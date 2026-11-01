# Tappa 1 — Dati, motore dei voti e "Dove e quando" — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dal telefono Federico vede la classifica "dove e quando" dei prossimi 5 giorni per i 10 spot, con voto 0–10 per fascia, motivi, avvisi di pericolo, grafici e scheda principiante, alimentata da dati Open-Meteo veri.

**Architecture:** GitHub Actions scarica Open-Meteo ogni 3 h in `data/meteo.json` (repo pubblico). Un'attività programmata Claude copia i dati nel database dell'Artifact. La pagina esegue il motore (moduli JS puri, testati con `node:test`) e mostra classifica e schede.

**Tech Stack:** Node 22 (locale) / Node 20 (GitHub Actions), ES modules, `node:test`, esbuild (bundle del motore per la pagina), suncalc (solo come oracolo nei test), Artifact claude.ai con capacità `db`, `user`, `mcp`.

**Spec:** `docs/superpowers/specs/2026-11-01-pesca-lazio-design.md`

## Global Constraints

- Solo servizi gratuiti; nessuna API a pagamento, nessuna chiave API.
- Nessuna dipendenza runtime in `scripts/fetch.mjs` e in `engine/` (solo Node standard / browser standard).
- Tutti i testi visibili all'utente in italiano semplice, frasi brevi.
- Voto intero o con mezzo punto, sempre tra 0 e 10.
- Frase obbligatoria visibile accanto ai voti: "Il voto è un aiuto, non una garanzia."
- Fasce: `notte`, `alba` (alba −1 h → +2 h), `mattina`, `pomeriggio`, `tramonto` (tramonto −2 h → +1 h), `sera`; mattina/pomeriggio divisi a mezzogiorno solare locale (12:00 Europe/Rome).
- Orari interni in epoch ms UTC; visualizzazione con `Intl` in `Europe/Rome`.
- Dati vecchi: > 12 h avviso arancione; > 36 h voti grigi "dati troppo vecchi, voti non affidabili".
- Un documento db per spot (limite 256 KiB per documento).
- Pagina usabile a 360 px di larghezza, senza scroll orizzontale; tema chiaro e scuro.
- Ogni regola di legge mostrata con fonte e data dell'ultimo controllo (`controllato: "YYYY-MM-DD"`).
- Numeri di emergenza in ogni scheda spot: 1530 (Guardia Costiera) e 112.

## Review Focus

1. Punto mare troppo vicino a costa: Open-Meteo Marine restituisce `null` per celle di terra → lo spot deve mostrare "onde non disponibili", non voto falsamente alto (test in Task 4 e Task 8).
2. Valori orari mancanti (`null`) sparsi nei dati → le medie li ignorano, nessun `NaN` nel voto (test in Task 4).
3. Cambio ora legale/solare (ultima domenica di ottobre/marzo) → fasce corrette, nessuna fascia di durata negativa (test in Task 3).
4. Database vuoto o documento `meta/stato` mancante al primo avvio → messaggio "Primo aggiornamento in arrivo", nessun crash (test in Task 10).
5. Più avvisi contemporanei (vento + onde) → l'avviso rosso vince, motivi non duplicati (test in Task 5).

---

## Struttura dei file

```
pesca-lazio/
  package.json                  # "type":"module", script test/build
  spots.json                    # unica fonte delle coordinate (letta anche da GitHub Actions)
  content/specie-base.json      # stagionalità, divieti, misure (minimo per Tappa 1)
  content/spot-info.json        # schede principiante, accesso, divieti per spot
  content/regole-default.json   # regole del motore
  content/sicurezza.json        # soglie di pericolo per tipo di spot
  engine/sun.js                 # alba/tramonto
  engine/moon.js                # fase lunare
  engine/bands.js               # fasce del giorno
  engine/features.js            # condizioni per fascia
  engine/safety.js              # pericoli
  engine/season.js              # stagione e divieti
  engine/score.js               # voti, motivi, classifica
  engine/index.js               # esporta l'API pubblica
  scripts/fetch.mjs             # download Open-Meteo → data/meteo.json
  .github/workflows/meteo.yml   # cron ogni 3 h
  data/meteo.json               # output (generato)
  test/fixtures/*.json          # dati di esempio
  test/*.test.js
  page/src/*.js, page/src/page.html  # sorgenti della pagina
  page/build.mjs                # bundle → dist/pesca.html
  guide/github-setup.md         # guida passo passo per Federico
```

