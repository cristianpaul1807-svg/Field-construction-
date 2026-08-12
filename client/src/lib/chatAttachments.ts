import { apiFetch, readJson, downloadFile } from "@/lib/api";
import { workerApiFetch } from "@/lib/workerSession";
import type { ChatMessage } from "@/lib/chatApi";

export type ChatPrefix = "" | "/client" | "/worker";

// A worker carries an access code in localStorage, not a Supabase session, so
// apiFetch would send no Authorization header at all and the request would
// come back 401. Which fetcher to use follows from the namespace.
const fetcherFor = (prefix: ChatPrefix) => (prefix === "/worker" ? workerApiFetch : apiFetch);

/**
 * Opens a message's attachment, whichever kind it is.
 *
 * An estimate or an invoice is stored as a reference, not a copy, so it is
 * rendered from the live row at the moment somebody opens it — a customer
 * reading their estimate six months later gets what the system actually
 * holds, not a snapshot that quietly disagrees with it. Uploaded files
 * resolve to a short-lived signed URL instead.
 *
 * `prefix` is the caller's own API namespace, because the panel, the portal
 * and the field app each prove differently that a conversation is theirs.
 */
export async function openChatAttachment(
  message: ChatMessage,
  prefix: ChatPrefix,
  lang: string
): Promise<void> {
  if (!message.attachment) return;

  const res = await fetcherFor(prefix)(`/api${prefix}/chat/messages/${message.id}/attachment`);
  const body = await readJson<{ kind?: string; url?: string; documentId?: string; name?: string }>(res);
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error || "No se pudo abrir el adjunto");
  }

  const filename = body.name ?? message.attachment.name ?? "documento";

  if (body.kind === "estimate" || body.kind === "invoice") {
    // The portal has its own document routes; the panel has the business ones.
    const documentPath =
      prefix === "/client"
        ? `/api/client-portal/${body.kind === "estimate" ? "estimates" : "invoices"}/${body.documentId}/pdf`
        : `/api/${body.kind === "estimate" ? "estimates" : "invoices"}/${body.documentId}/pdf?download=1`;
    await downloadFile(`${documentPath}${documentPath.includes("?") ? "&" : "?"}lang=${lang.slice(0, 2)}`, filename);
    return;
  }

  if (body.url) {
    // A signed URL is already authenticated, so it opens directly.
    window.open(body.url, "_blank", "noopener");
  }
}

/** Uploads a file into a conversation. Returns nothing; the caller reloads. */
export async function sendChatAttachment(
  channelId: string,
  file: File,
  prefix: ChatPrefix
): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  // No Content-Type header: the browser sets the multipart boundary itself.
  const res = await fetcherFor(prefix)(`/api${prefix}/chat/channels/${channelId}/attachments`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res);
    throw new Error(err?.error || "No se pudo enviar el archivo");
  }
}
