# Pesca Lazio

Dati meteo-marini gratuiti (Open-Meteo) per gli spot di pesca in `spots.json`.
Il workflow `meteo` (GitHub Actions) li scarica ogni 3 ore in `data/meteo.json`;
un'attività programmata di Claude li copia nella pagina "Pesca Lazio" su claude.ai.

- Aggiungere uno spot: modifica `spots.json` (la pagina, in Altro → Nuovo spot, prepara il testo).
- Motore dei voti: `engine/`, regole in `content/regole-default.json`, test con `node --test`.
