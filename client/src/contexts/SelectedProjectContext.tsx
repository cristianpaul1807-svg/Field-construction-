import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useApi } from "@/lib/api";

const STORAGE_KEY = "fsm-selected-project-id";

interface ProjectOption {
  id: string;
  name: string;
}

interface SelectedProjectContextValue {
  projects: ProjectOption[];
  projectsLoading: boolean;
  selectedProjectId: string | null;
  selectedProject: ProjectOption | null;
  setSelectedProjectId: (id: string | null) => void;
  reloadProjects: () => void;
}

const SelectedProjectContext = createContext<SelectedProjectContextValue | null>(null);

export function SelectedProjectProvider({ children }: { children: ReactNode }) {
  const { data: projects, loading: projectsLoading, reload: reloadProjects } = useApi<ProjectOption[]>("/api/projects");
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
