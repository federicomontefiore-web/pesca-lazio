import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spots = JSON.parse(readFileSync(new URL('../spots.json', import.meta.url)));
const IDS = ['riva-traiano','santa-marinella','fiumicino-tevere','foce-arrone','foce-marta','anzio','bracciano','martignano','tos-marina-grosseto','tos-cala-forno'];
const LAGHI = ['bracciano','martignano'];
const FIUMI = ['fiumicino-tevere','foce-arrone','foce-marta'];

test('spots.json contiene i 10 spot della spec con id unici', () => {
  assert.deepEqual(spots.map(s => s.id).sort(), [...IDS].sort());
  assert.equal(new Set(spots.map(s => s.id)).size, 10);
});

test('coordinate nel Lazio / Toscana meridionale', () => {
  for (const s of spots) {
    assert.ok(s.lat > 41 && s.lat < 43, s.id);
    assert.ok(s.lon > 10.5 && s.lon < 13, s.id);
  }
});

test('flag mare, fiume ed esposizione coerenti', () => {
  for (const s of spots) {
    assert.equal(s.mare, !LAGHI.includes(s.id), s.id);
    assert.equal(s.fiume, FIUMI.includes(s.id), s.id);
    if (s.mare) assert.ok(Number.isInteger(s.esposizione) && s.esposizione >= 0 && s.esposizione < 360, s.id);
    else assert.equal(s.esposizione, null, s.id);
    assert.ok(['scogliera','molo','spiaggia','foce','lago','barca'].includes(s.tipo), s.id);
    assert.ok(typeof s.nome === 'string' && s.nome.length > 3);
    assert.ok(Number.isFinite(s.minutiDaRoma));
  }
});
