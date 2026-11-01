// Fasce del giorno legate al sole (fuso Europe/Rome).
import { sunTimes } from './sun.js';
import { localMidnight, nextDay, tzOffset } from './time.js';

const H = 3600000;
export const BANDE = [
  ['notte', 'Notte'], ['alba', 'Alba'], ['mattina', 'Mattina'],
  ['pomeriggio', 'Pomeriggio'], ['tramonto', 'Tramonto'], ['sera', 'Sera'],
];

/** Le 6 fasce del giorno locale dayISO ("YYYY-MM-DD"), contigue da mezzanotte a mezzanotte. */
export function dayBands(dayISO, lat, lon) {
  const inizio = localMidnight(dayISO);
  const fine = localMidnight(nextDay(dayISO));
  const s = sunTimes(inizio + 12 * H, lat, lon);
  // 12:00 locali (nei giorni di 23/25 ore non coincide con mezzanotte + 12 h)
  const dodici = inizio + 12 * H + tzOffset(inizio) - tzOffset(inizio + 12 * H);
  const confini = [inizio, s.alba - H, s.alba + 2 * H, dodici, s.tramonto - 2 * H, s.tramonto + H, fine];
  return BANDE.map(([id, nome], i) => ({ id, nome, inizio: confini[i], fine: confini[i + 1] }));
}
