// Bucketliste (22-bucketliste.js): rekkefølge, fremdrift, sletting og avhaking
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();
const plain = (v) => JSON.parse(JSON.stringify(v));

const item = (id, extra = {}) => ({
  id, text: 'Punkt ' + id, createdBy: 'a', createdByName: 'Anna', createdAt: '2026-11-0' + id + 'T10:00:00.000Z', done: false, ...extra,
});

describe('sortBucketItems', () => {
  test('ikke gjort først i rekkefølgen de ble lagt til, gjort sist med nyeste øverst', () => {
    const list = [
      item('3'),
      item('1', { done: true, doneAt: '2026-11-10T08:00:00.000Z' }),
      item('2'),
      item('4', { done: true, doneAt: '2026-11-12T08:00:00.000Z' }),
    ];
    assert.deepEqual(plain(app.sortBucketItems(list).map((i) => i.id)), ['2', '3', '4', '1']);
  });
  test('endrer ikke listen den får', () => {
    const list = [item('2'), item('1')];
    app.sortBucketItems(list);
    assert.deepEqual(list.map((i) => i.id), ['2', '1']);
  });
});

describe('bucketProgress', () => {
  test('teller gjort og totalt', () => {
    assert.deepEqual(plain(app.bucketProgress([item('1', { done: true }), item('2'), item('3')])), { done: 1, total: 3 });
    assert.deepEqual(plain(app.bucketProgress([])), { done: 0, total: 0 });
  });
});

describe('canDeleteBucketItem (samme regel som firestore.rules)', () => {
  test('den som la til, og reiseeieren, kan slette – ingen andre', () => {
    const it = item('1', { createdBy: 'anna' });
    assert.equal(app.canDeleteBucketItem(it, 'anna', false), true);
    assert.equal(app.canDeleteBucketItem(it, 'eier', true), true);
    assert.equal(app.canDeleteBucketItem(it, 'kari', false), false);
    assert.equal(app.canDeleteBucketItem(it, '', true), false);
  });
});

describe('cleanBucketItem', () => {
  test('sender bare felt reglene godtar (ikke _pending eller ukjente felt)', () => {
    const out = app.cleanBucketItem({ ...item('1'), _pending: true, hacked: 1, place: 'Paris' });
    assert.deepEqual(plain(Object.keys(out).sort()), ['createdAt', 'createdBy', 'createdByName', 'done', 'id', 'place', 'text']);
  });
  test('kutter for lang tekst og tar ikke med doneBy når punktet ikke er gjort', () => {
    const out = app.cleanBucketItem({ ...item('1'), text: 'x'.repeat(300), doneBy: 'kari', doneAt: 'i går' });
    assert.equal(out.text.length, 140);
    assert.equal(out.doneBy, undefined);
    assert.equal(out.doneAt, undefined);
  });
});

describe('toggledBucketItem', () => {
  const NOW = '2026-11-27T12:00:00.000Z';
  test('haker av: den som haker av står som doneBy, resten er uendret', () => {
    const out = app.toggledBucketItem(item('1', { createdBy: 'anna' }), 'kari', 'Kari', NOW);
    assert.equal(out.done, true);
    assert.equal(out.doneBy, 'kari');
    assert.equal(out.doneByName, 'Kari');
    assert.equal(out.doneAt, NOW);
    assert.equal(out.createdBy, 'anna');
    assert.equal(out.text, 'Punkt 1');
  });
  test('fjerner avhaking: doneBy/doneAt forsvinner', () => {
    const done = item('1', { done: true, doneBy: 'kari', doneByName: 'Kari', doneAt: NOW });
    const out = app.toggledBucketItem(done, 'anna', 'Anna', NOW);
    assert.equal(out.done, false);
    assert.equal('doneBy' in out, false);
    assert.equal('doneAt' in out, false);
  });
});
