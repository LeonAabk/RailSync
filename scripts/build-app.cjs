#!/usr/bin/env node
// Setter sammen src/app/*.js (i navnerekkefølge) til app.js – den filen nettleseren laster.
// Delene deler samme skop, akkurat som da alt lå i én fil, så rekkefølgen betyr noe:
// funksjoner kan brukes på tvers, men variabler (let/const) må være definert i en tidligere del
// før de brukes når filen lastes.
//
// Bruk: node scripts/build-app.cjs [utfil]   (standard: app.js i roten)
// Kjøres av GitHub Actions før publisering, og lokalt før testene.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src", "app");
const out = path.resolve(root, process.argv[2] || "app.js");

const parts = fs.readdirSync(srcDir).filter(f => /^\d{2}-.+\.js$/.test(f)).sort();
if (!parts.length) throw new Error("Fant ingen deler i src/app/");

let line = 1;
const map = [];
const body = parts.map(f => {
  const text = fs.readFileSync(path.join(srcDir, f), "utf8");
  if (!text.endsWith("\n")) throw new Error(`src/app/${f} må slutte med linjeskift`);
  map.push(`//   linje ${String(line).padStart(5)}  src/app/${f}`);
  line += text.split("\n").length - 1;
  return text;
}).join("");

// Kartet over hvilke linjer som kommer fra hvilken fil legges NEDERST, så linjenumre i feilmeldinger
// stemmer med summen over (og første linje fortsatt er den første i src/app/01-…).
const footer = `\n// ---------------------------------------------------------------------------\n// Bygget fra src/app/ av scripts/build-app.cjs – ikke rediger app.js direkte.\n${map.join("\n")}\n`;
fs.writeFileSync(out, body + footer);

// Syntakssjekk som ES-modul
const tmp = path.join(require("os").tmpdir(), "railsync-app-check-" + process.pid + ".mjs");
fs.writeFileSync(tmp, body + footer);
try { execFileSync(process.execPath, ["--check", tmp], { stdio: "inherit" }); } finally { fs.unlinkSync(tmp); }
console.log(`app.js: ${parts.length} deler, ${line - 1} linjer -> ${path.relative(root, out)}`);
