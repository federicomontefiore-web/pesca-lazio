import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const spots = J('../spots.json');
const info = J('../content/spot-info.json');
const specie = new Set(J('../content/specie-base.json').map((s) => s.id));
const TECNICHE = ['eging', 'spinning', 'passata', 'fondo-leggero', 'galleggiante'];

test('ogni spot ha la sua scheda', () => {
  assert.deepEqual(Object.keys(info).sort(), spots.map((s) => s.id).sort());
});

for (const s of spots) {
  test(`scheda ${s.id}: obiettivi, montature, divieti, sicurezza`, () => {
    const i = info[s.id];
    assert.ok(i.obiettivi.length >= 2);
    for (const o of i.obiettivi) {
      assert.ok(specie.has(o.specie), `specie ${o.specie}`);
      assert.ok(TECNICHE.includes(o.tecnica), `tecnica ${o.tecnica}`);
      assert.ok(i.montature[o.tecnica], `montatura per ${o.tecnica}`);
    }
    for (const [t, m] of Object.entries(i.montature)) {
      for (const k of ['mulinello', 'filo', 'finale', 'peso', 'amoOArtificiale', 'esca']) assert.ok(typeof m[k] === 'string' && m[k].length > 2, `${t}.${k}`);
      const grammi = [...m.peso.matchAll(/(\d+)\s*g/g)].map((x) => Number(x[1]));
      assert.ok(grammi.every((g) => g <= 30), `${t}: peso oltre 30 g (${m.peso})`);
    }
    assert.ok(i.dovePosizionarsi.length > 10);
    assert.ok(i.erroriDaEvitare.length >= 2);
    assert.ok(i.accesso && i.parcheggio);
    assert.match(i.mapsUrl, /^https:\/\/www\.google\.com\/maps\//);
    assert.ok(i.divieti.length >= 1);
    for (const d of i.divieti) { assert.ok(d.testo && d.fonte, 'divieto senza fonte'); assert.match(d.controllato, /^\d{4}-\d{2}-\d{2}$/); }
    assert.ok(i.sicurezza.some((x) => x.includes('1530')) && i.sicurezza.some((x) => x.includes('112')));
  });
}
