// Pesca Lazio — pagina principale. Vanilla JS, dati dal db dell'artifact.
import { rankAll, scoreBand, dayBands, sunTimes, moonInfo, seasonLevel, closure, localDay, nextDay, localMonth, nomeMese } from '../../engine/index.js';
import { statoDati, regoleAttive, douglas, ventoNome, obiettiviPerSpot, migliorePerGiorno } from './data.js';
import { drawChart, aggrega } from './charts.js';
import SPOTS_BASE from '../../spots.json';
import SPOT_INFO from '../../content/spot-info.json';
import SPECIE from '../../content/specie-base.json';
import SOGLIE from '../../content/sicurezza.json';
import REGOLE_DEFAULT from '../../content/regole-default.json';

const H = 3600000;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtGiorno = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' });
const fmtGiornoBreve = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const fmtData = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const nomeSpecie = (id) => SPECIE.find((s) => s.id === id)?.nome || id;
const TECNICA = { eging: 'eging', spinning: 'spinning', passata: 'passata con galleggiante', 'fondo-leggero': 'fondo leggero', galleggiante: 'galleggiante' };
const LIVELLO = ['fuori stagione', 'scarso', 'buono', 'ottimo'];
const TIPO = { scogliera: 'Scogliera', molo: 'Molo / porto', spiaggia: 'Spiaggia', foce: 'Foce', lago: 'Lago', barca: 'In barca' };

const S = {
  db: null, user: null, mcp: null, isOwner: false,
  meta: null, meteoDocs: [], config: null, spotsDb: null,
  filtri: leggiFiltri(), selezione: null, messaggio: null, caricato: false, timeout: false,
};

function leggiFiltri() {
  try { return { giorno: 'tutti', ambiente: 'tutti', distanza: 'tutti', ...JSON.parse(localStorage.getItem('filtri') || '{}') }; } catch { return { giorno: 'tutti', ambiente: 'tutti', distanza: 'tutti' }; }
}
function salvaFiltri() { try { localStorage.setItem('filtri', JSON.stringify(S.filtri)); } catch { /* opzionale */ } }
function cacheScrivi() { try { localStorage.setItem('ultimi', JSON.stringify({ meta: S.meta, meteoDocs: S.meteoDocs, spotsDb: S.spotsDb })); } catch { /* opzionale */ } }
function cacheLeggi() { try { const c = JSON.parse(localStorage.getItem('ultimi') || 'null'); if (c) Object.assign(S, c); } catch { /* opzionale */ } }

const spots = () => (Array.isArray(S.spotsDb) && S.spotsDb.length ? S.spotsDb : SPOTS_BASE);
const spotById = (id) => spots().find((s) => s.id === id);
const infoSpot = (id) => SPOT_INFO[id] || {};

function calcola() {
  const ora = Date.now();
  const dati = statoDati({ meta: S.meta, meteo: S.meteoDocs, oraMs: ora });
  const regole = regoleAttive(S.config, REGOLE_DEFAULT);
  const spotInfo = Object.fromEntries(spots().map((s) => [s.id, { obiettivi: obiettiviPerSpot(s, SPOT_INFO) }]));
  const classifica = dati.stato === 'vuoto' ? [] : rankAll({ spots: spots(), spotInfo, meteo: dati.meteo, regole, specie: SPECIE, soglie: SOGLIE, oraMs: ora, giorni: 5 });
  return { ora, dati, regole, spotInfo, classifica };
}

function classeVoto(r, scaduto) {
  if (scaduto) return 'v-grigio';
  if (r.pericolo) return 'v-rosso';
  if (r.voto >= 7) return 'v-verde';
  if (r.voto >= 4) return 'v-giallo';
  return 'v-grigio';
}
const votoTxt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

// ---------- intestazione ----------
function renderStato(c) {
  const d = c.dati;
  const box = $('#stato');
  if (!S.caricato && !S.timeout) { box.className = 'stato'; box.textContent = 'Carico i dati…'; return; }
  if (d.stato === 'vuoto') { box.className = 'stato s-arancio'; box.textContent = S.timeout ? 'Dati non raggiungibili' : 'In attesa del primo aggiornamento'; return; }
  const quando = fmtData.format(new Date(d.aggiornato));
  box.className = 'stato' + (d.stato === 'ok' ? '' : d.stato === 'vecchio' ? ' s-arancio' : ' s-grigio');
  box.textContent = d.stato === 'ok' ? `Dati del ${quando}` : d.stato === 'vecchio' ? `Dati vecchi: ${quando}` : `Dati troppo vecchi: ${quando}`;
}

function bottoneAggiorna() {
  if (!S.mcp || !S.meta?.triggerId) return '';
  return `<button class="btn" id="aggiorna" type="button">Aggiorna ora</button>`;
}

