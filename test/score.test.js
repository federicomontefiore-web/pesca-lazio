import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreBand, rankAll, applies } from '../engine/score.js';
import { dayBands } from '../engine/bands.js';
import { makeData } from '../testlib/make-data.js';

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = J('../content/regole-default.json');
const specie = J('../content/specie-base.json');
const soglie = J('../content/sicurezza.json');
const spots = J('../spots.json');
const S = (id) => spots.find((s) => s.id === id);
const banda = (spot, id, g = '2026-11-01') => dayBands(g, spot.lat, spot.lon).find((b) => b.id === id);
const H = 3600000;

test('giornata perfetta per eging a Santa Marinella: voto alto con motivo', () => {
  const spot = S('santa-marinella');
  const r = scoreBand({ spot, obiettivi: [{ specie: 'seppia', tecnica: 'eging' }, { specie: 'sarago-maggiore', tecnica: 'passata' }], data: makeData({ onda: 0.3, vento: 8, ventoDir: 30 }), band: banda(spot, 'tramonto'), regole, specie, soglie });
  assert.ok(r.voto >= 7, `voto ${r.voto}`);
  assert.equal(r.obiettivo.tecnica, 'eging');
  assert.ok(r.motivi.some((m) => /mare calmo/i.test(m)), r.motivi.join(' | '));
  assert.equal(r.pericolo, false);
});

test('mareggiata sulla scogliera: voto 0 e avviso rosso', () => {
  const spot = S('santa-marinella');
  const r = scoreBand({ spot, obiettivi: [{ specie: 'seppia', tecnica: 'eging' }], data: makeData({ onda: 2.0 }), band: banda(spot, 'mattina'), regole, specie, soglie });
  assert.equal(r.voto, 0); assert.equal(r.pericolo, true);
  assert.ok(r.avvisi.some((a) => a.livello === 'rosso'));
});

test('Tevere in piena a Fiumicino: voto 0 e avviso fiume in piena', () => {
  const spot = S('fiumicino-tevere');
  const b = banda(spot, 'mattina');
  const pioggia = (i, t) => (t < b.inizio && t >= b.inizio - 72 * H ? 1.2 : 0);
  const portata = { giorni: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'], valori: [20, 20, 20, 40, 70] };
  const r = scoreBand({ spot, obiettivi: [{ specie: 'spigola', tecnica: 'spinning' }], data: makeData({ fiume: true, pioggia, portata }), band: b, regole, specie, soglie });
  assert.equal(r.voto, 0);
  assert.ok(r.avvisi.some((a) => /fiume in piena/.test(a.testo)));
});

test('luccio in periodo di divieto: nessun obiettivo, motivo divieto', () => {
  const spot = S('bracciano');
  const r = scoreBand({ spot, obiettivi: [{ specie: 'luccio', tecnica: 'spinning' }], data: makeData({ mare: false }), band: banda(spot, 'alba', '2026-03-10'), regole, specie, soglie });
  assert.equal(r.obiettivo, null); assert.equal(r.voto, 0);
  assert.ok(r.motivi.some((m) => /15 febbraio/.test(m)));
});

test('anguilla mai scelta come obiettivo', () => {
  const spot = S('bracciano');
  const r = scoreBand({ spot, obiettivi: [{ specie: 'anguilla', tecnica: 'fondo-leggero' }, { specie: 'persico-reale', tecnica: 'spinning' }], data: makeData({ mare: false }), band: banda(spot, 'tramonto'), regole, specie, soglie });
  assert.equal(r.obiettivo.specie, 'persico-reale');
});

test('voto sempre tra 0 e 10, a mezzi punti, massimo 3 motivi', () => {
  const spot = S('santa-marinella');
  const tante = Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, applicaA: {}, campo: 'onda', op: '<', valore: 5, punti: 3, motivo: 'motivo ' + i }));
  const r = scoreBand({ spot, obiettivi: [{ specie: 'seppia', tecnica: 'eging' }], data: makeData(), band: banda(spot, 'tramonto'), regole: tante, specie, soglie });
  assert.equal(r.voto, 10); assert.ok(r.motivi.length <= 3);
  const giu = tante.map((x) => ({ ...x, punti: -4 }));
  const r2 = scoreBand({ spot, obiettivi: [{ specie: 'seppia', tecnica: 'eging' }], data: makeData(), band: banda(spot, 'tramonto'), regole: giu, specie, soglie });
  assert.equal(r2.voto, 0);
  assert.equal(r.voto * 2 % 1, 0);
});

test('applies: operatori e filtri', () => {
  const f = { onda: 0.4, luce: 'tramonto', ventoMedio: null };
  const ob = { specie: 'seppia', tecnica: 'eging' };
  const sp = { tipo: 'scogliera' };
  assert.equal(applies({ applicaA: { tecniche: ['eging'] }, campo: 'onda', op: '<', valore: 0.5 }, f, ob, sp), true);
  assert.equal(applies({ applicaA: { tecniche: ['spinning'] }, campo: 'onda', op: '<', valore: 0.5 }, f, ob, sp), false);
  assert.equal(applies({ applicaA: { tipiSpot: ['foce'] }, campo: 'onda', op: '<', valore: 0.5 }, f, ob, sp), false);
  assert.equal(applies({ applicaA: {}, campo: 'onda', op: 'tra', valore: [0.3, 0.5] }, f, ob, sp), true);
  assert.equal(applies({ applicaA: {}, campo: 'luce', op: 'in', valore: ['alba', 'tramonto'] }, f, ob, sp), true);
  assert.equal(applies({ applicaA: {}, campo: 'ventoMedio', op: '>', valore: 1 }, f, ob, sp), false, 'campo null non applica');
});

test('rankAll: ordinato per voto, solo fasce future, tutti gli spot con dati', () => {
  const info = Object.fromEntries(spots.map((s) => [s.id, { obiettivi: s.mare ? [{ specie: 'seppia', tecnica: 'eging' }] : [{ specie: 'persico-reale', tecnica: 'spinning' }] }]));
  const meteo = Object.fromEntries(spots.filter((s) => s.id !== 'anzio').map((s) => [s.id, makeData({ mare: s.mare, fiume: s.fiume })]));
  const oraMs = Date.UTC(2026, 10, 1, 9);
  const out = rankAll({ spots, spotInfo: info, meteo, regole, specie, soglie, oraMs, giorni: 3 });
  assert.ok(out.length > 0);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].voto >= out[i].voto);
  assert.ok(out.every((r) => r.banda.fine > oraMs));
  assert.ok(!out.some((r) => r.spotId === 'anzio'));
  assert.equal(new Set(out.map((r) => r.giorno)).size, 3);
});

test('voto base senza regole: ottimo 5, buono 4, scarso 2 (10 solo con condizioni davvero favorevoli)', () => {
  const spot = S('santa-marinella');
  const b = banda(spot, 'mattina');
  const v = (sp) => scoreBand({ spot, obiettivi: [{ specie: sp, tecnica: 'eging' }], data: makeData(), band: b, regole: [], specie, soglie }).voto;
  assert.equal(v('seppia'), 5);      // novembre: ottimo
  assert.equal(v('polpo'), 4);       // novembre: buono
});
