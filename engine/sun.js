// Alba e tramonto con l'algoritmo NOAA (precisione ~1 minuto alle nostre latitudini).
import { localDay } from './time.js';

const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

function solar(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M))
    + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
    - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  return { decl, eqTime };
}

// minuti UTC dall'inizio del giorno per alba (sign -1), mezzogiorno (0) o tramonto (+1)
function eventMinutes(jd0, lat, lon, sign) {
  let minutes = 720 - 4 * lon;
  for (let i = 0; i < 3; i++) {
    const { decl, eqTime } = solar(jd0 + minutes / 1440);
    const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
    const H = deg(Math.acos(Math.max(-1, Math.min(1, cosH))));
    minutes = 720 - 4 * (lon - sign * H) - eqTime;
  }
  return minutes;
}

/** Alba, tramonto e mezzogiorno solare (epoch ms UTC) del giorno locale (Europe/Rome) che contiene dateMs. */
export function sunTimes(dateMs, lat, lon) {
  const [y, m, d] = localDay(dateMs).split('-').map(Number);
  const day0 = Date.UTC(y, m - 1, d);
  const jd0 = day0 / 86400000 + 2440587.5;
  const at = (min) => Math.round(day0 + min * 60000);
  return {
    alba: at(eventMinutes(jd0, lat, lon, -1)),
    tramonto: at(eventMinutes(jd0, lat, lon, 1)),
    mezzogiorno: at(eventMinutes(jd0, lat, lon, 0)),
  };
}
