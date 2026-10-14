import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import QRCode from 'react-qr-code';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Check,
  ContactRound,
  Copy,
  Download,
  FileText,
  Globe2,
  ImagePlus,
  Languages,
  Monitor,
  Moon,
  Layers3,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  Palette,
  Phone,
  Plus,
  QrCode,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sun,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { languages, translations, type Language, type TranslationKey } from './i18n';
import SelectMenu, { type SelectMenuOption } from './components/SelectMenu';
import StyledQr, { type StyledQrHandle } from './components/StyledQr';
import LocationPickerMap from './components/LocationPickerMap';
import { DEFAULT_QR_STYLE, QR_STYLE_PRESETS, type QrPresetId, type QrVisualStyle } from './lib/qrStyle';
import {
  canShareFile,
  downloadBlob,
  isLikelyMobileDevice,
  openBlobPreview,
  recordDownloadExperiment,
  resolveDownloadVariant,
  shareFile,
  type DownloadExtension,
  type DownloadOutcome,
  type DownloadVariant,
} from './lib/downloadExperiment';
import {
  buildPayload,
  clampUtf8,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  hasValidCoordinates,
  parseLatitude,
  parseLongitude,
  MAX_MIXED_FIELDS,
  SAFE_MIXED_FIELD_MAX_BYTES,
  SAFE_MIXED_LABEL_MAX_BYTES,
  SAFE_MIXED_MAX_BYTES,
  SAFE_TEXT_MAX_BYTES,
  safePayloadLimit,
  utf8ByteLength,
  normalizeUrl,
  type ContactData,
  type MixedField,
  type MixedFieldType,
  type LocationMode,
  type QrFormState,
  type QrType,
  type SocialPlatform,
} from './lib/qrPayload';

type WizardStep = 1 | 2 | 3 | 4;
type ThemeMode = 'auto' | 'light' | 'dark';
type GeolocationStatus = 'idle' | 'loading' | 'success' | 'denied' | 'unavailable' | 'error' | 'unsupported';

type TypeOption = {
  value: QrType;
  label: TranslationKey;
  icon: typeof Globe2;
};

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'website', label: 'typeWebsite', icon: Globe2 },
  { value: 'phone', label: 'typePhone', icon: Phone },
  { value: 'address', label: 'typeAddress', icon: MapPin },
  { value: 'social', label: 'typeSocial', icon: Share2 },
  { value: 'email', label: 'typeEmail', icon: Mail },
  { value: 'contact', label: 'typeContact', icon: ContactRound },
  { value: 'text', label: 'typeText', icon: FileText },
  { value: 'mixed', label: 'typeMixed', icon: Layers3 },
];

const SOCIAL_PLATFORMS: Array<{ value: SocialPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];

const MIXED_TYPES: Array<{ value: MixedFieldType; label: TranslationKey }> = [
  { value: 'title', label: 'fieldTitle' },
  { value: 'text', label: 'fieldText' },
  { value: 'phone', label: 'fieldPhone' },
  { value: 'email', label: 'fieldEmail' },
  { value: 'website', label: 'fieldWebsite' },
  { value: 'address', label: 'fieldAddress' },
  { value: 'social', label: 'fieldSocial' },
  { value: 'custom', label: 'fieldCustom' },
];

const PRESET_OPTIONS: Array<{ value: QrPresetId; label: TranslationKey }> = [
  { value: 'classic', label: 'presetClassic' },
  { value: 'soft', label: 'presetSoft' },
  { value: 'dots', label: 'presetDots' },
  { value: 'classy', label: 'presetClassy' },
  { value: 'circle', label: 'presetCircle' },
  { value: 'gradient', label: 'presetGradient' },
];

const initialContact: ContactData = {
  fullName: '',
  company: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  socialLinks: [''],
};

const initialForm: QrFormState = {
  type: 'website',
  website: '',
  phone: '',
  address: '',
  locationMode: 'address',
  latitude: '',
  longitude: '',
  socialPlatform: 'instagram',
  socialProfile: '',
  email: '',
  text: '',
  contact: initialContact,
  mixed: { format: 'text', fields: [] },
};

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function copyWithFallback(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

function hasArabicScript(value: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(value);
}

function scriptFontClass(value: string) {
  return hasArabicScript(value) ? 'font-vazirmatn' : '';
}

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem('qr-theme') as ThemeMode | null;
  return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
}

function initialLanguage(): Language {
  const fromQuery = new URLSearchParams(window.location.search).get('lang') as Language | null;
  if (fromQuery && languages.some((item) => item.code === fromQuery)) return fromQuery;

  const saved = localStorage.getItem('qr-language') as Language | null;
  if (saved && languages.some((item) => item.code === saved)) return saved;

  const browser = navigator.language.toLowerCase();
  const match = languages.find((item) => browser === item.code || browser.startsWith(`${item.code}-`));
  return match?.code ?? 'en';
}

