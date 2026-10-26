# Piano di collaudo — prototipo 0.1

## Smoke test manuale

1. Aprire la pagina tramite server locale o GitHub Pages.
2. Creare una partita per ognuna delle quattro classi.
3. Verificare valori iniziali, punti vita e caratteristiche.
4. Percorrere il ramo di indagine e controllare l'indizio nel diario/inventario.
5. Provare il combattimento, l'uso della benda e la fuga.
6. Salvare in uno slot, tornare al titolo, ricaricare e verificare la scena.
7. Avviare una partita permadeath, subire una sconfitta e verificare che non sia possibile riprendere la partita conclusa.
8. Verificare layout a 320px, 768px e desktop.

## Test automatici da aggiungere

- Validazione di tutte le destinazioni `next`, `success.next`, `failure.next`, `victoryScene`, `escapeScene`.
- Test dei modificatori da 3 a 18.
- Test delle CD con dadi controllati.
- Test degli effetti idempotenti e delle transizioni doppie.
- Test di serializzazione e validazione dei salvataggi.
- Test dei rami della mini storia e dei finali raggiungibili.
