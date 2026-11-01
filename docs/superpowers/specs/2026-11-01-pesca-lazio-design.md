# Pesca Lazio — "Dove e quando andare a pescare" — Spec di design

Data: 2026-11-01 · Stato: in revisione da Federico

## 1. Obiettivo

Un sistema, usato soprattutto dal telefono, che dice a un pescatore principiante
**dove** e **quando** conviene pescare nei prossimi 3–5 giorni, con un voto 0–10
per fascia oraria, il motivo in parole semplici, gli avvisi di pericolo, le schede
da principiante per spot e specie, e un diario che controlla misure e divieti.

Il voto è un aiuto, non una garanzia: deve essere scritto nella pagina.

## 2. Profilo dell'utente (vincoli che guidano le scelte)

- Principiante assoluto, non pratico di strumenti tecnici: ogni passo che deve fare
  lui va spiegato passo per passo, in italiano semplice.
- Parte da Roma nord/ovest; distanza massima 1 h 30 di auto (eccezione: zone barca
  in Toscana).
- Pesca da terra nel Lazio; dalla barca di famiglia in Toscana (Marina di Grosseto,
  Cala di Forno).
- Attrezzatura: **una sola canna**, Caperlan Ukiyo 500 da 2,40 m, esche 10–30 g,
  egi 2.0–4.0, azione medio-lenta. Mulinello da comprare.
  → Tutte le tecniche e montature consigliate devono essere fattibili con questa
  canna; se una tecnica richiede altro, il sistema lo dice e propone l'alternativa.
- Obiettivi: cefalopodi (eging), predatori di mare, pesci da fondo/scogli, acqua dolce.
- Solo servizi gratuiti; sfruttare l'abbonamento Claude esistente.
- Ha un account GitHub.

## 3. Spot iniziali

| id | Nome | Tipo | Note da verificare in fase di costruzione |
|---|---|---|---|
| riva-traiano | Riva di Traiano, diga foranea (Civitavecchia) | mare/porto | porto privato: dove è consentito pescare |
| santa-marinella | Santa Marinella, lungomare e Capo Linaro | mare/scogliera | zone balneari 1/5–30/9 di giorno |
| fiumicino-tevere | Canale e foce del Tevere, Fiumicino | foce | ordinanza Capitaneria di Roma, zone portuali |
| foce-arrone | Foce dell'Arrone, Fregene/Maccarese | foce/spiaggia | Riserva statale Litorale Romano |
| foce-marta | Foce del Marta, Lido di Tarquinia | foce/spiaggia | Riserva Saline di Tarquinia vicina |
| anzio | Anzio, Capo d'Anzio e porto | mare/scogliera/porto | regole del porto |
| bracciano | Lago di Bracciano (Vigna di Valle, Anguillara, Trevignano) | lago | Parco Bracciano-Martignano |
| martignano | Lago di Martignano | lago | Parco; accesso e parcheggio estivo a pagamento |
| tos-marina-grosseto | Mare davanti a Marina di Grosseto (barca) | mare/barca | RecFishing obbligatoria da barca |
| tos-cala-forno | Cala di Forno (barca) | mare/barca | Parco della Maremma: regole a mare da verificare |

Per ogni spot: coordinate, tipo, esposizione (direzione verso il mare aperto, per
capire vento da terra / da mare), soglie di sicurezza, obiettivi (specie+tecnica),
scheda principiante, accesso e parcheggio, divieti da controllare, fonti.

## 4. Architettura (approccio 1 approvato)

Le pagine pubblicate su Claude non possono collegarsi a siti esterni; anche lo
spazio di lavoro cloud di Claude non raggiunge Open-Meteo. Quindi:

```
GitHub Actions (ogni 3 h, gratis)
  └─ scripts/fetch.mjs legge spots.json → Open-Meteo (Forecast, Marine, Flood)
     └─ scrive data/meteo.json nel repo pubblico
Attività programmata Claude (06:40 e 15:40, più "Aggiorna ora")
  └─ legge data/meteo.json via api.github.com (lettura pubblica)
     └─ scrive nel database della pagina (meteo/<spotId>, meta/stato)
     └─ al giro del mattino: esegue il motore e manda notifica con le 3 migliori occasioni
Pagina su Claude (Artifact)
  └─ legge il database, calcola alba/tramonto/luna, voti, grafici
  └─ diario, foto, enciclopedia, regole modificabili
```

### 4.1 Repo GitHub `pesca-lazio` (pubblico)

- `spots.json` — elenco spot (id, nome, lat, lon, tipo). Unica fonte per le coordinate.
- `scripts/fetch.mjs` — Node 20, nessuna dipendenza esterna.
- `.github/workflows/meteo.yml` — cron ogni 3 ore + avvio manuale.
- `data/meteo.json` — output. Se un servizio fallisce per uno spot, si tengono i dati
  precedenti di quello spot e si segna `errore` con data.
