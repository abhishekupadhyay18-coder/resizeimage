export interface ShareFile {
  name: string;
  blob: Blob;
}

/** Trigger a browser download for a blob. */
export function downloadOne(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Download several files one by one (no zip), staggered so browsers don't block them. */
export async function downloadAll(files: ShareFile[]) {
  for (let i = 0; i < files.length; i++) {
    downloadOne(files[i].blob, files[i].name);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 350));
  }
}

export function canShareFiles(files: ShareFile[]) {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
  try {
    const fs = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
    return navigator.canShare({ files: fs });
  } catch {
    return false;
  }
}

/** Share files through the device share sheet. Returns false when unsupported. */
export async function shareAll(files: ShareFile[], title = "Compressed images") {
  if (!canShareFiles(files)) return false;
  const fs = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
  try {
    await navigator.share({ files: fs, title });
    return true;
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return true;
    return false;
  }
}
