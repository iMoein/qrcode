import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'node_modules', 'vazirmatn');
const outputDir = join(root, 'public', 'fonts');
const outputFont = join(outputDir, 'Vazirmatn.woff2');
const outputLicense = join(outputDir, 'OFL.txt');

async function walk(directory) {
  const items = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const fullPath = join(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

if (!(await exists(packageRoot))) {
  console.error('Vazirmatn package is not installed. Run npm install first.');
  process.exit(1);
}

const files = await walk(packageRoot);
const variable = files.find((path) => /Vazirmatn\[wght\]\.woff2$/i.test(path));
const regular = files.find((path) => /Vazirmatn-Regular\.woff2$/i.test(path));
const fontSource = variable ?? regular;

if (!fontSource) {
  console.error('Could not find a Vazirmatn WOFF2 file inside node_modules/vazirmatn.');
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });
await copyFile(fontSource, outputFont);

const licenseSource = join(packageRoot, 'OFL.txt');
if (await exists(licenseSource)) await copyFile(licenseSource, outputLicense);

console.log(`Vazirmatn vendored locally: ${fontSource.replace(root, '.')} -> ./public/fonts/Vazirmatn.woff2`);
