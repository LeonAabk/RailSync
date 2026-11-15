#!/usr/bin/env node
// Lager assets/icons.js med bare de Lucide-ikonene RailSync bruker, i stedet for hele biblioteket (~470 KB).
// Bruk: node scripts/build-icons.cjs <sti til lucide UMD-fil> <utfil>
// Kjøres av GitHub Actions (.github/workflows/deploy.yml) med lucide@1.71.0 fra npm.
//
// Ikonnavn hentes fra index.html og app.js: alle data-lucide="..." og alle tekststrenger i anførselstegn
// som er navnet på et Lucide-ikon (slik fanges også navn som settes dynamisk, f.eks. icon: "pencil").
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const [umdPath, outPath] = process.argv.slice(2);
if (!umdPath || !outPath) {
  console.error("Bruk: node scripts/build-icons.cjs <lucide.js> <utfil>");
  process.exit(1);
}

const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.runInNewContext(fs.readFileSync(umdPath, "utf8"), sandbox, { filename: umdPath });
const lucide = sandbox.lucide;
if (!lucide || !lucide.icons) throw new Error("Fant ikke lucide.icons i " + umdPath);

const root = path.join(__dirname, "..");
const source = ["index.html", "app.js"].map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const explicit = new Set([...source.matchAll(/data-lucide="([a-z0-9-]+)"/g)].map(m => m[1]));
const quoted = new Set([...source.matchAll(/["'`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)["'`]/g)].map(m => m[1]));

const toPascal = s => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const used = {};
const missing = [];
for (const name of [...new Set([...explicit, ...quoted])].sort()) {
  const node = lucide.icons[toPascal(name)];
  if (node) used[name] = node;
  else if (explicit.has(name)) missing.push(name);
}
if (missing.length) {
  console.error("Disse ikonene finnes ikke i Lucide: " + missing.join(", "));
  process.exit(1);
}

const runtime = `/* RailSync – ikoner fra Lucide (https://lucide.dev, ISC-lisens). Bare ikonene appen bruker.
   Generert av scripts/build-icons.cjs – ikke rediger for hånd. */
(function () {
  var ICONS = ${JSON.stringify(used)};
  var NS = "http://www.w3.org/2000/svg";
  var DEFAULTS = { xmlns: NS, width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
  function replace(el) {
    var name = el.getAttribute("data-lucide");
    var node = ICONS[name];
    if (!node || !el.parentNode) return;
    var svg = document.createElementNS(NS, "svg");
    var k;
    for (k in DEFAULTS) svg.setAttribute(k, DEFAULTS[k]);
    svg.setAttribute("data-lucide", name);
    var hasLabel = false;
    var extraClass = "";
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name === "class") { extraClass = a.value; continue; }
      if (a.name === "aria-label" || a.name === "aria-labelledby" || a.name === "title") hasLabel = true;
    }
    if (!hasLabel) svg.setAttribute("aria-hidden", "true");
    var cls = ("lucide lucide-" + name + " " + extraClass.replace(/\\blucide(-[a-z0-9-]+)?\\b/g, "")).replace(/\\s+/g, " ").trim();
    svg.setAttribute("class", cls);
    for (var j = 0; j < el.attributes.length; j++) {
      var at = el.attributes[j];
      if (at.name !== "class" && at.name !== "data-lucide" && !(at.name in DEFAULTS)) svg.setAttribute(at.name, at.value);
    }
    for (var c = 0; c < node.length; c++) {
      var child = document.createElementNS(NS, node[c][0]);
      for (k in node[c][1]) child.setAttribute(k, node[c][1][k]);
      svg.appendChild(child);
    }
    el.parentNode.replaceChild(svg, el);
  }
  function createIcons() {
    var els = document.querySelectorAll("[data-lucide]");
    for (var i = 0; i < els.length; i++) replace(els[i]);
  }
  window.lucide = { createIcons: createIcons, icons: ICONS };
})();
`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, runtime);
console.log(`Ikoner: ${Object.keys(used).length} (${Math.round(runtime.length / 1024)} KB) -> ${outPath}`);
