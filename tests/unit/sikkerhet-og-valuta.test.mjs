// Escaping av brukerinnhold (16-vinduer-og-bilder.js) og valutaomregning (19-land-og-valuta.js)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();

describe('escapeHtml', () => {
  test('alle tegn som kan bryte ut av HTML eller attributter escapes', () => {
    assert.equal(app.escapeHtml(`<img src=x onerror="alert('x')">&`),
      '&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;&amp;');
  });

  test('tomme verdier blir tom streng, tall blir tekst', () => {
    assert.equal(app.escapeHtml(null), '');
    assert.equal(app.escapeHtml(undefined), '');
    assert.equal(app.escapeHtml(42), '42');
  });
});

describe('jsArg – verdier inne i onclick="…"', () => {
  test('kan ikke bryte ut av attributtet eller JS-strengen', () => {
    const evil = `"); alert(1); ("`;
    const arg = app.jsArg(evil);
    assert.ok(!arg.includes('"'), 'rå anførselstegn ville avsluttet attributtet');
    // Nettleseren dekoder entitetene i attributtet – resultatet må være en gyldig JS-streng med samme tekst
    const decoded = arg.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(JSON.parse(decoded), evil);
  });

  test('null og undefined blir tom streng', () => {
    assert.equal(app.jsArg(null), '&quot;&quot;');
  });
});

describe('safeColor', () => {
  test('bare #RRGGBB slipper gjennom (hindrer CSS-injeksjon)', () => {
    assert.equal(app.safeColor('#0D9488'), '#0D9488');
    assert.equal(app.safeColor('red'), '#0b8176');
    assert.equal(app.safeColor('#fff'), '#0b8176');
    assert.equal(app.safeColor('#000000;background:url(x)', '#123456'), '#123456');
  });
});

describe('avatarColor og avatarInk – lesbare initialer (WCAG 4.5:1)', () => {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  test('eldre farger vises som mørkere variant av samme farge', () => {
    assert.equal(app.avatarColor('#0d9488'), '#0b8176');
    assert.equal(app.avatarColor('#F97316'), '#c2410c');
    assert.equal(app.avatarColor('#059669'), '#047857');
    assert.equal(app.avatarColor('#2563eb'), '#2563eb');
    assert.equal(app.avatarColor('ugyldig', '#7c3aed'), '#7c3aed');
  });

  test('alle fargene i profilvelgeren gir hvit tekst med minst 4.5:1', () => {
    for (const c of ['#0b8176', '#2563eb', '#7c3aed', '#e11d48', '#c2410c', '#047857', '#0f172a']) {
      assert.equal(app.avatarInk(c), '#ffffff', c);
      assert.ok(contrast(c, '#ffffff') >= 4.5, `${c}: ${contrast(c, '#ffffff').toFixed(2)}`);
    }
  });

  test('lyse farger (som andre kan ha lagret) får mørk tekst, og alltid nok kontrast', () => {
    for (const c of ['#fde047', '#a7f3d0', '#ffffff', '#94a3b8', '#14b8a6', '#000000', '#ff0000']) {
      const ink = app.avatarInk(c);
      assert.ok(contrast(c, ink) >= 4.5 || contrast(c, '#ffffff') < 4.5 && contrast(c, '#0f172a') >= contrast(c, '#ffffff'), `${c} med ${ink}`);
    }
    assert.equal(app.avatarInk('#fde047'), '#0f172a');
  });
});

describe('isSafePhotoDataUrl', () => {
  const jpeg = 'data:image/jpeg;base64,' + 'QUJD'.repeat(10);

  test('godtar JPEG-data-URL innenfor grensen', () => {
    assert.equal(app.isSafePhotoDataUrl(jpeg, 1000), true);
  });

  test('avviser andre bildetyper, lenker, for store bilder og ugyldig base64', () => {
    assert.equal(app.isSafePhotoDataUrl('data:image/svg+xml;base64,PHN2Zz4=', 1000), false);
    assert.equal(app.isSafePhotoDataUrl('https://evil.example/x.jpg', 1000), false);
    assert.equal(app.isSafePhotoDataUrl(jpeg, 20), false);
    assert.equal(app.isSafePhotoDataUrl('data:image/jpeg;base64,abc"onerror="x', 1000), false);
  });
});

describe('nokPerUnit', () => {
  // Kursene ligger i localStorage som { perNok: { EUR: 0.085, … } } (enheter per krone)
  function withRates(perNok) {
    const store = {};
    const localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    };
    const fresh = loadApp({ localStorage });
    localStorage.setItem(fresh.FX_STORAGE_KEY, JSON.stringify({ perNok }));
    return fresh;
  }

  test('kroner er alltid 1', () => {
    assert.equal(app.nokPerUnit('NOK'), 1);
    assert.equal(app.nokPerUnit(''), 1);
  });

  test('regner om fra enheter per krone til kroner per enhet', () => {
    const fx = withRates({ EUR: 0.08, SEK: 1 });
    assert.equal(fx.nokPerUnit('EUR'), 12.5);
    assert.equal(fx.nokPerUnit('SEK'), 1);
  });

  test('ukjent valuta eller manglende kurser gir 0 (ikke feil beløp)', () => {
    assert.equal(withRates({ EUR: 0.08 }).nokPerUnit('CHF'), 0);
    assert.equal(withRates({ EUR: 0 }).nokPerUnit('EUR'), 0);
  });
});
