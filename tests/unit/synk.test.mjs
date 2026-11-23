// Samtidig redigering: sammenslåing av endringer, Firestore-trygge data og medlemskap (04-…js)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();
const plain = (x) => JSON.parse(JSON.stringify(x));
const ids = (list) => plain(list).map((x) => x.id);
const item = (id, extra = {}) => ({ id, name: `Ting ${id}`, ...extra });

describe('mergeItemList – tre-veis sammenslåing', () => {
  const base = [item(1), item(2), item(3)];

  test('begge legger til hver sin ting: begge beholdes', () => {
    const local = [...base, item(4)];
    const remote = [...base, item(5)];
    assert.deepEqual(ids(app.mergeItemList(base, local, remote)).sort(), [1, 2, 3, 4, 5]);
  });

  test('slettet lokalt og uendret i skyen: forblir slettet', () => {
    const local = [item(1), item(3)];
    assert.deepEqual(ids(app.mergeItemList(base, local, base)), [1, 3]);
  });

  test('slettet i skyen og uendret lokalt: forblir slettet', () => {
    const remote = [item(1), item(2)];
    assert.deepEqual(ids(app.mergeItemList(base, base, remote)), [1, 2]);
  });

  test('regresjon: slettet ting kommer ikke tilbake når feltene har annen rekkefølge fra Firestore', () => {
    // Firestore gir tilbake objektfelt i vilkårlig rekkefølge; det skal ikke tolkes som en endring.
    const remote = [{ name: 'Ting 1', id: 1 }, { name: 'Ting 2', id: 2 }, { name: 'Ting 3', id: 3 }];
    const local = [item(1), item(3)];
    assert.deepEqual(ids(app.mergeItemList(base, local, remote)), [1, 3]);
  });

  test('endret i skyen, slettet lokalt: endringen vinner (ingen data går tapt)', () => {
    const remote = [item(1), item(2, { name: 'Endret' }), item(3)];
    const local = [item(1), item(3)];
    assert.deepEqual(ids(app.mergeItemList(base, local, remote)), [1, 2, 3]);
  });

  test('begge endrer ulike ting: begge endringene beholdes', () => {
    const local = [item(1, { name: 'Lokal' }), item(2), item(3)];
    const remote = [item(1), item(2), item(3, { name: 'Sky' })];
    const merged = plain(app.mergeItemList(base, local, remote));
    assert.equal(merged.find((x) => x.id === 1).name, 'Lokal');
    assert.equal(merged.find((x) => x.id === 3).name, 'Sky');
  });

  test('begge endrer samme ting: den lokale endringen vinner', () => {
    const local = [item(1), item(2, { name: 'Lokal' }), item(3)];
    const remote = [item(1), item(2, { name: 'Sky' }), item(3)];
    assert.equal(plain(app.mergeItemList(base, local, remote))[1].name, 'Lokal');
  });

  test('lokal omsortering beholdes, og nye ting fra skyen kommer med', () => {
    const local = [item(3), item(1), item(2)];
    const remote = [...base, item(4)];
    const merged = ids(app.mergeItemList(base, local, remote));
    assert.deepEqual(merged.filter((id) => id !== 4), [3, 1, 2]);
    assert.ok(merged.includes(4));
  });

  test('ingen duplikater selv om samme id finnes to ganger', () => {
    const local = [item(1), item(1), item(2), item(3)];
    assert.deepEqual(ids(app.mergeItemList(base, local, base)), [1, 2, 3]);
  });
});

