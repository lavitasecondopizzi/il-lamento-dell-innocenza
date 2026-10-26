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

## Test automatici

Con Node.js 18 o successivo, esegui dalla radice del progetto:

```bash
node --test tests/*.test.mjs
```

I test controllano la scena iniziale, i testi delle scene, i riferimenti narrativi, i nemici e la raggiungibilità dei finali. La stessa verifica viene eseguita da GitHub Actions prima della pubblicazione su Pages.

## Struttura

- `index.html`: schermate e struttura dell'interfaccia.
- `styles.css`: tema gotico e layout responsive.
- `src/main.js`: motore narrativo, personaggio, prove, combattimento e salvataggi.
- `content/demo-story.json`: mini avventura temporanea e dati del nemico.
- `.github/workflows/pages.yml`: pubblicazione automatica.

## Funzioni attuali

- Wizard di creazione personaggio con anteprima della scheda in tempo reale.
- Cinque discendenze, quattro classi e sei background selezionabili.
- Lancio di 4d6 per ciascuna caratteristica, scartando il dado più basso; distribuzione dei sei risultati senza duplicati.
- Bonus di discendenza e modificatori derivati ricalcolati automaticamente.
- Competenze di classe/background e selezione di magie iniziali per mago e chierico.
- Punti vita, classe armatura, prove e combattimento collegati alle caratteristiche.
- Progressione nascosta fino al livello 10: esperienza non mostrata nell'interfaccia, assegnata per scelte, tentativi e successi nelle prove, scoperte, vittorie e fughe.
- Premi unici per evento, per evitare di ottenere progressi ripetendo la stessa azione; i livelli aumentano PF e bonus di competenza alle soglie previste.
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
- Il sistema di progressione è una prima implementazione e richiederà bilanciamento con avventure più lunghe; le magie selezionate non hanno ancora tutte effetti attivi in gioco.
- Alcune regole avanzate del GdR (magia completa, condizioni, checkpoint con recupero da errori tecnici) non sono ancora implementate.
- Le font esterne migliorano l'aspetto, ma richiedono una connessione; il gioco non dipende da esse per le regole.

## Licenza

Nessuna licenza open-source è stata assegnata automaticamente. Scegline una prima di dichiarare il progetto riutilizzabile da terzi.