function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [step, setStep] = useState<WizardStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<WizardStep>(1);
  const [typeConfirmed, setTypeConfirmed] = useState(false);
  const [form, setForm] = useState<QrFormState>(initialForm);
  const [qrStyle, setQrStyle] = useState<QrVisualStyle>(DEFAULT_QR_STYLE);
  const [activePreset, setActivePreset] = useState<QrPresetId>('classic');
  const [pageUrl] = useState(() => window.location.href.split('#')[0]);
  const [copiedTarget, setCopiedTarget] = useState<'payload' | 'page' | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>('idle');
  const [geolocationAccuracy, setGeolocationAccuracy] = useState<number | null>(null);
  const [downloadVariant] = useState<DownloadVariant>(resolveDownloadVariant);

  const styledQrRef = useRef<StyledQrHandle>(null);
  const pageQrRef = useRef<HTMLDivElement>(null);
  const geolocationRequestedRef = useRef(false);

  const t = (key: TranslationKey) => translations[language][key];
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];
  const payload = useMemo(() => buildPayload(form), [form]);
  const payloadBytes = useMemo(() => utf8ByteLength(payload), [payload]);
  const payloadLimit = safePayloadLimit(form.type);
  const payloadTooLarge = payloadBytes > payloadLimit;
  const scannablePayload = payloadTooLarge ? '' : payload;
  const normalizedPageUrl = useMemo(() => (isValidUrl(pageUrl) ? normalizeUrl(pageUrl) : ''), [pageUrl]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = currentLanguage.dir;
    document.title = t('metaTitle');
    localStorage.setItem('qr-language', language);

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (description) description.content = t('metaDescription');
    if (ogTitle) ogTitle.content = t('metaTitle');
    if (ogDescription) ogDescription.content = t('metaDescription');
    if (twitterTitle) twitterTitle.content = t('metaTitle');
    if (twitterDescription) twitterDescription.content = t('metaDescription');

    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [language, currentLanguage.dir]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const resolvedTheme = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themeMode = themeMode;
    document.documentElement.style.colorScheme = resolvedTheme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = resolvedTheme === 'dark' ? '#0a0d14' : '#f6f7fb';
    localStorage.setItem('qr-theme', themeMode);
  }, [themeMode, systemDark]);

  useEffect(() => {
    if (!copiedTarget) return;
    const timer = window.setTimeout(() => setCopiedTarget(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedTarget]);

  useEffect(() => {
    if (!scannablePayload && maxStepReached > 2) {
      setMaxStepReached(2);
      if (step > 2) setStep(2);
    }
  }, [scannablePayload, maxStepReached, step]);

  const languageOptions: SelectMenuOption[] = languages.map((item) => ({
    value: item.code,
    label: item.nativeName,
    meta: item.short,
    lang: item.code,
    dir: item.dir,
  }));

  const socialOptions: SelectMenuOption[] = SOCIAL_PLATFORMS.map((item) => ({
    value: item.value,
    label: item.value === 'other' ? t('platformOther') : item.label,
  }));

  const mixedTypeOptions: SelectMenuOption[] = MIXED_TYPES.map((item) => ({ value: item.value, label: t(item.label) }));
  const mixedFormatOptions: SelectMenuOption[] = [
    { value: 'text', label: t('mixedFormatText') },
    { value: 'json', label: t('mixedFormatJson') },
  ];
  const shapeOptions: SelectMenuOption[] = [
    { value: 'square', label: t('optionSquare') },
    { value: 'circle', label: t('optionCircle') },
  ];
  const dotOptions: SelectMenuOption[] = [
    { value: 'square', label: t('optionSquare') },
    { value: 'rounded', label: t('optionRounded') },
    { value: 'dots', label: t('optionDots') },
    { value: 'classy', label: t('optionClassy') },
    { value: 'classy-rounded', label: t('optionClassyRounded') },
    { value: 'extra-rounded', label: t('optionExtraRounded') },
  ];
  const cornerSquareOptions: SelectMenuOption[] = [
    { value: 'square', label: t('optionSquare') },
    { value: 'rounded', label: t('optionRounded') },
    { value: 'extra-rounded', label: t('optionExtraRounded') },
    { value: 'dot', label: t('optionDot') },
    { value: 'classy-rounded', label: t('optionClassyRounded') },
  ];
  const cornerDotOptions: SelectMenuOption[] = [
    { value: 'square', label: t('optionSquare') },
    { value: 'rounded', label: t('optionRounded') },
    { value: 'extra-rounded', label: t('optionExtraRounded') },
    { value: 'dot', label: t('optionDot') },
  ];

  const steps = [
    { id: 1 as const, label: t('stepType'), icon: Layers3 },
    { id: 2 as const, label: t('stepContent'), icon: FileText },
    { id: 3 as const, label: t('stepStyle'), icon: Palette },
    { id: 4 as const, label: t('stepExport'), icon: BadgeCheck },
  ];

  const setDeviceCoordinates = (latitude: number, longitude: number, accuracy?: number | null) => {
    setForm((current) => ({
      ...current,
      locationMode: 'coordinates' as LocationMode,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));
    setGeolocationAccuracy(typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null);
    setGeolocationStatus('success');
  };

  const requestCurrentLocation = (force = false) => {
    if (!('geolocation' in navigator)) {
      setGeolocationStatus('unsupported');
      return;
    }
    if (!force && geolocationRequestedRef.current) return;

    geolocationRequestedRef.current = true;
    setForm((current) => ({ ...current, locationMode: 'coordinates' as LocationMode }));
    setGeolocationStatus('loading');
    setGeolocationAccuracy(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceCoordinates(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGeolocationStatus('denied');
        else if (error.code === error.POSITION_UNAVAILABLE) setGeolocationStatus('unavailable');
        else setGeolocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const createMixedField = (type: MixedFieldType = 'text'): MixedField => {
    const option = MIXED_TYPES.find((item) => item.value === type);
    return { id: newId(), type, label: type === 'title' ? '' : option ? t(option.label) : '', value: '' };
  };

  const selectType = (type: QrType) => {
    const typeChanged = form.type !== type;
    setTypeConfirmed(true);
    setMaxStepReached(2);
    setStep(2);

    setForm((current) => {
      if (type !== 'mixed' || current.mixed.fields.length) return { ...current, type };
      return {
        ...current,
        type,
        mixed: { ...current.mixed, fields: [createMixedField('title'), createMixedField('text')] },
      };
    });

    if (typeChanged) {
      setGeolocationStatus('idle');
      setGeolocationAccuracy(null);
    }
    if (type === 'address') requestCurrentLocation(false);
  };

  const updateContact = <K extends keyof ContactData>(key: K, value: ContactData[K]) => {
    setForm((current) => ({ ...current, contact: { ...current.contact, [key]: value } }));
  };

  const updateSocialLink = (index: number, value: string) => {
    const next = [...form.contact.socialLinks];
    next[index] = value;
    updateContact('socialLinks', next);
  };

  const addSocialLink = () => {
    if (form.contact.socialLinks.length >= 5) return;
    updateContact('socialLinks', [...form.contact.socialLinks, '']);
  };

  const removeSocialLink = (index: number) => {
    const next = form.contact.socialLinks.filter((_, itemIndex) => itemIndex !== index);
    updateContact('socialLinks', next.length ? next : ['']);
  };

  const addMixedField = () => {
    if (form.mixed.fields.length >= MAX_MIXED_FIELDS) return;
    setForm((current) => ({
      ...current,
      mixed: { ...current.mixed, fields: [...current.mixed.fields, createMixedField('text')] },
    }));
  };

  const updateMixedField = (id: string, patch: Partial<MixedField>) => {
    setForm((current) => ({
      ...current,
      mixed: {
        ...current.mixed,
        fields: current.mixed.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
      },
    }));
  };

  const changeMixedType = (field: MixedField, nextType: MixedFieldType) => {
    const option = MIXED_TYPES.find((item) => item.value === nextType);
    updateMixedField(field.id, {
      type: nextType,
      label: nextType === 'title' ? '' : option ? t(option.label) : field.label,
    });
  };

  const removeMixedField = (id: string) => {
    setForm((current) => ({
      ...current,
      mixed: { ...current.mixed, fields: current.mixed.fields.filter((field) => field.id !== id) },
    }));
  };

  const moveMixedField = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.mixed.fields.length) return current;
      const fields = [...current.mixed.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, mixed: { ...current.mixed, fields } };
    });
  };

  const updateQrStyle = <K extends keyof QrVisualStyle>(key: K, value: QrVisualStyle[K]) => {
    setQrStyle((current) => ({ ...current, [key]: value }));
    setActivePreset('classic');
  };

  const applyQrPreset = (preset: QrPresetId) => {
    setActivePreset(preset);
    setQrStyle((current) => ({ ...current, ...QR_STYLE_PRESETS[preset] }));
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setQrStyle((current) => ({ ...current, logoDataUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const copyValue = async (target: 'payload' | 'page', value: string) => {
    if (!value) return;
    await copyWithFallback(value);
    setCopiedTarget(target);
  };

  const runPortableDownload = async (file: File, extension: DownloadExtension): Promise<DownloadOutcome> => {
    const mobile = isLikelyMobileDevice();

    if (mobile && canShareFile(file)) {
      const shareResult = await shareFile(file, t('appName'));
      if (shareResult === 'shared') return 'shared';
      if (shareResult === 'cancelled') return 'share-cancelled';
    }

    // On touch-first browsers without file sharing, opening a real Blob URL is
    // more reliable than a synthetic data-URL download. It also gives iOS a
    // native preview from which the file can be saved or shared.
    if (mobile && openBlobPreview(file)) return 'opened-preview';

    try {
      downloadBlob(file, file.name);
      return 'blob-download';
    } catch {
      return 'failed';
    }
  };

  const recordDownload = (extension: DownloadExtension, outcome: DownloadOutcome) => {
    recordDownloadExperiment({
      variant: downloadVariant,
      extension,
      outcome,
      mobile: isLikelyMobileDevice(),
    });
  };

  const downloadStyledQr = async (extension: DownloadExtension) => {
    if (!scannablePayload || !styledQrRef.current) return;

    if (downloadVariant === 'a') {
      try {
        await styledQrRef.current.downloadLegacy(extension);
        recordDownload(extension, 'legacy-invoked');
      } catch {
        recordDownload(extension, 'failed');
      }
      return;
    }

    // The component warms both export files in the background. A cached File
    // lets navigator.share() start during the original tap, which matters on
    // mobile browsers that require transient user activation.
    const cachedFile = styledQrRef.current.getCachedFile(extension);
    const file = cachedFile ?? (await styledQrRef.current.getFile(extension));
    if (!file) {
      recordDownload(extension, 'failed');
      return;
    }

    const outcome = await runPortableDownload(file, extension);
    recordDownload(extension, outcome);
  };

  const downloadSvg = async (ref: RefObject<HTMLDivElement>, filename: string) => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${source}`], { type: 'image/svg+xml;charset=utf-8' });

    if (downloadVariant === 'a') {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      recordDownload('svg', 'legacy-invoked');
      return;
    }

    const file = new File([blob], filename, { type: 'image/svg+xml' });
    const outcome = await runPortableDownload(file, 'svg');
    recordDownload('svg', outcome);
  };

  const resetWizard = () => {
    setForm(initialForm);
    setQrStyle(DEFAULT_QR_STYLE);
    setActivePreset('classic');
    setTypeConfirmed(false);
    setMaxStepReached(1);
    setStep(1);
    setGeolocationStatus('idle');
    setGeolocationAccuracy(null);
    geolocationRequestedRef.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContentFields = () => {
    switch (form.type) {
      case 'website': {
        const showError = Boolean(form.website.trim()) && !isValidUrl(form.website);
        return (
          <div className="field-group">
            <label htmlFor="website">{t('website')}</label>
            <div className={`input-shell ${showError ? 'is-error' : ''}`}>
              <Globe2 aria-hidden="true" size={19} />
              <input id="website" dir="ltr" inputMode="url" autoComplete="url" value={form.website} placeholder={t('websitePlaceholder')} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
            </div>
            {showError && <p className="field-error">{t('validationUrl')}</p>}
          </div>
        );
      }
      case 'phone': {
        const showError = Boolean(form.phone.trim()) && !isValidPhone(form.phone);
        return (
          <div className="field-group">
            <label htmlFor="phone">{t('phone')}</label>
            <div className={`input-shell ${showError ? 'is-error' : ''}`}>
              <Phone aria-hidden="true" size={19} />
              <input id="phone" dir="ltr" inputMode="tel" autoComplete="tel" value={form.phone} placeholder={t('phonePlaceholder')} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            {showError && <p className="field-error">{t('validationPhone')}</p>}
          </div>
        );
      }
      case 'address': {
        const latitudeParsed = form.latitude.trim() ? parseLatitude(form.latitude) : null;
        const longitudeParsed = form.longitude.trim() ? parseLongitude(form.longitude) : null;
        const latitudeInvalid = Boolean(form.latitude.trim()) && latitudeParsed === null;
        const longitudeInvalid = Boolean(form.longitude.trim()) && longitudeParsed === null;
        const updateCoordinate = (key: 'latitude' | 'longitude', value: string) => {
          const cleaned = value.replace(',', '.').replace(/[^0-9+\-.]/g, '');
          setForm((current) => ({ ...current, [key]: cleaned }));
          setGeolocationStatus('idle');
          setGeolocationAccuracy(null);
        };
        return (
          <div className="location-content">
            <div className="location-mode-switch" role="group" aria-label={t('locationMethod')}>
              <button type="button" className={form.locationMode === 'address' ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, locationMode: 'address' as LocationMode }))}>
                <MapPin size={17} aria-hidden="true" />{t('locationByAddress')}
              </button>
              <button type="button" className={form.locationMode === 'coordinates' ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, locationMode: 'coordinates' as LocationMode }))}>
                <Globe2 size={17} aria-hidden="true" />{t('locationByCoordinates')}
              </button>
            </div>

            <div className={`current-location-card ${geolocationStatus === 'success' ? 'is-success' : ''} ${['denied', 'unavailable', 'error', 'unsupported'].includes(geolocationStatus) ? 'is-error' : ''}`}>
              <div className="current-location-copy">
                <span className="current-location-icon"><MapPin size={19} aria-hidden="true" /></span>
                <div>
                  <strong>{geolocationStatus === 'success' ? t('locationFound') : t('useMyLocation')}</strong>
                  <p>
                    {geolocationStatus === 'loading' && t('locating')}
                    {geolocationStatus === 'success' && (geolocationAccuracy !== null ? t('locationAccuracy').replace('{meters}', String(Math.round(geolocationAccuracy))) : t('locationFoundHint'))}
                    {geolocationStatus === 'denied' && t('locationPermissionDenied')}
                    {geolocationStatus === 'unavailable' && t('locationUnavailable')}
                    {geolocationStatus === 'error' && t('locationError')}
                    {geolocationStatus === 'unsupported' && t('locationUnsupported')}
                    {geolocationStatus === 'idle' && t('useMyLocationHint')}
                  </p>
                </div>
              </div>
              <button className="button button-secondary current-location-button" type="button" onClick={() => requestCurrentLocation(true)} disabled={geolocationStatus === 'loading'}>
                <RefreshCcw className={geolocationStatus === 'loading' ? 'is-spinning' : ''} size={17} aria-hidden="true" />
                {geolocationStatus === 'loading' ? t('locatingShort') : geolocationStatus === 'success' ? t('refreshLocation') : t('detectLocation')}
              </button>
            </div>

            {form.locationMode === 'address' ? (
              <div className="field-group">
                <label htmlFor="address">{t('address')}</label>
                <textarea id="address" dir="auto" className={scriptFontClass(form.address)} rows={4} autoComplete="street-address" value={form.address} placeholder={t('addressPlaceholder')} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                <p className="field-help">{t('addressModeHelp')}</p>
              </div>
            ) : (
              <div className="coordinate-layout">
                <div className="coordinate-entry">
                  <div className="field-grid two-columns">
                    <div className="field-group">
                      <label htmlFor="latitude">{t('latitude')}</label>
                      <div className={`input-shell ${latitudeInvalid ? 'is-error' : ''}`}>
                        <input id="latitude" dir="ltr" inputMode="decimal" value={form.latitude} placeholder="60.169900" onChange={(event) => updateCoordinate('latitude', event.target.value)} />
                      </div>
                      {latitudeInvalid && <p className="field-error">{t('latitudeError')}</p>}
                    </div>
                    <div className="field-group">
                      <label htmlFor="longitude">{t('longitude')}</label>
                      <div className={`input-shell ${longitudeInvalid ? 'is-error' : ''}`}>
                        <input id="longitude" dir="ltr" inputMode="decimal" value={form.longitude} placeholder="24.938400" onChange={(event) => updateCoordinate('longitude', event.target.value)} />
                      </div>
                      {longitudeInvalid && <p className="field-error">{t('longitudeError')}</p>}
                    </div>
                  </div>
                  <div className={`coordinate-status ${hasValidCoordinates(form.latitude, form.longitude) ? 'is-valid' : ''}`}>
                    <MapPin size={18} aria-hidden="true" />
                    <div><strong>{hasValidCoordinates(form.latitude, form.longitude) ? t('coordinatesReady') : t('coordinatesPrompt')}</strong><p>{t('coordinatesHelp')}</p></div>
                  </div>
                </div>
                <div className="map-picker-shell">
                  <div className="map-picker-heading"><div><strong>{t('pickOnMap')}</strong><p>{t('pickOnMapHelp')}</p></div><span>{t('mapPoweredBy')}</span></div>
                  <LocationPickerMap latitude={form.latitude} longitude={form.longitude} ariaLabel={t('mapAriaLabel')} onChange={(latitude, longitude) => { setForm((current) => ({ ...current, locationMode: 'coordinates' as LocationMode, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })); setGeolocationStatus('idle'); setGeolocationAccuracy(null); }} />
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'social':
        return (
          <div className="field-grid two-columns">
            <div className="field-group">
              <label>{t('socialPlatform')}</label>
              <SelectMenu value={form.socialPlatform} options={socialOptions} ariaLabel={t('socialPlatform')} onChange={(value) => setForm((current) => ({ ...current, socialPlatform: value as SocialPlatform }))} />
            </div>
            <div className="field-group">
              <label htmlFor="social-profile">{t('socialProfile')}</label>
              <div className="input-shell">
                <Share2 aria-hidden="true" size={19} />
                <input id="social-profile" dir="ltr" value={form.socialProfile} placeholder={t('socialPlaceholder')} onChange={(event) => setForm((current) => ({ ...current, socialProfile: event.target.value }))} />
              </div>
            </div>
          </div>
        );
      case 'email': {
        const showError = Boolean(form.email.trim()) && !isValidEmail(form.email);
        return (
          <div className="field-group">
            <label htmlFor="email">{t('email')}</label>
            <div className={`input-shell ${showError ? 'is-error' : ''}`}>
              <Mail aria-hidden="true" size={19} />
              <input id="email" dir="ltr" type="email" autoComplete="email" value={form.email} placeholder={t('emailPlaceholder')} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            {showError && <p className="field-error">{t('validationEmail')}</p>}
          </div>
        );
      }
      case 'text':
        return (
          <div className="field-group">
            <label htmlFor="free-text">{t('textLabel')}</label>
            <textarea id="free-text" dir="auto" className={`large-textarea ${scriptFontClass(form.text)}`} rows={8} value={form.text} placeholder={t('textPlaceholder')} onChange={(event) => setForm((current) => ({ ...current, text: clampUtf8(event.target.value, SAFE_TEXT_MAX_BYTES) }))} />
            <div className={`capacity-meter ${utf8ByteLength(form.text) >= SAFE_TEXT_MAX_BYTES * 0.8 ? 'is-warning' : ''}`}>
              <div className="capacity-copy"><span>{t('scanSafeSize')}</span><strong>{utf8ByteLength(form.text)} / {SAFE_TEXT_MAX_BYTES} {t('bytesUnit')}</strong></div>
              <div className="capacity-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (utf8ByteLength(form.text) / SAFE_TEXT_MAX_BYTES) * 100)}%` }} /></div>
              <p>{utf8ByteLength(form.text) >= SAFE_TEXT_MAX_BYTES ? t('textLimitReached') : t('textLimitHelp')}</p>
            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="contact-fields">
            <div className="field-grid two-columns">
              <div className="field-group"><label htmlFor="contact-name">{t('fullName')}</label><input id="contact-name" dir="auto" className={scriptFontClass(form.contact.fullName)} autoComplete="name" value={form.contact.fullName} placeholder={t('fullNamePlaceholder')} onChange={(event) => updateContact('fullName', event.target.value)} /></div>
              <div className="field-group"><label htmlFor="contact-company">{t('company')}</label><input id="contact-company" dir="auto" className={scriptFontClass(form.contact.company)} autoComplete="organization" value={form.contact.company} placeholder={t('companyPlaceholder')} onChange={(event) => updateContact('company', event.target.value)} /></div>
            </div>
            <div className="field-grid two-columns">
              <div className="field-group"><label htmlFor="contact-phone">{t('phone')}</label><input id="contact-phone" dir="ltr" autoComplete="tel" value={form.contact.phone} placeholder={t('phonePlaceholder')} onChange={(event) => updateContact('phone', event.target.value)} /></div>
              <div className="field-group"><label htmlFor="contact-email">{t('email')}</label><input id="contact-email" dir="ltr" type="email" autoComplete="email" value={form.contact.email} placeholder={t('emailPlaceholder')} onChange={(event) => updateContact('email', event.target.value)} /></div>
            </div>
            <div className="field-group"><label htmlFor="contact-address">{t('address')}</label><textarea id="contact-address" dir="auto" className={scriptFontClass(form.contact.address)} rows={3} value={form.contact.address} placeholder={t('addressPlaceholder')} onChange={(event) => updateContact('address', event.target.value)} /></div>
            <div className="field-group"><label htmlFor="contact-website">{t('website')}</label><input id="contact-website" dir="ltr" value={form.contact.website} placeholder={t('websitePlaceholder')} onChange={(event) => updateContact('website', event.target.value)} /></div>
            <div className="field-group">
              <div className="field-label-row"><label>{t('socialLinks')}</label><button type="button" className="text-button" onClick={addSocialLink} disabled={form.contact.socialLinks.length >= 5}><Plus size={16} aria-hidden="true" />{t('addSocial')}</button></div>
              <div className="repeat-stack">
                {form.contact.socialLinks.map((value, index) => (
                  <div className="repeat-row" key={index}>
                    <input dir="ltr" value={value} placeholder={t('socialLinkPlaceholder')} onChange={(event) => updateSocialLink(index, event.target.value)} />
                    <button type="button" className="icon-button danger" aria-label={t('remove')} onClick={() => removeSocialLink(index)}><Trash2 size={17} aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'mixed':
        return (
          <div className="mixed-builder">
            <p className="helper-copy">{t('mixedIntro')}</p>
            <div className={`capacity-meter ${payloadBytes >= SAFE_MIXED_MAX_BYTES * 0.8 ? 'is-warning' : ''} ${payloadTooLarge ? 'is-error' : ''}`}>
              <div className="capacity-copy"><span>{t('scanSafeSize')}</span><strong>{payloadBytes} / {SAFE_MIXED_MAX_BYTES} {t('bytesUnit')}</strong></div>
              <div className="capacity-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (payloadBytes / SAFE_MIXED_MAX_BYTES) * 100)}%` }} /></div>
              <p>{payloadTooLarge ? t('mixedLimitReached') : t('mixedLimitHelp')}</p>
            </div>
            <div className="field-group max-width-small">
              <label>{t('mixedOutputFormat')}</label>
              <SelectMenu value={form.mixed.format} options={mixedFormatOptions} ariaLabel={t('mixedOutputFormat')} onChange={(value) => setForm((current) => ({ ...current, mixed: { ...current.mixed, format: value as 'text' | 'json' } }))} />
            </div>
            <div className="field-label-row mixed-heading"><label>{t('mixedFields')}</label><button type="button" className="text-button" disabled={form.mixed.fields.length >= MAX_MIXED_FIELDS} onClick={addMixedField}><Plus size={16} aria-hidden="true" />{t('addField')}</button></div>
            <div className="mixed-fields">
              {form.mixed.fields.map((field, index) => (
                <div className="mixed-card" key={field.id}>
                  <div className="mixed-card-top">
                    <span className="field-order">{index + 1}</span>
                    <div className="mixed-actions">
                      <button type="button" className="icon-button" aria-label={t('moveUp')} disabled={index === 0} onClick={() => moveMixedField(index, -1)}><ArrowUp size={16} /></button>
                      <button type="button" className="icon-button" aria-label={t('moveDown')} disabled={index === form.mixed.fields.length - 1} onClick={() => moveMixedField(index, 1)}><ArrowDown size={16} /></button>
                      <button type="button" className="icon-button danger" aria-label={t('remove')} onClick={() => removeMixedField(field.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="field-grid mixed-grid">
                    <div className="field-group"><label>{t('fieldType')}</label><SelectMenu value={field.type} options={mixedTypeOptions} ariaLabel={t('fieldType')} compact onChange={(value) => changeMixedType(field, value as MixedFieldType)} /></div>
                    <div className="field-group"><label htmlFor={`label-${field.id}`}>{t('fieldLabel')}</label><input id={`label-${field.id}`} dir="auto" className={scriptFontClass(field.label)} value={field.label} placeholder={t('fieldLabelPlaceholder')} disabled={field.type === 'title'} onChange={(event) => updateMixedField(field.id, { label: clampUtf8(event.target.value, SAFE_MIXED_LABEL_MAX_BYTES) })} /></div>
                    <div className="field-group mixed-value"><label htmlFor={`value-${field.id}`}>{t('fieldValue')}</label><textarea id={`value-${field.id}`} dir="auto" className={scriptFontClass(field.value)} rows={field.type === 'text' || field.type === 'address' ? 3 : 1} value={field.value} placeholder={t('fieldValuePlaceholder')} onChange={(event) => updateMixedField(field.id, { value: clampUtf8(event.target.value, SAFE_MIXED_FIELD_MAX_BYTES) })} /><div className="field-byte-count">{utf8ByteLength(field.value)} / {SAFE_MIXED_FIELD_MAX_BYTES} {t('bytesUnit')}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const canAdvance = step === 1 ? typeConfirmed : step === 2 ? Boolean(scannablePayload) : true;
  const currentStepCopy = step === 1 ? t('stepTypeDesc') : step === 2 ? t('stepContentDesc') : step === 3 ? t('stepStyleDesc') : t('stepExportDesc');

  const goToStep = (target: WizardStep) => {
    if (target <= maxStepReached) setStep(target);
  };

  const goNext = () => {
    if (!canAdvance || step >= 4) return;
    const nextStep = (step + 1) as WizardStep;
    setMaxStepReached((current) => Math.max(current, nextStep) as WizardStep);
    setStep(nextStep);
  };

  const goBack = () => {
    if (step <= 1) return;
    setStep((step - 1) as WizardStep);
  };

  const handleWizardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      event.key !== 'Enter' ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !canAdvance ||
      step >= 4
    ) {
      return;
    }

    const target = event.target as HTMLElement;

    // Keep Enter available for multiline editing and controls whose native
    // keyboard interaction already depends on Enter (dropdowns, buttons, etc.).
    if (target instanceof HTMLTextAreaElement || target.isContentEditable) return;

    if (target instanceof HTMLInputElement) {
      const enterAdvancesFromInput = ['text', 'email', 'url', 'tel', 'number', 'search'].includes(target.type);
      if (!enterAdvancesFromInput) return;
    } else if (target.closest('button, a, [role="button"], [role="option"], [role="listbox"], [role="menu"], [role="menuitem"]')) {
      return;
    }

    event.preventDefault();
    goNext();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label={t('appName')}>
          <span className="brand-mark"><QrCode size={24} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong className="brand-name">{t('appName')}</strong>
            <small>{t('heroKicker')}</small>
          </span>
        </a>

        <div className="header-actions">
          <div className="language-control">
            <span className="header-control-icon" aria-hidden="true"><Languages size={17} /></span>
            <SelectMenu value={language} options={languageOptions} ariaLabel={t('language')} compact className="language-select" onChange={(value) => setLanguage(value as Language)} />
          </div>
          <span className="header-control-divider" aria-hidden="true" />
          <div className="theme-switcher" role="group" aria-label={t('themeLabel')}>
            <button type="button" className={themeMode === 'auto' ? 'active' : ''} aria-pressed={themeMode === 'auto'} aria-label={t('themeAuto')} title={t('themeAuto')} onClick={() => setThemeMode('auto')}><Monitor size={16} aria-hidden="true" /></button>
            <button type="button" className={themeMode === 'light' ? 'active' : ''} aria-pressed={themeMode === 'light'} aria-label={t('themeLight')} title={t('themeLight')} onClick={() => setThemeMode('light')}><Sun size={16} aria-hidden="true" /></button>
            <button type="button" className={themeMode === 'dark' ? 'active' : ''} aria-pressed={themeMode === 'dark'} aria-label={t('themeDark')} title={t('themeDark')} onClick={() => setThemeMode('dark')}><Moon size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero page-width">
          <div className="hero-kicker"><Sparkles size={16} aria-hidden="true" />{t('heroKicker')}</div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroSubtitle')}</p>
          <div className="trust-row" aria-label="Product benefits">
            <span><Check size={16} aria-hidden="true" />{t('trustFree')}</span>
            <span><Download size={16} aria-hidden="true" />{t('trustFormats')}</span>
          </div>
        </section>

        <section className="workspace page-width" aria-label={t('wizardLabel')} onKeyDown={handleWizardKeyDown}>
          <div className="wizard-card panel">
            <nav className="wizard-progress" aria-label={t('wizardLabel')}>
              {steps.map((item) => {
                const Icon = item.icon;
                const active = step === item.id;
                const unlocked = item.id <= maxStepReached;
                const done = item.id < maxStepReached && !active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`wizard-step ${active ? 'active' : ''} ${done ? 'done' : ''} ${!unlocked ? 'locked' : ''}`}
                    onClick={() => goToStep(item.id)}
                    disabled={!unlocked}
                    aria-current={active ? 'step' : undefined}
                    aria-disabled={!unlocked}
                  >
                    <span className="wizard-step-icon">{done ? <Check size={17} /> : unlocked ? <Icon size={17} /> : <LockKeyhole size={16} />}</span>
                    <span className="wizard-step-copy"><small>0{item.id}</small><strong>{item.label}</strong></span>
                  </button>
                );
              })}
            </nav>

            <div className="wizard-header">
              <div><span className="step-count">0{step} / 04</span><h2>{steps[step - 1].label}</h2></div>
              <p>{currentStepCopy}</p>
            </div>

            <div className="wizard-body">
              {step === 1 && (
                <div className="type-grid">
                  {TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = typeConfirmed && form.type === option.value;
                    return (
                      <button type="button" key={option.value} className={`type-card ${active ? 'active' : ''}`} onClick={() => selectType(option.value)}>
                        <span className="type-icon"><Icon size={22} aria-hidden="true" /></span>
                        <strong>{t(option.label)}</strong>
                        <span className="type-check"><Check size={15} aria-hidden="true" /></span>
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 2 && renderContentFields()}

              {step === 3 && (
                <div className="style-studio">
                  <div className="field-group">
                    <label>{t('presetLabel')}</label>
                    <div className="preset-grid">
                      {PRESET_OPTIONS.map((preset) => (
                        <button type="button" key={preset.value} className={`preset-card ${activePreset === preset.value ? 'active' : ''}`} onClick={() => applyQrPreset(preset.value)}>
                          <span className={`preset-swatch preset-${preset.value}`} />
                          <strong>{t(preset.label)}</strong>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="style-grid four-columns">
                    <div className="field-group"><label>{t('qrShape')}</label><SelectMenu value={qrStyle.shape} options={shapeOptions} ariaLabel={t('qrShape')} compact onChange={(value) => updateQrStyle('shape', value as QrVisualStyle['shape'])} /></div>
                    <div className="field-group"><label>{t('dotsStyle')}</label><SelectMenu value={qrStyle.dots} options={dotOptions} ariaLabel={t('dotsStyle')} compact onChange={(value) => updateQrStyle('dots', value as QrVisualStyle['dots'])} /></div>
                    <div className="field-group"><label>{t('eyeFrame')}</label><SelectMenu value={qrStyle.cornerSquare} options={cornerSquareOptions} ariaLabel={t('eyeFrame')} compact onChange={(value) => updateQrStyle('cornerSquare', value as QrVisualStyle['cornerSquare'])} /></div>
                    <div className="field-group"><label>{t('eyeCenter')}</label><SelectMenu value={qrStyle.cornerDot} options={cornerDotOptions} ariaLabel={t('eyeCenter')} compact onChange={(value) => updateQrStyle('cornerDot', value as QrVisualStyle['cornerDot'])} /></div>
                  </div>

                  <div className="style-section">
                    <div className="field-group compact-group"><label>{t('colorMode')}</label><div className="segmented-control"><button type="button" className={qrStyle.colorMode === 'solid' ? 'active' : ''} onClick={() => updateQrStyle('colorMode', 'solid')}>{t('solid')}</button><button type="button" className={qrStyle.colorMode === 'gradient' ? 'active' : ''} onClick={() => updateQrStyle('colorMode', 'gradient')}>{t('gradient')}</button></div></div>
                    <div className="color-grid">
                      <ColorField id="foreground" label={t('foreground')} value={qrStyle.foreground} onChange={(value) => updateQrStyle('foreground', value)} />
                      {qrStyle.colorMode === 'gradient' && <ColorField id="gradient-end" label={t('gradientEnd')} value={qrStyle.gradientEnd} onChange={(value) => updateQrStyle('gradientEnd', value)} />}
                      <ColorField id="eye-color" label={t('eyeColor')} value={qrStyle.eyeColor} onChange={(value) => updateQrStyle('eyeColor', value)} />
                      <ColorField id="background" label={t('background')} value={qrStyle.background} onChange={(value) => updateQrStyle('background', value)} />
                    </div>
                  </div>

                  <div className="range-grid">
                    {qrStyle.colorMode === 'gradient' && <RangeField id="gradient-angle" label={t('gradientAngle')} min={0} max={360} step={5} value={qrStyle.gradientAngle} output={`${qrStyle.gradientAngle}°`} onChange={(value) => updateQrStyle('gradientAngle', value)} />}
                    <RangeField id="qr-margin" label={t('margin')} min={0} max={32} step={2} value={qrStyle.margin} output={`${qrStyle.margin}px`} onChange={(value) => updateQrStyle('margin', value)} />
                    <RangeField id="logo-size" label={t('logoSize')} min={0.16} max={0.38} step={0.01} value={qrStyle.logoSize} output={`${Math.round(qrStyle.logoSize * 100)}%`} disabled={!qrStyle.logoDataUrl} onChange={(value) => updateQrStyle('logoSize', value)} />
                  </div>

                  <div className="logo-row">
                    <div className="logo-copy"><strong>{t('logo')}</strong><p>{t('reliability')}</p></div>
                    <div className="logo-actions">
                      <label className="button button-secondary file-button"><ImagePlus size={18} aria-hidden="true" />{qrStyle.logoDataUrl ? t('replaceLogo') : t('addLogo')}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => handleLogoUpload(event.target.files?.[0])} /></label>
                      {qrStyle.logoDataUrl && <button className="button button-ghost" type="button" onClick={() => updateQrStyle('logoDataUrl', '')}><Trash2 size={17} />{t('removeLogo')}</button>}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="review-card">
                  <div className="review-status"><span><BadgeCheck size={22} aria-hidden="true" /></span><div><strong>{t('stepExport')}</strong><p>{t('stepExportDesc')}</p></div></div>
                  <div className="privacy-note"><ShieldCheck size={21} aria-hidden="true" /><div><strong>{t('privacyTitle')}</strong><p>{t('privacyText')}</p></div></div>
                  <div className="encoded-block"><span>{t('encodedValue')}</span><pre dir="auto" className={scriptFontClass(payload)}>{payload || '—'}</pre></div>
                  <div className="review-actions">
                    <button className="button button-primary" type="button" disabled={!scannablePayload} onClick={() => downloadStyledQr('svg')}><Download size={18} aria-hidden="true" />{t('downloadSvg')}</button>
                    <button className="button button-secondary" type="button" disabled={!scannablePayload} onClick={() => downloadStyledQr('png')}><Download size={18} aria-hidden="true" />{t('downloadPng')}</button>
                    <button className="button button-secondary" type="button" disabled={!scannablePayload} onClick={() => copyValue('payload', payload)}>{copiedTarget === 'payload' ? <Check size={18} /> : <Copy size={18} />}{copiedTarget === 'payload' ? t('copied') : t('copy')}</button>
                  </div>
                </div>
              )}
            </div>

            {step > 1 && (
              <div className="wizard-footer">
                <button className="button button-ghost" type="button" onClick={goBack}>
                  {currentLanguage.dir === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}{t('back')}
                </button>
                {step < 4 ? (
                  <button className="button button-primary" type="button" disabled={!canAdvance} onClick={goNext}>
                    {step === 3 ? t('review') : t('next')}{currentLanguage.dir === 'rtl' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                  </button>
                ) : (
                  <button className="button button-ghost" type="button" onClick={resetWizard}><RefreshCcw size={18} />{t('startOver')}</button>
                )}
              </div>
            )}
          </div>

          <aside className="preview-column">
            <section className="panel preview-panel">
              <div className="panel-heading"><div><span className="panel-icon"><WandSparkles size={18} /></span><div><h2>{t('livePreview')}</h2><p>{t('livePreviewHint')}</p></div></div></div>
              <div className={`qr-stage ${scannablePayload ? '' : 'is-empty'}`}>
                {scannablePayload ? <div className="qr-frame"><StyledQr ref={styledQrRef} data={scannablePayload} style={qrStyle} size={260} fileName={`qr-${form.type}`} className="styled-qr" /></div> : <div className="empty-state"><QrCode size={36} aria-hidden="true" /><p>{payloadTooLarge ? t('payloadTooLargePreview') : t('emptyPreview')}</p></div>}
              </div>
              {scannablePayload && step === 3 && <button className="button button-secondary full-width" type="button" onClick={goNext}><BadgeCheck size={18} />{t('review')}</button>}
            </section>

          </aside>
        </section>

        <section className="discover page-width" aria-labelledby="discover-title">
          <div className="discover-intro"><span>{t('discoverKicker')}</span><h2 id="discover-title">{t('discoverTitle')}</h2><p>{t('discoverBody')}</p></div>
          <div className="feature-grid">
            <article><ShieldCheck size={23} aria-hidden="true" /><h3>{t('featurePrivateTitle')}</h3><p>{t('featurePrivateBody')}</p></article>
            <article><WandSparkles size={23} aria-hidden="true" /><h3>{t('featureBrandTitle')}</h3><p>{t('featureBrandBody')}</p></article>
            <article><Download size={23} aria-hidden="true" /><h3>{t('featureFormatTitle')}</h3><p>{t('featureFormatBody')}</p></article>
          </div>
          <div className="answers-block">
            <h2>{t('answersTitle')}</h2>
            <div className="answer-grid">
              <article><h3>{t('answerPrivacyQ')}</h3><p>{t('answerPrivacyA')}</p></article>
              <article><h3>{t('answerTypesQ')}</h3><p>{t('answerTypesA')}</p></article>
              <article><h3>{t('answerStaticQ')}</h3><p>{t('answerStaticA')}</p></article>
            </div>
          </div>

          <section className="access-showcase" aria-labelledby="page-access-title">
            <div className="access-showcase-copy">
              <div className="access-eyebrow"><Smartphone size={15} aria-hidden="true" /><span>{t('pageAccessBadge')}</span></div>
              <h2 id="page-access-title">{t('pageAccess')}</h2>
              <p>{t('pageAccessHelp')}</p>
              <div className="access-benefits" aria-label={t('pageAccessBenefitsLabel')}>
                <span><Check size={15} aria-hidden="true" />{t('pageAccessBenefitFast')}</span>
                <span><ShieldCheck size={15} aria-hidden="true" />{t('pageAccessBenefitPrivate')}</span>
                <span><Smartphone size={15} aria-hidden="true" />{t('pageAccessBenefitMobile')}</span>
              </div>
            </div>
            <div className="access-showcase-qr">
              <div className="small-qr-frame access-qr-premium" ref={pageQrRef}>{normalizedPageUrl ? <QRCode value={normalizedPageUrl} size={132} level="M" bgColor="#FFFFFF" fgColor="#111827" /> : <QrCode size={30} />}</div>
            </div>
            <div className="access-showcase-actions">
              <span className="access-url-label">{t('pageUrl')}</span>
              <div className="access-url-pill"><Link2 size={16} aria-hidden="true" /><span dir="ltr">{normalizedPageUrl || pageUrl}</span></div>
              <div className="inline-actions">
                <button className="button button-secondary button-small" type="button" disabled={!normalizedPageUrl} onClick={() => copyValue('page', normalizedPageUrl)}>{copiedTarget === 'page' ? <Check size={16} /> : <Copy size={16} />}{copiedTarget === 'page' ? t('copied') : t('copy')}</button>
                <button className="button button-primary button-small" type="button" disabled={!normalizedPageUrl} onClick={() => downloadSvg(pageQrRef, 'qr-page-access.svg')}><Download size={16} />{t('download')}</button>
              </div>
            </div>
          </section>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div><span>{t('footerMadeBy')} </span><a href="https://imoein.com" target="_blank" rel="author noopener noreferrer">imoein.com</a></div>
        <p>{t('footerNote')}</p>
      </footer>
    </div>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field-group color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-control"><input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><span dir="ltr">{value}</span></div>
    </div>
  );
}

function RangeField({ id, label, min, max, step, value, output, disabled, onChange }: { id: string; label: string; min: number; max: number; step: number; value: number; output: string; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <div className="range-field">
      <div><label htmlFor={id}>{label}</label><output>{output}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

export default App;
