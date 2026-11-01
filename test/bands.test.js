import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayBands } from '../engine/bands.js';
import { sunTimes } from '../engine/sun.js';

const FIU = [41.7695, 12.2125];
const H = 3600000;
const IDS = ['notte', 'alba', 'mattina', 'pomeriggio', 'tramonto', 'sera'];
const NOMI = ['Notte', 'Alba', 'Mattina', 'Pomeriggio', 'Tramonto', 'Sera'];

function controlla(giorno, oreAttese) {
  const b = dayBands(giorno, ...FIU);
  assert.deepEqual(b.map(x => x.id), IDS);
  assert.deepEqual(b.map(x => x.nome), NOMI);
  for (let i = 0; i < b.length - 1; i++) assert.equal(b[i].fine, b[i + 1].inizio);
  for (const x of b) assert.ok(x.fine - x.inizio > 0, `${giorno} ${x.id} durata`);
  assert.equal(b.at(-1).fine - b[0].inizio, oreAttese * H);
  return b;
}

test('1 novembre 2026: 6 fasce legate al sole, contigue, 24 ore', () => {
  const b = controlla('2026-11-01', 24);
  const s = sunTimes(Date.UTC(2026, 10, 1, 10), ...FIU);
  assert.equal(b[1].inizio, s.alba - H);
  assert.equal(b[1].fine, s.alba + 2 * H);
  assert.equal(b[4].inizio, s.tramonto - 2 * H);
  assert.equal(b[4].fine, s.tramonto + H);
});

test('25 ottobre 2026 (giorno di 25 ore, ritorno ora solare)', () => { controlla('2026-10-25', 25); });
test('29 marzo 2026 (giorno di 23 ore, ora legale)', () => { controlla('2026-03-29', 23); });
test('21 giugno e 21 dicembre: nessuna fascia vuota', () => { controlla('2026-06-21', 24); controlla('2026-12-21', 24); });

test('mattina e pomeriggio si dividono alle 12:00 locali anche nei giorni del cambio ora', () => {
  const ora = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const g of ['2026-10-25', '2026-03-29', '2026-11-01']) {
    assert.equal(ora.format(new Date(dayBands(g, ...FIU)[2].fine)), '12:00', g);
  }
});
