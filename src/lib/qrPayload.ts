export type LocationMode = 'address' | 'coordinates';

export type QrType =
  | 'website'
  | 'phone'
  | 'address'
  | 'social'
  | 'email'
  | 'contact'
  | 'text'
  | 'mixed';


export const SAFE_TEXT_MAX_BYTES = 480;
export const SAFE_MIXED_MAX_BYTES = 720;
export const SAFE_MIXED_FIELD_MAX_BYTES = 280;
export const SAFE_MIXED_LABEL_MAX_BYTES = 80;
export const SAFE_DEFAULT_MAX_BYTES = 900;
export const MAX_MIXED_FIELDS = 8;

const utf8Encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length;
}

export function clampUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) return value;
  let output = '';
  let used = 0;
  for (const character of value) {
    const size = utf8ByteLength(character);
    if (used + size > maxBytes) break;
    output += character;
    used += size;
  }
  return output;
}

export function safePayloadLimit(type: QrType): number {
  if (type === 'text') return SAFE_TEXT_MAX_BYTES;
  if (type === 'mixed') return SAFE_MIXED_MAX_BYTES;
  return SAFE_DEFAULT_MAX_BYTES;
}

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'telegram'
  | 'whatsapp'
  | 'other';

export type ContactData = {
  fullName: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  socialLinks: string[];
};

export type MixedFieldType = 'title' | 'text' | 'phone' | 'email' | 'website' | 'address' | 'social' | 'custom';
export type MixedOutputFormat = 'text' | 'json';

export type MixedField = {
  id: string;
  type: MixedFieldType;
  label: string;
  value: string;
};

export type MixedData = {
  format: MixedOutputFormat;
  fields: MixedField[];
};

export type QrFormState = {
  type: QrType;
  website: string;
  phone: string;
  address: string;
  locationMode: LocationMode;
  latitude: string;
  longitude: string;
  socialPlatform: SocialPlatform;
  socialProfile: string;
  email: string;
  text: string;
  contact: ContactData;
  mixed: MixedData;
};

const PLATFORM_BASE: Record<Exclude<SocialPlatform, 'other' | 'whatsapp'>, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://linkedin.com/in/',
  x: 'https://x.com/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/@',
  telegram: 'https://t.me/',
};

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidUrl(value: string): boolean {
  try {
    const normalized = normalizeUrl(value);
    if (!normalized) return false;
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}


export function parseLatitude(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90 ? parsed : null;
}

export function parseLongitude(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180 ? parsed : null;
}

export function hasValidCoordinates(latitude: string, longitude: string): boolean {
  return parseLatitude(latitude) !== null && parseLongitude(longitude) !== null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export function buildSocialUrl(platform: SocialPlatform, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) return normalizeUrl(trimmed);

  const handle = trimmed.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  if (platform === 'other') return normalizeUrl(trimmed);
  if (platform === 'whatsapp') {
    const digits = trimmed.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  }
  return `${PLATFORM_BASE[platform]}${handle}`;
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function normalizeSocialLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return normalizeUrl(trimmed);
}

export function buildVCard(contact: ContactData): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (contact.fullName.trim()) {
    lines.push(`FN:${escapeVCard(contact.fullName.trim())}`);
    lines.push(`N:${escapeVCard(contact.fullName.trim())};;;;`);
  }
  if (contact.company.trim()) lines.push(`ORG:${escapeVCard(contact.company.trim())}`);
  if (contact.phone.trim()) lines.push(`TEL;TYPE=CELL:${escapeVCard(contact.phone.trim())}`);
  if (contact.email.trim()) lines.push(`EMAIL:${escapeVCard(contact.email.trim())}`);
  if (contact.address.trim()) lines.push(`ADR;TYPE=HOME:;;${escapeVCard(contact.address.trim())};;;;`);
  if (contact.website.trim() && isValidUrl(contact.website)) lines.push(`URL:${normalizeUrl(contact.website)}`);

  contact.socialLinks
    .map(normalizeSocialLink)
    .filter(Boolean)
    .forEach((url) => lines.push(`X-SOCIALPROFILE:${url}`));

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function normalizeMixedValue(field: MixedField): string {
  const value = field.value.trim();
  if (!value) return '';

  switch (field.type) {
    case 'website':
      return isValidUrl(value) ? normalizeUrl(value) : value;
    case 'email':
      return value;
    case 'phone':
      return value.replace(/\s+/g, ' ');
    default:
      return value;
  }
}

export function buildMixedPayload(mixed: MixedData): string {
  const fields = mixed.fields
    .map((field) => ({
      ...field,
      label: field.label.trim(),
      value: normalizeMixedValue(field),
    }))
    .filter((field) => field.value);

  if (!fields.length) return '';

  if (mixed.format === 'json') {
    return JSON.stringify(
      fields.map(({ type, label, value }) => ({ type, ...(label ? { label } : {}), value })),
      null,
      2,
    );
  }

  return fields
    .map((field) => {
      if (field.type === 'title') return field.value;
      if (field.label) return `${field.label}:\n${field.value}`;
      return field.value;
    })
    .join('\n\n');
}

export function buildPayload(state: QrFormState): string {
  switch (state.type) {
    case 'website':
      return isValidUrl(state.website) ? normalizeUrl(state.website) : '';
    case 'phone':
      return isValidPhone(state.phone) ? `tel:${state.phone.trim().replace(/\s+/g, '')}` : '';
    case 'address': {
      if (state.locationMode === 'coordinates') {
        const latitude = parseLatitude(state.latitude);
        const longitude = parseLongitude(state.longitude);
        return latitude !== null && longitude !== null ? `geo:${latitude},${longitude}` : '';
      }
      return state.address.trim() ? `geo:0,0?q=${encodeURIComponent(state.address.trim())}` : '';
    }
    case 'social':
      return buildSocialUrl(state.socialPlatform, state.socialProfile);
    case 'email':
      return isValidEmail(state.email) ? `mailto:${state.email.trim()}` : '';
    case 'text':
      return state.text.trim();
    case 'mixed':
      return buildMixedPayload(state.mixed);
    case 'contact': {
      const c = state.contact;
      const hasAny = Boolean(
        c.fullName.trim() ||
          c.company.trim() ||
          c.phone.trim() ||
          c.email.trim() ||
          c.address.trim() ||
          c.website.trim() ||
          c.socialLinks.some((x) => x.trim()),
      );
      return hasAny ? buildVCard(c) : '';
    }
    default:
      return '';
  }
}
