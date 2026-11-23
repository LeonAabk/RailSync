// Laster de rene funksjonene fra src/app/ til enhetstester – uten å endre appens kode.
//
// Delene i src/app/ deler samme skop (de limes sammen til app.js), så de kan ikke importeres hver for seg.
// Denne hjelperen leser delene i samme rekkefølge som scripts/build-app.cjs, finner funksjoner og
// konstanter på øverste nivå med acorn, og kjører dem i en egen sandkasse (node:vm).
// Importer, DOM-kode og annet som kjøres ved oppstart blir IKKE kjørt.
//
// Bruk:
//   const app = loadApp();
//   app.computeSharedBalances(...)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import * as acorn from 'acorn';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/app');

function readParts() {
  return readdirSync(srcDir)
    .filter((f) => /^\d{2}-.+\.js$/.test(f))
    .sort()
    .map((f) => readFileSync(path.join(srcDir, f), 'utf8'))
    .join('');
}

let cached;

/**
 * @param {object} [globals] Ekstra globale verdier i sandkassen (f.eks. { window: { __today: '2026-07-01' } }).
 * @returns {Record<string, any>} Alle funksjoner og konstanter på øverste nivå, etter navn.
 */
export function loadApp(globals = {}) {
  if (!cached) cached = readParts();
  const source = cached;
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

  const functions = [];
  const variables = [];
  const names = [];

  for (let node of ast.body) {
    if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') && node.declaration) {
      node = node.declaration;
    }
    if (node.type === 'FunctionDeclaration' && node.id) {
      functions.push(source.slice(node.start, node.end));
      names.push(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id.type !== 'Identifier') continue;
        const init = decl.init ? source.slice(decl.init.start, decl.init.end) : 'undefined';
        // Hver konstant for seg: feiler den (f.eks. fordi den bruker DOM-en), blir den bare undefined.
        variables.push(`try { var ${decl.id.name} = (${init}); } catch (e) { var ${decl.id.name}; }`);
        names.push(decl.id.name);
      }
    }
  }

  const script = [
    ...functions,
    ...variables,
    `({ ${[...new Set(names)].join(', ')} })`,
  ].join('\n');

  const sandbox = vm.createContext({ console, ...globals });
  return vm.runInContext(script, sandbox, { filename: 'src/app (testlaster)' });
}
