// Anteprima locale: dist/pesca.html con un finto window.claude e dati di ESEMPIO (non reali).
import { readFileSync, writeFileSync } from 'node:fs';
const spots = JSON.parse(readFileSync('spots.json', 'utf8'));
const H = 3600000;
const ora = Date.now();
const t0 = Math.floor((ora - 72 * H) / H) * H;
const n = 192;
const meteo = spots.map((s, k) => {
  const ore = Array.from({ length: n }, (_, i) => t0 + i * H);
  const tempesta = (i) => Math.max(0, 1 - Math.abs(i - 140) / 14); // mareggiata tra ~3 giorni
  const d = {
    ore, aggiornato: new Date(ora - 2 * H).toISOString(),
    vento: ore.map((_, i) => Math.round((8 + 6 * Math.sin(i / 5 + k) + 30 * tempesta(i)) * 10) / 10),
    raffica: ore.map((_, i) => Math.round((15 + 8 * Math.sin(i / 5 + k) + 45 * tempesta(i)) * 10) / 10),
    ventoDir: ore.map((_, i) => (i > 125 && i < 155 ? 225 : 40 + 20 * Math.sin(i / 9))),
    pressione: ore.map((_, i) => Math.round((1019 - 12 * tempesta(i + 6) + 2 * Math.sin(i / 20)) * 10) / 10),
    pioggia: ore.map((_, i) => (i > 20 && i < 28 ? 1.4 : tempesta(i) > 0.5 ? 2.2 : 0)),
    temp: ore.map(() => 17), nuvole: ore.map(() => 40), codice: ore.map((_, i) => (tempesta(i) > 0.8 ? 95 : 2)),
  };
  if (s.mare) Object.assign(d, { onda: ore.map((_, i) => Math.round((0.3 + 0.2 * Math.sin(i / 7) + 2.2 * tempesta(i - 4)) * 100) / 100), ondaDir: ore.map(() => 230), ondaPeriodo: ore.map(() => 6), tempMare: ore.map(() => 19.5) });
  if (s.fiume) d.portata = { giorni: Array.from({ length: 12 }, (_, i) => new Date(t0 + (i - 4) * 24 * H).toISOString().slice(0, 10)), valori: [20, 21, 20, 22, 30, 26, 22, 21, 20, 45, 60, 35] };
  return { id: s.id, data: d };
});
const fixture = { meta: { aggiornato: new Date(ora - 2 * H).toISOString(), triggerId: 'trig_esempio', github: 'esempio' }, meteo };
const shim = `<script>
(() => {
  const F = ${JSON.stringify(fixture)};
  const snap = (id, data) => ({ id, exists: data != null, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
  const docs = { 'meta/stato': F.meta };
  const db = {
    doc: (p) => ({ onSnapshot: (cb) => { setTimeout(() => cb(snap(p.split('/')[1], docs[p] ?? null)), 50); return () => {}; }, set: async (d) => { docs[p] = d; }, delete: async () => { delete docs[p]; } }),
    collection: (p) => ({ onSnapshot: (cb) => { setTimeout(() => cb({ docs: F.meteo.map((m) => snap(m.id, m.data)), metadata: { fromCache: false } }), 80); return () => {}; } }),
  };
  window.claude = { use: async (name) => name === 'db' ? db : name === 'user' ? { isOwner: () => true } : name === 'mcp' ? { callTool: async () => ({ payload: {} }) } : null };
})();
</script>`;
const page = readFileSync('dist/pesca.html', 'utf8');
writeFileSync('dist/preview.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>${shim}</head><body>${page}</body></html>`);
console.log('dist/preview.html');
