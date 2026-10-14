import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCodeStyling, { type FileExtension } from 'qr-code-styling';
import { buildStyledQrOptions, type QrVisualStyle } from '../lib/qrStyle';

export type StyledQrExtension = Extract<FileExtension, 'svg' | 'png'>;

export type StyledQrHandle = {
  getCachedFile: (extension: StyledQrExtension) => File | null;
  getFile: (extension: StyledQrExtension) => Promise<File | null>;
};

type StyledQrProps = {
  data: string;
  style: QrVisualStyle;
  size?: number;
  fileName?: string;
  className?: string;
};

type ExportCache = Partial<Record<StyledQrExtension, Blob>>;
type ExportPending = Partial<Record<StyledQrExtension, Promise<Blob | null>>>;

const MIME_TYPES: Record<StyledQrExtension, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
};

const StyledQr = forwardRef<StyledQrHandle, StyledQrProps>(function StyledQr(
  { data, style, size = 232, fileName = 'qr-code', className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const exportCacheRef = useRef<ExportCache>({});
  const exportPendingRef = useRef<ExportPending>({});

  const toFile = (blob: Blob, extension: StyledQrExtension) =>
    new File([blob], `${fileName}.${extension}`, { type: blob.type || MIME_TYPES[extension] });

  const getExportBlob = async (extension: StyledQrExtension): Promise<Blob | null> => {
    const cached = exportCacheRef.current[extension];
    if (cached) return cached;

    const pending = exportPendingRef.current[extension];
    if (pending) return pending;

    const qr = qrRef.current;
    if (!qr || !data) return null;

    const promise = qr
      .getRawData(extension)
      .then((raw) => {
        if (!(raw instanceof Blob) || qrRef.current !== qr) return null;
        exportCacheRef.current[extension] = raw;
        return raw;
      })
      .catch(() => null)
      .finally(() => {
        if (exportPendingRef.current[extension] === promise) delete exportPendingRef.current[extension];
      });

    exportPendingRef.current[extension] = promise;
    return promise;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren();
    qrRef.current = null;
    exportCacheRef.current = {};
    exportPendingRef.current = {};
    if (!data) return;

    const qr = new QRCodeStyling(buildStyledQrOptions(data, style, size));
    qr.append(container);
    qrRef.current = qr;

    // Warm both export formats so native mobile sharing can begin during the
    // user's tap instead of waiting for an asynchronous canvas/SVG conversion.
    void getExportBlob('png');
    void getExportBlob('svg');

    return () => {
      container.replaceChildren();
      if (qrRef.current === qr) qrRef.current = null;
      exportCacheRef.current = {};
      exportPendingRef.current = {};
    };
  }, [data, style, size]);

  useImperativeHandle(
    ref,
    () => ({
      getCachedFile(extension) {
        const blob = exportCacheRef.current[extension];
        return blob ? toFile(blob, extension) : null;
      },
      async getFile(extension) {
        const blob = await getExportBlob(extension);
        return blob ? toFile(blob, extension) : null;
      },
    }),
    [data, fileName],
  );

  return <div className={className} ref={containerRef} aria-label="QR code" />;
});

export default StyledQr;
