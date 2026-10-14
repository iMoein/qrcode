import type { CornerDotType, CornerSquareType, DotType, Gradient, Options, ShapeType } from 'qr-code-styling';

export type QrColorMode = 'solid' | 'gradient';
export type QrPresetId = 'classic' | 'soft' | 'dots' | 'classy' | 'circle' | 'gradient';

export type QrVisualStyle = {
  shape: ShapeType;
  dots: DotType;
  cornerSquare: CornerSquareType;
  cornerDot: CornerDotType;
  colorMode: QrColorMode;
  foreground: string;
  gradientEnd: string;
  gradientAngle: number;
  background: string;
  eyeColor: string;
  margin: number;
  logoDataUrl: string;
  logoSize: number;
};

export const DEFAULT_QR_STYLE: QrVisualStyle = {
  shape: 'square',
  dots: 'square',
  cornerSquare: 'square',
  cornerDot: 'square',
  colorMode: 'solid',
  foreground: '#111827',
  gradientEnd: '#0f766e',
  gradientAngle: 45,
  background: '#ffffff',
  eyeColor: '#111827',
  margin: 10,
  logoDataUrl: '',
  logoSize: 0.28,
};

export const QR_STYLE_PRESETS: Record<QrPresetId, Partial<QrVisualStyle>> = {
  classic: {
    shape: 'square',
    dots: 'square',
    cornerSquare: 'square',
    cornerDot: 'square',
    colorMode: 'solid',
    foreground: '#111827',
    background: '#ffffff',
    eyeColor: '#111827',
  },
  soft: {
    shape: 'square',
    dots: 'rounded',
    cornerSquare: 'extra-rounded',
    cornerDot: 'dot',
    colorMode: 'solid',
    foreground: '#1f2937',
    background: '#ffffff',
    eyeColor: '#111827',
  },
  dots: {
    shape: 'square',
    dots: 'dots',
    cornerSquare: 'extra-rounded',
    cornerDot: 'dot',
    colorMode: 'solid',
    foreground: '#26324a',
    background: '#ffffff',
    eyeColor: '#111827',
  },
  classy: {
    shape: 'square',
    dots: 'classy-rounded',
    cornerSquare: 'classy-rounded',
    cornerDot: 'dot',
    colorMode: 'solid',
    foreground: '#312e81',
    background: '#ffffff',
    eyeColor: '#312e81',
  },
  circle: {
    shape: 'circle',
    dots: 'dots',
    cornerSquare: 'dot',
    cornerDot: 'dot',
    colorMode: 'solid',
    foreground: '#172554',
    background: '#ffffff',
    eyeColor: '#172554',
  },
  gradient: {
    shape: 'square',
    dots: 'rounded',
    cornerSquare: 'extra-rounded',
    cornerDot: 'dot',
    colorMode: 'gradient',
    foreground: '#5a4bff',
    gradientEnd: '#0f9f8f',
    gradientAngle: 35,
    background: '#ffffff',
    eyeColor: '#3529b7',
  },
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function buildStyledQrOptions(data: string, style: QrVisualStyle, size: number): Options {
  const gradient: Gradient = {
    type: 'linear',
    rotation: toRadians(style.gradientAngle),
    colorStops: [
      { offset: 0, color: style.foreground },
      { offset: 1, color: style.gradientEnd },
    ],
  };

  return {
    width: size,
    height: size,
    type: 'svg',
    shape: style.shape,
    data,
    margin: style.margin,
    image: style.logoDataUrl || undefined,
    qrOptions: {
      errorCorrectionLevel: style.logoDataUrl ? 'H' : 'M',
    },
    dotsOptions: {
      type: style.dots,
      ...(style.colorMode === 'gradient' ? { gradient } : { color: style.foreground }),
    },
    cornersSquareOptions: {
      type: style.cornerSquare,
      color: style.eyeColor,
    },
    cornersDotOptions: {
      type: style.cornerDot,
      color: style.eyeColor,
    },
    backgroundOptions: {
      color: style.background,
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: style.logoSize,
      margin: 4,
    },
  };
}
