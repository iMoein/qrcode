export type DownloadExtension = 'svg' | 'png';

export function isLikelyMobileDevice() {
  return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
}

function canShareFile(file: File) {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openBlobPreview(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function savePortableFile(file: File, title: string) {
  const mobile = isLikelyMobileDevice();

  if (mobile && canShareFile(file)) {
    const shareResult = await shareFile(file, title);
    if (shareResult === 'shared' || shareResult === 'cancelled') return;
  }

  // Mobile browsers that cannot share files get a real Blob preview, which is
  // more reliable than synthetic data-URL downloads and exposes native save/share actions.
  if (mobile && openBlobPreview(file)) return;

  downloadBlob(file, file.name);
}