- `engine/` — il motore (stesso codice usato dalla pagina e dal report).

Dati scaricati per spot, ora per ora, 3 giorni passati + 5 futuri:
- Forecast: `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`,
  `pressure_msl`, `precipitation`, `temperature_2m`, `cloud_cover`, `weather_code`.
- Marine (solo spot di mare): `wave_height`, `wave_direction`, `wave_period`,
  `sea_surface_temperature`.
- Flood (solo foci/fiumi): `river_discharge` giornaliero (stima GloFAS, non misura).

Il livello misurato dei fiumi del Centro Funzionale Lazio non è disponibile in
formato automatico (solo portale web, nessun open data/API dichiarato): si usano
pioggia + portata stimata, e la pagina lo dichiara.

### 4.2 Attività programmata Claude

- Due esecuzioni al giorno; il pulsante "Aggiorna ora" la avvia tramite il connettore
  Claude Code Remote (`fire_trigger`).
- Notifica push con le 3 migliori occasioni (solo giro del mattino) o con un avviso
  se i dati non sono arrivati.
- Il prompt dell'attività è autosufficiente (ogni esecuzione parte da zero).

### 4.3 Pagina (Artifact su claude.ai)

Capacità: `db`, `user`, `assets`, `sample` (con immagini), `mcp`
(Claude Code Remote → `fire_trigger`).

Database (limite 256 KiB per documento → un documento per spot):
- `meteo/<spotId>` — dati orari dello spot (scritto dall'attività Claude).
- `meta/stato` — data/ora ultimo aggiornamento, errori.
- `config/regole` — regole personalizzate (se assente: regole iniziali incluse nella pagina).
- `diario/<id>` — uscite. Leggibile e scrivibile solo dal proprietario.

Regole di accesso: `meteo` e `meta` lettura `view`, scrittura `owner`;
`config` lettura `view`, scrittura `owner`; `diario` lettura e scrittura `owner`.

## 5. Motore dei voti

Funzioni pure, testate con `node:test`, in moduli separati:

- `sun.js` — alba, tramonto, crepuscoli per data e coordinate.
- `moon.js` — fase e illuminazione lunare.
- `bands.js` — fasce del giorno legate al sole: notte, alba (−1 h/+2 h), mattina,
  pomeriggio, tramonto (−2 h/+1 h), sera.
- `features.js` — dai dati orari ricava, per fascia: vento medio e raffica max,
  onda max, tendenza dell'onda (in calo dopo mareggiata), pressione e variazione
  in 12 h, pioggia ultime 24/48/72 h, portata rispetto alla media del periodo,
  temperatura mare, temporale sì/no, direzione del vento rispetto all'esposizione.
- `safety.js` — pericolo → voto 0 + avviso rosso con motivo. Soglie per tipo di spot
  (scogliera/molo più severi della spiaggia; fiume in piena per foci/fiumi;
  temporale ovunque).
- `season.js` — stagionalità mensile di ogni obiettivo dalle schede specie
  (ottimo/buono/scarso/no) e periodi di divieto legali.
- `rules.js` — regole dichiarative: `{id, applicaA (tecnica/specie/tipo spot),
  condizione (campo, operatore, soglia), punti, motivo}`. Voto base dalla stagione,
  poi somma dei punti, limitato tra 0 e 10.
- `score.js` — voto per (spot, giorno, fascia) = miglior obiettivo; restituisce voto,
  obiettivo, 2–3 motivi principali, avvisi.
- `catch-check.js` — controlli cattura: sotto misura, protetta, periodo di divieto,
  invasiva (cosa fare), pericolosa (come maneggiarla), limite giornaliero
  (5 kg in mare; capi per specie in acqua dolce).

Le regole iniziali sono quelle descritte e approvate (eging con mare calmo e luce
bassa, spigola in foce dopo pioggia moderata, orata/mormora in scaduta, lago con
pressione stabile/in calo, ecc.). L'utente le modifica dalla schermata "Regole"
(cursori e soglie), con "Ripristina regole iniziali".

## 6. Schermate (prima il telefono)

Barra in basso: **Dove e quando · Spot · Pesci · Diario · Altro**.

- **Dove e quando**: avvisi rossi in alto, data ultimo aggiornamento, classifica
  delle migliori occasioni con motivo, filtri (oggi/domani/weekend/tutti,
  mare/dolce, distanza), riquadro "Questo mese ha senso".
- **Spot**: lista con voto migliore; scheda spot con striscia voti 5 giorni × 6 fasce,
  grafici (vento e raffiche, onde, pressione, pioggia, voto per fascia), alba/tramonto/
  luna, scheda principiante (specie del mese, montatura completa: filo e diametro,
  finale, peso, amo/artificiale, esca; posizione; errori da evitare), accesso e
  parcheggio con link a Google Maps, divieti da controllare, sicurezza.
- **Pesci**: enciclopedia con ricerca e filtro; scheda completa con fonti e data
  dell'ultimo controllo; "Che pesce è?" con foto (risposta di Claude con livello di
  sicurezza e verifica misura).
