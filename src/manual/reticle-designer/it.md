# geladen.ch ballistics Manuale d'uso — Progettista di reticoli

*Parte della* [suite balistica geladen.ch](https://bc.geladen.ch)*. In Utilità. Disegna i reticoli integrati nelle tue ottiche dell'Arsenale, quelli che mostra la vista cannocchiale del Calcolatore per il poligono.*

---

## 1. A cosa serve questo strumento

Il Calcolatore per il poligono può mostrarti la tua correzione a reticolo sul reticolo che vedi davvero, ma solo se conosce quel reticolo: dove si trovano ogni tacca, ogni punto, ogni barra e ogni cifra. Il Progettista di reticoli è il posto dove glielo dici. Disegni il reticolo una volta, dalla scheda tecnica del produttore, lo salvi nell'Arsenale, lo associ all'ottica con cui viene fornito e monti quell'ottica su un fucile. Da quel momento la vista cannocchiale del Calcolatore per il poligono disegna la tua correzione su quel reticolo, scrive sui suoi segni BDC le distanze a cui corrispondono oggi, con la tua cartuccia, e mette le correzioni per il vento dove il tuo occhio le cercherà.

L'app include una serie di reticoli integrati. Se il tuo è tra questi, questo strumento potrebbe servirti solo per farne una variante.

### Cosa non è

Non è un programma di disegno. Ogni elemento è un dettaglio del reticolo, con una posizione e dimensioni angolari, digitate o trascinate, e ogni posizione si misura dal centro del reticolo. Niente disegno a mano libera, niente colore, niente testo al di fuori delle cifre. Un disegno che hai già può entrare come forma SVG (§12), ma diventa allora un unico elemento, che si posiziona e si scala in blocco.

Non sa come si comporta la tua ottica in particolare. Un reticolo è disegnato per un'*ottica di riferimento* — solo il suo tipo e il suo ingrandimento (§5). L'ottica vera in cui finisce, definita nell'Arsenale, porta il proprio campo visivo, la propria escursione di ingrandimento e, per un'ottica in secondo piano focale, l'ingrandimento a cui i suoi valori angolari sono esatti.

---

## 2. Dove resta il tuo lavoro

**Un reticolo si conserva salvandolo nell'Arsenale.** Fino ad allora vive solo nella memoria dell'app: sopravvive al passaggio a un altro strumento e ritorno, con la sua cronologia di annullamento, ma non a un ricaricamento, alla chiusura dell'app o a un riavvio. La barra del file dice *«Non salvato nell'arsenale»* finché c'è qualcosa da salvare, e il browser chiede conferma prima di ricaricare o chiudere la pagina con modifiche non salvate.

I reticoli salvati stanno nella scheda **Ottiche** dell'Arsenale, sotto **I tuoi reticoli**, memorizzati solo su questo dispositivo, e vengono salvati e sincronizzati con il resto dell'Arsenale (vedi il [manuale dell'Arsenale](#/manual/arsenal), §5.9 e §8). Un reticolo con un disegno SVG importato può essere grande — megabyte — e quella dimensione entra in ogni file di backup e in ogni sincronizzazione; la scheda Ottiche mostra quanto spazio occupa ogni reticolo.

Niente di ciò che disegni lascia mai il tuo dispositivo, tranne i file che salvi e la cartella di sincronizzazione che configuri tu stesso.

---

## 3. Per iniziare subito

1. Apri la scheda **Ottiche** dell'Arsenale e premi **+ Aggiungi reticolo**, oppure apri il **Progettista di reticoli** da Utilità.
2. In **Cannocchiale**, imposta il tipo di ottica e l'ingrandimento per cui è fatto il reticolo, come li dà la scheda tecnica.
3. In **Opzioni**, scegli **mrad** o **MOA** — l'unità della scheda tecnica.
4. Scegli **Linea verticale** nella tavolozza degli elementi e trascinala dal centro al fondo del campo; fai lo stesso con una **Linea orizzontale** verso un lato e spunta **Specchia orizzontalmente** nelle sue impostazioni.
5. Aggiungi una breve linea verticale per una tacca sotto il centro, spunta **Ripeti** e imposta direzione, numero e passo.
6. Scrivi produttore e modello nella barra del file e premi **Salva nell'arsenale**.
7. Nell'Arsenale, associa il reticolo alla sua ottica (**Modifica** l'ottica, spunta il reticolo) e scegli quell'ottica per il tuo fucile.

---

## 4. Lo schermo

Dall'alto in basso:

- **La barra del file** — **Produttore** e **Modello** del reticolo (entrambi necessari per salvare; il produttore suggerisce i produttori di ottiche e reticoli che l'app conosce), un campo facoltativo **Fonte / note** per indicare da dove vengono i valori angolari, e i pulsanti **Nuovo reticolo**, **Salva nell'arsenale**, **Scarta le modifiche** e **Inserisci un reticolo intero…** (§14, §15).
- **Cannocchiale** — l'ottica di riferimento per cui è disegnato il reticolo, e la sua illuminazione (§5).
- **L'area di lavoro**, in cinque riquadri: **Opzioni** (§6), **Elementi** — la tavolozza e i pulsanti Raggruppa, Separa, Duplica ed Elimina (§8, §10) —, la **Vista del reticolo** (§7), le **Impostazioni** di ciò che è selezionato, ed **Elementi del reticolo**, l'elenco di tutto ciò che è disegnato.

Ogni modifica al reticolo — un elemento posizionato, spostato o modificato, l'ottica, l'illuminazione, produttore, modello e note — è un passo che puoi annullare. Un intero trascinamento, una serie di battute in un campo o una pressione di un tasto freccia sono un solo passo. Vengono conservati gli ultimi 1000 passi.

---

## 5. L'ottica di riferimento

La sezione **Cannocchiale** stabilisce per cosa è disegnato il reticolo:

- **Tipo di cannocchiale** — **Ingrandimento fisso**, **Variabile, primo piano focale** (FFP) o **Variabile, secondo piano focale** (SFP).
- **Ingrandimento** — un solo valore per un'ottica fissa; **Ingrandimento da** e **a** per una variabile.
- **Valori esatti a** — solo SFP: l'ingrandimento a cui i segni del reticolo valgono quanto dice la scheda tecnica. Deve trovarsi nell'escursione di ingrandimento.

**Il campo visivo non si inserisce.** Viene dedotto dall'ingrandimento — 12 m a 100 m a 3×, restringendosi in proporzione al crescere dell'ingrandimento — solo perché la vista possa disegnare il campo in cui sta il reticolo. Non deve corrispondere all'ottica vera; i valori veri vengono dall'ottica nell'Arsenale.

Se il reticolo deve servire in ottiche in primo piano focale di ingrandimenti diversi, imposta l'ingrandimento minimo dell'ottica di riferimento sul minimo reale: così gli elementi «senza fine» che arrivano fino al bordo, come le barre laterali, raggiungono davvero il bordo con il campo visivo più ampio.

Un reticolo SFP è disegnato al suo ingrandimento di calibrazione, quindi la vista mostra il campo a quell'ingrandimento.

**Illuminazione.** Per un reticolo illuminato spunta **Reticolo illuminato** e scegli **Rosso**, **Ambra** o **Verde**; ogni elemento dice allora se è illuminato (§8). Il Calcolatore per il poligono lo usa per mantenere leggibile la propria sovrapposizione: su un reticolo illuminato in rosso o in ambra disegna in blu.

---

## 6. Opzioni

Il riquadro **Opzioni** cambia il modo in cui lavori, non il reticolo; nessuna di queste opzioni è un passo di annullamento.

- **mrad / MOA** — l'unità in cui ogni angolo è mostrato e digitato. È propria dello strumento, indipendente dalle unità che preferisci altrove nell'app, perché un reticolo si specifica nell'unità dei suoi valori angolari, qualunque sia quella delle tue torrette. Cambiarla non modifica nulla nel reticolo: ogni posizione e ogni dimensione sono conservate come angolo, cambia solo la loro visualizzazione.
- **Griglia (1 mrad)** / **Griglia (1 MOA)** — una griglia di guida, una linea ogni cinque più marcata. Con uno zoom molto indietro si dirada da sola a una linea ogni cinque, poi una ogni 25, e così via.
- **Aggancia a 0,1 mrad** / **Aggancia a 0,25 MOA** — posizionamenti e spostamenti cadono su multipli di quel passo, contati dal centro. I tasti freccia spostano dello stesso passo (§16).
- **Mostra lo zero** — la croce rossa in un cerchio che segna il centro del reticolo. Non fa parte del reticolo.
- **Mostra i segni BDC** — i marcatori blu dei segni BDC (§13). Posizionare un segno li mostra di nuovo.
- **Mostra l'illuminazione** e **Oscura il campo** — solo su un reticolo illuminato: disegnare gli elementi illuminati nel loro colore e oscurare il campo come in poca luce.

---

## 7. La vista del reticolo

La vista mostra il reticolo come lo vedresti: nero su un campo chiaro, dentro un cerchio per il campo visivo, tutto ciò che sta fuori scuro. x è positivo verso destra e y positivo *verso il basso*, entrambi misurati dal centro, quindi una tacca 2 mrad sotto il centro ha y = 2.

**Posizionare.** Scegli un elemento nella tavolozza — resta evidenziato finché non ne posizioni uno —, poi fai clic nella vista per posizionarlo lì, oppure trascina l'icona direttamente nella vista. Linee e barre rastremate si tracciano premendo e trascinando, da un'estremità all'altra. Un semplice clic dà una linea lunga 1 mrad (4 MOA), rivolta in direzione opposta al centro, e una barra rastremata che arriva fino al bordo del campo. Dopo il posizionamento lo strumento torna alla freccia di selezione, e il nuovo elemento è selezionato.

**Selezionare.** Con la freccia, fai clic su un elemento per selezionarlo; un clic su una copia specchiata o ripetuta seleziona l'elemento a cui appartiene. Un clic con Maiusc, Ctrl o Cmd aggiunge un elemento alla selezione o lo toglie. Un trascinamento con Maiusc, Ctrl o Cmd sul campo vuoto traccia un rettangolo che aggiunge ogni elemento la cui forma propria sta interamente al suo interno (le sue copie non contano; un gruppo solo se c'è tutto). Un clic su un elemento di un gruppo seleziona il gruppo. Anche l'elenco seleziona, e scegliervi la riga di un membro seleziona quel membro da solo.

**Spostare.** Trascina un elemento, un gruppo o una selezione per spostarlo. Una sola linea o barra rastremata selezionata mostra una maniglia a ogni estremità, per trascinare un'estremità alla volta. Durante il trascinamento le coordinate compaiono accanto al puntatore — allo zoom normale un passo di aggancio è più piccolo di un pixel, ed è da questa lettura che vedi l'aggancio all'opera.

**Zoom e spostamento della vista.** La rotellina, il gesto con due dita o i pulsanti **+** e **−** cambiano lo zoom; trascina sul campo vuoto (o con il tasto centrale) per spostare la vista. **Ripristina vista** torna al campo intero, centrato, all'ingrandimento minimo.

**Ingrandimento.** Per un'ottica variabile, il cursore **Ingrandimento** sopra la vista mostra in anteprima l'anello degli ingrandimenti. Su un'ottica FFP il campo si restringe man mano che ingrandisci, e il reticolo cresce con l'immagine, come nel cannocchiale. Su un'ottica SFP l'immagine non cambia; una nota indica quanto valgono i valori angolari a quell'ingrandimento, ad es. *«Valori qui: ×0.5 del valore nominale»*. Le icone **Annulla** e **Ripeti** stanno alla sua sinistra.

---

## 8. Gli elementi

| Elemento | Posizionato da | Impostazioni | Uno nuovo (mrad / MOA) |
|---|---|---|---|
| Linea orizzontale, linea verticale | Il suo inizio, e la sua fine lungo la linea | Spessore | 0,05 / 0,15 di spessore |
| Punto | Il suo centro | Diametro | 0,05 / 0,15 |
| Barra orizzontale e verticale rastremata | Il suo inizio (l'estremità sottile), e la sua fine | Spessore nominale, spessore in punta, lunghezza di rastremazione | 0,5 / 1,5 di spessore, 0,25 / 0,75 in punta, rastremata su 2 / 7 |
| Cerchio | Il suo centro | Diametro esterno, diametro interno | 2 / 6 all'esterno, 1,8 / 5,4 all'interno |
| Ferro di cavallo | Il suo centro | Diametri esterno e interno, angolo di apertura in basso | come il cerchio, 60° di apertura |
| Chevron | Il suo vertice | Spessore della linea, larghezza totale, altezza | linee di 0,5 / 1,5 in un quadrato di 1 / 3,5 |
| Numero | Il suo ancoraggio | Cifre, altezza delle cifre, ancoraggio, carattere | alto 0,5 / 1,5 |
| Forma SVG | L'origine propria del disegno | Scala, larghezza, altezza, riflesso | 5 / 15 sul lato più lungo |
| Segno BDC | La sua altezza sull'asse verticale | — | — |

Posizione e dimensioni di ogni elemento si impostano nelle sue **Impostazioni**; un valore che lo renderebbe impossibile (un diametro interno maggiore di quello esterno, per esempio) viene rifiutato con un avviso e non applicato. Una nuova linea o un nuovo punto riprende lo spessore o il diametro digitato per ultimo per l'uno o per l'altro, un nuovo numero il carattere, l'altezza e l'ancoraggio scelti per ultimi, e un nuovo elemento l'ultima impostazione di illuminazione data.

- **Le linee** sono semplici segmenti di spessore costante; entrambe le estremità possono andare ovunque.
- **Le barre rastremate** sono le barre spesse al bordo di molti reticoli: sottili dove iniziano, si allargano lungo la lunghezza di rastremazione fino allo spessore nominale, poi proseguono con quello spessore fino alla fine. L'estremità sottile è sempre rivolta al centro. La fine non può mai essere più vicina al centro dell'inizio, e una barra spostata lungo il proprio asse si ferma quando il suo inizio raggiunge il centro. Una barra rastremata non deve per forza rastremarsi: con uno spessore in punta uguale a quello nominale, o una lunghezza di rastremazione di 0, è una semplice barra di spessore costante. Usala per qualsiasi barra spessa di un reticolo, non solo per quelle rastremate.
- **Un cerchio** è un anello tra i suoi due diametri; un diametro interno di 0 dà un disco pieno.
- **Un ferro di cavallo** è un anello aperto in basso, per l'ampiezza dell'angolo di apertura.
- **Uno chevron** punta verso l'alto, con il vertice nella sua posizione; i suoi due bracci arrivano agli angoli inferiori della sua larghezza totale e della sua altezza.
- **I numeri** e **le forme SVG** hanno sezioni proprie (§11, §12).
- **I segni BDC** non vengono disegnati affatto (§13).

**Elementi illuminati.** Su un reticolo illuminato ogni elemento visibile ha una casella **Illuminato**: quelli illuminati sono disegnati nel colore dell'illuminazione finché **Mostra l'illuminazione** è attivo. L'elenco li segna come *illuminato*.

---

## 9. Specchiatura e ripetizione

La maggior parte dei reticoli è simmetrica e regolare: disegni un dettaglio una volta e lasci che lo strumento lo copi.

**Specchia orizzontalmente** aggiunge una copia riflessa rispetto all'asse verticale: una tacca a x = 2 riceve la sua gemella a x = −2. Le cifre di un numero non vengono riflesse (si leggono sempre nel verso giusto), ma il suo ancoraggio sì: un numero che finisce a x = 2 inizia a x = −2.

**Ripeti** aggiunge copie in fila: una **Direzione** (in alto, in basso, a sinistra o a destra), un **Numero** di copie (oltre all'elemento stesso, fino a 500) e un **Passo** tra di esse. Dieci tacche lungo il filo verticale, una ogni 1 mrad, sono una sola breve linea con Ripeti impostato su *in basso, 9, 1 mrad*.

Le due cose si combinano: prima si fanno le ripetizioni, poi ognuna viene specchiata. Le copie non sono elementi a sé — seguono l'elemento, e un clic su una di esse lo seleziona. L'elenco segna un elemento come *specchiato* o *ripetuto ×n*. Attivare Ripeti riprende la direzione, il numero e il passo inseriti per ultimi.

---

## 10. Gruppi, più elementi insieme, duplicare, eliminare

**Più elementi insieme.** Con più di un elemento selezionato, il riquadro Impostazioni mostra la posizione dell'intera selezione (la media delle loro posizioni) e ogni impostazione che hanno tutti: uno spessore quando sono tutte linee, Specchia e Ripeti se tra di loro non c'è un segno BDC, e così via. Cambiarne una la cambia per tutti, come un solo passo di annullamento; un campo in cui differiscono mostra *misto* finché non lo imposti.

**Raggruppa** riunisce gli elementi selezionati (due o più) in un gruppo, che da allora si seleziona, si sposta e si modifica come un tutt'uno. I gruppi non si annidano: raggruppare elementi di un gruppo esistente con altri forma un unico nuovo gruppo di tutti. **Separa** scioglie il gruppo selezionato. Un gruppo rimasto con un solo elemento si scioglie da sé.

**Duplica** copia la selezione 1 mrad (o 1 MOA) a destra e in basso, e seleziona la copia; la copia di un gruppo intero è un gruppo a sé. **Elimina** (o il tasto Canc o Backspace) la rimuove.

---

## 11. I numeri

Un numero è una fila di cifre, solo da 0 a 9, al massimo 12 — i reticoli non numerano le loro tacche con nient'altro. La sua **Altezza delle cifre** è l'altezza di una cifra; il suo **Ancoraggio** è il punto a cui si riferisce la sua posizione: la sua **Estremità sinistra**, il suo **Centro** o la sua **Estremità destra**, a metà dell'altezza delle cifre. Un'etichetta a destra di una tacca si ancora più facilmente per l'estremità sinistra: così mantiene la sua distanza qualunque sia il numero delle sue cifre.

Sono disponibili cinque caratteri: **B612** Regular (il predefinito, progettato per i display di cabina degli aerei), **Barlow** Light e Regular, e **Overpass** Light e Regular. Tutti sono sotto licenza SIL Open Font License; le cifre sono integrate nell'app come contorni, quindi non viene caricato alcun carattere.

---

## 12. Le forme SVG

Per tutto ciò che gli elementi non sanno disegnare — un segno di mira a forma di logo del produttore, un anello insolito, una scala telemetrica — importa un disegno SVG. Premi **Forma SVG** nella tavolozza, poi scegli un file o incolla il codice e premi **Leggi il codice incollato**. Un'anteprima mostra cosa entrerà; **Inserisci nel reticolo** lo aggiunge.

Si conservano solo le forme. Ogni riempimento e ogni contorno visibili diventano inchiostro del reticolo, qualunque sia il loro colore, con gli spessori di contorno del file. Tracciati di ritaglio e maschere vengono ignorati (le forme sono disegnate intere), i contorni tratteggiati sono disegnati pieni, e i marcatori di linea e le immagini incorporate vengono tralasciati; l'anteprima lo segnala quando succede. Il testo va prima convertito in tracciati (in Inkscape: Tracciato → Da oggetto a tracciato).

Il disegno entra con l'origine propria dell'SVG al centro del reticolo, scalato in modo che il lato più lungo misuri 5 mrad (15 MOA). Imposta la sua dimensione vera nelle sue impostazioni, in tre modi che modificano tutti la stessa scala: **1 unità SVG =** un angolo, oppure la **Larghezza** o l'**Altezza** del disegno. **Rifletti la forma quando specchiata** decide se una copia specchiata è un riflesso o lo stesso disegno semplicemente spostato dall'altra parte.

Durante il caricamento il file viene controllato alla ricerca di contenuti troppo complicati o dannosi, e rifiutato se supera i 2 MB, ha più di 5000 elementi, è annidato per più di 32 livelli, ha più di 100 000 segmenti di tracciato o 1000 copie riutilizzate, usa lunghezze in unità diverse dalle semplici unità utente o px, contiene un DOCTYPE, o richiede troppo tempo per essere letto. Un disegno grande fa un reticolo grande (§2): se puoi, semplificalo nel programma di disegno prima di importarlo.

---

## 13. I segni BDC

Un segno BDC (dall'inglese «Bullet Drop Compensation», cioè «compensazione della caduta del proiettile»; in parole povere, un segno di correzione a reticolo) è un punto di mira per una distanza diversa da quella di azzeramento: la tacca, il punto o lo chevron sotto il centro con cui si deve mirare a 300, 400, 500 m. Nel Progettista il dettaglio visibile si disegna con gli elementi descritti sopra; il segno BDC è un punto distinto e invisibile che dà l'angolo di quella correzione. Sta sull'asse verticale — si imposta solo la sua altezza — e non viene mai specchiato, ripetuto né illuminato. La vista lo mostra come un marcatore blu, nascosto da **Mostra i segni BDC**.

La vista cannocchiale del Calcolatore per il poligono calcola, per le condizioni attuali, a quale distanza corrisponde ogni segno BDC, e la scrive (vedi **Vista cannocchiale** nel [manuale principale](#/manual)). Metti un segno su ogni livello di correzione previsto dal reticolo, all'altezza che indica la scheda tecnica.

---

## 14. Inserire un reticolo intero

**Inserisci un reticolo intero…** nella barra del file copia un altro reticolo — uno dei tuoi o uno integrato — in quello che stai modificando: ogni elemento, al suo posto nell'originale, con i suoi gruppi e le sue impostazioni di illuminazione. Non si converte nulla: ogni valore angolare entra così come è stato disegnato, anche se l'originale era disegnato per un altro tipo di ottica o un altro ingrandimento di calibrazione (il pannello lo segnala). Se il tuo reticolo non è illuminato e l'originale sì, prende l'illuminazione dell'originale; se il tuo non ha ancora produttore né modello, prende quelli dell'originale.

Gli elementi inseriti arrivano selezionati, come un solo passo di annullamento, così puoi spostarli insieme o eliminarli di nuovo in un colpo. Inserire in un reticolo vuoto è il modo rapido di iniziare una variante: apri un nuovo reticolo, inserisci quello da cui differisce, cambia ciò che differisce, e salvalo con il suo nome di modello.

---

## 15. Salvare, scartare, ricominciare

- **Salva nell'arsenale** salva il reticolo nell'Arsenale e ti lascia nel Progettista, con un breve *«Salvato nell'arsenale.»* Un reticolo aperto dall'Arsenale viene salvato sopra se stesso; uno nuovo diventa un nuovo reticolo dell'Arsenale. Produttore e modello insieme sono il suo nome: se un altro dei tuoi reticoli ha già quel nome, ti viene chiesto se sostituirlo. Finché non c'è nulla da salvare, il pulsante diventa **Torna all'arsenale** e ti porta alla scheda Ottiche.
- **Scarta le modifiche** torna al reticolo come salvato per ultimo (o a uno vuoto se non lo è mai stato), dopo una conferma, e la sua cronologia di annullamento se ne va con esse. Un reticolo aperto dall'Arsenale ti riporta poi lì. Il pulsante è disattivato finché non c'è nulla da scartare.
- **Nuovo reticolo** inizia un reticolo vuoto, chiedendo conferma se quello attuale ha modifiche non salvate. Le tue opzioni, e i valori ricordati per i nuovi elementi, restano come sono.

Un reticolo si può salvare in un file dall'Arsenale, da solo o insieme a tutto il resto (vedi il [manuale dell'Arsenale](#/manual/arsenal), §8).

---

## 16. Tastiera

| Tasto | Effetto |
|---|---|
| Ctrl+Z / Cmd+Z | Annulla |
| Ctrl+Maiusc+Z, Ctrl+Y / Cmd+Maiusc+Z | Ripeti |
| Tasti freccia | Sposta la selezione di un passo di aggancio (0,1 mrad o 0,25 MOA) |
| Maiusc + tasti freccia | La sposta di dieci passi |
| Canc, Backspace | Elimina la selezione |
| Esc | Posa l'elemento scelto nella tavolozza; se non ce n'è uno, svuota la selezione |
| Invio, Spazio (nell'elenco) | Seleziona la riga attiva |

Nessuno di questi tasti agisce mentre stai scrivendo in un campo.

---

## 17. Nella pratica

### 17.1 Disegnare da una scheda tecnica

Le schede tecniche dei produttori danno di solito un disegno e una tabella delle quote. Dove i due non coincidono, fidati della tabella: il disegno è un'illustrazione, la tabella è la specifica. Leggi ogni quota nell'unità della scheda, imposta il Progettista su quell'unità, e digita i valori invece di trascinare gli elementi al loro posto. Compila **Fonte / note** con il nome e la data della scheda, così saprai poi da dove vengono i numeri.

### 17.2 Un tipico reticolo a tacche

1. Una **Linea verticale** dalla cima al fondo del campo e una **Linea orizzontale** da un lato all'altro, allo spessore dei fili.
2. Una breve **Linea orizzontale** per la prima tacca sotto il centro, a 1 mrad; spunta **Ripeti**, direzione *in basso*, il numero di tacche meno una, passo 1 mrad.
3. Una più corta per la mezza tacca a 0,5 mrad, ripetuta allo stesso modo.
4. Lo stesso per il filo orizzontale, con una breve **Linea verticale**, **Ripeti** a destra e **Specchia orizzontalmente** per il lato sinistro.
5. **Numeri** accanto a una tacca ogni due o ogni cinque, ancorati per l'estremità sinistra, specchiati dove la scheda numera entrambi i lati.
6. **Barre rastremate orizzontali** e **verticali** fino al bordo del campo, che iniziano dove la scheda fa iniziare le barre spesse; specchia quella orizzontale.

### 17.3 Un reticolo BDC

Disegna prima i dettagli visibili — tacche, punti o chevron, con i loro numeri se ce ne sono. Poi metti un **Segno BDC** su ogni livello di compensazione indicato dalla scheda, digitandone l'altezza in **Segno y**. Salva, associa il reticolo alla sua ottica nell'Arsenale, monta l'ottica sul tuo fucile e guardalo nella vista cannocchiale del Calcolatore per il poligono con le distanze BDC visibili: ogni segno mostra la distanza corrispondente alla caduta del tuo proiettile, nella tua cartuccia, nell'aria di oggi.

---

## 18. Limiti

- Al massimo 500 copie ripetute per elemento, e al massimo 12 cifre per numero.
- Nessuna posizione o dimensione oltre mezzo giro.
- Forme SVG: i limiti del §12.
- La cronologia di annullamento conserva gli ultimi 1000 passi, e ricomincia da capo con un nuovo reticolo, all'apertura di un altro, con Scarta le modifiche e al ricaricamento.
- Il campo visivo disegnato è un'ipotesi (§5), non quello della tua ottica.
