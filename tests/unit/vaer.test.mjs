// Vær i dagsplanen (19-vaer.js): værmelding nær i tid, ellers vanlig vær for årstiden
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const app = loadApp();

describe('weatherKindForDate', () => {
  test('i dag og 15 dager fram er værmelding, dag 16 og senere er normalvær', () => {
    assert.equal(app.weatherKindForDate('2026-07-01', '2026-07-01'), 'forecast');
    assert.equal(app.weatherKindForDate('2026-07-16', '2026-07-01'), 'forecast');
    assert.equal(app.weatherKindForDate('2026-07-17', '2026-07-01'), 'normal');
    assert.equal(app.weatherKindForDate('2027-01-10', '2026-07-01'), 'normal');
  });
  test('tidligere dager og ugyldige datoer får ikke vær', () => {
    assert.equal(app.weatherKindForDate('2026-06-30', '2026-07-01'), '');
    assert.equal(app.weatherKindForDate('', '2026-07-01'), '');
    assert.equal(app.weatherKindForDate('1. juli', '2026-07-01'), '');
  });
  test('værmeldingen kommer 15 dager før datoen (samme grense som over)', () => {
    const date = '2026-08-20';
    const from = app.weatherForecastFrom(date);
    assert.equal(from, '2026-08-05');
    assert.equal(app.weatherKindForDate(date, from), 'forecast');
    assert.equal(app.weatherKindForDate(date, app.isoAddDays(from, -1)), 'normal');
  });
});

describe('weatherPlaceForDay', () => {
  test('bruker overnattingen, ellers stoppet man er på, og runder til 0,1°', () => {
    const night = { city: 'Paris', lat: 48.8566, lng: 2.3522 };
    const here = { city: 'Lyon', lat: 45.764, lng: 4.8357 };
    assert.deepEqual({ ...app.weatherPlaceForDay({ night, here }) }, { key: '48.9,2.4', lat: 48.9, lng: 2.4, city: 'Paris' });
    assert.equal(app.weatherPlaceForDay({ night: null, here }).city, 'Lyon');
  });
  test('uten stopp eller koordinater blir det ikke vær', () => {
    assert.equal(app.weatherPlaceForDay({ night: null, here: null }), null);
    assert.equal(app.weatherPlaceForDay({ night: { city: 'X' } }), null);
    assert.equal(app.weatherPlaceForDay({ night: { city: 'X', lat: 'abc', lng: 2 } }), null);
    assert.equal(app.weatherPlaceForDay({ night: { city: 'X', lat: 120, lng: 2 } }), null);
  });
  test('negative koordinater (vest for Greenwich) gir riktig nøkkel', () => {
    assert.equal(app.weatherPlaceForDay({ night: { city: 'Lisboa', lat: 38.7223, lng: -9.1393 } }).key, '38.7,-9.1');
  });
});

describe('parseWeatherForecast', () => {
  test('gjør om svaret til én rad per dato og runder temperaturene', () => {
    const out = app.parseWeatherForecast({
      daily: {
        time: ['2026-07-01', '2026-07-02'],
        weather_code: [2, 61],
        temperature_2m_max: [24.6, 19.2],
        temperature_2m_min: [14.4, 12.5],
        precipitation_probability_max: [10, null],
      },
    });
    assert.deepEqual(JSON.parse(JSON.stringify(out)), {
      '2026-07-01': { code: 2, max: 25, min: 14, rain: 10 },
      '2026-07-02': { code: 61, max: 19, min: 13, rain: null },
    });
  });
  test('dager uten temperatur (null) hoppes over i stedet for å vises som 0°', () => {
    const out = app.parseWeatherForecast({ daily: { time: ['2026-07-01'], weather_code: [0], temperature_2m_max: [null], temperature_2m_min: [10] } });
    assert.equal(Object.keys(out).length, 0);
  });
  test('tålte tomt eller ødelagt svar', () => {
    assert.equal(Object.keys(app.parseWeatherForecast(null)).length, 0);
    assert.equal(Object.keys(app.parseWeatherForecast({ daily: { time: 'x' } })).length, 0);
  });
});

