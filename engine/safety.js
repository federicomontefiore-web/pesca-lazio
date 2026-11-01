// Controllo pericoli: se c'è un avviso rosso il voto della fascia diventa 0.
const LUOGO = { scogliera: 'non andare sugli scogli', molo: 'non andare sul molo', spiaggia: 'resta lontano dalla battigia', foce: 'resta lontano dalla riva', barca: 'non uscire in barca', lago: 'resta a riva' };

/** {pericolo, avvisi:[{livello:'rosso'|'arancione', testo}]} */
export function checkSafety(f, spot, soglie) {
  const s = soglie[spot.tipo] || {};
  const avvisi = [];
  const add = (livello, testo) => avvisi.push({ livello, testo });
  const dove = LUOGO[spot.tipo] || 'fai attenzione';

  if (f.temporale) add('rosso', 'Previsto temporale: con la canna in mano rischi i fulmini, resta a casa.');

  if (f.onda !== null && f.onda !== undefined && s.ondaRosso !== undefined) {
    if (f.onda >= s.ondaRosso) add('rosso', `Mare grosso: onde fino a ${f.onda} m, ${dove}.`);
    else if (f.onda >= s.ondaArancione) add('arancione', `Mare mosso: onde fino a ${f.onda} m, attenzione.`);
  }
  if (f.raffica !== null && f.raffica !== undefined && s.rafficaRosso !== undefined) {
    if (f.raffica >= s.rafficaRosso) add('rosso', `Vento forte: raffiche fino a ${Math.round(f.raffica)} km/h, ${dove}.`);
    else if (f.raffica >= s.rafficaArancione) add('arancione', `Vento sostenuto: raffiche fino a ${Math.round(f.raffica)} km/h.`);
  }
  if (s.portataRosso !== undefined || s.pioggia72Rosso !== undefined) {
    const piena = (f.portataRapporto ?? 0) >= (s.portataRosso ?? Infinity) || (f.pioggia72 ?? 0) >= (s.pioggia72Rosso ?? Infinity);
    if (piena) add('rosso', 'Possibile fiume in piena: corrente forte e argini scivolosi, non avvicinarti.');
    else if ((f.portataRapporto ?? 0) >= (s.portataArancione ?? Infinity)) add('arancione', 'Fiume più alto del normale: acqua torbida e corrente, attenzione alla riva.');
  }
  return { pericolo: avvisi.some((a) => a.livello === 'rosso'), avvisi };
}
