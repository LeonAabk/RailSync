// ESLint – fanger ekte feil (udefinerte variabler, skrivefeil, død kode), ikke kodestil.
//
// Appen (src/app/*.js) lintes som ferdig sammensatt app.js via scripts/lint.mjs,
// fordi delene deler skop: en variabel definert i én del brukes i en annen.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', '_site/**', 'app.js', 'src/app/**'],
  },

  // Appen (sammensatt app.js)
  {
    files: ['**/app.lint.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        L: 'readonly', // Leaflet (lastes fra unpkg)
        lucide: 'readonly', // ikoner (assets/icons.js)
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      // ignoreRestSiblings: «const { a, ...rest } = obj» brukes med vilje for å fjerne felt før lagring
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },

  // Hendelser fra HTML (lastes før app.js, vanlig skript)
  {
    files: ['assets/dispatch.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
    rules: { ...js.configs.recommended.rules, 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },

  // Service worker
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },

  // Byggeskript og tester (Node)
  {
    files: ['scripts/**/*.{js,cjs,mjs}', 'tests/**/*.mjs', '*.config.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: js.configs.recommended.rules,
  },
];
