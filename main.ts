// Mosslight Courier — entry program.
//
// Copies game/ and screenshots/ into the output directory (MAKEFUN_OUTPUT_DIR,
// else /output) and writes dossier.json with the kit's buildDossier. Node 22,
// standard library only, and it writes the same bytes every run.

import { mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const here = import.meta.dirname;
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

const shots = join(here, 'screenshots');
if (!existsSync(shots)) {
  console.error('screenshots/ is missing: capture 3-4 real browser renders first (see README.md).');
  process.exit(1);
}
cpSync(shots, join(out, 'screenshots'), { recursive: true });

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

console.log(`dossier written to ${join(out, 'dossier.json')}`);