// ---------- Dove e quando ----------
function filtra(lista, c) {
  const oggi = localDay(c.ora), domani = nextDay(oggi);
  return lista.filter((r) => {
    const sp = spotById(r.spotId);
    if (S.filtri.giorno === 'oggi' && r.giorno !== oggi) return false;
    if (S.filtri.giorno === 'domani' && r.giorno !== domani) return false;
    if (S.filtri.giorno === 'weekend') { const g = new Date(r.banda.inizio + 2 * H).toLocaleDateString('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }); if (g !== 'Sat' && g !== 'Sun') return false; }
    if (S.filtri.ambiente === 'mare' && !sp.mare) return false;
    if (S.filtri.ambiente === 'dolce' && sp.mare) return false;
    if (S.filtri.distanza === '45' && sp.minutiDaRoma > 45) return false;
    if (S.filtri.distanza === '90' && sp.minutiDaRoma > 90) return false;
    return true;
  });
}

function chip(gruppo, valore, testo) {
  const on = S.filtri[gruppo] === valore;
  return `<button type="button" class="chip${on ? ' on' : ''}" data-filtro="${gruppo}" data-valore="${valore}" aria-pressed="${on}">${testo}</button>`;
}

function rigaClassifica(r, c) {
  const sp = spotById(r.spotId);
  const scaduto = c.dati.stato === 'scaduto';
  const arancioni = r.avvisi.filter((a) => a.livello === 'arancione');
  const quando = `${fmtGiornoBreve.format(new Date(r.banda.inizio + 2 * H))} · ${r.banda.nome} ${fmtOra.format(new Date(r.banda.inizio))}–${fmtOra.format(new Date(r.banda.fine))}`;
  return `<li><a class="riga" href="#spot-${esc(r.spotId)}">
    <span class="voto ${classeVoto(r, scaduto)}" aria-label="voto ${votoTxt(r.voto)} su 10">${votoTxt(r.voto)}</span>
    <span class="riga-corpo">
      <span class="riga-titolo">${esc(sp.nome)}</span>
      <span class="riga-quando">${quando}</span>
      ${r.obiettivo ? `<span class="riga-obiettivo">${esc(nomeSpecie(r.obiettivo.specie))} · ${TECNICA[r.obiettivo.tecnica]}</span>` : ''}
      <span class="riga-motivi">${r.motivi.map(esc).join(' · ')}</span>
      ${arancioni.length ? `<span class="avviso-mini">⚠ ${esc(arancioni[0].testo)}</span>` : ''}
    </span></a></li>`;
}

function questoMese(c) {
  const per = {};
  for (const sp of spots()) for (const o of obiettiviPerSpot(sp, SPOT_INFO)) {
    const liv = seasonLevel(o.specie, c.ora, SPECIE);
    if (liv < 2 || closure(o.specie, c.ora, SPECIE).chiuso) continue;
    (per[o.tecnica] ||= new Map()).set(o.specie, liv);
  }
  const righe = Object.entries(per).map(([t, m]) => `<li><b>${TECNICA[t][0].toUpperCase() + TECNICA[t].slice(1)}</b>: ${[...m].sort((a, b) => b[1] - a[1]).map(([s, l]) => `${esc(nomeSpecie(s).toLowerCase())}${l === 3 ? ' <span class="ottimo">ottimo</span>' : ''}`).join(', ')}</li>`);
  const chiuse = SPECIE.filter((s) => closure(s.id, c.ora, SPECIE).chiuso).map((s) => s.nome.toLowerCase());
  return `<section class="pannello"><h2>A ${nomeMese(localMonth(c.ora))} ha senso provare</h2><ul class="mese">${righe.join('')}</ul>
    ${chiuse.length ? `<p class="nota">Chiuse o vietate adesso: ${esc(chiuse.join(', '))}.</p>` : ''}
    <p class="nota">Tutte queste tecniche si fanno con la tua Ukiyo 500 (esche 10–30 g).</p></section>`;
}

function viewDove(c) {
  if (c.dati.stato === 'vuoto') {
    return `<section class="vuoto-grande"><h1>Primo aggiornamento in arrivo</h1>
      <p>Qui comparirà la classifica di dove e quando conviene pescare nei prossimi 5 giorni, con il voto da 0 a 10 per ogni fascia del giorno e il motivo.</p>
      <p>I dati meteo arrivano da soli due volte al giorno.${S.meta?.triggerId ? ' Se non vuoi aspettare, tocca il pulsante.' : ''}</p>${bottoneAggiorna()}</section>${questoMese(c)}`;
  }
  const perSpot = new Map();
  for (const r of c.classifica) if (r.pericolo) {
    const p = perSpot.get(r.spotId) || { giorni: new Set(), testo: r.motivi[0] };
    p.giorni.add(fmtGiornoBreve.format(new Date(r.banda.inizio + 2 * H)));
    perSpot.set(r.spotId, p);
  }
  const pericoli = [...perSpot].map(([id, p]) => `<li><b>${esc(spotById(id).nome.split(',')[0].split('(')[0].trim())}</b> (${[...p.giorni].join(', ')}): ${esc(p.testo)}</li>`);
  const lista = migliorePerGiorno(filtra(c.classifica, c).filter((r) => r.voto > 0)).slice(0, 15);
  return `${pericoli.length ? `<section class="pericoli" role="alert"><h2>Pericolo</h2><ul>${pericoli.slice(0, 5).join('')}</ul>${pericoli.length > 5 ? `<p>…e altri ${pericoli.length - 5} spot. Guarda le loro schede.</p>` : ''}</section>` : ''}
    ${c.dati.stato === 'scaduto' ? '<p class="banner b-grigio">Dati troppo vecchi: i voti non sono affidabili. ' + (S.meta?.triggerId ? 'Tocca “Aggiorna ora”.' : 'Riprova più tardi.') + '</p>' : c.dati.stato === 'vecchio' ? '<p class="banner b-arancio">I dati hanno più di 12 ore: le previsioni potrebbero essere cambiate.</p>' : ''}
    <div class="filtri" role="group" aria-label="Filtri">
      <div>${chip('giorno', 'tutti', 'Tutti')}${chip('giorno', 'oggi', 'Oggi')}${chip('giorno', 'domani', 'Domani')}${chip('giorno', 'weekend', 'Weekend')}</div>
      <div>${chip('ambiente', 'tutti', 'Mare e lago')}${chip('ambiente', 'mare', 'Mare')}${chip('ambiente', 'dolce', 'Acqua dolce')}</div>
      <div>${chip('distanza', 'tutti', 'Ovunque')}${chip('distanza', '45', 'Entro 45 min')}${chip('distanza', '90', 'Entro 1 h 30')}</div>
    </div>
    <p class="garanzia">Il voto è un aiuto, non una garanzia. Per ogni spot e giorno vedi solo la fascia migliore.</p>
    ${lista.length ? `<ol class="classifica">${lista.map((r) => rigaClassifica(r, c)).join('')}</ol>` : '<p class="vuoto">Nessuna occasione con questi filtri. Prova “Tutti”.</p>'}
    ${bottoneAggiorna()}
    ${questoMese(c)}`;
}

// ---------- Spot ----------
function viewSpotLista(c) {
  const migliore = {};
  for (const r of c.classifica) if (!migliore[r.spotId] || r.voto > migliore[r.spotId].voto) migliore[r.spotId] = r;
  return `<h1 class="titolo-vista">I tuoi spot</h1><ul class="spot-lista">${spots().map((sp) => {
    const m = migliore[sp.id];
    return `<li><a class="riga" href="#spot-${esc(sp.id)}">
      <span class="voto ${m ? classeVoto(m, c.dati.stato === 'scaduto') : 'v-grigio'}">${m ? votoTxt(m.voto) : '–'}</span>
      <span class="riga-corpo"><span class="riga-titolo">${esc(sp.nome)}</span>
      <span class="riga-quando">${TIPO[sp.tipo]} · ${sp.minutiDaRoma >= 120 ? 'Toscana' : `circa ${sp.minutiDaRoma} min da Roma`}</span>
      ${m ? `<span class="riga-motivi">Meglio: ${fmtGiornoBreve.format(new Date(m.banda.inizio + 2 * H))}, ${m.banda.nome.toLowerCase()}</span>` : ''}</span></a></li>`;
  }).join('')}</ul><p class="nota">Per aggiungere uno spot vai in <a href="#altro">Altro → Nuovo spot</a>.</p>`;
}

function striscia(sp, c) {
  const righe = [];
  let g = localDay(c.ora);
  const tutte = c.classifica.filter((r) => r.spotId === sp.id);
  for (let i = 0; i < 5; i++, g = nextDay(g)) {
    const bande = dayBands(g, sp.lat, sp.lon);
    const celle = bande.map((b) => {
      const r = tutte.find((x) => x.giorno === g && x.banda.id === b.id);
      if (!r) return '<td class="cella passata" aria-label="passata">·</td>';
      const sel = S.selezione === `${g}|${b.id}`;
      return `<td><button type="button" class="cella ${classeVoto(r, c.dati.stato === 'scaduto')}${sel ? ' sel' : ''}" data-cella="${g}|${b.id}" aria-label="${b.nome} ${votoTxt(r.voto)} su 10">${r.pericolo ? '!' : votoTxt(r.voto)}</button></td>`;
    });
    righe.push(`<tr><th scope="row">${fmtGiornoBreve.format(new Date(dayBands(g, sp.lat, sp.lon)[2].inizio))}</th>${celle.join('')}</tr>`);
  }
  let dett = '';
  const sel = S.selezione && tutte.find((x) => `${x.giorno}|${x.banda.id}` === S.selezione);
  const r = sel || tutte.filter((x) => !x.pericolo).sort((a, b) => b.voto - a.voto)[0] || tutte[0];
  if (r) {
    const f = r.condizioni;
    const cond = [
      f.ventoMedio !== null && `Vento ${Math.round(f.ventoMedio)} km/h${f.ventoDir !== null ? ` da ${ventoNome(f.ventoDir)}` : ''}${f.ventoRelativo ? ` (${f.ventoRelativo})` : ''}, raffiche ${Math.round(f.raffica)}`,
      f.onda !== null && `Mare ${douglas(f.onda).toLowerCase()} (onde ${String(f.onda).replace('.', ',')} m${f.ondaTrend && f.ondaTrend !== 'stabile' ? `, ${f.ondaTrend}` : ''})`,
      f.tempMare !== null && `Acqua ${Math.round(f.tempMare)} °C`,
      f.pressione !== null && `Pressione ${Math.round(f.pressione)} hPa${f.deltaP12h !== null ? ` (${f.deltaP12h > 0 ? '+' : ''}${String(f.deltaP12h).replace('.', ',')} in 12 h)` : ''}`,
      `Pioggia ultimi 3 giorni ${String(f.pioggia72).replace('.', ',')} mm`,
      `${f.luna.nome}`,
    ].filter(Boolean);
    dett = `<div class="dettaglio"><p class="dett-titolo"><span class="voto ${classeVoto(r, c.dati.stato === 'scaduto')}">${votoTxt(r.voto)}</span> ${fmtGiornoBreve.format(new Date(r.banda.inizio + 2 * H))}, ${r.banda.nome.toLowerCase()} ${fmtOra.format(new Date(r.banda.inizio))}–${fmtOra.format(new Date(r.banda.fine))}</p>
      ${r.obiettivo ? `<p><b>${esc(nomeSpecie(r.obiettivo.specie))}</b> a ${TECNICA[r.obiettivo.tecnica]}</p>` : ''}
      <ul class="motivi">${r.motivi.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      ${r.avvisi.length ? `<ul class="avvisi">${r.avvisi.map((a) => `<li class="a-${a.livello}">${esc(a.testo)}</li>`).join('')}</ul>` : ''}
      <p class="cond">${cond.map(esc).join(' · ')}</p></div>`;
  }
  return `<div class="tabella-scroll"><table class="striscia"><thead><tr><th></th>${['Notte', 'Alba', 'Matt.', 'Pom.', 'Tram.', 'Sera'].map((n) => `<th scope="col">${n}</th>`).join('')}</tr></thead><tbody>${righe.join('')}</tbody></table></div>
    <p class="nota">Tocca una casella per vedere il motivo del voto. “!” = pericolo.</p>${dett}`;
}

function soleLuna(sp, c) {
  let g = localDay(c.ora);
  const r = [];
  for (let i = 0; i < 5; i++, g = nextDay(g)) {
    const t = sunTimes(dayBands(g, sp.lat, sp.lon)[2].inizio, sp.lat, sp.lon);
    const l = moonInfo(t.mezzogiorno);
    r.push(`<tr><th scope="row">${fmtGiornoBreve.format(new Date(t.mezzogiorno))}</th><td>${fmtOra.format(new Date(t.alba))}</td><td>${fmtOra.format(new Date(t.tramonto))}</td><td>${l.nome} (${Math.round(l.illuminazione * 100)}%)</td></tr>`);
  }
  return `<div class="tabella-scroll"><table class="dati"><thead><tr><th></th><th>Alba</th><th>Tramonto</th><th>Luna</th></tr></thead><tbody>${r.join('')}</tbody></table></div>`;
}

function schedaPrincipiante(sp, c) {
  const i = infoSpot(sp.id);
  const ob = obiettiviPerSpot(sp, SPOT_INFO);
  const mese = ob.map((o) => {
    const liv = seasonLevel(o.specie, c.ora, SPECIE), ch = closure(o.specie, c.ora, SPECIE);
    return `<li>${esc(nomeSpecie(o.specie))} a ${TECNICA[o.tecnica]}: <b>${ch.chiuso ? 'chiusa' : LIVELLO[liv]}</b>${ch.chiuso ? ` (${esc(ch.motivo)})` : ''}</li>`;
  }).join('');
  const mont = Object.entries(i.montature || {}).map(([t, m]) => `<details><summary>Montatura per ${TECNICA[t]}</summary><dl class="montatura">
    <dt>Mulinello</dt><dd>${esc(m.mulinello)}</dd><dt>Filo</dt><dd>${esc(m.filo)}</dd><dt>Finale</dt><dd>${esc(m.finale)}</dd>
    <dt>Peso</dt><dd>${esc(m.peso)}</dd><dt>Amo / artificiale</dt><dd>${esc(m.amoOArtificiale)}</dd><dt>Esca</dt><dd>${esc(m.esca)}</dd></dl></details>`).join('');
  return `<section class="pannello"><h2>Scheda da principiante</h2>
    <h3>Specie a ${nomeMese(localMonth(c.ora))}</h3><ul>${mese}</ul>
    ${mont}
    ${i.dovePosizionarsi ? `<h3>Dove posizionarti</h3><p>${esc(i.dovePosizionarsi)}</p>` : ''}
    ${i.erroriDaEvitare ? `<h3>Errori da evitare</h3><ul>${i.erroriDaEvitare.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    </section>
    <section class="pannello"><h2>Come arrivare</h2>
    ${i.accesso ? `<p>${esc(i.accesso)}</p>` : ''}${i.parcheggio ? `<p><b>Parcheggio:</b> ${esc(i.parcheggio)}</p>` : ''}
    <a class="btn" href="${esc(i.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${sp.lat},${sp.lon}`)}" target="_blank" rel="noopener">Portami lì (Google Maps)</a></section>
    <section class="pannello"><h2>Divieti e limiti da controllare</h2><ul class="divieti">${(i.divieti || [{ testo: 'Spot aggiunto da te: controlla tu divieti e ordinanze della zona.', fonte: '', controllato: '' }]).map((d) => `<li>${esc(d.testo)}${d.fonte ? ` <span class="fonte">Fonte: ${linkFonte(d.fonte)}${d.controllato ? `, controllato il ${esc(d.controllato.split('-').reverse().join('/'))}` : ''}</span>` : ''}</li>`).join('')}</ul></section>
    <section class="pannello sicurezza"><h2>Sicurezza</h2><ul>${(i.sicurezza || ['Emergenze in mare: Guardia Costiera 1530; emergenze generali: 112']).map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>`;
}

function linkFonte(f) {
  const m = String(f).match(/https?:\/\/\S+/);
  const testo = String(f).replace(/\s*—?\s*https?:\/\/\S+/, '').replace(/[,:]\s*$/, '') || (m ? new URL(m[0]).hostname.replace(/^www\./, '') : 'fonte');
  return m ? `<a href="${esc(m[0])}" target="_blank" rel="noopener">${esc(testo)}</a>` : esc(f);
}

function viewSpot(id, c) {
  const sp = spotById(id);
  if (!sp) return `<p class="vuoto">Spot non trovato. <a href="#spot">Torna alla lista</a>.</p>`;
  const data = c.dati.meteo[id];
  return `<a class="indietro" href="#spot">← Tutti gli spot</a>
    <h1 class="titolo-vista">${esc(sp.nome)}</h1>
    <p class="sotto">${TIPO[sp.tipo]} · ${sp.minutiDaRoma >= 120 ? 'Toscana, con la barca' : `circa ${sp.minutiDaRoma} min da Roma nord`}</p>
    ${data?.errore ? `<p class="banner b-arancio">${esc(data.errore.startsWith('Onde') ? 'Dati delle onde non disponibili per questo spot.' : 'Ultimo aggiornamento non riuscito: mostro i dati precedenti.')}</p>` : ''}
    ${data ? `<section class="pannello"><h2>Quando andare</h2><p class="garanzia">Il voto è un aiuto, non una garanzia.</p>${striscia(sp, c)}</section>
    <section class="pannello"><h2>Vento e raffiche</h2><div class="chart" id="g-vento"></div></section>
    ${sp.mare ? '<section class="pannello"><h2>Onde</h2><div class="chart" id="g-onde"></div></section>' : ''}
    <section class="pannello"><h2>Pressione</h2><div class="chart" id="g-press"></div><p class="nota">Un calo lento prima del maltempo spesso fa mangiare i pesci; una salita veloce dopo il maltempo li rende apatici.</p></section>
    <section class="pannello"><h2>Pioggia</h2><div class="chart" id="g-pioggia"></div><p class="nota">Millimetri ogni 6 ore. Alle foci, la pioggia dei giorni prima rende l'acqua torbida: piace alla spigola, non alle seppie.</p></section>`
    : '<p class="banner b-arancio">Dati non disponibili per questo spot: arriveranno con il prossimo aggiornamento.</p>'}
    <section class="pannello"><h2>Alba, tramonto e luna</h2>${soleLuna(sp, c)}</section>
    ${schedaPrincipiante(sp, c)}`;
}

function disegnaGrafici(id, c) {
  const d = c.dati.meteo[id];
  if (!d) return;
  const da = c.ora - 24 * H, a = d.ore.at(-1);
  const base = { ore: d.ore, da, a, ora: c.ora };
  const g = (sel) => document.querySelector(sel);
  if (g('#g-vento')) drawChart(g('#g-vento'), { ...base, titolo: 'Vento e raffiche', unita: 'km/h', serie: [{ nome: 'Vento medio', valori: d.vento, classe: 's1' }, { nome: 'Raffiche', valori: d.raffica, classe: 's2', tratteggio: true }] });
  if (g('#g-onde')) drawChart(g('#g-onde'), { ...base, titolo: 'Altezza onde', unita: 'm', yMax: 1.5, serie: [{ nome: 'Onde', valori: d.onda || [], classe: 's1', area: true }] });
  if (g('#g-press')) drawChart(g('#g-press'), { ...base, titolo: 'Pressione', unita: 'hPa', yAuto: true, serie: [{ nome: 'Pressione', valori: d.pressione, classe: 's1' }] });
  if (g('#g-pioggia')) { const p = aggrega(d.ore, d.pioggia, 6); drawChart(g('#g-pioggia'), { ore: p.ore, da, a, ora: c.ora, titolo: 'Pioggia', unita: 'mm', tipo: 'barre', yMax: 3, serie: [{ nome: 'Pioggia', valori: p.valori, classe: 's1' }] }); }
}

// ---------- Pesci (Tappa 2) ----------
function viewPesci(c) {
  const righe = SPECIE.map((s) => {
    const ch = closure(s.id, c.ora, SPECIE);
    return `<tr><th scope="row">${esc(s.nome)}</th><td>${s.ambiente === 'dolce' ? 'dolce' : s.ambiente === 'mare' ? 'mare' : 'mare e dolce'}</td><td class="num">${s.misuraMinimaCm ? s.misuraMinimaCm + ' cm' : '—'}</td><td>${s.vietata ? '<b>vietata</b>' : ch.chiuso ? '<b>chiusa ora</b>' : s.divieti.map((d) => `${d.dal.split('-').reverse().join('/')}–${d.al.split('-').reverse().join('/')}`).join(', ') || '—'}</td></tr>`;
  }).join('');
  return `<h1 class="titolo-vista">Pesci</h1>
    <p class="banner b-info">L'enciclopedia completa (come riconoscerli, esche, pericoli, “Che pesce è?” con la foto) arriva nella prossima tappa. Intanto ecco misure minime e divieti.</p>
    <div class="tabella-scroll"><table class="dati"><thead><tr><th>Specie</th><th>Acqua</th><th>Misura minima</th><th>Divieto</th></tr></thead><tbody>${righe}</tbody></table></div>
    <p class="nota">“—” nella misura: nessuna misura minima nazionale trovata (per seppia, calamaro e polpo rilascia comunque gli esemplari piccoli). Fonti: Reg. (UE) 2019/1241 All. IX, D.P.R. 1639/1968 art. 87, L.R. Lazio 87/1990 art. 12. Controllato il 01/11/2026. Le regole cambiano: in caso di dubbio vale la fonte ufficiale.</p>`;
}

function viewDiario() {
  return `<h1 class="titolo-vista">Diario</h1><section class="vuoto-grande"><h2>In arrivo nella prossima tappa</h2>
    <p>Qui segnerai le uscite: spot, esca, catture. Quando segni un pesce la pagina ti avviserà se è sotto misura, protetto o in periodo di divieto.</p></section>`;
}

// ---------- Altro ----------
function viewAltro(c) {
  const modificabile = S.db && S.isOwner;
  const regole = c.regole.map((r, k) => `<li class="regola"><label for="r-${k}">${esc(r.motivo)}</label>
    <div class="regola-ctl"><input type="range" id="r-${k}" min="-5" max="5" step="1" value="${r.punti}" data-regola="${k}" ${modificabile ? '' : 'disabled'}><output for="r-${k}" id="o-${k}">${r.punti > 0 ? '+' : ''}${r.punti}</output></div></li>`).join('');
  return `<h1 class="titolo-vista">Altro</h1>
  <section class="pannello"><h2>Licenze e permessi</h2><ul class="divieti">
    <li><b>Laghi e fiumi:</b> serve la licenza di pesca della Regione Lazio (tipo B). <a href="https://regione.lazio.it/cittadini/agricoltura/pesca-acquacoltura/pesca-sportiva-dilettantistica" target="_blank" rel="noopener">Regione Lazio</a></li>
    <li><b>Mare:</b> una sola volta, la comunicazione al Ministero (MASAF) sul portale SIAN, con SPID. <a href="https://www.sian.it" target="_blank" rel="noopener">Portale SIAN</a></li>
    <li><b>Barca:</b> dal 2026, da barca (dai 16 anni) si usa l'app RecFishing per dichiarare tonno rosso, pesce spada, lampuga e alalunga. Da riva non serve.</li>
    <li><b>Parchi e riserve:</b> hanno regole proprie; ogni scheda spot ti dice cosa controllare.</li>
    <li><b>Limiti in mare:</b> 5 kg di pescato al giorno a persona (escluso un singolo pesce più pesante), una sola cernia.</li></ul>
    <p class="nota">Controllato il 01/11/2026. Le regole cambiano: in caso di dubbio vale la fonte ufficiale.</p></section>
  <section class="pannello"><h2>La mia attrezzatura</h2>
    <p><b>Canna:</b> Caperlan Ukiyo 500, 2,40 m, esche 10–30 g, totanare 2.0–4.0, azione medio-lenta.</p>
    <p><b>Da comprare prima di tutto:</b> un mulinello taglia 2500 con trecciato PE 0.6–0.8.</p>
    <p><b>Kit base:</b> fluorocarbon 0,22 e 0,28 mm; moschettoni piccoli; totanare 2.5 e 3.0 (una naturale, una arancio); 2 minnow 9–12 cm; un ondulante 20 g; galleggianti scorrevoli 4–6 g e pallini; ami n. 6, 8 e 12; piombi a oliva 20–30 g; una pinza lunga (per tracine e scorfani) e un metro.</p>
    <p class="nota">Il sistema ti consiglia solo tecniche adatte a questa canna.</p></section>
  <section class="pannello"><h2>Regole dei voti</h2>
    <p class="nota">Ogni regola aggiunge o toglie punti al voto. ${modificabile ? 'Sposta i cursori e salva.' : 'Solo il proprietario della pagina può modificarle.'}</p>
    <ul class="regole">${regole}</ul>
    ${modificabile ? '<div class="azioni"><button class="btn" type="button" id="salva-regole">Salva regole</button><button class="btn btn-2" type="button" id="reset-regole">Ripristina regole iniziali</button></div>' : ''}
    <p class="esito" id="esito-regole" role="status"></p></section>
  <section class="pannello"><h2>Nuovo spot</h2>
    <form id="nuovo-spot" class="modulo">
      <label for="ns-nome">Nome</label><input id="ns-nome" required placeholder="Es. Scogli di Santa Severa">
      <label for="ns-tipo">Tipo</label><select id="ns-tipo">${Object.entries(TIPO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label for="ns-pos">Posizione (incollala da Google Maps: tieni premuto sul punto e copia i numeri)</label><input id="ns-pos" required placeholder="42.0300, 11.8420" inputmode="decimal">
      <label for="ns-esp">Il mare aperto è verso…</label><select id="ns-esp"><option value="">(lago o fiume)</option>${['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'].map((n, k) => `<option value="${k * 45}">${n}</option>`).join('')}</select>
      <label for="ns-min">Minuti di auto da Roma</label><input id="ns-min" type="number" min="0" value="60">
      <label for="ns-gh">Il tuo nome utente GitHub</label><input id="ns-gh" value="${esc(S.meta?.github || '')}" placeholder="nomeutente">
      <button class="btn" type="submit">Prepara il testo</button>
    </form>
    <div id="ns-out" hidden></div></section>`;
}

function preparaSpot() {
  const nome = $('#ns-nome').value.trim();
  const m = $('#ns-pos').value.match(/(-?\d+[.,]\d+)\s*[,; ]\s*(-?\d+[.,]\d+)/);
  const out = $('#ns-out');
  out.hidden = false;
  if (!nome || !m) { out.innerHTML = '<p class="esito errore">Scrivi il nome e la posizione come due numeri, per esempio 42.0300, 11.8420.</p>'; return; }
  const lat = Number(m[1].replace(',', '.')), lon = Number(m[2].replace(',', '.'));
  const tipo = $('#ns-tipo').value;
  const esp = $('#ns-esp').value === '' ? null : Number($('#ns-esp').value);
  const mare = tipo !== 'lago' && esp !== null;
  const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const riga = JSON.stringify({ id, nome, lat, lon, tipo, mare, fiume: tipo === 'foce', esposizione: mare ? esp : null, minutiDaRoma: Number($('#ns-min').value) || 60 });
  const gh = $('#ns-gh').value.trim();
  const link = gh ? `https://github.com/${encodeURIComponent(gh)}/pesca-lazio/edit/main/spots.json` : null;
  out.innerHTML = `<p><b>Passo 1.</b> Copia questo testo:</p><pre class="codice" id="ns-riga">,\n  ${esc(riga)}</pre>
    <button class="btn btn-2" type="button" id="ns-copia">Copia</button>
    <p><b>Passo 2.</b> ${link ? `Apri <a href="${esc(link)}" target="_blank" rel="noopener">spots.json su GitHub</a>` : 'Apri il file spots.json del tuo progetto su GitHub e tocca la matita'}.</p>
    <p><b>Passo 3.</b> Metti il cursore subito dopo l'ultima <code>}</code> (prima della <code>]</code> finale) e incolla.</p>
    <p><b>Passo 4.</b> Tocca “Commit changes” e conferma. Al prossimo aggiornamento lo spot riceve i dati.</p>`;
  $('#ns-copia').onclick = async () => {
    try { await navigator.clipboard.writeText(`,\n  ${riga}`); $('#ns-copia').textContent = 'Copiato'; } catch {
      const r = document.createRange(); r.selectNodeContents($('#ns-riga')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#ns-copia').textContent = 'Testo selezionato: copialo';
    }
  };
}

// ---------- router e render ----------
function vista() { const h = location.hash.slice(1); return h || 'dove'; }

function render() {
  const c = calcola();
  renderStato(c);
  const v = vista();
  const main = $('#vista');
  let html;
  if (v.startsWith('spot-')) html = viewSpot(v.slice(5), c);
  else if (v === 'spot') html = viewSpotLista(c);
  else if (v === 'pesci') html = viewPesci(c);
  else if (v === 'diario') html = viewDiario(c);
  else if (v === 'altro') html = viewAltro(c);
  else html = viewDove(c);
  main.innerHTML = html + (S.messaggio ? `<p class="esito" role="status">${esc(S.messaggio)}</p>` : '');
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.tab === v.split('-')[0] || (v === 'dove' && t.dataset.tab === 'dove') ? 'page' : 'false'));
  if (v.startsWith('spot-')) disegnaGrafici(v.slice(5), c);
  collega(c);
}

function collega(c) {
  document.querySelectorAll('[data-filtro]').forEach((b) => b.onclick = () => { S.filtri[b.dataset.filtro] = b.dataset.valore; salvaFiltri(); render(); });
  document.querySelectorAll('[data-cella]').forEach((b) => b.onclick = () => { S.selezione = b.dataset.cella; const y = scrollY; render(); scrollTo(0, y); });
  const agg = $('#aggiorna');
  if (agg) agg.onclick = aggiornaOra;
  document.querySelectorAll('[data-regola]').forEach((inp) => inp.oninput = () => { $(`#o-${inp.dataset.regola}`).textContent = `${inp.value > 0 ? '+' : ''}${inp.value}`; });
  const sr = $('#salva-regole');
  if (sr) sr.onclick = async () => {
    const nuove = c.regole.map((r, k) => ({ ...r, punti: Number($(`#r-${k}`).value) }));
    try { await S.db.doc('config/regole').set({ regole: nuove, modificato: new Date().toISOString() }); $('#esito-regole').textContent = 'Regole salvate: i voti sono ricalcolati.'; }
    catch (e) { $('#esito-regole').textContent = `Non riesco a salvare (${e.code || 'errore'}). Riprova tra poco.`; }
  };
  const rr = $('#reset-regole');
  if (rr) rr.onclick = async () => {
    if (rr.dataset.conferma !== '1') { rr.dataset.conferma = '1'; rr.textContent = 'Tocca di nuovo per confermare'; return; }
    try { await S.db.doc('config/regole').delete(); $('#esito-regole').textContent = 'Regole iniziali ripristinate.'; }
    catch (e) { $('#esito-regole').textContent = `Non riesco a ripristinare (${e.code || 'errore'}).`; }
  };
  const ns = $('#nuovo-spot');
  if (ns) ns.onsubmit = (e) => { e.preventDefault(); preparaSpot(); };
}

async function aggiornaOra() {
  const b = $('#aggiorna');
  b.disabled = true; b.textContent = 'Avvio l’aggiornamento…';
  try {
    await S.mcp.callTool('Claude Code Remote', 'fire_trigger', { trigger_id: S.meta.triggerId }, { cache: false });
    S.messaggio = 'Aggiornamento avviato: i nuovi dati arrivano in qualche minuto, la pagina si aggiorna da sola.';
  } catch (e) {
    S.messaggio = e?.code === 'not_granted' || e?.code === 'denied' ? 'Per usare questo pulsante consenti alla pagina di usare Claude Code Remote.' : 'Non sono riuscito ad avviare l’aggiornamento. Riprova tra qualche minuto.';
  }
  render();
}

// ---------- avvio ----------
async function avvia() {
  cacheLeggi();
  render();
  window.addEventListener('hashchange', () => { S.selezione = null; S.messaggio = null; render(); scrollTo(0, 0); });
  const claude = window.claude;
  if (!claude?.use) { S.timeout = true; render(); return; }
  const timer = setTimeout(() => { if (!S.caricato) { S.timeout = true; render(); } }, 10000);
  const [db, user, mcp] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('mcp')]);
  S.db = db; S.user = user; S.mcp = mcp;
  try { S.isOwner = user ? Boolean(await user.isOwner()) : false; } catch { S.isOwner = false; }
  if (!db) { clearTimeout(timer); S.timeout = true; render(); return; }
  const fine = () => { S.caricato = true; clearTimeout(timer); cacheScrivi(); render(); };
  db.doc('meta/stato').onSnapshot((s) => { S.meta = s.exists ? s.data() : null; if (!s.metadata.fromCache) fine(); else render(); }, () => fine());
  db.doc('meta/spots').onSnapshot((s) => { S.spotsDb = s.exists ? s.data().spots : null; render(); }, () => {});
  db.doc('config/regole').onSnapshot((s) => { S.config = s.exists ? s.data() : null; render(); }, () => {});
  db.collection('meteo').onSnapshot((q) => { S.meteoDocs = q.docs.map((d) => ({ id: d.id, data: d.data() })); if (!q.metadata.fromCache) fine(); else render(); }, () => fine());
}
avvia();
