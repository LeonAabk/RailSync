// Egen pakkeliste per person (04-budsjettlager-og-synkhjelpere.js og 10-budsjett.js)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from './load-app.mjs';

const app = loadApp();
const plain = (v) => JSON.parse(JSON.stringify(v));
const item = (id, checked = false, text = 'Ting ' + id) => ({ id, category: 'Elektronikk', text, checked });

describe('seedPackingFromSharedList – første gang fra den felles listen', () => {
  const shared = [item('a', true), item('b', false), { id: 'c', text: '  ' }, { text: 'uten id' }, null];

  test('alene på reisen: kryssene beholdes', () => {
    const e = plain(app.seedPackingFromSharedList(shared, true));
    assert.deepEqual(e.items.map((i) => [i.id, i.checked]), [['a', true], ['b', false]]);
    assert.equal(e.hidden, false);
  });

  test('flere på reisen: alt starter uten kryss, fordi vi ikke vet hvem som krysset av', () => {
    const e = plain(app.seedPackingFromSharedList(shared, false));
    assert.deepEqual(e.items.map((i) => i.checked), [false, false]);
  });

  test('kopien er også base, så en liste som allerede er i skyen vinner', () => {
    const e = plain(app.seedPackingFromSharedList(shared, true));
    assert.deepEqual(e._base, { items: e.items, hidden: false });
  });

  test('tom eller manglende liste gir tom pakkeliste', () => {
    assert.deepEqual(plain(app.seedPackingFromSharedList(undefined, true)).items, []);
  });
});

describe('mergePackingContent – samme liste endret på to enheter', () => {
  const base = { items: [item('a'), item('b')], hidden: false };

  test('kryss fra begge enheter beholdes', () => {
    const local = { items: [item('a', true), item('b')], hidden: false };
    const remote = { items: [item('a'), item('b', true)], hidden: false };
    const out = plain(app.mergePackingContent(base, local, remote));
    assert.deepEqual(out.items.map((i) => i.checked), [true, true]);
  });

  test('skjult på denne enheten vinner over uendret i skyen', () => {
    const out = app.mergePackingContent(base, { ...base, hidden: true }, base);
    assert.equal(out.hidden, true);
  });

  test('skjult i skyen beholdes når denne enheten ikke endret det', () => {
    const out = app.mergePackingContent(base, { ...base, items: [item('a', true), item('b')] }, { ...base, hidden: true });
    assert.equal(out.hidden, true);
  });
});

describe('packingContentOf', () => {
  test('rydder bort lokale felt og gir alltid items og hidden', () => {
    assert.deepEqual(plain(app.packingContentOf({ items: [item('a')], _base: {}, updatedAt: 'x' })), { items: [item('a')], hidden: false });
    assert.deepEqual(plain(app.packingContentOf(null)), { items: [], hidden: false });
  });
});

describe('pakkelisten er ikke lenger felles', () => {
  test('lagring av reisen skriver ikke pakkelisten inn i den felles reisen', () => {
    const src = app.syncStateToActiveTrip.toString();
    assert.doesNotMatch(src, /active\.packingList\s*=/, 'syncStateToActiveTrip skriver fortsatt felles packingList');
    assert.match(src, /updateMyPackingForTrip\(/);
  });

  test('endringer fra reisefølget overskriver ikke min pakkeliste på skjermen', () => {
    assert.doesNotMatch(app.applyContentToTrip.toString(), /appState\.packingList\s*=/);
  });

  test('pakkelistesiden har personvelger, skjul-bryter og lesemerknad', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    for (const id of ['packing-person-picker', 'packing-visibility', 'packing-readonly-note', 'packing-subtitle']) {
      assert.match(html, new RegExp(`id="${id}"`), `mangler #${id}`);
    }
    assert.match(html, /data-onchange="togglePackingHidden\(\)"/);
  });
});
