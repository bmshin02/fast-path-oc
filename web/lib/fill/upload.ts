// Which files we accept, and the checks we run before accepting one.
//
// Accepted: PDF and Word (.docx). Older Word files (.doc) can be chosen, but
// we can't read them, so the user is told how to re-save them.
// Everything else is filtered out of the file picker and can't be dropped.

// Vercel caps a request body at 4.5 MB, and each turn sends the file to our
// server as base64, which is 4/3 the size. 3 MB becomes 4 MB, leaving room
// for the field list and conversation. City forms are usually well below 1 MB.
export const MAX_UPLOAD_MB = 3;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const TOO_LARGE_MESSAGE = `That file is too large. Please use a file under ${MAX_UPLOAD_MB} MB.`;

export type UploadKind = "pdf" | "docx";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

/** For <input accept>: the picker greys out everything else. */
export const ACCEPT_ATTR = [".pdf", ".docx", ".doc", PDF_MIME, DOCX_MIME, DOC_MIME].join(",");

/**
 * While dragging, browsers expose only the MIME type, not the name.
 * Some systems report an empty type; let those through and check on drop.
 */
export function isAcceptableDragType(mime: string): boolean {
  return mime === "" || [PDF_MIME, DOCX_MIME, DOC_MIME].includes(mime);
}

function typeOf(file: File): UploadKind | "doc" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === PDF_MIME) return "pdf";
  if (name.endsWith(".docx") || file.type === DOCX_MIME) return "docx";
  if (name.endsWith(".doc") || file.type === DOC_MIME) return "doc";
  return null;
}

async function startsWith(file: File, bytes: number[]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, bytes.length).arrayBuffer());
  return bytes.every((b, i) => head[i] === b);
}

export type UploadCheck =
  | { ok: true; kind: UploadKind }
  | { ok: false; message: string };

export async function checkUpload(file: File): Promise<UploadCheck> {
  const kind = typeOf(file);

  // Only reachable if the picker's filter is bypassed (e.g. "All files" on
  // Windows) or a drag reported no type.
  if (!kind) {
    return { ok: false, message: `"${file.name}" can't be used. Choose a PDF or Word document.` };
  }
  if (kind === "doc") {
    return {
      ok: false,
      message: `"${file.name}" is an older Word file (.doc). Open it in Word, choose File, then Save As, and save it as a Word Document (.docx) or a PDF. Then upload that file.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: `"${file.name}" is empty. Choose a different file.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `"${file.name}" is ${mb} MB. Choose a file under ${MAX_UPLOAD_MB} MB.` };
  }

  // Check the file's first bytes so a renamed file can't slip through.
  // PDFs start with "%PDF-"; .docx files are zip archives starting "PK\3\4".
  const real =
    kind === "pdf"
      ? await startsWith(file, [0x25, 0x50, 0x44, 0x46, 0x2d])
      : await startsWith(file, [0x50, 0x4b, 0x03, 0x04]);
  if (!real) {
    const what = kind === "pdf" ? "PDF" : "Word document";
    return {
      ok: false,
      message: `"${file.name}" can't be opened as a ${what}. Try saving it again from the program that made it.`,
    };
  }

  return { ok: true, kind };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
