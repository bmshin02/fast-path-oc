// Checks a file the user picked before we accept it.

// Vercel caps a request body at 4.5 MB, and step 5 sends the PDF to our
// server, so stay under that. City forms are usually well below 1 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function checkUpload(file: File): Promise<string | null> {
  const looksLikePdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    return `"${file.name}" isn't a PDF. Choose a PDF file, the kind that ends in .pdf.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty. Choose a different file.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `"${file.name}" is ${mb} MB. Choose a PDF under 4 MB.`;
  }
  // Every real PDF starts with "%PDF-", so this catches renamed files.
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") {
    return `"${file.name}" ends in .pdf but isn't a readable PDF. Try saving it again as a PDF.`;
  }
  return null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
