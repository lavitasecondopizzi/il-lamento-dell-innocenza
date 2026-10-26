# Il lamento dell'innocenza

Prototipo di libro-game fantasy per GitHub Pages. La mini avventura **Il custode del ponte** è esclusivamente dimostrativa e non fa parte della storia ufficiale.

## Avvio locale

Il gioco carica i contenuti da `content/demo-story.json` con `fetch`, quindi non va aperto direttamente come file `file://`.

Con Python installato:

```bash
python -m http.server 8000
```

Apri `http://localhost:8000`.

## Pubblicazione su GitHub Pages

1. Crea un repository GitHub chiamato `il-lamento-dell-innocenza`.
2. Carica tutti i file e le cartelle di questo progetto nella radice del repository.
3. Vai in **Settings → Pages**.
4. In **Build and deployment**, scegli **GitHub Actions**.
5. Il workflow `.github/workflows/pages.yml` pubblica il sito a ogni push sul branch `main`.

URL previsto: `https://lavitasecondopizzi.github.io/il-lamento-dell-innocenza/`.

## Struttura

- `index.html`: schermate e struttura dell'interfaccia.
- `styles.css`: tema gotico e layout responsive.
- `src/main.js`: motore narrativo, personaggio, prove, combattimento e salvataggi.
- `content/demo-story.json`: mini avventura temporanea e dati del nemico.
- `.github/workflows/pages.yml`: pubblicazione automatica.

## Funzioni attuali

- Quattro classi iniziali: guerriero, mago, ladro, chierico.
- Sei caratteristiche con array standard e modificatori.
- Scelte narrative con requisiti ed effetti.
- Prove d20 e un combattimento dimostrativo.
- Diario, inventario e scheda.
- Modalità libera con autosalvataggio e tre slot manuali.
- Modalità permadeath con autosalvataggio e blocco del caricamento dopo la morte.
- Layout adattivo desktop/mobile.

## Limiti noti del prototipo

- La modalità permadeath è una protezione applicativa locale, non anti-manomissione: cancellare i dati del browser può azzerare lo stato.
- I salvataggi non si sincronizzano tra dispositivi.
- Il sistema di combattimento e il bilanciamento sono dimostrativi e richiedono test.
- Alcune regole avanzate del GdR (progressione completa, magia, condizioni, checkpoint con recupero da errori tecnici) non sono ancora implementate.
- Le font esterne migliorano l'aspetto, ma richiedono una connessione; il gioco non dipende da esse per le regole.

## Licenza

Nessuna licenza open-source è stata assegnata automaticamente. Scegline una prima di dichiarare il progetto riutilizzabile da terzi.
