export type DownloadVariant = 'a' | 'b';
export type DownloadExtension = 'svg' | 'png';
export type DownloadOutcome =
  | 'legacy-invoked'
  | 'shared'
  | 'share-cancelled'
  | 'blob-download'
  | 'opened-preview'
  | 'failed';

const VARIANT_KEY = 'qr-download-variant-v1';
const METRICS_KEY = 'qr-download-experiment-v1';
const MAX_EVENTS = 40;

export type DownloadExperimentEvent = {
  at: string;
  variant: DownloadVariant;
  extension: DownloadExtension;
  outcome: DownloadOutcome;
  mobile: boolean;
};

export function resolveDownloadVariant(): DownloadVariant {
  const override = new URLSearchParams(window.location.search).get('downloadVariant')?.toLowerCase();
  if (override === 'a' || override === 'b') return override;

  const saved = localStorage.getItem(VARIANT_KEY);
  if (saved === 'a' || saved === 'b') return saved;

  let variant: DownloadVariant;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const sample = new Uint32Array(1);
    crypto.getRandomValues(sample);
    variant = sample[0] % 2 === 0 ? 'a' : 'b';
  } else {
    variant = Math.random() < 0.5 ? 'a' : 'b';
  }
  localStorage.setItem(VARIANT_KEY, variant);
  return variant;
}

export function isLikelyMobileDevice() {
  return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
}

export function canShareFile(file: File) {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
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

export function openBlobPreview(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export function recordDownloadExperiment(event: Omit<DownloadExperimentEvent, 'at'>) {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    const current = raw ? (JSON.parse(raw) as DownloadExperimentEvent[]) : [];
    const next = [...current, { ...event, at: new Date().toISOString() }].slice(-MAX_EVENTS);
    localStorage.setItem(METRICS_KEY, JSON.stringify(next));
  } catch {
    // Download behavior must never depend on local experiment storage.
  }
}