describe('mergeTripContent', () => {
  const content = (over = {}) => ({
    title: 'Tur',
    trip: { title: 'Tur', startDate: '2026-07-01', endDate: '2026-07-20' },
    stops: [{ id: 's1', city: 'Oslo', order: 1 }, { id: 's2', city: 'Berlin', order: 2 }],
    trains: [],
    packingList: [],
    dayPlan: [],
    ...over,
  });

  test('uten felles utgangspunkt brukes den lokale versjonen', () => {
    const local = content({ title: 'Lokal' });
    assert.equal(app.mergeTripContent(null, local, content()).title, 'Lokal');
  });

  test('ulike felt endret på hver side slås sammen', () => {
    const base = content();
    const local = content({ title: 'Ny tittel', trip: { ...base.trip, title: 'Ny tittel' } });
    const remote = content({ trip: { ...base.trip, endDate: '2026-07-25' } });
    const merged = plain(app.mergeTripContent(base, local, remote));
    assert.equal(merged.title, 'Ny tittel');
    assert.equal(merged.trip.title, 'Ny tittel');
    assert.equal(merged.trip.endDate, '2026-07-25');
  });

  test('stopp nummereres på nytt etter sammenslåing', () => {
    const base = content();
    const local = content({ stops: [...base.stops, { id: 's3', city: 'Praha', order: 3 }] });
    const remote = content({ stops: [{ id: 's0', city: 'Bergen', order: 1 }, ...base.stops] });
    const merged = plain(app.mergeTripContent(base, local, remote));
    assert.deepEqual(merged.stops.map((s) => s.order), merged.stops.map((_, i) => i + 1));
    assert.equal(merged.stops.length, 4);
  });
});

describe('canonicalJson', () => {
  test('feltrekkefølge spiller ingen rolle', () => {
    assert.equal(app.canonicalJson({ a: 1, b: { c: 2, d: 3 } }), app.canonicalJson({ b: { d: 3, c: 2 }, a: 1 }));
  });

  test('undefined-felt ignoreres, men listerekkefølge betyr noe', () => {
    assert.equal(app.canonicalJson({ a: 1, b: undefined }), app.canonicalJson({ a: 1 }));
    assert.notEqual(app.canonicalJson([1, 2]), app.canonicalJson([2, 1]));
  });
});

describe('firestoreSafe', () => {
  test('lister i lister gjøres om (Firestore støtter ikke det)', () => {
    assert.deepEqual(plain(app.firestoreSafe({ route: [[59.9, 10.7], [52.5, 13.4]] })),
      { route: [{ lat: 59.9, lng: 10.7 }, { lat: 52.5, lng: 13.4 }] });
    assert.deepEqual(plain(app.firestoreSafe([['a', 'b']])), [{ items: ['a', 'b'] }]);
  });

  test('undefined, NaN og Infinity fjernes', () => {
    assert.deepEqual(plain(app.firestoreSafe({ a: undefined, b: NaN, c: Infinity, d: 1 })), { b: null, c: null, d: 1 });
    assert.deepEqual(plain(app.firestoreSafe([undefined, 2])), [null, 2]);
  });
});

describe('normalizeGeometry', () => {
  test('godtar både [lat, lng] og { lat, lng }, og fjerner ugyldige punkter', () => {
    assert.deepEqual(plain(app.normalizeGeometry([[1, 2], { lat: '3', lng: 4 }, null, ['x', 5], { lat: 6 }])),
      [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    assert.deepEqual(plain(app.normalizeGeometry('ikke en liste')), []);
  });
});

describe('computeMembership', () => {
  test('redaktører og eier får skrivetilgang, lesere og gjester ikke', () => {
    const m = plain(app.computeMembership({
      owner: { uid: 'eier' },
      members: [
        { id: 'eier', uid: 'eier', role: 'owner' },
        { uid: 'red', role: 'editor' },
        { uid: 'les', role: 'viewer' },
        { id: 'mem_123', role: 'editor' }, // gjest uten konto
        { id: 'traveler_1', role: 'editor' }, // eksempelprofil
      ],
    }));
    assert.deepEqual(m.memberUids.sort(), ['eier', 'les', 'red']);
    assert.deepEqual(m.editorUids.sort(), ['eier', 'red']);
  });
});
