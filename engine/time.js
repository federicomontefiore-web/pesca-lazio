// Utilità per il fuso Europe/Rome. Tutti gli orari interni sono epoch ms UTC.
export const TZ = 'Europe/Rome';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });

/** "YYYY-MM-DD" del giorno locale che contiene ms */
export function localDay(ms) { return dayFmt.format(new Date(ms)); }

/** scarto (ms) tra ora locale e UTC nell'istante ms */
export function tzOffset(ms) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** epoch ms della mezzanotte locale di "YYYY-MM-DD" */
export function localMidnight(dayISO) {
  const [y, m, d] = dayISO.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ms = guess - tzOffset(guess);
  ms = guess - tzOffset(ms);
  return ms;
}

/** giorno successivo, "YYYY-MM-DD" */
export function nextDay(dayISO) {
  const [y, m, d] = dayISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** mese locale 1–12 */
export function localMonth(ms) { return Number(localDay(ms).slice(5, 7)); }