- **Diario**: nuova uscita, elenco, "Come sto andando" (da 10 uscite), "Chiedi a Claude
  di suggerire correzioni" (proposte approvate una per una).
- **Altro**: Regole, Licenze e permessi (licenza Regione Lazio, comunicazione MASAF
  su SIAN, RecFishing per la barca, parchi e riserve, con link ufficiali), La mia
  attrezzatura (mulinello da comprare, accessori base), Nuovo spot (genera il testo
  da incollare su GitHub + link).

Niente mappe con cartine (non caricabili nella pagina): link "Portami lì" a Google Maps.
Tema chiaro e scuro, testo grande, colori dei voti: verde/giallo/grigio/rosso.

## 7. Enciclopedia delle specie

Mare e foci: spigola, orata, sarago maggiore, sarago fasciato, sarago pizzuto,
mormora, ombrina, corvina, serra, leccia amia, leccia stella, barracuda, cefali,
occhiata, salpa, sgombro, lanzardo, sugarello, aguglia, pagello fragolino, triglia,
grongo; calamaro, seppia, polpo, totano. Pericolose: tracina, scorfano, pesce prete,
pastinaca/razze, murena. Invasive: pesce palla maculato, granchio blu. Protette:
nacchera, dattero di mare, cavalluccio marino, cheppia.

Acqua dolce: persico reale, black bass, luccio, carpa, carassio, tinca, cavedano,
barbo, trota fario/iridea, coregone, latterino, pesce gatto; protetta: rovella;
invasive: siluro, gambero della Louisiana; anguilla (vietata nel Lazio nel 2026).

Ogni scheda: riconoscimento, habitat, mesi/orari/condizioni migliori, tecnica ed
esche per principiante con montatura, regole (misura minima, divieti, limiti,
protetta/invasiva e cosa fare), pericoli e come maneggiarla, se è buona da mangiare,
fonti con data controllo. Immagini solo se libere da diritti (altrimenti nessuna).

Fonti di riferimento da verificare e citare: Reg. (CE) 1967/2006 All. III, DPR
1639/1968 art. 142, L.R. Lazio 87/1990 artt. 12 e 14, Det. Regione Lazio G07959
dell'11/06/2026, DM MASAF del 04/03/2026 (anguilla), Circolare MASAF n. 199994 del
28/04/2026 (RecFishing), ISPRA, FIPSAS, enti parco.

## 8. Errori e sicurezza

- Dati più vecchi di 12 h: avviso arancione; oltre 36 h: voti grigi "non affidabili".
- Dati mancanti per uno spot: "dati non disponibili" solo per quello spot.
- Database vuoto: "Primo aggiornamento in arrivo" + "Aggiorna ora".
- Ultimi dati tenuti in memoria del browser per uso senza campo (solo comodità).
- Attività Claude fallita: notifica di avviso.
- Ogni regola di legge con fonte e data controllo; oltre 6 mesi: "da ricontrollare".
- Consigli di sicurezza in ogni scheda spot; numeri 1530 e 112.

## 9. Verifica

- Test del motore scritti prima del codice (TDD) con dati di esempio: giornata
  perfetta eging, mareggiata su scogliera, Tevere in piena, specie fuori stagione,
  cattura sotto misura, specie invasiva.
- Alba/tramonto/luna confrontati con una libreria di riferimento (solo nei test).
- Dati veri: workflow GitHub eseguito, `data/meteo.json` controllato, alcuni valori
  confrontati con Open-Meteo.
- Pagina: screenshot a larghezza telefono di ogni schermata; uscita di prova nel
  diario scritta, letta e cancellata; "Che pesce è?" con una foto vera.

## 10. Tappe

1. Dati GitHub + attività Claude che copia i dati (senza notifica top 3) + motore +
   "Dove e quando" + schede spot.
2. Enciclopedia con ricerca sulle fonti ufficiali.
3. Diario con controlli.
4. "Che pesce è?".
5. "Come sto andando" e suggerimenti di correzione.
6. Report automatico del mattino (notifica con le 3 migliori occasioni).

## 11. Fuori da questa versione

Profondità EMODnet (facoltativa, rimandata), mappe interattive, condivisione con altri
pescatori, previsioni oltre 5 giorni.