---

### Task 1: Base del progetto e lista spot

**Files:**
- Create: `package.json`, `spots.json`, `test/spots.test.js`, `.gitignore` (`node_modules`, `dist`)

**Interfaces:**
- Produces: `spots.json` = array di
  `{id: string, nome: string, lat: number, lon: number, tipo: "scogliera"|"molo"|"spiaggia"|"foce"|"lago"|"barca", mare: boolean, fiume: boolean, esposizione: number /* gradi verso il mare aperto, null per lago */, minutiDaRoma: number}`

- [ ] **Step 1: Test**: `spots.json` ha 10 voci con gli id della spec (`riva-traiano`, `santa-marinella`, `fiumicino-tevere`, `foce-arrone`, `foce-marta`, `anzio`, `bracciano`, `martignano`, `tos-marina-grosseto`, `tos-cala-forno`); id unici; lat tra 41 e 43, lon tra 10.5 e 13; `mare === true` per tutti tranne `bracciano`,`martignano`; `fiume === true` per `fiumicino-tevere`,`foce-arrone`,`foce-marta`; `esposizione` numerica 0–359 per gli spot di mare, `null` per i laghi.
- [ ] **Step 2:** `node --test test/spots.test.js` → FAIL (file mancante).
- [ ] **Step 3:** Scrivi `spots.json`. Coordinate di partenza (da verificare su mappa e correggere; per gli spot di mare il punto va messo **in acqua a 100–300 m dalla riva**, perché la Marine API lavora su celle di mare):
  riva-traiano 42.0655,11.8125 (esp. 240) · santa-marinella 42.0300,11.8420 (210) · fiumicino-tevere 41.7695,12.2125 (250) · foce-arrone 41.8620,12.1880 (240) · foce-marta 42.2105,11.6960 (240) · anzio 41.4440,12.6170 (190) · bracciano 42.0880,12.2150 · martignano 42.1110,12.3160 · tos-marina-grosseto 42.7150,10.9650 (250) · tos-cala-forno 42.6050,11.0450 (240). Tipi: scogliera = santa-marinella, anzio; molo = riva-traiano; foce = fiumicino-tevere, foce-arrone, foce-marta; lago = bracciano, martignano; barca = tos-*. `minutiDaRoma` (da Roma nord/ovest): 60, 50, 35, 35, 75, 80, 40, 40, 150, 160.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** `package.json` con `"type":"module"`, script `"test": "node --test"`, devDependencies `suncalc@1.9.0`, `esbuild@0.24.0`; `npm install`; commit `feat: lista spot iniziale`.

---

### Task 2: Sole e luna

**Files:** Create `engine/sun.js`, `engine/moon.js`, `test/sun-moon.test.js`

**Interfaces:**
- Produces: `sunTimes(dateMs: number, lat: number, lon: number) -> {alba: number, tramonto: number, mezzogiorno: number}` (epoch ms UTC, per il giorno solare che contiene `dateMs` in Europe/Rome)
- Produces: `moonInfo(dateMs: number) -> {fase: number /*0 nuova…0.5 piena…1*/, illuminazione: number /*0–1*/, nome: "Luna nuova"|"Luna crescente"|"Primo quarto"|"Gibbosa crescente"|"Luna piena"|"Gibbosa calante"|"Ultimo quarto"|"Luna calante"}`

