// Costruisce dati SpotData di esempio (formato di data/meteo.json), un valore all'ora.
const H = 3600000;
export const INIZIO = Date.UTC(2026, 10, 1, 0) - 3 * 24 * H; // 3 giorni prima del 1/11/2026
export function makeData({ ore = 8 * 24, mare = true, fiume = false, ...f } = {}) {
  const v = (k, def) => (k in f ? f[k] : def);
  const serie = (x) => Array.from({ length: ore }, (_, i) => (typeof x === 'function' ? x(i, INIZIO + i * H) : x));
  const d = {
    ore: serie((i) => INIZIO + i * H),
    vento: serie(v('vento', 8)), raffica: serie(v('raffica', 15)), ventoDir: serie(v('ventoDir', 60)),
    pressione: serie(v('pressione', 1018)), pioggia: serie(v('pioggia', 0)), temp: serie(v('temp', 17)),
    nuvole: serie(v('nuvole', 20)), codice: serie(v('codice', 1)), aggiornato: '2026-11-01T05:00:00Z',
  };
  if (mare) Object.assign(d, { onda: serie(v('onda', 0.3)), ondaDir: serie(v('ondaDir', 240)), ondaPeriodo: serie(v('ondaPeriodo', 5)), tempMare: serie(v('tempMare', 19)) });
  if (fiume) d.portata = v('portata', { giorni: ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'], valori: [20, 20, 20, 20, 20] });
  return d;
}
export const ORA = (giorno, ora) => { const [y, m, dd] = giorno.split('-').map(Number); return Date.UTC(y, m - 1, dd, ora - 1); }; // ora locale CET (UTC+1)
