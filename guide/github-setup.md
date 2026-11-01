# Mettere online i dati meteo su GitHub (una volta sola, circa 10 minuti)

Fai tutto dal computer, nel browser.

1. Vai su https://github.com e accedi.
2. In alto a destra tocca **+** → **New repository**.
   - Repository name: `pesca-lazio`
   - Scegli **Public** (serve perché Claude possa leggere i dati senza password; dentro ci sono solo la lista degli spot e il meteo).
   - Spunta **Add a README file**.
   - Tocca **Create repository**.
3. Scarica lo zip `pesca-lazio.zip` che ti ho mandato e scompattalo (tasto destro → **Estrai tutto**).
4. Nella pagina del repository tocca **Add file** → **Upload files**.
   Apri la cartella scompattata, seleziona **tutto il suo contenuto** (Ctrl+A), comprese le cartelle `.github`, `data`, `engine`, `scripts`, e trascinalo nella pagina di GitHub.
   Aspetta che finisca il caricamento e tocca **Commit changes**.
5. Controlla che esista il file del programmino: nella pagina del repository devi vedere la cartella `.github`.
   Se non c'è: **Add file** → **Create new file**, come nome scrivi `.github/workflows/meteo.yml`,
   incolla il contenuto del file `meteo.yml` che trovi nello zip (apri con Blocco note) e tocca **Commit changes**.
6. Tocca **Settings** (in alto) → nel menu a sinistra **Actions** → **General** →
   in fondo, sotto **Workflow permissions**, scegli **Read and write permissions** → **Save**.
7. Tocca **Actions** (in alto). Se compare un pulsante verde "I understand my workflows, go ahead and enable them", toccalo.
   A sinistra tocca **meteo** → a destra **Run workflow** → **Run workflow**.
   Dopo 1–2 minuti compare una spunta verde.
8. Torna su **Code**: nella cartella `data` deve esserci `meteo.json`.
9. Scrivi a Claude il tuo **nome utente GitHub** (lo vedi in alto a destra, toccando la tua foto).
