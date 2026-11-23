// Felles utgifter: hvem skylder hvem (10-budsjett.js)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();
const plain = (x) => JSON.parse(JSON.stringify(x));
const people = (...ids) => ids.map((id) => ({ id }));
const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

describe('computeSharedBalances', () => {
  test('lik deling: den som betalte skal ha tilbake de andres del', () => {
    const bal = app.computeSharedBalances(
      [{ amount: 300, paidBy: 'a', split: ['a', 'b', 'c'] }],
      people('a', 'b', 'c'),
    );
    assert.deepEqual(plain(bal), { a: 20000, b: -10000, c: -10000 });
  });

  test('øre som ikke går opp fordeles uten at noe forsvinner', () => {
    const bal = app.computeSharedBalances(
      [{ amount: 100, paidBy: 'a', split: ['a', 'b', 'c'] }],
      people('a', 'b', 'c'),
    );
    assert.equal(sum(bal), 0);
    assert.deepEqual(plain(bal), { a: 6666, b: -3333, c: -3333 });
  });

  test('desimalbeløp regnes i hele øre (ingen flyttallsfeil)', () => {
    const bal = app.computeSharedBalances(
      [{ amount: 0.1 + 0.2, paidBy: 'a', split: ['b'] }],
      people('a', 'b'),
    );
    assert.deepEqual(plain(bal), { a: 30, b: -30 });
  });

  test('balansen går alltid i null, også med mange utgifter', () => {
    const expenses = [];
    const ids = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 200; i++) {
      const split = ids.filter((_, j) => (i + j) % 3 !== 0);
      expenses.push({ amount: (i * 37.13) % 997, paidBy: ids[i % 4], split: split.length ? split : ['a'] });
    }
    assert.equal(sum(app.computeSharedBalances(expenses, people(...ids))), 0);
  });

  test('utgifter uten beløp eller uten deltakere hoppes over', () => {
    const bal = app.computeSharedBalances(
      [
        { amount: 0, paidBy: 'a', split: ['b'] },
        { amount: 50, paidBy: 'a', split: [] },
        { amount: 50, paidBy: 'a' },
      ],
      people('a', 'b'),
    );
    assert.deepEqual(plain(bal), { a: 0, b: 0 });
  });

  test('betaler eller deltaker som har forlatt reisen tas fortsatt med', () => {
    const bal = app.computeSharedBalances(
      [{ amount: 90, paidBy: 'gone', split: ['a', 'gone', 'b'] }],
      people('a', 'b'),
    );
    assert.deepEqual(plain(bal), { a: -3000, b: -3000, gone: 6000 });
  });

  test('registrert betaling (oppgjør) nuller ut gjelden', () => {
    const bal = app.computeSharedBalances(
      [
        { kind: 'expense', amount: 200, paidBy: 'a', split: ['a', 'b'] },
        { kind: 'payment', amount: 100, paidBy: 'b', split: ['a'] },
      ],
      people('a', 'b'),
    );
    assert.deepEqual(plain(bal), { a: 0, b: 0 });
  });
});

describe('computeSettlementTransfers', () => {
  function applyTransfers(balances, transfers) {
    const out = { ...balances };
    for (const t of transfers) {
      out[t.from] += t.cents;
      out[t.to] -= t.cents;
    }
    return out;
  }

  test('overføringene gjør alle kvitt', () => {
    const balances = { a: 5000, b: -2000, c: -3000, d: 0 };
    const transfers = plain(app.computeSettlementTransfers(balances));
    assert.ok(Object.values(applyTransfers(balances, transfers)).every((v) => v === 0));
    assert.ok(transfers.every((t) => t.cents > 0));
  });

  test('aldri flere overføringer enn antall personer minus én', () => {
    const balances = { a: 7000, b: 3000, c: -4000, d: -2500, e: -3500 };
    const transfers = app.computeSettlementTransfers(balances);
    assert.ok(transfers.length <= Object.keys(balances).length - 1);
    assert.ok(Object.values(applyTransfers(balances, plain(transfers))).every((v) => v === 0));
  });

  test('ingen gjeld gir ingen overføringer', () => {
    assert.equal(app.computeSettlementTransfers({ a: 0, b: 0 }).length, 0);
  });

  test('ende-til-ende: utgifter → balanse → oppgjør', () => {
    const expenses = [
      { amount: 1234.5, paidBy: 'a', split: ['a', 'b', 'c'] },
      { amount: 99.99, paidBy: 'b', split: ['a', 'c'] },
      { amount: 450, paidBy: 'c', split: ['a', 'b', 'c'] },
    ];
    const bal = plain(app.computeSharedBalances(expenses, people('a', 'b', 'c')));
    const settled = applyTransfers(bal, plain(app.computeSettlementTransfers(bal)));
    assert.ok(Object.values(settled).every((v) => v === 0));
  });
});

describe('formatMoney', () => {
  // Intl bruker smalt mellomrom (U+00A0 / U+202F) som tusenskille – normaliser for lesbarhet
  const fmt = (n) => app.formatMoney(n).replace(/\s/g, ' ');

  test('hele kroner uten desimaler, øre med to', () => {
    assert.equal(fmt(1500), '1 500 kr');
    assert.equal(fmt(12.5), '12,50 kr');
    assert.equal(fmt(0), '0 kr');
  });

  test('ugyldige verdier blir 0 kr', () => {
    assert.equal(fmt(undefined), '0 kr');
    assert.equal(fmt('abc'), '0 kr');
  });
});
