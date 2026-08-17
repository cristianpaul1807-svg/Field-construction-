import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useApi } from "@/lib/api";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "fsm-selected-project-id";

interface ProjectOption {
  id: string;
  name: string;
}

interface SelectedProjectContextValue {
  projects: ProjectOption[];
  projectsLoading: boolean;
  /** Set when the list could not be read at all — which is not "no projects". */
  projectsError: string | null;
  selectedProjectId: string | null;
  selectedProject: ProjectOption | null;
  setSelectedProjectId: (id: string | null) => void;
  reloadProjects: () => void;
}

const SelectedProjectContext = createContext<SelectedProjectContextValue | null>(null);

export function SelectedProjectProvider({ children }: { children: ReactNode }) {
  // This provider sits outside the auth gate, so on a cold start it mounts
  // before anyone is signed in — and the request went out with no token,
  // came back 401, and left the switcher saying "no projects yet" for the
  // rest of the session. On a phone that is permanent: the app opens already
  // focused, so the focus listener below never fires to correct it.
  //
  // Keyed by the session's user so the request is made once there is one, and
  // made again for whoever signs in next.
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const {
    data: projects,
    loading: fetching,
    error: projectsError,
    reload: reloadProjects,
  } = useApi<ProjectOption[]>(userId ? `/api/projects?u=${userId}` : null);

  // Still loading while auth is settling: an empty list at that moment is
  // "we do not know yet", and saying "no projects" would be a guess.
  const projectsLoading = authLoading || (Boolean(userId) && fetching);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  // Drop the stored selection if that project no longer exists.
  useEffect(() => {
    if (!projects || !selectedProjectId) return;
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [projects, selectedProjectId]);

  // The list is fetched once at mount, so a project created afterwards —
  // by accepting an estimate, or on another tab — left the switcher claiming
  // there were no projects while the Projects page listed one. Refetching
  // when the window regains focus catches every case the explicit reload
  // calls miss.
  useEffect(() => {
    const refresh = () => reloadProjects();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [reloadProjects]);

  const setSelectedProjectId = (id: string | null) => {
    setSelectedProjectIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const selectedProject = projects?.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <SelectedProjectContext.Provider
      value={{
        projects: projects ?? [],
        projectsLoading,
        projectsError,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
        reloadProjects,
      }}
    >
      {children}
    </SelectedProjectContext.Provider>
  );
}

export function useSelectedProject() {
  const ctx = useContext(SelectedProjectContext);
  if (!ctx) throw new Error("useSelectedProject must be used within SelectedProjectProvider");
  return ctx;
}
