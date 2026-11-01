import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSafety } from '../engine/safety.js';

const soglie = JSON.parse(readFileSync(new URL('../content/sicurezza.json', import.meta.url)));
const base = { ventoMedio: 10, raffica: 15, onda: 0.4, portataRapporto: null, pioggia72: 0, temporale: false };
const sc = { tipo: 'scogliera' }, sp = { tipo: 'spiaggia' }, fo = { tipo: 'foce' }, ba = { tipo: 'barca' }, la = { tipo: 'lago' };
const rossi = (r) => r.avvisi.filter((a) => a.livello === 'rosso');

test('condizioni tranquille: nessun avviso', () => {
  const r = checkSafety(base, sc, soglie);
  assert.equal(r.pericolo, false); assert.deepEqual(r.avvisi, []);
});

test('scogliera con onda 1,6 m: pericolo, testo chiaro', () => {
  const r = checkSafety({ ...base, onda: 1.6 }, sc, soglie);
  assert.equal(r.pericolo, true);
  assert.match(rossi(r)[0].testo, /onde/); assert.match(rossi(r)[0].testo, /1\.6 m/); assert.match(rossi(r)[0].testo, /non andare sugli scogli/);
});

test('spiaggia con onda 1,6 m: niente rosso', () => {
  assert.equal(rossi(checkSafety({ ...base, onda: 1.6 }, sp, soglie)).length, 0);
});

test('foce con portata 3,2 volte il normale: fiume in piena', () => {
  const r = checkSafety({ ...base, portataRapporto: 3.2 }, fo, soglie);
  assert.equal(r.pericolo, true); assert.match(rossi(r)[0].testo, /fiume in piena/);
});

test('foce con 70 mm di pioggia in 72 h: fiume in piena anche senza portata', () => {
  assert.match(rossi(checkSafety({ ...base, pioggia72: 70 }, fo, soglie))[0].testo, /fiume in piena/);
});

test('temporale: rosso ovunque, anche al lago', () => {
  for (const s of [sc, sp, fo, ba, la]) assert.match(rossi(checkSafety({ ...base, temporale: true }, s, soglie))[0].testo, /temporale/);
});

test('barca con raffiche 30 km/h: avviso arancione', () => {
  const r = checkSafety({ ...base, raffica: 30 }, ba, soglie);
  assert.equal(r.pericolo, false);
  assert.equal(r.avvisi[0].livello, 'arancione');
});

test('Review Focus: onda e raffica insieme → due rossi distinti, nessun duplicato', () => {
  const r = checkSafety({ ...base, onda: 1.6, raffica: 55 }, sc, soglie);
  assert.equal(rossi(r).length, 2);
  assert.equal(new Set(r.avvisi.map((a) => a.testo)).size, r.avvisi.length);
  assert.ok(!r.avvisi.some((a) => a.livello === 'arancione' && /onde/.test(a.testo)), 'niente arancione onde se c’è già il rosso');
});

test('dati mancanti (null): nessun avviso inventato', () => {
  assert.deepEqual(checkSafety({ ...base, onda: null, raffica: null }, sc, soglie).avvisi, []);
});
