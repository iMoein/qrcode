# QR Code Studio

A multilingual, browser-based QR code generator and visual QR designer for `https://qrcode.imoein.com/`.

## Features

- Four-step QR creation flow: content type → details → design → review/download.
- QR types for websites, phone numbers, locations, social profiles, email, vCard contacts, text, and mixed/custom content.
- Location QR support with address search, manual coordinates, interactive map selection, and device geolocation.
- Visual customization for module shape, finder patterns, colors, gradients, quiet zone, and center logo.
- SVG and PNG export.
- Scan-safety limits for text-heavy QR payloads.
- Auto, Light, and Dark appearance modes.
- Responsive RTL/LTR interface.
- 11 interface languages: English, Finnish, Persian, Arabic, Russian, Chinese, Korean, Japanese, German, Spanish, and French.
- Local Vazirmatn typography for Persian and Arabic text.
- Cross-device handoff QR for opening the studio on another device.

## Requirements

- Node.js 18.18 or newer
- npm

## Install

```bash
npm install
```

The project uses the npm registry configured on the host system and does not commit a machine-specific registry URL.

## Development

```bash
npm run dev
```

Vite exposes both local and network development URLs when available.

## Production build

```bash
npm run build
```

The production output is written to:

```text
dist/
```

Preview the production build locally with:

```bash
npm run preview
```

## Local Vazirmatn font

Vazirmatn is pinned to `33.0.3`.

The install/build workflow copies the WOFF2 asset from the installed package into:

```text
public/fonts/Vazirmatn.woff2
```

The application loads that local file at runtime and does not require a font CDN.

You can run the font vendor step manually with:

```bash
npm run font:local
```

## Map configuration

The location picker uses Leaflet with a configurable raster tile source.

Default environment options are documented in `.env.example`:

```bash
VITE_MAP_TILE_URL="https://your-tile-provider/{z}/{x}/{y}.png"
VITE_MAP_ATTRIBUTION="Map data attribution"
```

Map attribution remains visible in the interface as required by the selected tile provider.

Browser geolocation requires a secure context in production. The intended production URL is:

```text
https://qrcode.imoein.com/
```

## Scan-safety limits

The application limits text-heavy payloads to keep generated QR codes practical for real phone cameras:

- Free text: 480 UTF-8 bytes.
- Mixed/custom payload: 720 UTF-8 bytes total.
- Mixed field value: 280 UTF-8 bytes.
- Mixed field label: 80 UTF-8 bytes.
- Mixed/custom fields: up to 8.
- Other payload types: 900-byte final safety ceiling.

Limits are measured in UTF-8 bytes rather than JavaScript character count so multilingual content is handled consistently.

## Search and structured discovery

The production page includes:

- canonical URL metadata
- optimized title and description
- Open Graph and Twitter metadata
- social share image
- `robots.txt`
- `sitemap.xml`
- web app manifest and favicon
- `WebSite` and `WebApplication` JSON-LD
- visible product and quick-answer content
- machine-readable product summary in `llms.txt`

## Privacy

QR payload creation runs in the browser. User-entered content and uploaded center logos do not require a remote QR-generation API.

## Main dependencies

- React
- TypeScript
- Vite
- `qr-code-styling`
- `react-qr-code`
- `lucide-react`
- Leaflet
- Vazirmatn

## Site

- QR Code Studio: `https://qrcode.imoein.com/`
- Creator: `https://imoein.com/`
