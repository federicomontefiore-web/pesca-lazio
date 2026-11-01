import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSpotData, main } from '../scripts/fetch.mjs';

const T0 = Date.UTC(2026, 9, 29) / 1000;
const ore = (n) => Array.from({ length: n }, (_, i) => T0 + i * 3600);
const forecast = (n = 192) => ({ hourly: { time: ore(n), wind_speed_10m: ore(n).map(() => 10), wind_gusts_10m: ore(n).map(() => 20), wind_direction_10m: ore(n).map(() => 200), pressure_msl: ore(n).map(() => 1015), precipitation: ore(n).map(() => 0), temperature_2m: ore(n).map(() => 16), cloud_cover: ore(n).map(() => 50), weather_code: ore(n).map(() => 3) } });
const marine = (n = 192, v = 0.6) => ({ hourly: { time: ore(n).slice(5), wave_height: ore(n).slice(5).map(() => v), wave_direction: ore(n).slice(5).map(() => 240), wave_period: ore(n).slice(5).map(() => 6), sea_surface_temperature: ore(n).slice(5).map(() => 19) } });
const flood = () => ({ daily: { time: ['2026-10-30', '2026-10-31', '2026-11-01'], river_discharge: [30, 32, 35] } });
const MARE = { id: 'santa-marinella', lat: 42.03, lon: 11.84, mare: true, fiume: false };
const LAGO = { id: 'bracciano', lat: 42.08, lon: 12.21, mare: false, fiume: false };
const FOCE = { id: 'foce-arrone', lat: 41.86, lon: 12.18, mare: true, fiume: true };

test('buildSpotData: orari in ms, serie marine allineate agli orari forecast', () => {
  const d = buildSpotData(MARE, forecast(), marine(), null, '2026-11-01T05:00:00Z');
  assert.equal(d.ore[0], T0 * 1000);
  assert.equal(d.ore.length, 192);
  assert.equal(d.vento.length, 192); assert.equal(d.onda.length, 192);
  assert.equal(d.onda[0], null, 'prime 5 ore senza dato marino');
  assert.equal(d.onda[5], 0.6);
  assert.equal(d.aggiornato, '2026-11-01T05:00:00Z');
  assert.equal(d.portata, undefined);
});

test('buildSpotData: lago senza campi marini, foce con portata', () => {
  const l = buildSpotData(LAGO, forecast(), null, null, 'x');
  assert.equal(l.onda, undefined); assert.equal(l.tempMare, undefined);
  const f = buildSpotData(FOCE, forecast(), marine(), flood(), 'x');
  assert.deepEqual(f.portata, { giorni: ['2026-10-30', '2026-10-31', '2026-11-01'], valori: [30, 32, 35] });
});

test('Review Focus: risposta marina tutta null → campi presenti ma null, nessuna eccezione', () => {
  const d = buildSpotData(MARE, forecast(), marine(192, null), null, 'x');
  assert.ok(d.onda.every((v) => v === null));
});

test('ogni spot serializzato pesa meno di 200 KiB', () => {
  const d = buildSpotData(FOCE, forecast(), marine(), flood(), 'x');
  assert.ok(Buffer.byteLength(JSON.stringify(d)) < 200 * 1024);
});

test('main: se uno spot fallisce tiene i dati precedenti e segna l’errore', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pesca-'));
  const spotsPath = join(dir, 'spots.json'), outPath = join(dir, 'meteo.json');
  writeFileSync(spotsPath, JSON.stringify([MARE, LAGO]));
  writeFileSync(outPath, JSON.stringify({ generato: 'vecchio', spots: { bracciano: { ore: [1], vento: [5], aggiornato: 'ieri' } } }));
  const fetchFn = async (url) => {
    if (url.includes('latitude=42.08')) throw new Error('rete giù');
    const body = url.includes('marine-api') ? marine() : forecast();
    return { ok: true, status: 200, json: async () => body };
  };
  await main(fetchFn, { spotsPath, outPath, now: () => '2026-11-01T06:00:00Z', pausaMs: 0 });
  const out = JSON.parse(readFileSync(outPath));
  assert.equal(out.generato, '2026-11-01T06:00:00Z');
  assert.equal(out.spots['santa-marinella'].aggiornato, '2026-11-01T06:00:00Z');
  assert.equal(out.spots.bracciano.aggiornato, 'ieri');
  assert.deepEqual(out.spots.bracciano.vento, [5]);
  assert.match(out.spots.bracciano.errore, /rete giù/);
  assert.match(out.spots.bracciano.errore, /2026-11-01T06:00:00Z/);
});

test('main: URL corretti (GMT, unixtime, km/h, 3 giorni passati, 5 futuri)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pesca-'));
  const spotsPath = join(dir, 'spots.json'), outPath = join(dir, 'meteo.json');
  writeFileSync(spotsPath, JSON.stringify([FOCE]));
  const urls = [];
  const fetchFn = async (url) => { urls.push(url); const body = url.includes('marine-api') ? marine() : url.includes('flood-api') ? flood() : forecast(); return { ok: true, status: 200, json: async () => body }; };
  await main(fetchFn, { spotsPath, outPath, now: () => 'n', pausaMs: 0 });
  const f = urls.find((u) => u.startsWith('https://api.open-meteo.com/v1/forecast'));
  for (const p of ['timezone=GMT', 'timeformat=unixtime', 'wind_speed_unit=kmh', 'past_days=3', 'forecast_days=5']) assert.ok(f.includes(p), p);
  assert.ok(urls.some((u) => u.startsWith('https://marine-api.open-meteo.com/v1/marine')));
  assert.ok(urls.some((u) => u.startsWith('https://flood-api.open-meteo.com/v1/flood') && u.includes('past_days=30')));
});
