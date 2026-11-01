import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunTimes } from '../engine/sun.js';
import { moonInfo } from '../engine/moon.js';

// Oracolo: sunrisesunsettime.org, Roma 41.891930, 12.511330, ora Europe/Rome (controllato 2026-11-01)
const ROMA = [41.89193, 12.51133];
const RIF = [
  ['2026-01-01', '07:38', '16:50'], ['2026-03-28', '06:01', '18:31'],
  ['2026-03-29', '06:59', '19:32'], ['2026-03-30', '06:57', '19:33'],
  ['2026-04-15', '06:31', '19:51'], ['2026-06-21', '05:36', '20:49'],
  ['2026-08-15', '06:19', '20:12'], ['2026-10-24', '07:33', '18:17'],
  ['2026-10-25', '06:34', '17:15'], ['2026-11-01', '06:43', '17:06'],
  ['2026-12-15', '07:31', '16:40'],
];
const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const minuti = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const localMin = (ms) => minuti(fmt.format(new Date(ms)));

for (const [giorno, alba, tramonto] of RIF) {
  test(`alba e tramonto a Roma il ${giorno} entro 2 minuti`, () => {
    const [y, m, d] = giorno.split('-').map(Number);
    const t = sunTimes(Date.UTC(y, m - 1, d, 10), ...ROMA);
    assert.ok(Math.abs(localMin(t.alba) - minuti(alba)) <= 2, `alba ${fmt.format(new Date(t.alba))} vs ${alba}`);
    assert.ok(Math.abs(localMin(t.tramonto) - minuti(tramonto)) <= 2, `tramonto ${fmt.format(new Date(t.tramonto))} vs ${tramonto}`);
    assert.ok(t.alba < t.mezzogiorno && t.mezzogiorno < t.tramonto);
  });
}

test('alba restituita appartiene al giorno locale richiesto anche a tarda sera', () => {
  const t = sunTimes(Date.UTC(2026, 10, 1, 22, 30), ...ROMA); // 23:30 del 1/11 a Roma
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(t.alba)), '2026-11-01');
});

// Oracolo: almanac.com, fasi lunari gennaio 2026 (orari ET convertiti in UTC)
const FASI = [
  [Date.UTC(2026, 0, 3, 10, 4), 0.5, 'Luna piena'],
  [Date.UTC(2026, 0, 10, 15, 49), 0.75, 'Ultimo quarto'],
  [Date.UTC(2026, 0, 18, 19, 53), 0, 'Luna nuova'],
  [Date.UTC(2026, 0, 26, 4, 48), 0.25, 'Primo quarto'],
];
for (const [ms, fase, nome] of FASI) {
  test(`fase lunare ${nome} ${new Date(ms).toISOString().slice(0, 10)}`, () => {
    const l = moonInfo(ms);
    const diff = Math.min(Math.abs(l.fase - fase), 1 - Math.abs(l.fase - fase));
    assert.ok(diff < 0.03, `fase ${l.fase}`);
    assert.equal(l.nome, nome);
  });
}

test('illuminazione: piena ~1, nuova ~0, quarti ~0.5', () => {
  assert.ok(moonInfo(FASI[0][0]).illuminazione > 0.97);
  assert.ok(moonInfo(FASI[2][0]).illuminazione < 0.03);
  assert.ok(Math.abs(moonInfo(FASI[1][0]).illuminazione - 0.5) < 0.1);
});