- [ ] **Step 1: Test** con suncalc come oracolo: per 10 date distribuite nel 2026 (incluse 2026-03-29 e 2026-10-25, cambi d'ora) e per Fiumicino (41.7695, 12.2125), `|alba − suncalc.sunrise| < 2 min`, idem tramonto. `|fase − suncalc.getMoonIllumination().phase| < 0.02` e `|illuminazione − suncalc…fraction| < 0.03` su 10 date; `nome` coerente con la fase (es. fase 0.48–0.52 → "Luna piena").
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3:** Implementa con l'algoritmo NOAA semplificato (sole) e l'età lunare dalla luna nuova di riferimento 2000-01-06T18:14Z con mese sinodico 29.530588853 giorni (luna). Nessuna dipendenza.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** commit `feat: calcolo alba, tramonto e fase lunare`.

---

### Task 3: Fasce del giorno

**Files:** Create `engine/bands.js`, `test/bands.test.js`

**Interfaces:**
- Consumes: `sunTimes`
- Produces: `dayBands(dayISO: string /*"YYYY-MM-DD" Europe/Rome*/, lat, lon) -> Array<{id: BandId, nome: string, inizio: number, fine: number}>` in ordine, contigue, che coprono 00:00–24:00 locali del giorno.

- [ ] **Step 1: Test**: per "2026-11-01" a Fiumicino restituisce 6 fasce in ordine `notte, alba, mattina, pomeriggio, tramonto, sera` (la `notte` è 00:00→alba−1h; la `sera` è tramonto+1h→24:00); `alba.inizio === sunrise−1h`; `tramonto.fine === sunset+1h`; ogni `fine === inizio` della successiva; somma durate = 24 h. Per "2026-10-25" (giorno di 25 h) somma = 25 h e nessuna durata ≤ 0. Per "2026-03-29" somma = 23 h. `nome` in italiano: "Notte", "Alba", "Mattina", "Pomeriggio", "Tramonto", "Sera".
- [ ] **Step 2:** FAIL. **Step 3:** implementa (mezzanotte locale calcolata con `Intl.DateTimeFormat` su `Europe/Rome`). **Step 4:** PASS. **Step 5:** commit `feat: fasce orarie legate al sole`.

---

### Task 4: Condizioni per fascia

**Files:** Create `engine/features.js`, `test/fixtures/spot-calmo.json`, `test/fixtures/mareggiata.json`, `test/fixtures/piena.json`, `test/features.test.js`

**Interfaces:**
- Consumes: formato dati di uno spot (lo stesso prodotto da Task 8):
  `SpotData = {ore: number[], vento: (number|null)[] /*km/h*/, raffica: [], ventoDir: [], pressione: [] /*hPa*/, pioggia: [] /*mm/h*/, temp: [], nuvole: [], codice: [] /*WMO*/, onda?: [] /*m*/, ondaDir?: [], ondaPeriodo?: [], tempMare?: [], portata?: {giorni: string[], valori: number[]}, aggiornato: string, errore?: string}`
- Produces: `bandFeatures(data: SpotData, band, spot) -> Features` con
  `{ventoMedio, raffica, ventoRelativo: "da terra"|"da mare"|"laterale"|null, onda, ondaTrend: "in calo"|"stabile"|"in aumento"|null, ondaPeriodo, pressione, deltaP12h, pioggia24, pioggia48, pioggia72, portataRapporto /* portata del giorno / mediana dei giorni disponibili */, tempMare, temporale: boolean, luce: BandId, luna: moonInfo}`; campi senza dati = `null`.

- [ ] **Step 1: Test**: con `spot-calmo` → `onda < 0.5`, `temporale === false`, `ventoRelativo` corretto per vento da 60° con esposizione 240° (= "da terra"); con `mareggiata` in calo → `ondaTrend === "in calo"` quando l'onda media delle 12 h precedenti supera di ≥0.3 m quella della fascia; con `piena` → `pioggia72 ≥ 60` e `portataRapporto ≥ 3`. Codici WMO 95/96/99 → `temporale === true`. **Review Focus 1–2:** dati con tutte le `onda` = `null` → `onda === null`, `ondaTrend === null`; dati con `null` sparsi → nessun campo `NaN` (assert su ogni valore numerico `Number.isFinite || === null`).
- [ ] **Step 2:** FAIL. **Step 3:** implementa (regola "da mare" se differenza angolare tra direzione da cui viene il vento ed `esposizione` ≤ 60°, "da terra" se ≥ 120°, altrimenti "laterale"). **Step 4:** PASS. **Step 5:** commit `feat: condizioni meteo-marine per fascia`.

---

### Task 5: Sicurezza

**Files:** Create `content/sicurezza.json`, `engine/safety.js`, `test/safety.test.js`

**Interfaces:**
- Produces: `checkSafety(f: Features, spot, soglie) -> {pericolo: boolean, avvisi: Array<{livello: "rosso"|"arancione", testo: string}>}`
- `sicurezza.json` per tipo: `{ondaRosso, ondaArancione, rafficaRosso, rafficaArancione, pioggia72Rosso?, portataRosso?, portataArancione?}`. Valori iniziali: scogliera e molo 1.5/1.0 m, 50/35 km/h; spiaggia e foce 2.5/1.8 m, 55/40 km/h; foce anche pioggia72Rosso 60 mm, portataRosso 3, portataArancione 2; lago raffica 45/30; barca 1.2/0.8 m, 35/25 km/h. Temporale = rosso ovunque.

- [ ] **Step 1: Test**: scogliera con onda 1.6 → `pericolo`, testo contiene "onde" e "1.6 m" e "non andare sugli scogli"; spiaggia con onda 1.6 → nessun rosso; foce con `portataRapporto 3.2` → rosso "fiume in piena"; temporale → rosso "temporale"; barca raffica 30 → arancione. **Review Focus 5:** onda 1.6 + raffica 55 su scogliera → 2 avvisi rossi distinti, nessun duplicato, `pericolo === true`.
- [ ] **Step 2:** FAIL. **Step 3:** implementa. **Step 4:** PASS. **Step 5:** commit `feat: avvisi di pericolo`.

---

### Task 6: Stagione, divieti e dati specie di base

**Files:** Create `content/specie-base.json`, `engine/season.js`, `test/season.test.js`

**Interfaces:**
- `specie-base.json`: array di `{id, nome, ambiente: "mare"|"dolce"|"entrambi", stagione: number[12] /*0 no, 1 scarso, 2 buono, 3 ottimo, gen→dic*/, divieti: Array<{dal: "MM-DD", al: "MM-DD", motivo, fonte}>, vietata: boolean, misuraMinimaCm: number|null, fonteMisura, controllato: "YYYY-MM-DD"}` per tutte le specie usate dagli obiettivi della Tappa 1.
- Produces: `seasonLevel(speciesId, dateMs) -> 0|1|2|3`; `closure(speciesId, dateMs) -> {chiuso: boolean, motivo: string|null}` (chiuso se `vietata` o data dentro un divieto, gestendo intervalli a cavallo dell'anno).

- [ ] **Step 1: Ricerca e verifica valori** (prima del codice): conferma su fonti ufficiali e registra con data: misure Reg. (CE) 1967/2006 All. III per spigola 25, orata 20, sarago maggiore 23, sarago pizzuto 18, sarago fasciato 18, mormora 20; L.R. Lazio 87/1990 art. 12 per luccio 30 (divieto 15/02–30/03), persico reale 18 (15/04–30/05), persico trota 25, carpa 25 (15/05–30/06), cavedano 18 (15/05–30/06); anguilla `vietata: true` (Det. G07959 dell'11/06/2026). Cefalopodi: nessuna misura minima nazionale finché non trovata su fonte ufficiale (`misuraMinimaCm: null`).
- [ ] **Step 2: Test**: `closure("luccio", 2026-03-10)` → chiuso, motivo contiene "15 febbraio"; `closure("luccio", 2026-04-01)` → aperto; `closure("anguilla", qualunque)` → chiuso; `seasonLevel("seppia", novembre) ≥ 2`; `seasonLevel("calamaro", luglio) ≤ 1`; ogni specie ha `controllato` valido e `stagione.length === 12`.
- [ ] **Step 3:** FAIL. **Step 4:** implementa. **Step 5:** PASS. **Step 6:** commit `feat: stagionalità e divieti`.

---

### Task 7: Regole, voti e classifica

**Files:** Create `content/regole-default.json`, `engine/score.js`, `engine/index.js`, `test/score.test.js`

**Interfaces:**
- Consumes: `bandFeatures`, `checkSafety`, `seasonLevel`, `closure`, `dayBands`
- Regola: `{id, applicaA: {tecniche?: string[], specie?: string[], tipiSpot?: string[]}, campo: keyof Features, op: "<"|"<="|">"|">="|"=="|"tra"|"in", valore: any, punti: number, motivo: string}`
- Obiettivo per spot: in `spot-info.json` (Task 9) `obiettivi: Array<{specie, tecnica: "eging"|"spinning"|"passata"|"fondo-leggero"|"galleggiante"}>`; in questo task i test usano obiettivi fittizi passati come argomento.
- Voto base da stagione: livello 3 → 6, 2 → 5, 1 → 3, 0 → obiettivo escluso.
- Produces:
  - `scoreBand({spot, obiettivi, data: SpotData, band, regole, specie, soglie}) -> {voto: number, obiettivo: {specie, tecnica}|null, motivi: string[] /*max 3, per |punti| decrescente*/, avvisi, pericolo}`
  - `rankAll({spots, spotInfo, meteo, regole, specie, soglie, oraMs, giorni: number}) -> Array<{spotId, giorno, banda, voto, obiettivo, motivi, avvisi, pericolo}>` ordinata per voto decrescente, solo fasce future.
  - `engine/index.js` riesporta tutte le funzioni pubbliche dei Task 2–7.
- Regole iniziali (dalla spec, Parte 2): eging onda <0.5 +2 "mare calmo, l'esca lavora bene"; eging onda >1.0 −3; eging luce in [alba,tramonto,notte,sera] +2 "luce bassa: i cefalopodi si avvicinano"; eging ventoRelativo laterale e ventoMedio >20 −2 "il filo fa la pancia, non senti la seppia"; eging pioggia48 >15 su tipiSpot foce −2 "acqua sporca"; spigola/foce pioggia72 tra 5–40 +3 "acqua velata, la spigola caccia"; spigola onda tra 0.5–1.2 +2; spigola ondaTrend "in calo" +2 "mare in scaduta"; spigola onda <0.3 e luce in [mattina,pomeriggio] −2 "mare piatto e limpido di giorno"; orata/mormora ondaTrend "in calo" +3; lago deltaP12h tra −4 e 1 +1 "pressione stabile o in leggero calo"; lago ventoMedio tra 5–15 +1 "un po' di vento increspa l'acqua"; lago luce in [alba,tramonto] +2; tutti deltaP12h < −3 +1 "pressione in calo prima della perturbazione"; tutti deltaP12h > 4 −1 "pressione in salita veloce dopo il maltempo".

- [ ] **Step 1: Test scenari (TDD):**
  - `perfetta-eging`: santa-marinella, novembre, tramonto, onda 0.3, vento 8 da terra → voto ≥ 7, obiettivo tecnica `eging`, `motivi` contiene "mare calmo".
  - `mareggiata-scogliera`: onda 2.0 → voto 0, `pericolo`, avviso rosso.
  - `tevere-piena`: fiumicino-tevere, pioggia72 80, portataRapporto 3.5 → voto 0, avviso "fiume in piena".
  - `luccio-chiuso`: bracciano 2026-03-10 con obiettivi solo luccio → `obiettivo === null`, voto 0, motivo "periodo di divieto".
  - `anguilla-mai`: obiettivo anguilla → mai scelto.
  - limiti: voto sempre tra 0 e 10 anche con somma punti > 10; massimo 3 motivi; `rankAll` ordinato e senza fasce passate.
- [ ] **Step 2:** FAIL. **Step 3:** implementa. **Step 4:** PASS (`npm test` tutto verde). **Step 5:** commit `feat: motore dei voti e classifica`.

---

### Task 8: Download dati e GitHub Actions

**Files:** Create `scripts/fetch.mjs`, `.github/workflows/meteo.yml`, `test/fetch.test.js`, `test/fixtures/openmeteo-*.json`

**Interfaces:**
- Produces: `data/meteo.json` = `{generato: ISOString, spots: {[id]: SpotData}}` (formato Task 4); export `buildSpotData(spot, forecastJson, marineJson|null, floodJson|null) -> SpotData` e `main(fetchFn = fetch)`.
- Chiamate (timezone `GMT`, `past_days=3`, `forecast_days=5`, `wind_speed_unit=kmh`):
  - `https://api.open-meteo.com/v1/forecast` hourly `wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,precipitation,temperature_2m,cloud_cover,weather_code`
  - `https://marine-api.open-meteo.com/v1/marine` hourly `wave_height,wave_direction,wave_period,sea_surface_temperature` (solo `mare`)
  - `https://flood-api.open-meteo.com/v1/flood` daily `river_discharge`, `past_days=30`, `forecast_days=7` (solo `fiume`)

- [ ] **Step 1: Test** con fixture registrate a mano nel formato documentato Open-Meteo: `buildSpotData` converte gli orari in epoch ms, allinea le serie marine agli orari forecast, lascia assenti i campi marini per i laghi; `main` con `fetchFn` finto che fallisce per uno spot → quello spot mantiene i dati del file precedente e ha `errore` con testo e data; gli altri sono aggiornati. **Review Focus 1:** risposta marina tutta `null` → campi presenti ma `null`, nessuna eccezione. Dimensione di ogni spot serializzato < 200 KiB.
- [ ] **Step 2:** FAIL. **Step 3:** implementa (pausa 300 ms tra chiamate; massimo 2 tentativi). **Step 4:** PASS.
- [ ] **Step 5:** `meteo.yml`: `on: schedule: - cron: "17 */3 * * *"` + `workflow_dispatch`; job ubuntu-latest, `actions/setup-node@v4` node 20, `node scripts/fetch.mjs`, commit di `data/meteo.json` solo se cambiato, `permissions: contents: write`.
- [ ] **Step 6:** commit `feat: download Open-Meteo con GitHub Actions`.

---

### Task 9: Schede spot (contenuti verificati)

**Files:** Create `content/spot-info.json`, `test/spot-info.test.js`

**Interfaces:**
- Produces per ogni id di `spots.json`: `{obiettivi: [{specie, tecnica}], dovePosizionarsi: string, erroriDaEvitare: string[], montature: {[tecnica]: {mulinello, filo, finale, peso, amoOArtificiale, esca}}, accesso: string, parcheggio: string, mapsUrl: string, divieti: Array<{testo, fonte, controllato}>, sicurezza: string[], fonti: string[]}`
- Tutte le tecniche devono essere compatibili con Ukiyo 500 (2,40 m, 10–30 g, egi 2.0–4.0). Mulinello consigliato: taglia 2500–3000 con trecciato PE 0.6–0.8 e finale in fluorocarbon (diametri per tecnica nelle montature).

- [ ] **Step 1: Ricerca** per ogni spot: accesso, parcheggio, divieti (ordinanze Capitaneria, porti, parchi, riserve, zone balneari 1/5–30/9), con fonte e data. Ciò che non si trova su fonte affidabile va scritto come "da controllare: <dove>".
- [ ] **Step 2: Test**: ogni spot ha almeno 2 obiettivi con specie presenti in `specie-base.json`; ogni tecnica usata ha una montatura; ogni `peso` dichiarato ≤ 30 g; ogni `divieti[i]` ha `fonte` e `controllato`; `sicurezza` contiene "1530" e "112"; `mapsUrl` inizia con `https://www.google.com/maps/`.
- [ ] **Step 3:** FAIL → **Step 4:** scrivi i contenuti → **Step 5:** PASS → **Step 6:** commit `feat: schede spot da principiante`.

---

### Task 10: Pagina — "Dove e quando", Spot, Altro

**Files:** Create `page/src/page.html`, `page/src/app.js`, `page/src/data.js`, `page/src/charts.js`, `page/build.mjs`, `test/page-data.test.js`

**Prima di scrivere:** caricare le skill `artifact-design`, `dataviz`, `artifact-capabilities` (leggere `claude.d.ts`, `db.d.ts`, `mcp.d.ts`).

**Interfaces:**
- Consumes: API di `engine/index.js`, tutti i file `content/*.json`, `spots.json` (inclusi nel bundle).
- `page/src/data.js` produce `loadState(db) -> {stato: "vuoto"|"ok"|"vecchio"|"scaduto", aggiornato: number|null, meteo: {[id]: SpotData}}` (vecchio > 12 h, scaduto > 36 h) e `regoleAttive(db) -> regole` (`config/regole` se presente, altrimenti default).
- `build.mjs`: esbuild bundle IIFE di `app.js` inline in `page.html` → `dist/pesca.html`.
- Capacità alla pubblicazione: `{db: {rules: [{path:"meteo",read:"view",write:"owner"},{path:"meta",read:"view",write:"owner"},{path:"config",read:"view",write:"owner"},{path:"diario",read:"owner",write:"owner"}]}, user: {}, mcp: {servers: [{server: "Claude Code Remote", tools: ["fire_trigger"]}]}}`.

- [ ] **Step 1: Test** (`page-data.test.js`, db finto): db senza documenti → `stato === "vuoto"` (**Review Focus 4**); `meta/stato.aggiornato` 13 h fa → `"vecchio"`; 40 h fa → `"scaduto"`; `config/regole` assente → regole default.
- [ ] **Step 2:** FAIL → **Step 3:** implementa `data.js` → **Step 4:** PASS.
- [ ] **Step 5:** Implementa le schermate secondo la spec, sezione 6 (barra Dove e quando · Spot · Pesci · Diario · Altro; Pesci e Diario in Tappa 1 mostrano "In arrivo nella prossima tappa"): classifica con filtri, avvisi, "Questo mese ha senso"; scheda spot con striscia 5 giorni × 6 fasce, grafici vento/raffiche, onde, pressione, pioggia, alba/tramonto/luna per giorno, scheda principiante (Task 9), "Portami lì", divieti e sicurezza; Altro con Licenze e permessi, La mia attrezzatura, Nuovo spot (genera la riga JSON per `spots.json` + link `https://github.com/<utente>/pesca-lazio/edit/main/spots.json`), pulsante "Aggiorna ora" (`fire_trigger`, nascosto se `mcp` è `null`). Cache dell'ultimo stato in `localStorage` con try/catch.
- [ ] **Step 6:** `node page/build.mjs` → crea `dist/pesca.html`; screenshot Playwright a 390×844 con un shim `window.claude` che serve `test/fixtures` (chiaro e scuro): nessuno scroll orizzontale, testi leggibili.
- [ ] **Step 7:** commit `feat: pagina dove e quando`.

---

### Task 11: Messa online (con Federico)

**Files:** Create `guide/github-setup.md`

- [ ] **Step 1:** Scrivi la guida passo passo (italiano semplice, con cosa cliccare): creare il repo pubblico `pesca-lazio`; caricare i file dallo zip con "Add file → Upload files"; in Settings → Actions → General attivare "Read and write permissions"; in Actions avviare "meteo" con "Run workflow"; controllare che compaia `data/meteo.json`.
- [ ] **Step 2:** Prepara lo zip del repo (senza `node_modules`, `dist`) e consegnalo con la guida.
- [ ] **Step 3 (Federico):** segue la guida e mi scrive il suo nome utente GitHub.
- [ ] **Step 4:** Verifica: `curl -s https://api.github.com/repos/<utente>/pesca-lazio/contents/data/meteo.json` → JSON con 10 spot, `generato` recente, nessun `errore`; confronta il vento di domani a Fiumicino con il sito Open-Meteo (Federico apre il link e mi dice il valore).
- [ ] **Step 5:** Pubblica `dist/pesca.html` con il tool Artifact e le capacità del Task 10.
- [ ] **Step 6:** Crea l'attività programmata (`create_trigger`, cron `CRON_TZ=Europe/Rome 40 6,15 * * *`, notifiche push) con prompt autosufficiente: leggi `data/meteo.json` da api.github.com (decodifica base64), scrivi ogni spot in `meteo/<id>` e `meta/stato` con ArtifactData `batch` sull'URL dell'artifact; se il file manca o è più vecchio di 12 h, termina con un messaggio di avviso.
- [ ] **Step 7:** `fire_trigger` una volta; verifica con ArtifactData `list` di `meteo` (10 documenti) e `get` di `meta/stato`.
- [ ] **Step 8:** commit `docs: guida GitHub e messa online`.

---

### Task 12: Verifica finale della Tappa 1

- [ ] **Step 1:** `npm test` → tutti PASS (riportare il numero di test).
- [ ] **Step 2:** Screenshot a 390 px della pagina pubblicata con dati veri: Dove e quando, una scheda spot di mare, una di lago, Altro.
- [ ] **Step 3:** Controllo a campione: per 2 fasce, ricalcolo a mano voto e motivi dai dati veri e confronto con la pagina.
- [ ] **Step 4:** Messaggio a Federico con screenshot, cosa funziona, cosa resta per la Tappa 2, e le 5 righe "come si usa / come aggiungo uno spot".

---

## Tappe successive (un piano per ciascuna, scritto alla fine della tappa precedente)

2. Enciclopedia: ricerca fonti ufficiali per tutte le specie della spec §7, `content/specie.json` completo, schermata Pesci.
3. Diario: `engine/catch-check.js` con TDD (sotto misura, protetta, divieto, invasiva, pericolosa, limiti 5 kg / capi), schermata Diario su `diario/*`.
4. "Che pesce è?": capacità `assets` e `sample` con immagini.
5. "Come sto andando" e suggerimenti di correzione via `sample`.
6. Report del mattino: estensione dell'attività programmata con le 3 migliori occasioni.
