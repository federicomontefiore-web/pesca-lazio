import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFeatures } from '../engine/features.js';
import { dayBands } from '../engine/bands.js';
import { makeData, ORA } from '../testlib/make-data.js';

const SM = { id: 'santa-marinella', tipo: 'scogliera', lat: 42.03, lon: 11.842, esposizione: 210, mare: true, fiume: false };
const FIU = { id: 'fiumicino-tevere', tipo: 'foce', lat: 41.7695, lon: 12.2125, esposizione: 250, mare: true, fiume: true };
const LAGO = { id: 'bracciano', tipo: 'lago', lat: 42.088, lon: 12.215, esposizione: null, mare: false, fiume: false };
const banda = (spot, id, g = '2026-11-01') => dayBands(g, spot.lat, spot.lon).find(b => b.id === id);
const numeriValidi = (f) => { for (const [k, v] of Object.entries(f)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k}=${v}`); };

test('giornata calma: onda bassa, nessun temporale, vento da terra', () => {
  const f = bandFeatures(makeData({ ventoDir: 30 }), banda(SM, 'tramonto'), SM);
  assert.ok(f.onda < 0.5);
  assert.equal(f.temporale, false);
  assert.equal(f.ventoRelativo, 'da terra');
  assert.equal(f.luce, 'tramonto');
  assert.ok(f.luna && typeof f.luna.nome === 'string');
  numeriValidi(f);
});

test('vento dal mare e laterale rispetto all’esposizione', () => {
  assert.equal(bandFeatures(makeData({ ventoDir: 220 }), banda(SM, 'mattina'), SM).ventoRelativo, 'da mare');
  assert.equal(bandFeatures(makeData({ ventoDir: 300 }), banda(SM, 'mattina'), SM).ventoRelativo, 'laterale');
  assert.equal(bandFeatures(makeData({ mare: false }), banda(LAGO, 'mattina'), LAGO).ventoRelativo, null);
});

test('mareggiata in calo: onda delle 12 h prima più alta di almeno 0,3 m', () => {
  const b = banda(SM, 'pomeriggio');
  const onda = (i, t) => (t < b.inizio ? 1.6 : 0.8);
  assert.equal(bandFeatures(makeData({ onda }), b, SM).ondaTrend, 'in calo');
  assert.equal(bandFeatures(makeData({ onda: (i, t) => (t < b.inizio ? 0.4 : 1.2) }), b, SM).ondaTrend, 'in aumento');
  assert.equal(bandFeatures(makeData({ onda: 0.5 }), b, SM).ondaTrend, 'stabile');
});

test('fiume in piena: pioggia 72 h e portata sopra la mediana', () => {
  const b = banda(FIU, 'mattina');
  const pioggia = (i, t) => (t < b.inizio && t >= b.inizio - 72 * 3600000 ? 1.2 : 0);
  const portata = { giorni: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'], valori: [20, 21, 19, 40, 70] };
  const f = bandFeatures(makeData({ fiume: true, pioggia, portata }), b, FIU);
  assert.ok(f.pioggia72 >= 60, `pioggia72 ${f.pioggia72}`);
  assert.ok(f.pioggia24 < f.pioggia48 && f.pioggia48 < f.pioggia72);
  assert.ok(f.portataRapporto >= 3, `rapporto ${f.portataRapporto}`);
});

test('temporale con codici WMO 95, 96, 99', () => {
  const b = banda(SM, 'sera');
  for (const c of [95, 96, 99]) {
    const codice = (i, t) => (t >= b.inizio && t < b.fine && i % 3 === 0 ? c : 2);
    assert.equal(bandFeatures(makeData({ codice }), b, SM).temporale, true, String(c));
  }
});

test('pressione e variazione in 12 ore', () => {
  const b = banda(SM, 'pomeriggio');
  const pressione = (i, t) => 1020 - (t - (b.inizio - 12 * 3600000)) / 3600000 * 0.5; // -0,5 hPa/h
  const f = bandFeatures(makeData({ pressione }), b, SM);
  assert.ok(Math.abs(f.deltaP12h - -6) < 0.6, `delta ${f.deltaP12h}`);
});

test('Review Focus: onde tutte null → onda e trend null, nessun NaN', () => {
  const f = bandFeatures(makeData({ onda: null, ondaPeriodo: null, tempMare: null }), banda(SM, 'alba'), SM);
  assert.equal(f.onda, null); assert.equal(f.ondaTrend, null); assert.equal(f.tempMare, null);
  numeriValidi(f);
});

test('Review Focus: valori null sparsi vengono ignorati', () => {
  const buchi = (v) => (i) => (i % 4 === 0 ? null : v);
  const f = bandFeatures(makeData({ vento: buchi(10), raffica: buchi(20), pressione: buchi(1015), pioggia: buchi(0.5), onda: buchi(0.4) }), banda(SM, 'mattina'), SM);
  assert.equal(f.ventoMedio, 10); assert.equal(f.raffica, 20); assert.equal(f.onda, 0.4);
  numeriValidi(f);
});

test('lago senza dati marini: campi marini null', () => {
  const f = bandFeatures(makeData({ mare: false }), banda(LAGO, 'alba'), LAGO);
  assert.equal(f.onda, null); assert.equal(f.portataRapporto, null);
  numeriValidi(f);
});
