#!/usr/bin/env node
// Linter RailSync med ESLint.
//
// Appens deler (src/app/*.js) deler skop, så de lintes samlet: de limes sammen i samme
// rekkefølge som scripts/build-app.cjs, og hver feil vises med riktig fil og linje i src/app/.
// Service worker, byggeskript og tester lintes som vanlige filer.
//
// Bruk: npm run lint
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ESLint } from 'eslint';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src', 'app');

// Sett sammen delene og husk hvilke linjer som kom fra hvilken fil
const parts = readdirSync(srcDir).filter((f) => /^\d{2}-.+\.js$/.test(f)).sort();
const ranges = [];
let line = 1;
let text = '';
for (const f of parts) {
  const content = readFileSync(path.join(srcDir, f), 'utf8');
  const count = content.split('\n').length - 1;
  ranges.push({ file: `src/app/${f}`, start: line, end: line + count - 1 });
  line += count;
  text += content;
}

function locate(n) {
  const r = ranges.find((x) => n >= x.start && n <= x.end);
  return r ? { file: r.file, line: n - r.start + 1 } : { file: 'app.js', line: n };
}

const eslint = new ESLint({ cwd: root });
const results = [
  ...(await eslint.lintText(text, { filePath: path.join(root, 'app.lint.js') })),
  ...(await eslint.lintFiles(['sw.js', 'assets/dispatch.js', 'scripts', 'tests', 'eslint.config.mjs'])),
];

let errors = 0;
let warnings = 0;
for (const result of results) {
  const isApp = result.filePath.endsWith('app.lint.js');
  for (const m of result.messages) {
    const where = isApp ? locate(m.line) : { file: path.relative(root, result.filePath), line: m.line };
    const level = m.severity === 2 ? 'feil' : 'advarsel';
    if (m.severity === 2) errors++;
    else warnings++;
    console.log(`${where.file.replace(/\\/g, '/')}:${where.line}:${m.column}  ${level}  ${m.message}  (${m.ruleId || 'parser'})`);
  }
}

console.log(`\n${errors} feil, ${warnings} advarsler`);
process.exit(errors ? 1 : 0);
