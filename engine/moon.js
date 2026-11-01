// Fase lunare dall'età media della luna (errore tipico < 0,6 giorni).
const SINODICO = 29.530588853;
const NUOVA_RIF = Date.UTC(2000, 0, 6, 18, 14);

const NOMI = ['Luna nuova', 'Luna crescente', 'Primo quarto', 'Gibbosa crescente', 'Luna piena', 'Gibbosa calante', 'Ultimo quarto', 'Luna calante'];

/** {fase 0–1 (0 nuova, 0.5 piena), illuminazione 0–1, nome} */
export function moonInfo(dateMs) {
  const giorni = (dateMs - NUOVA_RIF) / 86400000;
  const fase = ((giorni / SINODICO) % 1 + 1) % 1;
  const illuminazione = (1 - Math.cos(2 * Math.PI * fase)) / 2;
  const nome = NOMI[Math.round(fase * 8) % 8];
  return { fase, illuminazione, nome };
}
