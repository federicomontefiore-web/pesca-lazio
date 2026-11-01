// Scarica i dati gratuiti di Open-Meteo per ogni spot e li salva in data/meteo.json.
// Gira su GitHub Actions (Node 20), senza dipendenze esterne.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FORECAST = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,precipitation,temperature_2m,cloud_cover,weather_code';
const MARINE = 'wave_height,wave_direction,wave_period,sea_surface_temperature';
const CAMPI_F = { vento: 'wind_speed_10m', raffica: 'wind_gusts_10m', ventoDir: 'wind_direction_10m', pressione: 'pressure_msl', pioggia: 'precipitation', temp: 'temperature_2m', nuvole: 'cloud_cover', codice: 'weather_code' };
const CAMPI_M = { onda: 'wave_height', ondaDir: 'wave_direction', ondaPeriodo: 'wave_period', tempMare: 'sea_surface_temperature' };

export const urls = (s) => ({
  forecast: `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=${FORECAST}&past_days=3&forecast_days=5&timezone=GMT&timeformat=unixtime&wind_speed_unit=kmh`,
  marine: `https://marine-api.open-meteo.com/v1/marine?latitude=${s.lat}&longitude=${s.lon}&hourly=${MARINE}&past_days=3&forecast_days=5&timezone=GMT&timeformat=unixtime`,
  flood: `https://flood-api.open-meteo.com/v1/flood?latitude=${s.lat}&longitude=${s.lon}&daily=river_discharge&past_days=30&forecast_days=7`,
});

const r = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

/** Converte le risposte Open-Meteo nel formato SpotData. */
export function buildSpotData(spot, fc, mar, fl, aggiornato) {
  const ore = fc.hourly.time.map((t) => t * 1000);
  const d = { ore, aggiornato };
  for (const [k, src] of Object.entries(CAMPI_F)) d[k] = (fc.hourly[src] || []).map(r);
  if (spot.mare) {
    const idx = new Map((mar?.hourly?.time || []).map((t, i) => [t * 1000, i]));
    for (const [k, src] of Object.entries(CAMPI_M)) {
      const serie = mar?.hourly?.[src] || [];
      d[k] = ore.map((t) => (idx.has(t) ? r(serie[idx.get(t)]) : null));
    }
  }
  if (spot.fiume && fl?.daily) d.portata = { giorni: fl.daily.time, valori: fl.daily.river_discharge.map(r) };
  return d;
}

async function getJson(fetchFn, url, tentativi = 2) {
  let ultimo;
  for (let i = 0; i < tentativi; i++) {
    try {
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { ultimo = e; }
  }
  throw ultimo;
}
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function main(fetchFn = fetch, { spotsPath = 'spots.json', outPath = 'data/meteo.json', now = () => new Date().toISOString(), pausaMs = 300 } = {}) {
  const spots = JSON.parse(readFileSync(spotsPath, 'utf8'));
  const prima = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { spots: {} };
  const adesso = now();
  const out = { generato: adesso, spots: {} };
  for (const s of spots) {
    const u = urls(s);
    try {
      const fc = await getJson(fetchFn, u.forecast); await pausa(pausaMs);
      let mar = null, fl = null;
      if (s.mare) { mar = await getJson(fetchFn, u.marine).catch(() => null); await pausa(pausaMs); }
      if (s.fiume) { fl = await getJson(fetchFn, u.flood).catch(() => null); await pausa(pausaMs); }
      out.spots[s.id] = buildSpotData(s, fc, mar, fl, adesso);
      if (s.mare && !mar) out.spots[s.id].errore = `Onde non disponibili (${adesso})`;
    } catch (e) {
      out.spots[s.id] = { ...(prima.spots?.[s.id] || {}), errore: `${e.message} (${adesso})` };
    }
    console.log(`${s.id}: ${out.spots[s.id].errore ? 'ERRORE ' + out.spots[s.id].errore : 'ok'}`);
  }
  writeFileSync(outPath, JSON.stringify(out));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
