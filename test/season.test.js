import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seasonLevel, closure } from '../engine/season.js';

const specie = JSON.parse(readFileSync(new URL('../content/specie-base.json', import.meta.url)));
const D = (s) => Date.parse(s + 'T10:00:00Z');

test('luccio chiuso dal 15 febbraio al 30 marzo (L.R. Lazio 87/1990)', () => {
  const c = closure('luccio', D('2026-03-10'), specie);
  assert.equal(c.chiuso, true); assert.match(c.motivo, /15 febbraio/);
  assert.equal(closure('luccio', D('2026-04-01'), specie).chiuso, false);
  assert.equal(closure('luccio', D('2026-02-15'), specie).chiuso, true);
  assert.equal(closure('luccio', D('2026-03-30'), specie).chiuso, true);
});

test('divieto a cavallo dell’anno (coregone 15 dicembre – 30 gennaio)', () => {
  assert.equal(closure('coregone', D('2026-12-20'), specie).chiuso, true);
  assert.equal(closure('coregone', D('2027-01-10'), specie).chiuso, true);
  assert.equal(closure('coregone', D('2026-02-05'), specie).chiuso, false);
});

test('anguilla sempre vietata nel 2026', () => {
  for (const g of ['2026-01-05', '2026-07-01', '2026-11-01']) assert.equal(closure('anguilla', D(g), specie).chiuso, true);
});

test('stagionalità: seppia buona a novembre, calamaro scarso a luglio', () => {
  assert.ok(seasonLevel('seppia', D('2026-11-01'), specie) >= 2);
  assert.ok(seasonLevel('calamaro', D('2026-07-15'), specie) <= 1);
});

test('specie sconosciuta: livello 0 e non chiusa', () => {
  assert.equal(seasonLevel('pesce-inventato', D('2026-11-01'), specie), 0);
  assert.equal(closure('pesce-inventato', D('2026-11-01'), specie).chiuso, false);
});

test('ogni specie ha 12 mesi, data di controllo e fonte della misura', () => {
  for (const s of specie) {
    assert.equal(s.stagione.length, 12, s.id);
    assert.ok(s.stagione.every((x) => [0, 1, 2, 3].includes(x)), s.id);
    assert.match(s.controllato, /^\d{4}-\d{2}-\d{2}$/, s.id);
    if (s.misuraMinimaCm !== null) assert.ok(s.fonteMisura, s.id);
    for (const d of s.divieti) { assert.match(d.dal, /^\d{2}-\d{2}$/); assert.match(d.al, /^\d{2}-\d{2}$/); assert.ok(d.fonte); }
  }
});

test('misure minime verificate', () => {
  const m = Object.fromEntries(specie.map((s) => [s.id, s.misuraMinimaCm]));
  assert.deepEqual(
    { spigola: m.spigola, orata: m.orata, 'sarago-maggiore': m['sarago-maggiore'], 'sarago-pizzuto': m['sarago-pizzuto'], 'sarago-fasciato': m['sarago-fasciato'], mormora: m.mormora, cefalo: m.cefalo, sgombro: m.sgombro, luccio: m.luccio, 'persico-reale': m['persico-reale'], 'black-bass': m['black-bass'], carpa: m.carpa, cavedano: m.cavedano, seppia: m.seppia },
    { spigola: 25, orata: 20, 'sarago-maggiore': 23, 'sarago-pizzuto': 18, 'sarago-fasciato': 18, mormora: 20, cefalo: 20, sgombro: 18, luccio: 30, 'persico-reale': 18, 'black-bass': 25, carpa: 25, cavedano: 18, seppia: null });
});
