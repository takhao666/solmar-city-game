// Solmar City: Streets of Gold — the hand-in program for make.fun's gta6-01.
// Node 22, standard library only. It copies this repository's game/ and screenshots/
// beside this file into /output (or $MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library, so the judge can read the
// game. Run it locally to check the hand-in before entering:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Refuse a hand-in with no screenshots: the judge reads the game through them.
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotFiles.length}`);
}

// Count the game files, so the run log says what was handed in.
let gameFiles = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(join(dir, entry.name));
    else gameFiles += 1;
  }
};
walk(join(out, 'game'));
console.log(`Solmar City: ${gameFiles} game files, ${shotFiles.length} screenshots -> ${out}`);

// The scorer's own caps, from the kit's reference/gate.json: the text cap shapes the
// dossier's bytes, the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files or 48 MiB under game/, or a
// path under game/ longer than 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
