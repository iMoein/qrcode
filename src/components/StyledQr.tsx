import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCodeStyling, { type FileExtension } from 'qr-code-styling';
import { buildStyledQrOptions, type QrVisualStyle } from '../lib/qrStyle';

export type StyledQrHandle = {
  download: (extension: Extract<FileExtension, 'svg' | 'png'>) => Promise<void>;
};

type StyledQrProps = {
  data: string;
  style: QrVisualStyle;
  size?: number;
  fileName?: string;
  className?: string;
};

const StyledQr = forwardRef<StyledQrHandle, StyledQrProps>(function StyledQr(
  { data, style, size = 232, fileName = 'qr-code', className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren();
    qrRef.current = null;
    if (!data) return;

    const qr = new QRCodeStyling(buildStyledQrOptions(data, style, size));
    qr.append(container);
    qrRef.current = qr;

    return () => {
      container.replaceChildren();
      if (qrRef.current === qr) qrRef.current = null;
    };
  }, [data, style, size]);

  useImperativeHandle(
    ref,
    () => ({
      async download(extension) {
        if (!qrRef.current || !data) return;
        await qrRef.current.download({ name: fileName, extension });
      },
    }),
    [data, fileName],
  );

  return <div className={className} ref={containerRef} aria-label="QR code" />;
});

export default StyledQr;