describe('computeWeatherNormals', () => {
  // Lager et daglig historikksvar for flere år med samme temperatur hver dag
  function history(years, fn) {
    const time = [], max = [], min = [], precip = [];
    for (const y of years) {
      for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const v = fn(iso, y);
        time.push(iso); max.push(v.max); min.push(v.min); precip.push(v.precip);
      }
    }
    return { daily: { time, temperature_2m_max: max, temperature_2m_min: min, precipitation_sum: precip } };
  }

  test('snitt over årene for samme tid på året', () => {
    const normals = app.computeWeatherNormals(history([2024, 2025], (iso, y) => ({ max: y === 2024 ? 20 : 24, min: y === 2024 ? 10 : 14, precip: 0 })));
    assert.deepEqual([...normals['07-14']], [22, 12, 0]);
    assert.equal(Object.keys(normals).length, 366);
  });
  test('andel dager med minst 1 mm nedbør', () => {
    // Annenhver dag regn (2 mm), ellers 0,5 mm (teller ikke)
    const normals = app.computeWeatherNormals(history([2025], (iso) => ({ max: 15, min: 5, precip: Number(iso.slice(8)) % 2 ? 2 : 0.5 })));
    const pct = normals['07-14'][2];
    assert.ok(pct > 40 && pct < 60, `forventet rundt 50 %, fikk ${pct}`);
  });
  test('29. februar og årsskiftet får verdier fra dagene rundt', () => {
    const normals = app.computeWeatherNormals(history([2025], () => ({ max: 3, min: -4, precip: 0 })));
    assert.deepEqual([...normals['02-29']], [3, -4, 0]);
    assert.deepEqual([...normals['01-01']], [3, -4, 0]);
    assert.deepEqual([...normals['12-31']], [3, -4, 0]);
  });
  test('manglende verdier (null) teller ikke som 0°', () => {
    const normals = app.computeWeatherNormals(history([2025], (iso) => (iso.startsWith('2025-07') ? { max: null, min: null, precip: null } : { max: 30, min: 20, precip: 0 })));
    // Midt i juli finnes ingen data innen ±7 dager
    assert.equal(normals['07-15'], undefined);
    // Kanten av juli får bare data fra juni (30°), ikke null som 0°
    assert.deepEqual([...normals['07-02']], [30, 20, 0]);
  });
});

describe('tekst og ikoner', () => {
  test('værkoder gir norsk tekst og et ikon', () => {
    assert.equal(app.weatherCodeInfo(0).text, 'Klart');
    assert.equal(app.weatherCodeInfo(0).icon, 'sun');
    assert.equal(app.weatherCodeInfo(63).icon, 'cloud-rain');
    assert.equal(app.weatherCodeInfo(81).icon, 'cloud-rain');
    assert.equal(app.weatherCodeInfo(73).icon, 'cloud-snow');
    assert.equal(app.weatherCodeInfo(95).text, 'Torden');
    assert.equal(app.weatherCodeInfo(999).text, '');
  });
  test('regndager som «x av 10»', () => {
    assert.equal(app.weatherRainDaysText(0), 'sjelden regn');
    assert.equal(app.weatherRainDaysText(31), 'regn omtrent 3 av 10 dager');
    assert.equal(app.weatherRainDaysText(100), 'regn nesten hver dag');
    assert.equal(app.weatherRainDaysText(null), '');
  });
  test('minusgrader med ekte minustegn', () => {
    assert.equal(app.formatTemp(-3.4), '−3°');
    assert.equal(app.formatTemp(21.6), '22°');
  });
  test('normalvær for en dato', () => {
    assert.deepEqual({ ...app.weatherNormalFor({ '07-14': [24, 15, 30] }, '2027-07-14') }, { max: 24, min: 15, rainPct: 30 });
    assert.equal(app.weatherNormalFor({}, '2027-07-14'), null);
  });
});
