#!/usr/bin/env node
// Sjekker alle data-onclick/-onsubmit/-onchange/-oninput i index.html og src/app/:
//  1. Ingen inline-hendelser (onclick="…") igjen – de stoppes av Content-Security-Policy.
//  2. Teksten følger syntaksen assets/dispatch.js forstår (funksjonskall med enkle argumenter).
//  3. Funksjonene som kalles finnes på window (window.navn = … i src/app/ eller assets/dispatch.js).
// Kjøres av «npm run lint» og i GitHub Actions.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['index.html', ...readdirSync(path.join(root, 'src/app')).filter((f) => f.endsWith('.js')).map((f) => `src/app/${f}`)];
const read = (f) => readFileSync(path.join(root, f), 'utf8');

// Funksjoner som er tilgjengelige for HTML-en
const exposed = new Set();
for (const f of [...files.filter((f) => f.endsWith('.js')), 'assets/dispatch.js']) {
  for (const m of read(f).matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) exposed.add(m[1]);
}

// Samme grammatikk som assets/dispatch.js
const ARG = String.raw`(?:'[^']*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null|event|this(?:\.(?:value|checked))?)`;
const CALL = String.raw`(?:window\.)?([A-Za-z_$][\w$]*)\(\s*(?:${ARG}(?:\s*,\s*${ARG})*)?\s*\)`;
const VALID = new RegExp(String.raw`^\s*${CALL}(?:\s*;\s*${CALL})*\s*;?\s*$`);
const NAMES = new RegExp(CALL, 'g');

// I JS-maler står argumentene som ${…}. Bytt dem ut med typiske verdier før sjekken.
// ${jsArg(x)} blir en JSON-streng, ${Number(x)} og indekser blir tall.
function fromTemplate(body) {
  return body
    .replace(/\$\{jsArg\([^}]*\)\}/g, '"x"')
    .replace(/\$\{Number\([^}]*\)\}/g, '0')
    .replace(/\$\{[a-zA-Z_$][\w$.]*\}/g, (m) => (/\$\{(i|idx|index|n)\}/.test(m) ? '0' : m));
}

// Dynamiske handlere: tekst som settes ved kjøring. Hvert mulige resultat sjekkes i stedet.
const DYNAMIC = {
  '${st.action}': [...read('src/app/07-navigasjon-og-ny-reise.js').matchAll(/action: "([^"]+)"/g)].map((m) => m[1]),
  '${shared ? "focusJoinTripInput()" : "newTripFromPage()"}': ['focusJoinTripInput()', 'newTripFromPage()'],
};

const problems = [];
let count = 0;
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/\bon(click|submit|change|input|keydown|keyup|focus|blur|load|error)\s*=\s*["'`]/g)) {
    if (src[m.index - 1] === '-') continue; // data-onclick
    problems.push(`${f}: inline-hendelse «${m[0]}» (bruk data-${m[0].replace(/\s*=.*/, '')})`);
  }
  // ${…} i maler kan inneholde anførselstegn, så de leses som én enhet
  for (const m of src.matchAll(/data-on(click|submit|change|input)="((?:\$\{[^}]*\}|[^"])*)"/g)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (/^\s*\/\//.test(src.slice(lineStart, m.index))) continue; // kommentar
    count++;
    const raw = m[2];
    const bodies = DYNAMIC[raw] || [f.endsWith('.js') ? fromTemplate(raw) : raw];
    for (const body of bodies) {
      const decoded = body.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
      if (!VALID.test(decoded)) { problems.push(`${f}: data-on${m[1]}="${raw}" følger ikke syntaksen`); continue; }
      for (const c of decoded.matchAll(NAMES)) {
        if (!exposed.has(c[1])) problems.push(`${f}: ${c[1]}() er ikke lagt på window (data-on${m[1]})`);
      }
    }
  }
}

if (problems.length) {
  console.error(`Hendelser: ${problems.length} problem(er)\n  ` + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
console.log(`Hendelser: ${count} data-on*-attributter OK (${exposed.size} funksjoner på window)`);
