// Voti 0–10 per fascia, con motivi e avvisi.
import { bandFeatures } from './features.js';
import { checkSafety } from './safety.js';
import { seasonLevel, closure } from './season.js';
import { dayBands } from './bands.js';
import { localDay, nextDay } from './time.js';

const BASE = { 3: 5, 2: 4, 1: 2 };
const clamp = (v) => Math.max(0, Math.min(10, Math.round(v * 2) / 2));

/** La regola vale per questo obiettivo/spot e la sua condizione è vera? (campo null → false) */
export function applies(regola, f, obiettivo, spot) {
  const a = regola.applicaA || {};
  if (a.tecniche && !a.tecniche.includes(obiettivo.tecnica)) return false;
  if (a.specie && !a.specie.includes(obiettivo.specie)) return false;
  if (a.tipiSpot && !a.tipiSpot.includes(spot.tipo)) return false;
  const v = f[regola.campo];
  if (v === null || v === undefined) return false;
  const x = regola.valore;
  switch (regola.op) {
    case '<': return v < x;
    case '<=': return v <= x;
    case '>': return v > x;
    case '>=': return v >= x;
    case '==': return v === x;
    case 'tra': return v >= x[0] && v <= x[1];
    case 'in': return x.includes(v);
    default: return false;
  }
}

/** Voto di una fascia: miglior obiettivo dello spot. */
export function scoreBand({ spot, obiettivi, data, band, regole, specie, soglie }) {
  const f = bandFeatures(data, band, spot);
  const sic = checkSafety(f, spot, soglie);
  if (sic.pericolo) {
    return { voto: 0, obiettivo: null, motivi: sic.avvisi.filter((a) => a.livello === 'rosso').map((a) => a.testo), avvisi: sic.avvisi, pericolo: true, condizioni: f };
  }
  let best = null;
  const esclusi = [];
  for (const ob of obiettivi) {
    const chiusa = closure(ob.specie, band.inizio, specie);
    if (chiusa.chiuso) { esclusi.push(chiusa.motivo); continue; }
    const livello = seasonLevel(ob.specie, band.inizio, specie);
    if (!livello) continue;
    const usate = regole.filter((r) => r.punti !== 0 && applies(r, f, ob, spot));
    const voto = clamp(BASE[livello] + usate.reduce((s, r) => s + r.punti, 0));
    const motivi = [...usate].sort((a, b) => Math.abs(b.punti) - Math.abs(a.punti)).slice(0, 3).map((r) => r.motivo);
    if (!motivi.length) motivi.push(livello === 3 ? 'Periodo ottimo per questa specie' : livello === 2 ? 'Periodo buono per questa specie' : 'Periodo poco favorevole per questa specie');
    if (!best || voto > best.voto) best = { voto, obiettivo: ob, motivi, livello };
  }
  if (!best) {
    return { voto: 0, obiettivo: null, motivi: esclusi.length ? [...new Set(esclusi)] : ['Nessuna specie adatta a questo spot nel periodo'], avvisi: sic.avvisi, pericolo: false, condizioni: f };
  }
  return { voto: best.voto, obiettivo: best.obiettivo, motivi: best.motivi, stagione: best.livello, avvisi: sic.avvisi, pericolo: false, condizioni: f };
}

/** Classifica di tutte le fasce future dei prossimi `giorni` giorni, per voto decrescente. */
export function rankAll({ spots, spotInfo, meteo, regole, specie, soglie, oraMs, giorni }) {
  const out = [];
  for (const spot of spots) {
    const data = meteo[spot.id];
    const obiettivi = spotInfo[spot.id]?.obiettivi;
    if (!data || !data.ore?.length || !obiettivi) continue;
    let giorno = localDay(oraMs);
    for (let g = 0; g < giorni; g++, giorno = nextDay(giorno)) {
      for (const band of dayBands(giorno, spot.lat, spot.lon)) {
        if (band.fine <= oraMs) continue;
        if (band.inizio > data.ore[data.ore.length - 1]) continue;
        const r = scoreBand({ spot, obiettivi, data, band, regole, specie, soglie });
        out.push({ spotId: spot.id, giorno, banda: band, ...r });
      }
    }
  }
  return out.sort((a, b) => b.voto - a.voto || a.banda.inizio - b.banda.inizio);
}
