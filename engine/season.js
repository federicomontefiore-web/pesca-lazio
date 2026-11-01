// Stagionalità e divieti legali delle specie (dati in content/specie-base.json).
import { localDay } from './time.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const trova = (id, specie) => specie.find((s) => s.id === id);

/** 0 no · 1 scarso · 2 buono · 3 ottimo, per il mese locale di dateMs */
export function seasonLevel(speciesId, dateMs, specie) {
  const s = trova(speciesId, specie);
  if (!s) return 0;
  return s.stagione[Number(localDay(dateMs).slice(5, 7)) - 1];
}

/** {chiuso, motivo}: specie vietata o data dentro un periodo di divieto (anche a cavallo d'anno) */
export function closure(speciesId, dateMs, specie) {
  const s = trova(speciesId, specie);
  if (!s) return { chiuso: false, motivo: null };
  if (s.vietata) return { chiuso: true, motivo: s.motivoVietata || `Pesca di ${s.nome} vietata.` };
  const md = localDay(dateMs).slice(5);
  for (const d of s.divieti) {
    const dentro = d.dal <= d.al ? md >= d.dal && md <= d.al : md >= d.dal || md <= d.al;
    if (dentro) return { chiuso: true, motivo: d.motivo };
  }
  return { chiuso: false, motivo: null };
}

export const nomeMese = (m) => MESI[m - 1];
