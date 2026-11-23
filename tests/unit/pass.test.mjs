// Interrail-pass: reisedager, nattog-regelen og gyldighetsperiode (09-pass.js)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();
const plain = (x) => JSON.parse(JSON.stringify(x));
const train = (date, departureTime = '10:00', arrivalTime = '14:00', extra = {}) =>
  ({ isTravelDay: true, date, departureTime, arrivalTime, transfers: 0, ...extra });

describe('normalizePass', () => {
  test('gyldige pass beholdes', () => {
    assert.deepEqual(plain(app.normalizePass({ kind: 'flexi', travelDays: 7, periodMonths: 1 })),
      { kind: 'flexi', travelDays: 7, periodDays: 0, periodMonths: 1, startDate: '' });
    assert.deepEqual(plain(app.normalizePass({ kind: 'continuous', periodDays: 22, startDate: '2026-07-01' })),
      { kind: 'continuous', travelDays: 0, periodDays: 22, periodMonths: 0, startDate: '2026-07-01' });
  });

  test('ugyldige pass blir null', () => {
    assert.equal(app.normalizePass(null), null);
    assert.equal(app.normalizePass({ kind: 'gratis' }), null);
    assert.equal(app.normalizePass({ kind: 'flexi', travelDays: 0 }), null);
    assert.equal(app.normalizePass({ kind: 'continuous' }), null);
  });

  test('verdier klemmes til lovlige grenser og rare datoer fjernes', () => {
    const p = app.normalizePass({ kind: 'custom', travelDays: 500, periodDays: 9999, startDate: '1. juli' });
    assert.equal(p.travelDays, 90);
    assert.equal(p.periodDays, 400);
    assert.equal(p.startDate, '');
  });

  test('sammenhengende pass har aldri et tak på reisedager', () => {
    assert.equal(app.normalizePass({ kind: 'continuous', travelDays: 5, periodDays: 15 }).travelDays, 0);
  });
});

describe('passTravelDateOfTrain – nattog-regelen', () => {
  test('vanlig tog teller på avreisedagen', () => {
    assert.equal(app.passTravelDateOfTrain(train('2026-07-01')), '2026-07-01');
  });

  test('direkte nattog etter kl. 19 teller på ankomstdagen', () => {
    assert.equal(app.passTravelDateOfTrain(train('2026-07-01', '21:30', '07:15')), '2026-07-02');
    assert.equal(app.passTravelDateOfTrain(train('2026-07-31', '19:00', '06:00')), '2026-08-01');
  });

  test('nattog med bytte teller på avreisedagen', () => {
    assert.equal(app.passTravelDateOfTrain(train('2026-07-01', '21:30', '07:15', { transfers: 1 })), '2026-07-01');
  });

  test('tog før kl. 19 som kommer fram etter midnatt teller på avreisedagen', () => {
    assert.equal(app.passTravelDateOfTrain(train('2026-07-01', '18:59', '01:00')), '2026-07-01');
  });

  test('tog som ikke er reisedag, eller mangler dato, teller ikke', () => {
    assert.equal(app.passTravelDateOfTrain(train('2026-07-01', '10:00', '12:00', { isTravelDay: false })), null);
    assert.equal(app.passTravelDateOfTrain(train('')), null);
    assert.equal(app.passTravelDateOfTrain(null), null);
  });
});

describe('computePassStatus', () => {
  const flexi = { kind: 'flexi', travelDays: 4, periodMonths: 1, startDate: '2026-07-10' };

  test('teller hver reisedag én gang, selv med flere tog samme dag', () => {
    const s = app.computePassStatus(flexi, [
      train('2026-07-10'), train('2026-07-10', '15:00', '18:00'), train('2026-07-12'),
    ], {}, '2026-07-11');
    assert.equal(s.used, 2);
    assert.equal(s.remaining, 2);
    assert.equal(s.over, 0);
  });

  test('periode på én måned slutter dagen før samme dato neste måned', () => {
    const s = app.computePassStatus(flexi, [], {}, '2026-07-11');
    assert.equal(s.start, '2026-07-10');
    assert.equal(s.end, '2026-08-09');
    assert.equal(s.length, 31);
  });

  test('periode i dager: 15 dager er start + 14', () => {
    const s = app.computePassStatus({ kind: 'continuous', periodDays: 15, startDate: '2026-07-10' }, [], {}, '2026-07-10');
    assert.equal(s.end, '2026-07-24');
    assert.equal(s.unlimited, true);
    assert.equal(s.remaining, null);
  });

  test('skuddår: én måned fra 31. januar slutter 28. februar', () => {
    const s = app.computePassStatus({ kind: 'continuous', periodMonths: 1, startDate: '2028-01-31' }, [], {}, '2028-02-01');
    assert.equal(s.end, '2028-02-28');
  });

  test('status før, under og etter perioden', () => {
    assert.equal(app.computePassStatus(flexi, [], {}, '2026-07-01').state, 'before');
    const active = app.computePassStatus(flexi, [], {}, '2026-08-09');
    assert.equal(active.state, 'active');
    assert.equal(active.daysLeft, 1);
    assert.equal(app.computePassStatus(flexi, [], {}, '2026-08-10').state, 'expired');
  });

  test('reisedager utenfor perioden telles ikke, men vises som «utenfor»', () => {
    const s = app.computePassStatus(flexi, [train('2026-07-05'), train('2026-07-15')], {}, '2026-07-15');
    assert.equal(s.used, 1);
    assert.deepEqual(plain(s.outside), ['2026-07-05']);
  });

  test('flere reisedager enn passet har gir «over»', () => {
    const trains = ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15'].map((d) => train(d));
    const s = app.computePassStatus(flexi, trains, {}, '2026-07-15');
    assert.equal(s.remaining, 0);
    assert.equal(s.over, 2);
  });

  test('uten startdato i passet brukes reisens startdato', () => {
    const s = app.computePassStatus({ kind: 'flexi', travelDays: 5, periodMonths: 1 }, [], { startDate: '2026-06-20' }, '2026-06-01');
    assert.equal(s.start, '2026-06-20');
  });

  test('«hele reisen» bruker reisens sluttdato', () => {
    const s = app.computePassStatus({ kind: 'custom', travelDays: 3 }, [], { startDate: '2026-06-20', endDate: '2026-07-05' }, '2026-06-25');
    assert.equal(s.end, '2026-07-05');
    assert.equal(s.length, 16);
  });

  test('uten pass: ingen status', () => {
    assert.equal(app.computePassStatus(null, [train('2026-07-01')], {}).state, 'none');
  });
});
