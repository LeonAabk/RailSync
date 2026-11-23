#!/usr/bin/env node
// Minifiserer den ferdige app.js med esbuild (kjøres av GitHub Actions etter at versjonsnummeret er satt inn).
// Lager også app.js.map, så feilmeldinger kan spores tilbake til den lesbare koden.
//
// Bruk: node scripts/minify.mjs <sti til app.js>
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { transform } from 'esbuild';

const file = process.argv[2];
if (!file) throw new Error('Bruk: node scripts/minify.mjs <app.js>');

const source = readFileSync(file, 'utf8');
const version = (source.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
if (!version) throw new Error('Fant ikke APP_VERSION i app.js – sett versjonsnummeret før minifisering.');

const result = await transform(source, {
  loader: 'js',
  format: 'esm',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  sourcemap: 'external',
  sourcefile: 'app.src.js',
});

const name = path.basename(file);
writeFileSync(file, `${result.code}//# sourceMappingURL=${name}.map\n`);
writeFileSync(`${file}.map`, result.map);

// Kontroller: gyldig ES-modul, og versjonen finnes fortsatt (brukes til «ny versjon»-sjekken og feilrapporter)
const tmp = path.join(path.dirname(file), '.minify-check.mjs');
writeFileSync(tmp, result.code);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
} finally {
  (await import('node:fs')).unlinkSync(tmp);
}
if (!result.code.includes(version)) throw new Error(`Versjonen ${version} forsvant under minifisering.`);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`${name}: ${kb(source.length)} -> ${kb(result.code.length)} (versjon ${version})`);
