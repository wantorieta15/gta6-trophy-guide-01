// Entry point (Node 22, standard library only): validates this entry's own data,
// copies app/ and screenshots/ into the output directory, and writes the dossier
// the judge reads, with the kit's vendored make.fun library (vendor/makefun-frontend.ts).
// It reads app/data/trophies.json and shots.json first and refuses to hand in a
// broken entry: the trophy list must hold the official 55 with a guide each and
// 149 cited steps, and shots.json must name the 4 screenshots in screenshots/.
// Deterministic: same inputs, same bytes out — run it as often as you like.
//   MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) { throw new Error(`main.ts: ${message}`); }

// 1. Read and check the trophy data this entry hands in.
const trophyPath = join(here, 'app', 'data', 'trophies.json');
if (statSync(trophyPath).size > 2097152) fail('trophies.json is over the 2 MiB cap');
const trophyDoc = JSON.parse(readFileSync(trophyPath, 'utf8'));
const list = trophyDoc.trophies;
if (!Array.isArray(list) || list.length !== 55) fail(`expected 55 trophies, found ${Array.isArray(list) ? list.length : 'none'}`);
const grades = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
let steps = 0;
for (const t of list) {
  if (!t.name || typeof t.guide !== 'string' || !t.guide.trim()) fail(`trophy ${t.id} has no guide`);
  if (!Array.isArray(t.sources) || t.sources.length < 2) fail(`trophy ${t.id} is backed by fewer than 2 sources`);
  grades[t.grade] = (grades[t.grade] ?? 0) + 1;
  steps += (t.steps || []).length;
}
if (grades.platinum !== 1 || grades.gold !== 2 || grades.silver !== 6 || grades.bronze !== 46) fail(`grade split is ${JSON.stringify(grades)}, expected 1/2/6/46`);
if (steps !== 149) fail(`expected 149 steps, found ${steps}`);

// 2. Read and check the screenshot list.
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
if (!Array.isArray(shots) || shots.length !== 4) fail(`expected 4 shots, found ${Array.isArray(shots) ? shots.length : 'none'}`);
for (const shot of shots) {
  const shotFile = join(here, 'screenshots', shot.file);
  if (!existsSync(shotFile) || !statSync(shotFile).isFile()) fail(`missing screenshot ${shot.file}`);
  if (statSync(shotFile).size > 262144) fail(`screenshot ${shot.file} is over 256 KiB`);
}

// 3. Copy the entry into the output directory and write its dossier.
mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
const appEntries = readdirSync(join(outDir, 'app'), { recursive: true }).length;
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
console.log(`Leonida guide v8: 55 trophies, 149 steps, ${shots.length} screenshots, ${appEntries} app entries -> ${outDir}`);
