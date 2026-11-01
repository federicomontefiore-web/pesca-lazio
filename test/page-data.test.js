import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statoDati, regoleAttive, douglas, ventoNome } from '../page/src/data.js';

const regoleDefault = JSON.parse(readFileSync(new URL('../content/regole-default.json', import.meta.url)));
const ORA = Date.UTC(2026, 10, 1, 12);
const H = 3600000;

test('Review Focus: database vuoto → stato "vuoto", nessun crash', () => {
  assert.deepEqual(statoDati({ meta: null, meteo: [], oraMs: ORA }), { stato: 'vuoto', aggiornato: null, meteo: {}, errori: [] });
  assert.equal(statoDati({ meta: undefined, meteo: undefined, oraMs: ORA }).stato, 'vuoto');
});

test('dati freschi, vecchi (>12 h) e scaduti (>36 h)', () => {
  const meteo = [{ id: 'anzio', data: { ore: [1], vento: [3] } }];
  const s = (oreFa) => statoDati({ meta: { aggiornato: new Date(ORA - oreFa * H).toISOString() }, meteo, oraMs: ORA });
  assert.equal(s(2).stato, 'ok');
  assert.equal(s(13).stato, 'vecchio');
  assert.equal(s(40).stato, 'scaduto');
  assert.deepEqual(Object.keys(s(2).meteo), ['anzio']);
  assert.equal(s(2).aggiornato, ORA - 2 * H);
});

test('meta presente ma nessuno spot → vuoto; errori degli spot raccolti', () => {
  assert.equal(statoDati({ meta: { aggiornato: new Date(ORA).toISOString() }, meteo: [], oraMs: ORA }).stato, 'vuoto');
  const r = statoDati({ meta: { aggiornato: new Date(ORA).toISOString() }, meteo: [{ id: 'anzio', data: { ore: [1], errore: 'HTTP 500 (x)' } }], oraMs: ORA });
  assert.deepEqual(r.errori, [{ id: 'anzio', errore: 'HTTP 500 (x)' }]);
});

test('regole: default se config assente o malformata, personalizzate se presenti', () => {
  assert.deepEqual(regoleAttive(null, regoleDefault), regoleDefault);
  assert.deepEqual(regoleAttive({ regole: 'rotto' }, regoleDefault), regoleDefault);
  const mie = [{ ...regoleDefault[0], punti: 1 }];
  assert.deepEqual(regoleAttive({ regole: mie }, regoleDefault), mie);
});

test('scala Douglas e nomi dei venti', () => {
  assert.equal(douglas(0), 'Calmo'); assert.equal(douglas(0.3), 'Poco mosso'); assert.equal(douglas(0.9), 'Mosso');
  assert.equal(douglas(2), 'Molto mosso'); assert.equal(douglas(3), 'Agitato'); assert.equal(douglas(null), null);
  assert.equal(ventoNome(0), 'Tramontana'); assert.equal(ventoNome(225), 'Libeccio'); assert.equal(ventoNome(135), 'Scirocco'); assert.equal(ventoNome(315), 'Maestrale'); assert.equal(ventoNome(350), 'Tramontana');
});

import { obiettiviPerSpot } from '../page/src/data.js';
test('spot nuovo senza scheda: obiettivi di base dal tipo', () => {
  assert.deepEqual(obiettiviPerSpot({ id: 'x', tipo: 'lago' }, {}).map((o) => o.tecnica), ['spinning', 'spinning', 'galleggiante']);
  assert.ok(obiettiviPerSpot({ id: 'x', tipo: 'scogliera' }, {}).some((o) => o.tecnica === 'eging'));
  assert.ok(obiettiviPerSpot({ id: 'x', tipo: 'foce' }, {}).some((o) => o.specie === 'spigola'));
  const info = { y: { obiettivi: [{ specie: 'orata', tecnica: 'fondo-leggero' }] } };
  assert.deepEqual(obiettiviPerSpot({ id: 'y', tipo: 'foce' }, info), info.y.obiettivi);
});

import { migliorePerGiorno } from '../page/src/data.js';
test('classifica: una sola riga per spot e giorno, la migliore', () => {
  const r = (spotId, giorno, voto, inizio) => ({ spotId, giorno, voto, banda: { inizio } });
  const out = migliorePerGiorno([r('a', 'g1', 9, 3), r('a', 'g1', 8, 1), r('b', 'g1', 8, 2), r('a', 'g2', 7, 5)]);
  assert.deepEqual(out.map((x) => `${x.spotId}${x.giorno}${x.voto}`), ['ag19', 'bg18', 'ag27']);
});
