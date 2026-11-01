// Dai dati orari di uno spot ricava le condizioni di una fascia.
import { moonInfo } from './moon.js';
import { localDay } from './time.js';

const H = 3600000;
const valide = (a) => a.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
const media = (a) => { const v = valide(a); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const massimo = (a) => { const v = valide(a); return v.length ? Math.max(...v) : null; };
const somma = (a) => { const v = valide(a); return v.length ? v.reduce((s, x) => s + x, 0) : null; };
const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

function mediaDirezioni(a) {
  const v = valide(a);
  if (!v.length) return null;
  const s = v.reduce((acc, d) => [acc[0] + Math.sin(d * Math.PI / 180), acc[1] + Math.cos(d * Math.PI / 180)], [0, 0]);
  return (Math.atan2(s[0], s[1]) * 180 / Math.PI + 360) % 360;
}
const distanzaAngolo = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function finestra(data, campo, da, a) {
  const serie = data[campo];
  if (!serie) return [];
  const out = [];
  for (let i = 0; i < data.ore.length; i++) if (data.ore[i] >= da && data.ore[i] < a) out.push(serie[i]);
  return out;
}
function valoreVicino(data, campo, t) {
  const serie = data[campo];
  if (!serie) return null;
  let best = null, dist = Infinity;
  for (let i = 0; i < data.ore.length; i++) {
    const d = Math.abs(data.ore[i] - t);
    if (d < dist && serie[i] !== null && Number.isFinite(serie[i])) { dist = d; best = serie[i]; }
  }
  return dist <= 3 * H ? best : null;
}
function mediana(v) { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

/** Condizioni della fascia `band` per lo spot (vedi Features nel piano). Campi senza dati = null. */
export function bandFeatures(data, band, spot) {
  const { inizio, fine } = band;
  const inFascia = (campo) => finestra(data, campo, inizio, fine);

  const ventoDir = mediaDirezioni(inFascia('ventoDir'));
  let ventoRelativo = null;
  if (spot.esposizione !== null && spot.esposizione !== undefined && ventoDir !== null) {
    const d = distanzaAngolo(ventoDir, spot.esposizione);
    ventoRelativo = d <= 60 ? 'da mare' : d >= 120 ? 'da terra' : 'laterale';
  }

  const onda = massimo(inFascia('onda'));
  let ondaTrend = null;
  const prima = media(finestra(data, 'onda', inizio - 12 * H, inizio));
  const ora = media(inFascia('onda'));
  if (prima !== null && ora !== null) ondaTrend = prima - ora >= 0.3 ? 'in calo' : ora - prima >= 0.3 ? 'in aumento' : 'stabile';

  const pIn = valoreVicino(data, 'pressione', inizio);
  const pPrima = valoreVicino(data, 'pressione', inizio - 12 * H);

  let portataRapporto = null;
  if (data.portata && data.portata.valori?.length) {
    const v = valide(data.portata.valori);
    const i = data.portata.giorni.indexOf(localDay(inizio));
    const oggi = i >= 0 ? data.portata.valori[i] : null;
    const med = v.length ? mediana(v) : null;
    if (oggi !== null && Number.isFinite(oggi) && med) portataRapporto = Math.round((oggi / med) * 100) / 100;
  }

  return {
    ventoMedio: r1(media(inFascia('vento'))),
    raffica: r1(massimo(inFascia('raffica'))),
    ventoDir: ventoDir === null ? null : Math.round(ventoDir),
    ventoRelativo,
    onda: r1(onda),
    ondaTrend,
    ondaPeriodo: r1(media(inFascia('ondaPeriodo'))),
    pressione: r1(media(inFascia('pressione'))),
    deltaP12h: pIn !== null && pPrima !== null ? r1(pIn - pPrima) : null,
    pioggia24: r1(somma(finestra(data, 'pioggia', inizio - 24 * H, inizio)) ?? 0),
    pioggia48: r1(somma(finestra(data, 'pioggia', inizio - 48 * H, inizio)) ?? 0),
    pioggia72: r1(somma(finestra(data, 'pioggia', inizio - 72 * H, inizio)) ?? 0),
    pioggiaFascia: r1(somma(inFascia('pioggia')) ?? 0),
    portataRapporto,
    tempMare: r1(media(inFascia('tempMare'))),
    temporale: valide(inFascia('codice')).some((c) => c === 95 || c === 96 || c === 99),
    luce: band.id,
    luna: moonInfo((inizio + fine) / 2),
  };
}
