// Funzioni pure della pagina: stato dei dati, regole attive, etichette.
const H = 3600000;

/** Stato dei dati dal db: vuoto | ok | vecchio (>12 h) | scaduto (>36 h). */
export function statoDati({ meta, meteo, oraMs }) {
  const mappa = {};
  const errori = [];
  for (const d of meteo || []) {
    if (!d?.data) continue;
    mappa[d.id] = d.data;
    if (d.data.errore) errori.push({ id: d.id, errore: d.data.errore });
  }
  const t = meta?.aggiornato ? Date.parse(meta.aggiornato) : NaN;
  if (!Number.isFinite(t) || !Object.keys(mappa).length) return { stato: 'vuoto', aggiornato: null, meteo: {}, errori: [] };
  const eta = oraMs - t;
  const stato = eta > 36 * H ? 'scaduto' : eta > 12 * H ? 'vecchio' : 'ok';
  return { stato, aggiornato: t, meteo: mappa, errori };
}

/** Regole personalizzate da config/regole se valide, altrimenti quelle iniziali. */
export function regoleAttive(config, regoleDefault) {
  const r = config?.regole;
  if (Array.isArray(r) && r.length && r.every((x) => x && typeof x.id === 'string' && typeof x.punti === 'number')) return r;
  return regoleDefault;
}

/** Stato del mare (scala Douglas) dall'altezza d'onda in metri. */
export function douglas(m) {
  if (m === null || m === undefined || !Number.isFinite(m)) return null;
  if (m === 0) return 'Calmo';
  if (m <= 0.1) return 'Quasi calmo';
  if (m <= 0.5) return 'Poco mosso';
  if (m <= 1.25) return 'Mosso';
  if (m <= 2.5) return 'Molto mosso';
  if (m <= 4) return 'Agitato';
  return 'Molto agitato';
}

const VENTI = ['Tramontana', 'Grecale', 'Levante', 'Scirocco', 'Ostro', 'Libeccio', 'Ponente', 'Maestrale'];
/** Nome del vento (rosa dei venti) dalla direzione di provenienza in gradi. */
export function ventoNome(gradi) {
  if (gradi === null || gradi === undefined) return null;
  return VENTI[Math.round((((gradi % 360) + 360) % 360) / 45) % 8];
}

const BASE = {
  scogliera: [['seppia', 'eging'], ['calamaro', 'eging'], ['sarago-maggiore', 'passata'], ['spigola', 'spinning']],
  molo: [['seppia', 'eging'], ['calamaro', 'eging'], ['spigola', 'spinning'], ['occhiata', 'galleggiante']],
  spiaggia: [['spigola', 'spinning'], ['orata', 'fondo-leggero'], ['mormora', 'fondo-leggero']],
  foce: [['spigola', 'spinning'], ['cefalo', 'galleggiante'], ['orata', 'fondo-leggero']],
  lago: [['persico-reale', 'spinning'], ['black-bass', 'spinning'], ['carpa', 'galleggiante']],
  barca: [['seppia', 'eging'], ['calamaro', 'eging'], ['serra', 'spinning']],
};
/** Obiettivi dello spot: dalla scheda se c'è, altrimenti quelli di base per tipo. */
export function obiettiviPerSpot(spot, spotInfo) {
  const o = spotInfo?.[spot.id]?.obiettivi;
  if (Array.isArray(o) && o.length) return o;
  return (BASE[spot.tipo] || BASE.spiaggia).map(([specie, tecnica]) => ({ specie, tecnica }));
}

/** Tiene, per ogni spot e giorno, solo la fascia con il voto più alto (lista già ordinata per voto). */
export function migliorePerGiorno(lista) {
  const visti = new Set();
  return lista.filter((r) => { const k = `${r.spotId}|${r.giorno}`; if (visti.has(k)) return false; visti.add(k); return true; });
}
