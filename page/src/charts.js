// Grafici SVG disegnati a mano: linee, area, barre. Asse x = tempo (ms), un solo asse y.
const W = 340, H = 160, M = { t: 24, r: 10, b: 24, l: 34 };
const NS = 'http://www.w3.org/2000/svg';
const giornoFmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric' });
const oraFmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const mezzanotteFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' });

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * Disegna un grafico nel contenitore.
 * opts: {ore:number[], serie:[{nome, valori, classe, area?, tratteggio?}], tipo:'linea'|'barre', unita, yMin?, yMax?, da, a, ora}
 */
export function drawChart(box, opts) {
  const { ore, serie, unita, da, a, ora } = opts;
  const idx = ore.map((t, i) => i).filter((i) => ore[i] >= da && ore[i] <= a);
  if (!idx.length || serie.every((s) => idx.every((i) => s.valori[i] === null || s.valori[i] === undefined))) {
    box.innerHTML = '<p class="vuoto">Dati non disponibili per questo grafico.</p>';
    return;
  }
  const valori = serie.flatMap((s) => idx.map((i) => s.valori[i])).filter((v) => v !== null && Number.isFinite(v));
  // 3 intervalli con passo "tondo" (1, 2, 2.5, 5 × 10^n)
  let yMin = opts.yMin ?? 0, yMax, passo;
  if (opts.yAuto) {
    const lo = Math.min(...valori), hi = Math.max(...valori);
    passo = niceMax(Math.max(1, hi - lo) / 2.5);
    yMin = Math.floor(lo / passo) * passo; yMax = yMin + 3 * passo;
    if (yMax < hi) yMax += passo;
  } else {
    passo = niceMax(Math.max(opts.yMax ?? 0, ...valori) / 3 || 1);
    yMax = passo * 3;
  }
  const x = (t) => M.l + ((t - da) / (a - da)) * (W - M.l - M.r);
  const y = (v) => H - M.b - ((v - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico', role: 'img', 'aria-label': opts.titolo || '' });

  // griglia e asse y (3 righe)
  const righe = Math.round((yMax - yMin) / passo);
  for (let k = 0; k <= righe; k++) {
    const v = Math.round((yMin + ((yMax - yMin) * k) / righe) * 100) / 100;
    svg.append(el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: k ? 'griglia' : 'asse' }));
    svg.append(el('text', { x: M.l - 4, y: y(v) + 3, class: 'tick', 'text-anchor': 'end' }, Number.isInteger(v) ? v : v.toFixed(1)));
  }
  // giorni (mezzanotte locale)
  for (let t = Math.ceil(da / 3600000) * 3600000; t <= a; t += 3600000) {
    if (mezzanotteFmt.format(new Date(t)) !== '00') continue;
    svg.append(el('line', { x1: x(t), x2: x(t), y1: M.t, y2: H - M.b, class: 'griglia' }));
    if (x(t) < W - 30) svg.append(el('text', { x: x(t) + 3, y: H - 8, class: 'tick' }, giornoFmt.format(new Date(t))));
  }
  // adesso
  if (ora >= da && ora <= a) {
    svg.append(el('line', { x1: x(ora), x2: x(ora), y1: M.t - 6, y2: H - M.b, class: 'adesso' }));
    svg.append(el("text", { x: x(ora), y: 10, class: 'tick adesso-t', 'text-anchor': 'middle' }, 'ora'));
  }
  svg.append(el("text", { x: 2, y: 10, class: "tick" }, unita));

  for (const s of serie) {
    if (opts.tipo === 'barre') {
      const larg = Math.max(2, ((W - M.l - M.r) / idx.length) - 2);
      for (const i of idx) {
        const v = s.valori[i];
        if (!v) continue;
        const h = Math.max(1, y(yMin) - y(v));
        svg.append(el('rect', { x: x(ore[i]) - larg / 2, y: y(v), width: larg, height: h, rx: Math.min(2, larg / 2), class: `barra ${s.classe}` }));
      }
      continue;
    }
    let d = '', aperto = false, area = '';
    for (const i of idx) {
      const v = s.valori[i];
      if (v === null || v === undefined || !Number.isFinite(v)) { aperto = false; continue; }
      d += `${aperto ? 'L' : 'M'}${x(ore[i]).toFixed(1)},${y(v).toFixed(1)}`;
      aperto = true;
    }
    if (s.area && d) {
      const pts = idx.filter((i) => Number.isFinite(s.valori[i]));
      area = `M${x(ore[pts[0]])},${y(yMin)}` + pts.map((i) => `L${x(ore[i]).toFixed(1)},${y(s.valori[i]).toFixed(1)}`).join('') + `L${x(ore[pts.at(-1)])},${y(yMin)}Z`;
      svg.append(el('path', { d: area, class: `area ${s.classe}` }));
    }
    svg.append(el('path', { d, class: `linea ${s.classe}${s.tratteggio ? ' tratto' : ''}` }));
  }

  // livello hover
  const cursore = el('line', { y1: M.t, y2: H - M.b, class: 'cursore', visibility: 'hidden' });
  const punti = serie.map((s) => el('circle', { r: 4, class: `punto ${s.classe}`, visibility: 'hidden' }));
  svg.append(cursore, ...punti);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  box.replaceChildren(svg, tip);
  if (serie.length > 1) {
    const leg = document.createElement('div');
    leg.className = 'legenda';
    leg.innerHTML = serie.map((s) => `<span><i class="chiave ${s.classe}${s.tratteggio ? ' tratto' : ''}"></i>${s.nome}</span>`).join('');
    box.append(leg);
  }
  const muovi = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const t = da + ((px - M.l) / (W - M.l - M.r)) * (a - da);
    let best = idx[0];
    for (const i of idx) if (Math.abs(ore[i] - t) < Math.abs(ore[best] - t)) best = i;
    const cx = x(ore[best]);
    cursore.setAttribute('x1', cx); cursore.setAttribute('x2', cx); cursore.setAttribute('visibility', 'visible');
    serie.forEach((s, k) => {
      const v = s.valori[best];
      if (opts.tipo === 'barre' || !Number.isFinite(v)) { punti[k].setAttribute('visibility', 'hidden'); return; }
      punti[k].setAttribute('cx', cx); punti[k].setAttribute('cy', y(v)); punti[k].setAttribute('visibility', 'visible');
    });
    tip.innerHTML = `<b>${oraFmt.format(new Date(ore[best]))}</b>` + serie.map((s) => `<span>${s.nome}: ${Number.isFinite(s.valori[best]) ? s.valori[best] : '—'} ${unita}</span>`).join('');
    tip.hidden = false;
    const left = Math.min(Math.max(0, (cx / W) * r.width - 70), r.width - 150);
    tip.style.left = `${left}px`;
  };
  const esci = () => { cursore.setAttribute('visibility', 'hidden'); punti.forEach((p) => p.setAttribute('visibility', 'hidden')); tip.hidden = true; };
  svg.addEventListener('pointermove', muovi);
  svg.addEventListener('pointerdown', muovi);
  svg.addEventListener('pointerleave', esci);
}

/** Somma oraria → blocchi di `n` ore (per le barre di pioggia). */
export function aggrega(ore, valori, n) {
  const o = [], v = [];
  for (let i = 0; i < ore.length; i += n) {
    const pezzo = valori.slice(i, i + n).filter(Number.isFinite);
    o.push(ore[i] + (n * 3600000) / 2);
    v.push(pezzo.length ? Math.round(pezzo.reduce((s, x) => s + x, 0) * 10) / 10 : null);
  }
  return { ore: o, valori: v };
}
