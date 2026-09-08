# geladen.ch ballistics Manuale d'uso — Calcolatore di precisione di tiro

*Parte della* [suite balistica geladen.ch](https://bc.geladen.ch)*. Successore dello strumento autonomo TARAN.*

---

## 1. A cosa serve questo strumento

Ogni tiratore ha un numero che cita a proposito della propria carabina. È quasi sempre sbagliato, ed è quasi sempre sbagliato nella stessa direzione: troppo ottimistico.

Il motivo non è la disonestà, è l'aritmetica. Il modo tradizionale di misurare la precisione di una carabina consiste nello sparare un gruppo di cinque colpi, misurare la distanza tra i due fori più lontani e chiamare quel numero «la precisione della mia carabina». Quella misura è una singola estrazione da una distribuzione casuale molto ampia. Sparate dieci gruppi del genere con la stessa carabina, le stesse munizioni, dallo stesso banco e nello stesso giorno: il migliore sarà regolarmente metà del peggiore. Se poi citate il migliore — e tutti citano il migliore — non state descrivendo la vostra carabina. State descrivendo la vostra fortuna.

Il Calcolatore di precisione di tiro fa l'opposto. Invece di chiedere *quanto era grande quel gruppo*, chiede *qual è la dispersione di fondo di questa combinazione carabina/ricarica, e quanto sono sicuro di questa risposta*. Lo fa aggregando **ogni colpo che avete mai inserito nel progetto** — su quanti bersagli e quanti gruppi vi va di sparare — in un'unica stima, e riportando un intervallo di confidenza accanto a ogni numero, così che vediate subito se avete misurato qualcosa di reale o semplicemente raccolto un altro aneddoto — o una bella foto da postare su un forum.

Il modo di lavorare è deliberatamente rudimentale. Non servono cronografo, bersaglio acustico, telemetro laser né alcunché di connesso a un'app. Servono bersagli di carta, un righello e la fotocamera di un telefono.

### Cosa non è

Non è un programma di punteggio. Non gli importa nulla di zone, mouches o valore di gara. Misura dispersione e punto di impatto, nient'altro.

Non è nemmeno un sostituto dello strumento **Probabilità di colpire**, che combina la precisione della carabina con vento, errore di stima della distanza e abilità del tiratore per prevedere la probabilità di colpire al primo colpo a distanza. Questo strumento misura *uno* dei dati che quello consuma — la precisione meccanica della carabina stessa — e può passarglielo direttamente (vedi §10.3).

---

## 2. Riservatezza, archiviazione e requisiti

**Nulla di ciò che mettete in questo strumento lascia il vostro dispositivo.** Nessun account, nessun caricamento, nessuna telemetria, nessuna «statistica d'uso anonima». Le foto dei vostri bersagli — che sono, dopotutto, foto di vostra proprietà, scattate in un luogo dove sparate — sono archiviate nel database IndexedDB del vostro browser, sulla vostra macchina, e rilette da lì. L'intero calcolo, dalle coordinate in pixel agli intervalli di confidenza, gira in JavaScript nel vostro browser.

Il corollario è quello che vi aspettate: **se cancellate i dati dei siti del browser, i vostri progetti spariscono.** Non esiste alcuna copia lato server da cui recuperarli. Usate le funzioni di backup (§9) se quei dati vi stanno a cuore.

**Requisiti.** Qualunque browser ragionevolmente recente. Lo strumento è usabile da telefono — anzi, segnare gli impatti toccando una foto sullo schermo è probabilmente il modo più naturale di usarlo — ma il rapporto di precisione, con diagramma, legenda e tabella dei numeri affiancati, è più comodo su un tablet o su uno schermo da scrivania. L'app si installa come PWA e funziona completamente offline una volta caricata.

---

## 3. Il modello dei dati: Progetti, Bersagli, Gruppi, Colpi

Quattro livelli di annidamento, e vale la pena capirli prima di iniziare a cliccare, perché sbagliare qui è di gran lunga il modo più comune di produrre un rapporto privo di senso.

```
Progetto        una carabina + una ricarica + una distanza
  └─ Bersaglio  una foto di un foglio di carta
       └─ Gruppo  un punto di mira e i colpi sparati su di esso
            └─ Colpo   un foro di proiettile
```

**Un Progetto** è l'unità di analisi. Tutto ciò che sta dentro un progetto viene aggregato in un'unica stima statistica, il che significa che tutto ciò che sta dentro un progetto deve essere confrontabile: stessa carabina, stesse munizioni, stessa distanza. Un progetto porta un **nome**, la **distanza dal bersaglio** e il **calibro**. La distanza serve perché ogni risultato angolare (mrad, MOA) dipende da essa; il calibro serve perché il diagramma possa disegnare i fori alla loro dimensione reale.

Se cambiate *qualunque cosa* nella carabina o nella ricarica — una carica di polvere diversa, una palla diversa, un regime di pulizia della canna in cui credete davvero — iniziate un nuovo progetto. Aggregare due ricariche diverse non vi dà la dispersione di nessuna delle due.

**Un Bersaglio** è una foto. Ogni bersaglio porta la propria calibrazione di scala, perché ogni foto è scattata da distanza e angolo leggermente diversi. Ecco perché la calibrazione è per bersaglio e non per progetto: lo strumento non presume mai che due foto abbiano gli stessi pixel per millimetro.

**Un Gruppo** è un punto di mira più i colpi sparati su di esso. Un foglio può, e di norma dovrebbe, portare più gruppi — un foglio con quattro rombi stampati, cinque colpi ciascuno, è un bersaglio con quattro gruppi.

**Un Colpo** è un foro di proiettile, archiviato come posizione sulla foto.

### Perché i gruppi contano statisticamente

Ogni colpo è misurato **rispetto al punto di mira del proprio gruppo**, non rispetto a un'origine assoluta sul foglio. È l'intera ragione per cui i gruppi esistono come livello della gerarchia.

Immaginate quattro gruppi su un foglio A4, mirati a quattro rombi diversi. Se lo strumento aggregasse semplicemente le posizioni grezze dei fori, calcolerebbe una dispersione superiore a 200 mm — la distanza tra i *rombi*, non la dispersione della *carabina*. Ricentrando ogni colpo sul punto di mira su cui è stato sparato, i quattro gruppi collassano su un'origine comune, e ciò che resta è la dispersione autentica colpo per colpo.

Ciò significa anche che i vostri segni di punto di mira devono essere onesti. Se piazzate il punto di mira al centro visivo del gruppo invece che nel punto che avete davvero mirato, vi giocate la capacità dello strumento di misurare il vostro errore di azzeramento (§8.3) — e, francamente, tutto il resto.

### 3.1 Nota sulle unità

**Ogni numero che questo strumento vi mostra, e ogni numero che vi lascia digitare, è nelle unità che avete scelto nelle Impostazioni.** Non ci sono eccezioni nascoste né campi che si aspettino di soppiatto qualcos'altro. Se lavorate in pollici e iarde, in questo strumento non vedete né digitate mai un millimetro.

Due dei gruppi di unità della suite entrano in gioco:

- **Distanza** (`m`, `yd`, `ft`) — la distanza del progetto.
- **Lunghezza piccola** (`mm`, `cm`, `in`) — tutto ciò che si misura sulla carta: il righello di calibrazione che digitate, il calibro, l'estensione, e ogni risultato del rapporto quando il selettore delle unità è impostato sull'assoluto anziché sull'angolare. Trattandosi di misure alla scala di una palla, sono mostrate con precisione più fine rispetto al valore generale della suite: **2 decimali in mm, 3 in cm e pollici**.

Internamente il motore lavora esclusivamente in millimetri e metri, e la conversione avviene solo al confine della visualizzazione. Ciò ha una conseguenza pratica che vale la pena conoscere: **cambiare la preferenza sulle unità non altera mai i dati archiviati né alcun risultato calcolato.** Passate da mm a pollici e ogni progetto esistente si rivisualizza correttamente — la calibrazione che l'anno scorso avete digitato come 100 mm ora si legge 3,937 in, descrive lo stesso righello e produce esattamente le stesse statistiche di dispersione.

**Dove sono indicate le unità.** I campi di inserimento portano l'unità come suffisso vivo sull'etichetta — *«Distanza reale (in)»* — che si aggiorna quando cambiate preferenza invece di restare fissato nella traduzione. I valori mostrati portano l'unità in linea: *«ES 1,78 in»*. L'esportazione CSV nomina l'unità in ogni intestazione di colonna (§8.7).

**L'unica eccezione.** Il selettore **Unità di visualizzazione dei risultati** del rapporto (§8.1) può riesprimere le statistiche in **mrad** o **MOA** invece che in una lunghezza. Governa solo la legenda e la tabella Numeri; l'intestazione della pagina e la **scala** del diagramma continuano a seguire la vostra preferenza globale, e l'esportazione CSV lo ignora del tutto, poiché le coordinate grezze sono sempre una lunghezza.

In tutto questo manuale gli esempi numerici sono scritti in millimetri e metri per concretezza. Leggeteli come «qualunque sia l'unità che avete configurato».

---

## 4. Avvio rapido

Per gli impazienti. I dettagli seguono nei §5–§9.

1. **Precisione di tiro** dal menu degli strumenti → **Aggiungi progetto**. Dategli un nome, la distanza, il calibro. Salvate.
2. **Aggiungi bersaglio** → **Scegli foto…** → scegliete una foto del vostro foglio bersaglio → ruotate se serve, stringete gli angoli di ritaglio se volete → **Usa questa foto**.
3. Atterrate direttamente nell'area di marcatura, al passo **calibrazione**. Toccate un'estremità del righello nella foto, toccate l'altra, inserite la distanza reale tra i due punti — nelle vostre unità, come dice l'etichetta del campo — e toccate **Fine calibrazione**.
4. Toccate dove avete mirato. Questo piazza il **punto di mira**.
5. Toccate ogni foro di proiettile. Continuate a toccare. Quando avete finito, **Fine inserimento colpi**.
6. **Aggiungi gruppo** e ripetete dal passo 4 per ogni ulteriore gruppo sul foglio.
7. Tornate al progetto. **Aggiungi bersaglio** per il foglio successivo, oppure, quando avete abbastanza colpi, **Vedi rapporto**.

Non aspettatevi che il rapporto dica qualcosa di attendibile prima di una ventina di colpi. Vedi §8.6.

---

## 5. Progetti

### 5.1 Creare un progetto

**Aggiungi progetto** apre un breve modulo:

- **Nome del progetto** — obbligatorio. Se digitate un nome già presente nella vostra libreria, compare un avviso che salvando sovrascriverete la voce esistente. È un avviso, non un blocco.
- **Distanza** — la distanza dalla volata al bersaglio. Inserita e mostrata nell'unità di distanza configurata nelle **Impostazioni** (m, yd o ft); archiviata internamente in metri in ogni caso, così che cambiare la preferenza in seguito rivisualizzi correttamente i progetti esistenti invece di corromperli.

  Questo valore guida ogni conversione angolare del rapporto, quindi assicuratevi che il numero corrisponda all'unità mostrata accanto. Se la vostra preferenza è in metri e digitate `100` per un bersaglio che in realtà avete sparato a 100 *iarde*, ogni cifra in mrad e MOA del rapporto esce circa il 9 % più piccola — e nulla, da nessuna parte, vi avviserà, perché 100 m è del tutto plausibile.
- **Calibro** — scelto dall'elenco a discesa delle designazioni standard (lo stesso che usa l'Arsenale) oppure digitato direttamente, nella vostra unità di lunghezza piccola. Serve a disegnare gli impatti al diametro reale dell'anima sul diagramma del rapporto, e a nient'altro — non influenza alcuna statistica.

### 5.2 L'elenco dei progetti

Ogni progetto salvato mostra il nome e il numero di bersagli. Non appena un progetto ha abbastanza colpi segnati per calcolare statistiche aggregate, la sua riga mostra in più il risultato principale — l'**R50** aggregato sia in mrad sia in MOA — e una **pastiglia di confidenza** colorata che dà la valutazione a colpo d'occhio (vedi §8.6). Questo vi permette di scorrere un elenco di una dozzina di progetti di sviluppo ricariche e vedere subito quali avete davvero sparato abbastanza da poterci credere.

Due indicazioni possono comparire sulla riga di un progetto:

- **Bersagli inutilizzabili presenti** — ad almeno un bersaglio del progetto manca qualcosa ed è escluso dall'analisi.
- **Nessun bersaglio utilizzabile trovato** — in questo progetto non c'è ancora nulla da analizzare.

### 5.3 Azioni per progetto

- **Modifica** / **Elimina** — eliminare un progetto elimina tutti i suoi bersagli, gruppi, colpi e foto. Vi viene chiesta conferma.
- **Backup su file** — scrive questo singolo progetto, foto comprese, in un file JSON.
- **Imposta come precisione della cartuccia…** — passa la precisione misurata di questo progetto a una cartuccia dell'Arsenale. Vedi §10.3.

---

## 6. Aggiungere un bersaglio

### 6.1 Fotografare il bersaglio

La qualità della vostra foto fissa un tetto rigido alla qualità di ogni numero che lo strumento produrrà poi. Trenta secondi di cura valgono la pena.

- **Fotografate perpendicolarmente alla carta.** Lo strumento applica un unico fattore di scala uniforme, ricavato dai vostri due punti di calibrazione. Non corregge la prospettiva. Una foto scattata di sbieco comprime un asse rispetto all'altro, e quell'errore finisce dritto nei vostri numeri di dispersione, in modo diverso in orizzontale e in verticale. Mettetevi davanti al bersaglio, tenete la fotocamera perpendicolare alla carta e riempite l'inquadratura con il foglio.
- **Includete un righello, nel piano della carta.** Fissate con nastro un righello d'acciaio o una scala stampata sulla faccia del bersaglio prima di spararci, oppure appoggiatene uno prima di fotografare. Un righello tenuto davanti al bersaglio, più vicino alla fotocamera, apparirà più grande della carta e farà sembrare i vostri gruppi più piccoli di quanto sono.
- **Usate una base di calibrazione lunga.** L'errore di calibrazione è un errore percentuale su ogni singolo risultato. Se calibrate su un dettaglio da 20 mm e i vostri tocchi sono sbagliati di un pixel, l'errore relativo è molto maggiore dello stesso pixel di gioco su una base da 200 mm. Usate l'elemento di lunghezza nota più lungo disponibile.
- **Luce piatta e uniforme.** I fori di proiettile nella carta sono ombre. Una luce laterale dura trasforma ogni foro in una cometa con bordo chiaro e coda scura, e finirete per segnare l'ombra anziché il foro.
- **Non ridimensionate troppo.** L'app riduce le immagini molto grandi per l'archiviazione, ma vi serve abbastanza risoluzione perché un foro di proiettile sia comodamente largo diversi pixel una volta ingrandito.

### 6.2 Importare la foto

**Aggiungi bersaglio** → **Scegli foto…** apre il selettore di file/fotocamera del vostro dispositivo. Scelto un file, ottenete una schermata di anteprima con tre operazioni:

- **Ruota a sinistra** / **Ruota a destra** — 90° per volta. Notate che ruotare riporta la selezione di ritaglio all'inquadratura piena, perché un rettangolo di ritaglio tracciato prima di una rotazione non indica più la stessa parte dell'immagine.
- **Ritaglia** — trascinate verso l'interno le maniglie d'angolo. Lasciatele sui bordi per tenere tutta la foto. Ritagliare le parti vuote dell'inquadratura conviene: significa più bersaglio sullo schermo quando ingrandite per segnare.
- **Usa questa foto** — conferma. Rotazione e ritaglio sono applicati insieme, in un'unica passata, sull'immagine originale a piena risoluzione, non sull'anteprima ridotta che stavate guardando. Scegliere un file da solo non crea mai un bersaglio; solo questo pulsante lo fa.

La conferma vi porta direttamente nell'area di marcatura.

Se il file non può essere decodificato ottenete *«Impossibile elaborare questa foto»* — provate un altro formato (PNG e JPEG sono le scelte sicure).

---

## 7. Marcare un bersaglio

L'area di marcatura è una vista a schermo intero della foto, trascinabile e ingrandibile, con un indicatore di passo e i comandi sotto. Vi guida attraverso tre passi in ordine — calibrazione, punto di mira, colpi — e poi si ferma in uno stato di riposo dal quale potete aggiungere altri gruppi.

**Tutto si salva automaticamente.** Ogni punto che piazzate, ogni punto che trascinate, ogni colpo che eliminate è scritto in memoria immediatamente. Non c'è un pulsante di salvataggio né alcun modo di perdere lavoro navigando altrove.

**Tutto è trascinabile.** Non esiste da nessuna parte un'azione separata «conferma questo punto»: toccare *è* piazzare. Se un punto cade leggermente fuori posto, ingrandite e trascinatelo. Entrambi i punti di calibrazione, il punto di mira del gruppo attivo e ognuno dei suoi impatti possono essere ritoccati in qualsiasi momento.

Solo i punti del gruppo **attivo** sono trascinabili. I punti di mira degli altri gruppi restano visibili come riferimenti fissi, così vedete la disposizione dell'intero foglio senza poter disturbare il lavoro già concluso.

### 7.1 Passo 1 — Calibrare la scala

*«Toccate la foto sul primo punto di calibrazione — un'estremità di un righello o un elemento di lunghezza nota sul bersaglio.»*

Toccate una volta per il primo punto, una volta ancora per il secondo, quindi inserite la **distanza reale** tra i due punti.

**Inseritela nelle vostre unità.** L'etichetta del campo porta un suffisso d'unità vivo — *«Distanza reale (mm)»*, *«(cm)»* o *«(in)»* secondo la vostra preferenza di lunghezza piccola — quindi appoggiate un righello da 6 pollici sul bersaglio con i pollici selezionati e digitate semplicemente **6**. Nessuna conversione, nessun conto, nulla da invertire. Il valore è convertito nei millimetri interni del motore nel momento in cui viene archiviato, ed è per questo che cambiare preferenza in seguito rivisualizza correttamente lo stesso righello invece di corromperlo.

Il passo del campo e il suo valore minimo accettato sono la precisione di visualizzazione di quell'unità — 0,01 mm, oppure 0,001 cm/in — così che tutto ciò che può esservi mostrato possa anche essere digitato.

La linea di calibrazione tracciata sulla foto è etichettata con lo stesso valore nella stessa unità, e lascia cadere gli zeri inutili: un righello da 100 mm si legge *«100 mm»*, non *«100,00 mm»*. Controllate quell'etichetta prima di proseguire; è l'unico numero del progetto per il quale tutto il resto viene scalato, e una svista qui scala i risultati di un intero bersaglio senza produrre nulla che assomigli a un errore.

La linea di calibrazione è tracciata in verde con la lunghezza indicata. Ingrandite e trascinate le estremità finché non poggiano esattamente sui riferimenti tra cui avete misurato.

**Fine calibrazione** fa avanzare. È un passo esplicito deliberato anziché un avanzamento automatico, così che armeggiare con le estremità o ridigitare la lunghezza mentre ricontrollate il vostro lavoro non vi butti mai fuori dal passo all'improvviso.

**Ricalibra**, disponibile più tardi dallo stato di riposo, vi riporta qui senza scartare i punti già piazzati. Ricalibrare riscala retroattivamente ogni misura di quel bersaglio — gli impatti sono archiviati come posizioni sulla foto, non come millimetri, quindi correggere una calibrazione sbagliata mesi dopo corregge anche tutti i suoi risultati.

### 7.2 Passo 2 — Punto di mira

*«Toccate la foto per piazzare il punto di mira di questo gruppo.»*

Un solo tocco. Segnate dove avete *mirato*, non dove è finito il gruppo. Disegnato come un reticolo rosso.

Piazzare il punto di mira avanza subito al passo degli impatti.

### 7.3 Passo 3 — Segnare i colpi

*«Toccate la foto per registrare ogni foro di proiettile — continuate a toccare per aggiungerne altri.»*

Toccate ogni foro. Ogni impatto è disegnato come un punto numerato nel vostro **colore degli impatti** configurato (Impostazioni → Colore degli impatti, condiviso con lo strumento Probabilità di colpire), cerchiato da un doppio bordo bianco e scuro perché resti visibile su qualsiasi parte di una foto reale — visuale nera, carta bianca o stampa. Nessun limite per gruppo.

Non appena un gruppo ha due o più colpi, la sovrapposizione traccia la linea dell'**estensione** tra i due fori più lontani, etichettata con la sua lunghezza, e segna il **punto di impatto medio** del gruppo — il suo baricentro. Anche la linea dell'estensione segue il colore degli impatti, così l'intero gruppo si legge come un tutt'uno.

Entrambe le etichette a schermo — la lunghezza dell'estensione e la lunghezza di calibrazione in verde — sono nella vostra unità di lunghezza piccola configurata.

Toccate in modo coerente. Che segniate il centro di ogni foro o il suo bordo in alto a sinistra conta meno che farlo sempre allo stesso modo; uno scostamento sistematico applicato a tutti i colpi si annulla nella dispersione, uno casuale no.

**Elimina colpo** passa a una modalità di cancellazione: *«Toccate l'impatto che volete rimuovere, oppure Annulla per tenerlo.»* Toccate il segno di un colpo per rimuoverlo, Annulla per uscire dalla modalità. È una modalità separata anziché una pressione prolungata o uno scorrimento proprio perché togliere un colpo da un insieme di dati che state cercando di mantenere onesto dovrebbe richiedere intenzione.

Il pulsante **Fine inserimento colpi** fa esattamente quello che dice — riporta tutto questo meccanismo al cosiddetto «stato di riposo».

### 7.4 Più gruppi per bersaglio

Dallo stato di riposo — *«Scegliete un gruppo qui sotto per continuare ad aggiungervi colpi, oppure aggiungete un nuovo gruppo»* — ottenete una barra di schede, una per gruppo, ciascuna etichettata con il suo numero e il conteggio dei colpi.

- Toccare la scheda di un gruppo lo rende attivo e rientra nel passo degli impatti, così potete aggiungere colpi a un gruppo che credevate concluso.
- **Aggiungi gruppo** avvia un gruppo nuovo: siete riportati al passo del punto di mira, e i colpi del nuovo gruppo iniziano da lì.

La riga di ogni gruppo mostra il conteggio dei colpi e la sua **ES** — l'estensione, la distanza tra i suoi due impatti più lontani, nella vostra unità di lunghezza piccola. Questo numero è mostrato perché tutti vogliono vederlo e perché è utile per individuare un colpo segnato male, ma tenete presente che è esattamente la statistica dalla quale distogliervi è la ragione d'essere di tutto questo strumento.

### 7.5 Salva immagine panoramica del gruppo

Scarica un PNG del **gruppo attualmente attivo** esattamente com'è segnato — punto di mira, impatti numerati, linea dell'estensione con la sua etichetta, punto di impatto medio e linea di calibrazione con la sua lunghezza — ritagliato su ciò che avete al momento a schermo, ingrandimento e spostamento compresi. Gli impatti sono disegnati al calibro reale del progetto.

L'immagine esportata è una copia fedele di ciò che è a schermo: stesso colore degli impatti, stesso doppio bordo, ed entrambe le etichette — estensione e lunghezza di calibrazione — nelle stesse unità che state guardando. Vale la pena ricordarlo se pubblicate l'immagine da qualche parte, dato che il destinatario non ha modo di sapere quale preferenza di unità fosse attiva al salvataggio. Se l'immagine è destinata a un pubblico imperiale, cambiate preferenza prima di esportare.

La linea di calibrazione è inclusa qui anche se la vista di marcatura la mostra solo durante il passo di calibrazione stesso — un'immagine esportata dovrebbe portare con sé la prova della propria scala.

Utile per un quaderno di sviluppo ricariche, un messaggio su un forum, o per mostrare a un armaiolo la prova di un problema, senza esportare l'intero progetto.

### 7.6 Quando un bersaglio è utilizzabile?

Un bersaglio deve avere **tutte e tre** le cose seguenti prima di poter contribuire a un rapporto:

1. una **calibrazione** completata (entrambi i punti piazzati *e* una lunghezza reale diversa da zero inserita),
2. almeno un gruppo con un **punto di mira**,
3. almeno un **colpo**.

Un bersaglio a cui manchi una di queste porta la pastiglia **Inutilizzabile** e un'indicazione che precisa esattamente cosa manca ancora — *«Richiesto: calibrazione, almeno 1 colpo»*. I bersagli inutilizzabili sono esclusi silenziosamente dal rapporto aggregato; non sono un errore, semplicemente non sono ancora finiti.

---

## 8. Il rapporto di precisione

**Vedi rapporto** compare su un progetto non appena almeno uno dei suoi bersagli è utilizzabile. Il rapporto aggrega ogni colpo di ogni gruppo utilizzabile su ogni bersaglio utilizzabile in un'unica analisi.

La riga sotto il titolo ripete i parametri del progetto e l'ampiezza del campione: *distanza, calibro, N colpo/i*. Controllatela. Se il conteggio dei colpi non è quello che vi aspettate, avete un bersaglio inutilizzabile da qualche parte.

### 8.1 Unità di visualizzazione dei risultati

Un selettore in alto governa le unità di ogni valore nella legenda e nella tabella Numeri sottostante. Offre tre scelte:

- **la vostra unità di lunghezza piccola configurata** — l'opzione è etichettata con l'unità reale (`mm`, `cm` o `in`, secondo quanto avete impostato), non con una parola generica, così vedete a colpo d'occhio cosa state per leggere. È la dimensione assoluta, lineare, sulla carta, mostrata con 2 decimali in mm e 3 in cm o pollici.
- **mrad** — milliradianti, con 3 decimali.
- **MOA** — minuti d'angolo, con 2 decimali.

Le unità angolari sono convertite usando la distanza propria del progetto. Le unità lineari sono ciò che è stato effettivamente misurato; le unità angolari sono quelle in cui è graduata la torretta della vostra ottica. Per confrontare carabine sparate a distanze diverse, usate l'angolare — un gruppo da 20 mm a 100 m e uno da 40 mm a 200 m differiscono di un fattore due in cifre assolute, ma riflettono la stessa precisione (angolare). Per ragionare se una palla passerà attraverso un foro, usate il lineare.

### 8.2 Il diagramma aggregato

**Risultati aggregati** è il grafico a dispersione aggregato: ogni colpo del progetto, disegnato rispetto al punto di mira del proprio gruppo, tutti su un'origine comune. La **Legenda** sta accanto ed elenca ogni elemento attualmente disegnato, con colore, nome e valore.

Tre elementi sono sempre disegnati e non si possono disattivare:

- **Tutti gli impatti** — i colpi aggregati, disegnati nel vostro **colore degli impatti** configurato (Impostazioni → Colore degli impatti; il valore predefinito è un rosso bacca scuro) con lo stesso doppio bordo bianco e scuro usato nella vista di marcatura, così i punti restano leggibili dove si sovrappongono tra loro o alla griglia. Il campione di colore della legenda legge dalla stessa fonte, e quindi non può mai discostarsi da ciò che è stato disegnato.
- **Punto di mira** (reticolo rosso) — nell'origine, per costruzione,
- **Punto di impatto** (arancione) — il baricentro aggregato.

Il colore degli impatti è letto al momento del disegno, quindi cambiarlo nelle Impostazioni compare al successivo rendering del diagramma — anche in un SVG esportato.

Tutto il resto è opzionale, e ogni elemento opzionale si attiva dalla colonna **Mostra sull'immagine** della tabella Numeri (§8.4) o dalle **Opzioni immagine** (§8.5). Attivare qualcosa aggiorna insieme diagramma, legenda e immagine esportata — ciò che vedete è esattamente ciò che esportate.

### 8.3 Cosa significano i numeri

Ogni valore qui sotto è mostrato in ciò su cui è impostato il selettore **Unità di visualizzazione dei risultati** (§8.1). Gli esempi numerici qui sono scritti in millimetri per concretezza; leggeteli nella vostra unità.

**Conteggio colpi** — quanti colpi sono stati aggregati. È il numero che conta di più, e quello che tutti vorrebbero più piccolo di quanto debba essere.

**Intervallo di confidenza** — espresso come coppia di percentuali, per esempio `-15%/+22%`. È l'intervallo di confidenza al 95 % sulla stima di dispersione stessa. Leggetelo così: *la vera dispersione di questa carabina si trova, con il 95 % di confidenza, da qualche parte tra il 15 % più piccola e il 22 % più grande del numero che vi sto mostrando*. Questa singola riga è la prova di onestà per tutto il resto della pagina.

**Media degli impatti** — dove sta il centro del gruppo rispetto al punto di mira, come coppia orizzontale e verticale, sempre mostrata con segno esplicito. È il vostro errore di azzeramento.

La convenzione è quella del tiratore: **H positivo verso destra, V positivo verso l'alto**, le stesse direzioni con cui sono marcate le vostre torrette. Perciò una lettura di `H +6 mm, V -14 mm` significa che la vostra carabina spara **6 mm a destra e 14 mm in basso**, e correggerla vuol dire andare a sinistra e in alto.

**Intervallo di confidenza del punto di impatto** — quanto conoscete davvero quell'errore di azzeramento, nella forma `H ±…, V ±…`. È il numero che vi dice se vale la pena toccare le torrette. Se il vostro scostamento è 8 mm in basso e l'intervallo di confidenza su di esso è ±11 mm, non avete misurato un errore di azzeramento; avete misurato rumore. Continuate a sparare.

**Deviazione standard (sigma, σ)** — il parametro di dispersione del modello adattato. Non direttamente utile al banco, ma è la grandezza da cui sono derivati tutti i raggi qui sotto, ed è la grandezza a cui si applica l'intervallo di confidenza.

**R50** — il raggio del cerchio, centrato sul punto di impatto, che contiene il 50 % dei colpi. Classicamente chiamato **errore circolare probabile** (CEP). È il migliore numero singolo per la precisione di una carabina: è una mediana, quindi robusto, ed è la forma che il resto di questa applicazione consuma (§10.3).

**R95** — il raggio che contiene il 95 % dei colpi.

**R99** — il raggio che contiene il 99 % dei colpi. Attenti a non leggerci troppo dentro: state estrapolando la coda di un modello adattato ben oltre il punto in cui avete dati, e il modello presume che non esistano colpi anomali.

**L'intervallo di confidenza dell'R95** — il raggio R95 con la propria banda di incertezza, mostrata sul diagramma come un anello pallido di spessore finito anziché come una linea. È un buon elemento da lasciare acceso: rende l'incertezza visibile geometricamente invece di nasconderla in una tabella.

**ES5x** — l'estensione media che dovreste *attendervi* da un gruppo di cinque colpi sparato da questa carabina. **ES10x** — lo stesso per dieci colpi.

Questi due meritano un paragrafo, perché sono il ponte tra questo strumento e il modo in cui tutti gli altri parlano di precisione. Se il vostro progetto dice ES5x = 22 mm, significa: se uscite a sparare gruppi da cinque colpi con questa carabina, misureranno *in media* 22 mm. Non «misureranno» — *in media*. Alcuni saranno 14 mm e altri 32 mm, e quello da 14 mm è quello che finisce su internet. ES5x è la versione onesta del numero di cui stavate per vantarvi, e vi permette anche di riscontrare questo strumento con i vostri appunti passati.

**Riferimento 1 MOA** — un cerchio tratteggiato di esattamente una MOA di diametro alla distanza del progetto, con la sua dimensione reale in didascalia. Un righello per l'occhio: trasforma «è una carabina sub-MOA?» in una domanda a cui si risponde guardando anziché calcolando.

### 8.4 La tabella Numeri

Tutte le statistiche di cui sopra in un'unica tabella: **Descrizione**, **Designazione**, **Valore** e **Mostra sull'immagine**. La casella nell'ultima colonna aggiunge quell'elemento al diagramma, alla legenda e all'immagine esportata simultaneamente. Conteggio colpi, intervallo di confidenza e media degli impatti non hanno casella — i primi due non sono geometrici, e il punto di impatto è sempre disegnato.

### 8.5 Opzioni immagine

- **Salva la legenda con l'immagine dei risultati** (attivo di default) — se l'esportazione SVG includa il pannello della legenda e il confidenziometro, oppure solo il diagramma nudo. Vedi §8.7.
- **Griglia** — una griglia di riferimento opzionale con passo **0,1 mrad**, **0,05 mrad**, **1/4 MOA** o **1/8 MOA**, oppure nessuna. Il passo è angolare, quindi la sua dimensione reale è calcolata dalla distanza del progetto. Impostatelo sul valore di clic della vostra ottica e il diagramma diventa leggibile direttamente in clic di torretta.
- **Colpi in scala** (attivo di default) — disegna ogni impatto al diametro reale dell'anima del progetto anziché a una dimensione fissa. È la resa onesta, ed è anche quella che fa sembrare una buona carabina a corta distanza un ammasso illeggibile di cerchi sovrapposti. Disattivatelo quando la sovrapposizione dà fastidio.
- **1 MOA** — il cerchio di riferimento tratteggiato descritto sopra.
- **Raggio di probabilità di colpire** — un cursore dallo 0 % al 99 %. Trascinatelo e sul diagramma compare un cerchio rosso scuro al raggio che contiene quella frazione dei colpi. La lettura dà quel raggio in tre modi contemporaneamente — nella vostra unità di lunghezza configurata, in mrad e in MOA — così potete confrontarlo con una dimensione di bersaglio, una suddivisione del reticolo o una scala di torretta senza convertire nulla a mano.

  È la forma pratica di *«quanto deve essere grande il bersaglio perché io lo colpisca nove volte su dieci?»* — e, letta al contrario, *«quale frazione dei miei colpi finisce in un bersaglio di questa dimensione?»*

  **È un raggio, non un diametro.** Un gong da 100 mm ha un raggio di 50 mm: trascinate il cursore finché la lettura non dice 50 mm e leggete la percentuale sul cursore. Dimenticare di dimezzare è l'errore più facile da commettere qui, e vi lusinga parecchio.
- **Scala** — una scala grafica sul diagramma, così che l'immagine esportata sia leggibile senza legenda.

Ognuna di queste impostazioni — il selettore delle unità, ogni casella Mostra sull'immagine, la griglia, le opzioni immagine, la posizione del cursore — è ricordata e ripristinata la volta successiva che aprite un rapporto qualsiasi, anche dopo un riavvio dell'app. Sono preferenze di visualizzazione, non dati di progetto: vi seguono di progetto in progetto.

### 8.6 Il Confidenziometro

Un indicatore verticale con una lancetta, e di gran lunga il widget più importante della pagina.

Risponde a una domanda: **ho sparato abbastanza da poter dire qualcosa?** La posizione della lancetta è guidata dall'ampiezza dell'intervallo di confidenza sulla stima di dispersione — intervallo stretto, lancetta alta. La barra è divisa in fasce, dal basso verso l'alto: **NON SIGNIFICATIVO**, **SCARSO**, **MEDIOCRE**, **BUONO**, **ECCELLENTE**, con una linea tratteggiata in cima alla fascia NON SIGNIFICATIVO, siglata con la sobrietà tipica di questo strumento: *«(soglia stronzate)»*.

Sotto quella linea, i vostri dati non sostengono alcuna affermazione sulla vostra carabina.

Il pannello accanto all'indicatore dà una qualità a parole, una **valutazione di confidenza** su una scala da 0 a 4 con i più, e il margine di confidenza come percentuale totale più i suoi due estremi.

Ed ecco quanto costa in munizioni. Queste cifre sono esatte, e sono una proprietà della matematica, non della vostra carabina — una buona carabina non raggiunge la confidenza più in fretta di una cattiva:

| Colpi | Margine di confidenza | σ noto a | Valutazione | Qualità |
|---:|---:|:---|:---:|:---|
| 3 | 227 % | −40 % … +187 % | 0 | Inutilizzabile |
| 5 | 124 % | −32 % … +92 % | 0 | Inutilizzabile |
| 10 | 72 % | −24 % … +48 % | 0 | Inutilizzabile |
| 15 | 56 % | −21 % … +35 % | 0 | Inutilizzabile |
| **19** | 49 % | −19 % … +30 % | 1 | Appena significativo |
| 22 | 45 % | −18 % … +27 % | 1+ | Scarso |
| 27 | 40 % | −16 % … +24 % | 2 | Mediocre |
| 35 | 35 % | −14 % … +20 % | 2+ | Sopra la media |
| 46 | 30 % | −13 % … +17 % | 3 | Buono |
| 65 | 25 % | −11 % … +14 % | 3+ | Molto buono |
| 99 | 20 % | −9 % … +11 % | 4 | Magnifico |

Leggete la cima di quella tabella, e rileggetela. **Un gruppo di cinque colpi vi dà la dispersione della vostra carabina entro circa meno un terzo, più un fattore due.** Dieci colpi — due «gruppi», una sessione rispettabile secondo il metro dei più — vi lasciano ancora incapaci di distinguere una carabina da un'altra peggiore del 40 %. Da *Inutilizzabile* non uscite prima di diciannove colpi, e una risposta davvero stretta non l'avete prima di avvicinarvi al centinaio.

Ne consegue che l'unica cosa che un singolo gruppo di 3 colpi pubblicato online vi dice davvero è qualcosa sull'ignoranza statistica di chi l'ha postato — o sulla sua disonestà intellettuale.

Non è un difetto dello strumento. È ciò che costa davvero misurare una variabile casuale bidimensionale, e ogni affermazione sulla precisione che abbiate mai letto basata su un gruppo di cinque colpi era soggetta esattamente alla stessa aritmetica — semplicemente non ve lo diceva.

La buona notizia è che quei colpi non devono essere sparati in una sola serie, né in un solo giorno, né su un solo foglio di carta. È tutto il senso della struttura progetto/bersaglio/gruppo: sparate cinque cartucce a settimana per cinque mesi e lasciate che lo strumento le accumuli.

### 8.7 Esportazioni

**Salva immagine** (accanto al titolo Risultati aggregati) scrive il diagramma come **SVG** — vettoriale, quindi si ingrandisce a qualsiasi dimensione senza sgranarsi. Con *Salva la legenda con l'immagine dei risultati* attivo, il file esportato porta una riga d'intestazione con nome del progetto, distanza, calibro e conteggio colpi; il pannello completo della legenda; e una resa del confidenziometro, così che l'immagine si regga da sola e non possa essere citata spogliata della propria incertezza. L'esportazione è generata ex novo con sfondo bianco, quindi si stampa e si incolla pulita nei documenti indipendentemente dal tema dell'app che state usando.

**Esporta CSV** scrive le coordinate grezze di ogni colpo aggregato, una riga per colpo:

| Colonna | Significato |
|---|---|
| `ShotRight (mm)` | scostamento orizzontale dal punto di mira del suo gruppo, positivo verso **destra** |
| `ShotUp (mm)` | scostamento verticale dal punto di mira del suo gruppo, positivo verso l'**alto** |
| `Target` | il nome del bersaglio |
| `Group` | il numero del gruppo all'interno del suo bersaglio |
| `Distance (m)` | la distanza del progetto |
| `Description` | il nome del progetto |

**Ogni colonna nomina sia la propria direzione sia la propria unità.** Impostate pollici e iarde e le intestazioni diventano `ShotRight (in)`, `ShotUp (in)`, `Distance (yd)`, con i valori convertiti di conseguenza — le coordinate alla precisione della vostra lunghezza piccola (2 decimali in mm, 3 in cm o pollici), la distanza a quella del proprio gruppo. Il file dice quindi in faccia ciò che significa: nulla di esso deve essere ricordato, cercato o dedotto dalle impostazioni che si trovavano attive al momento della scrittura. I *nomi* delle colonne restano in inglese qualunque sia la lingua dell'app, perché sono identificatori per lo strumento a cui il file è destinato.

Il selettore **Unità di visualizzazione dei risultati** non arriva al CSV. Può esprimere le statistiche in modo angolare, in mrad o MOA, ma queste sono coordinate grezze, che sono sempre una lunghezza.

> **Cambio di formato.** Queste colonne si chiamavano prima `ShotX` e `ShotY`, e `ShotY` era positivo verso il *basso* — l'opposto di `ShotUp`. La rinomina è deliberata: un foglio di calcolo che referenziava `ShotY` per nome ora fallisce in modo visibile invece di leggere in silenzio numeri invertiti. Se avete esportazioni archiviate, sono nella vecchia convenzione; invertite il segno del loro `ShotY` per confrontarle con un file nuovo.

I separatori di campo e decimale seguono le vostre preferenze in **Impostazioni → Esportazione CSV**, così il file si apre pulito nella localizzazione di foglio di calcolo che usate — questo governa la *formattazione* dei numeri, indipendentemente dalle unità di cui sopra. È la via di fuga: se volete fare la vostra analisi, adattare il vostro modello o verificare l'aritmetica dello strumento, ecco i vostri dati grezzi.

---

## 9. Backup, ripristino e gestione dei dati

L'archivio dello strumento vive nel vostro browser. Fatene il backup.

- **Backup su file** (per progetto) — un progetto, autosufficiente.
- **Backup della libreria su file…** — una finestra che vi lascia scegliere quali progetti includere, e poi un unico file JSON che li contiene tutti.
- **Carica backup da file…** — importa un file salvato in precedenza.

Le foto viaggiano dentro il file di backup, il che rende questi file voluminosi ma davvero completi: un progetto ripristinato è pienamente rimarcabile e pienamente rianalizzabile.

### Gestione dei conflitti all'importazione

I progetti importati sono confrontati con la vostra libreria esistente **per nome**, senza distinzione di maiuscole e spazi. Dove un nome collide, scegliete come risolvere:

- **Sovrascrivi** — la versione importata sostituisce quella esistente.
- **Sovrascrivi se più recente** — sostituisce solo se la marca temporale di modifica del progetto importato è successiva a quella dell'esistente; altrimenti viene saltato. La scelta sicura quando si uniscono due dispositivi.
- **Rinomina** — importa come copia, chiamata *«<nome> - copia (1)»*, e così via.

L'importazione riferisce quante voci sono state salvate e quante saltate. Se il file non è JSON valido, o è JSON valido ma non un'esportazione di precisione di tiro, ottenete un errore preciso anziché un silenzioso nulla di fatto.

---

## 10. Metterlo in pratica

### 10.1 Sviluppo delle ricariche

La tentazione è sparare un gruppo di tre colpi per ogni carica di polvere, scegliere il più piccolo e proclamare un nodo. La tabella del §8.6 vi dice esattamente quanto vale quella procedura: a tre colpi la stima di dispersione si estende su circa un fattore cinque. State selezionando rumore.

La procedura corretta con questo strumento è:

1. Un **progetto per ricarica**. Nomi identici tranne che per il parametro che varia, così che l'elenco dei progetti si ordini sensatamente.
2. Sparate ogni ricarica ripetutamente, in più sessioni, aggiungendo bersagli al suo progetto man mano.
3. Sorvegliate la pastiglia di confidenza nell'elenco dei progetti. Continuate a sparare finché ogni candidato non è almeno fuori dalla fascia *Inutilizzabile*, e preferibilmente a *Mediocre*.
4. Confrontate le ricariche per **R50 con il suo intervallo di confidenza**, non per R50 da solo.

La regola di decisione è semplice ed è severa: **se gli intervalli di confidenza di due ricariche si sovrappongono, non avete dimostrato che sono diverse.** Potrebbero benissimo esserlo — ma non in base alle vostre prove. O sparate di più, o accettate di non poterle distinguere e scegliete su un'altra base (costanza delle velocità, disponibilità dei componenti, di cosa avete già una cassa).

Questa regola, se la applicate onestamente, squalificherà la maggior parte delle conclusioni sullo sviluppo ricariche della letteratura di tiro. È voluto così — quella «maggior parte delle conclusioni» è stronzate ignoranti.

### 10.2 Azzeramento

La **media degli impatti** e il suo **intervallo di confidenza** sono gli strumenti dell'azzeramento, e l'intervallo è quello che la gente salta.

La regola: **non toccate le torrette finché l'intervallo di confidenza del punto di impatto non è più piccolo della correzione che state per fare** — e idealmente più piccolo di un clic di torretta alla vostra distanza. Se il vostro punto di impatto segna 12 mm basso ±15 mm, correggere equivale a lanciare una moneta e spostare il vostro azzeramento in un punto che non avete misurato. Sparate di più, guardate l'intervallo stringersi, e poi correggete una volta sola.

Impostate le unità dei risultati su **mrad** o **MOA** per corrispondere alle vostre torrette, e la correzione diventa un numero che potete impostare direttamente invece di uno da convertire da una misura lineare a una distanza da ricordare.

I segni sono quelli sui tappi delle vostre torrette — V positivo verso l'alto, H positivo verso destra — quindi la correzione è la lettura con il segno invertito: un punto di impatto di `V -14 mm` richiede 14 mm verso l'alto.

Impostate la **Griglia** sul valore di clic della vostra ottica e leggete la correzione direttamente dal diagramma, in clic.

### 10.3 Alimentare il resto della suite

**Imposta come precisione della cartuccia…** sulla riga di un progetto passa la sua precisione misurata a una cartuccia dell'Arsenale. La finestra elenca ogni progetto con statistiche calcolabili, mostrando per ciascuno l'R50 aggregato in mrad e MOA insieme alla sua pastiglia di confidenza, così vedete a cosa vi state impegnando. Sceglierne uno scrive quell'R50 nella cartuccia scelta.

Da lì confluisce in **Probabilità di colpire**, che lo combina con l'incertezza del vento, l'errore di stima della distanza e l'abilità del tiratore per produrre probabilità di colpire al primo colpo a distanza. È il guadagno di tutto l'esercizio: la differenza tra una probabilità di colpire calcolata da un R50 misurato e delimitato da un intervallo di confidenza, e una calcolata da un numero ricordato da un gruppo di cinque colpi, è la differenza tra un calcolo scientifico e un'illusione color rosa.

L'Arsenale archivia internamente la precisione come R50 in mrad, ma accetta l'inserimento nella convenzione che vi riesce più comoda — R50, R95, R99, ES5 o ES10 — convertendo automaticamente in R50 (§11.7). Se digitate un numero a mano invece di scegliere un progetto, usate la convenzione che avete effettivamente misurato.

### 10.4 Verificare la propria attrezzatura

Due usi rapidi che discendono dai numeri:

**L'ingrandimento della mia ottica è adeguato alla mia carabina?** *Un'ottica vi aiuta a vedere meglio, non a sparare meglio.*

Se l'R95 della vostra carabina è nell'ordine di 1–1,5 MOA, un'ottica da 12x o 15x basta e avanza per mirare comodamente al bersaglio più piccolo che potete colpire con sicurezza — e questo prima ancora di vento, distanza, dispersione della velocità alla volata e degli altri fattori d'errore che si sommano sopra. Un ingrandimento maggiore può essere utile per altro — identificare il bersaglio, osservare, leggere il vento e così via — ma per la mira in sé è peso morto: avete più ingrandimento del necessario, e i soldi spesi per quel di più sarebbero meglio investiti altrove.

**Un «colpo anomalo» lo è davvero?** Attivate **R99** e guardate dove cade il colpo in questione. Un colpo dentro l'R99 non è anomalo; è la coda della vostra distribuzione normale che si comporta esattamente come previsto. I colpi anomali veri stanno vistosamente fuori. Questo, nella maggior parte dei casi, vi priverà della vostra scusa preferita.

---

## 11. La gioia del nerd: il modello e la matematica

Tutto ciò che segue è quello che lo strumento calcola davvero, con le derivazioni. Non è lettura obbligatoria per usare lo strumento, ed è la parte più interessante dello strumento.

**Le unità di questa sezione sono quelle del motore, non le vostre.** Internamente lo strumento lavora esclusivamente in **millimetri** per le lunghezze sulla carta e in **metri** per la distanza, e ogni unità visibile all'utente — mm, cm, pollici, iarde, piedi, mrad, MOA — è una conversione applicata al confine della visualizzazione e da nessun'altra parte. Nessuna statistica qui sotto è influenzata dalle vostre preferenze; cambiare le unità cambia come un numero viene stampato, mai ciò che è stato calcolato.

### 11.1 Il modello di fondo

Lo strumento presume che gli scarti orizzontale e verticale di un colpo, misurati dal vero centro del gruppo, siano **variabili casuali normali indipendenti, a media nulla e di uguale varianza σ²**:

$$x \sim \mathcal{N}(0, \sigma^2), \qquad y \sim \mathcal{N}(0, \sigma^2), \qquad x \perp y$$

È il modello circolare-normale standard (normale bivariata isotropa) della dispersione dei colpi. La sua conseguenza è che lo scarto **radiale** $r = \sqrt{x^2 + y^2}$ segue una **distribuzione di Rayleigh** di parametro σ:

$$f(r) = \frac{r}{\sigma^2} \exp\left(-\frac{r^2}{2\sigma^2}\right), \qquad F(r) = 1 - \exp\left(-\frac{r^2}{2\sigma^2}\right)$$

Un solo parametro, σ, descrive l'intera dispersione. Ogni raggio che lo strumento riporta è un quantile di questa unica distribuzione, e l'intervallo di confidenza di ciascuno di essi è l'intervallo di confidenza di questo unico parametro.

**Le ipotesi, dichiarate onestamente.** Il modello è isotropo: presume che la dispersione verticale e quella orizzontale siano uguali. Le carabine reali violano spesso questa ipotesi — l'allungamento verticale dovuto alla variazione di velocità è il caso classico, e quello orizzontale dovuto al vento un altro. Il modello non prevede nulla per i colpi anomali, per una miscela eteroschedastica, né per un centro di gruppo che vaga tra le sessioni (riscaldamento della canna, sporco, un bipiede che cammina). Resta comunque la scelta predefinita giusta: ha un solo parametro, quindi converge all'incirca quanto più velocemente sia possibile, e i suoi modi di fallimento sono visibili a occhio sul grafico a dispersione. Se la vostra nuvola aggregata è visibilmente un'ellisse anziché un cerchio, il σ che vi viene mostrato è un compromesso tra due numeri diversi, ed è bene tenerlo a mente.

Notate inoltre che lo strumento misura la dispersione dell'*intero sistema così come avete sparato* — carabina, munizioni, ottica, appoggio e tiratore. Non può separarli. Un progetto sparato dal bipiede con vento misura voi e il meteo tanto quanto la carabina.

### 11.2 Aggregazione

Per ogni colpo $i$ del gruppo $g$ sul bersaglio $T$:

1. Il colpo e il punto di mira del suo gruppo sono archiviati come frazioni delle dimensioni native in pixel della foto, in $[0,1]^2$. Sono convertiti in pixel nativi moltiplicando per larghezza e altezza della foto.
2. La scala $s_T$ del bersaglio (px/mm) viene dal suo righello di calibrazione:

   $$s_T = \frac{\sqrt{(\Delta x_{\text{px}})^2 + (\Delta y_{\text{px}})^2}}{L_{\text{reale}}}$$

   dove il numeratore è la distanza in pixel tra i due punti di calibrazione e $L_{\text{reale}}$ è la lunghezza che avete inserito, in mm.
3. Le coordinate in pixel sono divise per $s_T$ per dare millimetri.
4. Il colpo è ricentrato sul punto di mira del proprio gruppo:

   $$(x_i, y_i) = (x_i^{\text{mm}} - x_{g,\text{PM}}^{\text{mm}},\; y_i^{\text{mm}} - y_{g,\text{PM}}^{\text{mm}})$$

Archiviare le posizioni come frazioni della foto anziché come millimetri è ciò che rende possibile la ricalibrazione retroattiva: correggere il righello mesi dopo riscala automaticamente ogni impatto di quel bersaglio. È anche ciò che rende lo strumento agnostico alle unità per costruzione — un colpo archiviato non ha alcuna unità, solo una posizione su un'immagine. I millimetri entrano per la prima volta al passo 2, tramite $L_{\text{reale}}$, a sua volta convertita dall'unità in cui l'avete inserita; da lì in poi tutta la catena è metrica, e le vostre unità preferite riappaiono solo quando un numero finito viene stampato.

**Sistema di riferimento.** L'origine della frazione della foto è l'angolo in alto a sinistra dell'immagine e il suo asse verticale cresce verso il **basso**, quindi le $y_i$ aggregate sono positive *sotto* il punto di mira. Il motore mantiene quel sistema fino in fondo, deliberatamente: è anche il sistema dell'SVG, ed è ciò che permette al diagramma di disegnare i colpi aggregati, i cerchi dei raggi, la griglia e il riquadro del punto di impatto direttamente da questi millimetri, senza alcuna trasformazione.

Non ha alcun effetto su nessuna statistica di dispersione. Ogni grandezza dal §11.3 in poi dipende da $y$ solo attraverso scarti al quadrato dalla media, e questi sono invarianti per cambio di segno. Conta solo per l'unica grandezza con segno che lo strumento riporta — lo scostamento verticale dell'azzeramento — che è letta da un essere umano davanti a una torretta e deve quindi essere positiva verso l'**alto**.

Quella conversione avviene in un unico punto, un ausiliario `toShooterFrame()` che applica $(x, y) \mapsto (x, -y)$, attraverso il quale passano tutti e tre i percorsi leggibili da un umano: la media degli impatti della tabella Numeri, la riga del punto di impatto della legenda (e con essa la legenda dell'esportazione SVG), e la colonna `ShotUp` del CSV. Il disegnatore lo scavalca, perché l'immagine è sempre stata giusta.

I due sistemi sono un pericolo reale quando restano impliciti, il che è l'argomento a favore del dare un nome al confine anziché disseminare cambi di segno: versioni precedenti di questo strumento portavano una seconda convenzione contraddittoria, positiva verso l'alto, in una coppia di scostamenti per gruppo mai usata, e il commento che l'accompagnava affermava l'opposto di ciò che il rapporto mostrava davvero. Quei campi sono stati rimossi.

Il campione aggregato è l'unione di questi colpi ricentrati su tutti i gruppi e tutti i bersagli. Ogni bersaglio contribuisce attraverso il proprio fattore di scala, ed è per questo che foto scattate a distanze diverse si combinano correttamente.

**Limiti.** Meno di 3 colpi aggregati restituisce `tooFewShots`; più di 1000 restituisce `tooManyShots`. L'elenco aggregato grezzo è restituito in ogni caso, così l'esportazione CSV funziona anche quando le statistiche no.

### 11.3 Stimare σ

Sia $n$ il conteggio dei colpi aggregati e $(\bar{x}, \bar{y})$ il baricentro del campione. Le varianze campionarie per asse usano il denominatore corretto di Bessel $n-1$:

$$v_x = \frac{1}{n-1}\sum_i (x_i - \bar{x})^2, \qquad v_y = \frac{1}{n-1}\sum_i (y_i - \bar{y})^2$$

e sono mediate, poiché il modello afferma che stimano la stessa grandezza:

$$v = \frac{v_x + v_y}{2}$$

Ora, $\sqrt{v}$ **non** è uno stimatore non distorto di σ, benché $v$ lo sia per σ². La radice quadrata è concava, quindi per la disuguaglianza di Jensen $E[\sqrt{v}] < \sqrt{E[v]} = \sigma$: lo stimatore ingenuo è distorto verso il *basso*, e tanto più quanto il campione è piccolo. Lo strumento corregge questo esattamente.

Sotto il modello, $\dfrac{k \, v}{\sigma^2} \sim \chi^2_k$ con

$$k = 2(n-1)$$

gradi di libertà — due per colpo, meno due per il baricentro stimato. Il valore atteso della radice quadrata di una variabile chi-quadro è noto in forma chiusa,

$$E\left[\sqrt{\chi^2_k}\right] = \sqrt{2}\,\frac{\Gamma\!\left(\frac{k+1}{2}\right)}{\Gamma\!\left(\frac{k}{2}\right)}$$

il che dà il fattore di correzione della distorsione

$$c_n = \sqrt{\frac{k}{2}} \cdot \frac{\Gamma\!\left(\frac{k}{2}\right)}{\Gamma\!\left(\frac{k+1}{2}\right)}, \qquad k = 2(n-1)$$

e lo stimatore che lo strumento usa davvero:

$$\boxed{\hat{\sigma} = c_n \sqrt{v}}$$

È l'esatto analogo del fattore di correzione $c_4$ del controllo statistico di processo, generalizzato a $2(n-1)$ gradi di libertà. Il fattore è distribuito come tabella precalcolata indicizzata su $n$ da 2 a 1000, e concorda con la forma chiusa qui sopra in tutti e dieci i decimali archiviati, per ogni voce:

| n | 2 | 3 | 5 | 10 | 20 | 50 | 100 | 1000 |
|---|---|---|---|---|---|---|---|---|
| $c_n$ | 1,1284 | 1,0638 | 1,0317 | 1,0140 | 1,0066 | 1,0026 | 1,0013 | 1,0001 |

A $n=2$ la correzione è del 12,8 %, il che non è un dettaglio di arrotondamento — una stima su due colpi non corretta sottostima la dispersione di un ottavo. A $n=20$ è sotto l'1 % e a $n=100$ è cosmetica, ma costa una consultazione di tabella, quindi non c'è motivo di non essere esatti.

### 11.4 L'intervallo di confidenza su σ

Stesso pivot chi-quadro, usato nel verso opposto. Con $k = 2(n-1)$,

$$\Pr\left(\chi^2_{0.025,k} \le \frac{k\,v}{\sigma^2} \le \chi^2_{0.975,k}\right) = 0.95$$

Riordinando per σ² e prendendo le radici quadrate si ottiene l'intervallo bilaterale al 95 %, espresso come moltiplicatori sulla stima puntuale:

$$\boxed{\;\lambda_{\text{lo}} = \sqrt{\frac{k}{\chi^2_{0.975,k}}}, \qquad \lambda_{\text{hi}} = \sqrt{\frac{k}{\chi^2_{0.025,k}}}\;}$$

così che l'intervallo è $[\lambda_{\text{lo}}\hat\sigma,\ \lambda_{\text{hi}}\hat\sigma]$. Lo strumento archivia i limiti del rapporto di *varianze* $k/\chi^2$ nelle sue tabelle e prende la radice all'uso; il fattore di correzione e $\sqrt{v}$ si semplificano algebricamente nel rapporto, quindi i moltiplicatori dipendono solo da $n$ e per nulla dai vostri dati. Verificata contro i quantili chi-quadro esatti, ogni voce della tabella concorda a sette decimali.

Il **margine di confidenza** mostrato nell'interfaccia è semplicemente $\lambda_{\text{hi}} - \lambda_{\text{lo}}$, e le percentuali mostrate sono $(\lambda_{\text{lo}} - 1)$ e $(\lambda_{\text{hi}} - 1)$.

L'asimmetria è severa per $n$ piccolo ed è il cuore matematico del §8.6. A $n=5$: $\lambda_{\text{lo}} = 0.676$, $\lambda_{\text{hi}} = 1.916$. La vostra stima su cinque colpi è compatibile con una dispersione vera pari a due terzi di quella che avete misurato, e altrettanto compatibile con quasi il doppio. A $n=2$ il moltiplicatore superiore vale $\sqrt{39.5} = 6.28$.

L'intervallo si stringe come $O(1/\sqrt{n})$ — il solito ritmo, brutale. Dimezzarne l'ampiezza costa quattro volte le munizioni.

### 11.5 I raggi di precisione

Ogni raggio è la funzione di ripartizione di Rayleigh invertita alla probabilità corrispondente. Posto $F(r) = p$ e risolvendo:

$$r_p = \sigma\sqrt{-2\ln(1-p)}$$

il che dà direttamente le costanti riportate:

| Statistica | Derivazione | Moltiplicatore di σ | Usato |
|---|---|---|---|
| **R50** (CEP) | $\sqrt{2\ln 2}$ | 1,17741 | 1,18 |
| **R95** | $\sqrt{-2\ln 0.05}$ | 2,44775 | 2,45 |
| **R99** | $\sqrt{-2\ln 0.01}$ | 3,03485 | 3,03 |

R50 è la **mediana** di Rayleigh, ed è per questo che è la cifra principale preferita: è il quantile più robusto della distribuzione e il meno sensibile alle ipotesi del modello sulle code.

Il **cursore di probabilità di colpire** interattivo è la stessa formula valutata con continuità. Data una percentuale $p$, calcola

$$r = \sigma\sqrt{-\ln\left((1 - p/100)^2\right)} \;=\; \sigma\sqrt{-2\ln(1 - p/100)}$$

— le due forme sono algebricamente identiche. Il cursore è limitato al 99 % perché $p = 100$ manda il logaritmo all'infinito.

L'**intervallo di confidenza dell'R95** disegnato sul diagramma è $[\lambda_{\text{lo}} R_{95},\ \lambda_{\text{hi}} R_{95}]$ — l'intervallo di σ propagato attraverso una scalatura lineare, il che è esatto, dato che $R_{95}$ è proporzionale a σ.

### 11.6 Estensione attesa — ES5x e ES10x

L'estensione è la massima distanza tra coppie fra $n$ colpi:

$$\text{ES}_n = \max_{i<j} \lVert p_i - p_j \rVert$$

È il **diametro dell'inviluppo convesso** del campione, e non ha forma chiusa trattabile per la normale bivariata oltre $n=2$. Il suo valore atteso è ottenuto numericamente (integrazione Monte Carlo su grandi campioni della circolare-normale), ed è lineare in σ per invarianza di scala:

$$E[\text{ES}_5] = 3.06\,\sigma, \qquad E[\text{ES}_{10}] = 3.79\,\sigma$$

Sono le cifre ES5x ed ES10x. Notate la loro proprietà più importante: **sono valori attesi, non limiti.** L'estensione di un singolo gruppo è essa stessa una variabile casuale con una propria dispersione notevole — il che è esattamente il motivo per cui è uno stimatore pessimo e per cui questo strumento si prende la briga di non usarla.

Notate anche la forma della relazione. Passare da 5 a 10 colpi per gruppo aumenta la dimensione *attesa* del gruppo del 24 %, unicamente perché avete dato al campione più occasioni di produrre una coppia estrema, senza il minimo cambiamento nella carabina di fondo. È il meccanismo per cui «la mia carabina spara gruppi di mezza MOA» e «la mia carabina spara gruppi da una MOA» possono essere entrambe affermazioni vere sulla stessa carabina, che differiscono solo per quanti colpi chi parla spara prima di misurare. L'estensione non è una proprietà della carabina; è una proprietà della carabina *e dell'ampiezza del campione*, e citarla senza quest'ultima non significa nulla.

Poiché l'estensione cresce con $n$ mentre σ, R50 ed R95 no, solo questi ultimi sono confrontabili tra tiratori. È l'argomento a favore dell'R50 in una frase.

### 11.7 Conversioni tra convenzioni

Per l'interoperabilità con il resto della suite — l'Arsenale archivia la precisione come R50 in mrad — ogni convenzione si converte in σ dividendo per il suo moltiplicatore del §11.5, e σ si converte in R50 moltiplicando per 1,1774. ES5 ed ES10 si dividono rispettivamente per 3,06 e 3,79. Così, per esempio, una carabina dichiarata da 1 MOA su dieci colpi ha

$$\sigma = \frac{1.0}{3.79} = 0.264\ \text{MOA} \quad\Rightarrow\quad R_{50} = 1.1774 \times 0.264 = 0.311\ \text{MOA}$$

che è una cosa utile da saper fare a mente in armeria.

### 11.8 L'intervallo di confidenza sul punto di impatto

Un problema diverso da quello dell'intervallo di dispersione, e un pivot diverso. Il baricentro aggregato $(\bar{x}, \bar{y})$ stima il vero centro del gruppo; la sua incertezza è l'errore standard di una media, che per una popolazione normale a varianza ignota è un problema di *t* di Student:

$$\text{IC}_x = t_{q,\,n-1} \cdot \frac{\sqrt{v_x}}{\sqrt{n}}, \qquad \text{IC}_y = t_{q,\,n-1} \cdot \frac{\sqrt{v_y}}{\sqrt{n}}$$

Notate che qui le varianze per asse $v_x$ e $v_y$ sono usate **separatamente**, non la media aggregata $v$ — così l'intervallo di confidenza del punto di impatto è davvero ellittico e riferirà onestamente che una carabina che allunga in verticale è conosciuta meglio in orizzontale che in verticale. (La stima di dispersione del §11.3 le aggrega; la stima del punto di impatto no. È deliberato: l'ipotesi di isotropia è una scelta di modellazione per i quantili radiali, ma non c'è ragione di imporla a una semplice media.)

Il quantile è preso a

$$q = 1 - \frac{0.05}{4} = 0.9875$$

anziché all'ingenuo 0,975. È una **correzione di Bonferroni sui due assi**: l'intervallo mostrato è una regione al 95 % *congiunta* su orizzontale e verticale simultaneamente, quindi a ciascun asse è assegnato α/2 = 0,025 dell'errore totale, suddiviso bilateralmente in 0,0125 per coda. Prendere 0,975 per asse darebbe due intervalli marginali al 95 % la cui copertura congiunta sarebbe solo di circa il 90 %. Verificata contro i quantili *t* esatti a $q = 0.9875$ con $n-1$ gradi di libertà, la tabella distribuita concorda a cinque decimali ovunque.

L'intervallo è disegnato sul diagramma come un riquadro tratteggiato attorno al segno del punto di impatto.

### 11.9 La scala del Confidenziometro

L'indicatore mappa il margine di confidenza $c = \lambda_{\text{hi}} - \lambda_{\text{lo}}$ su una posizione della lancetta, e separatamente su uno di otto livelli discreti.

Il **livello discreto** è una scansione di soglie su

$$[0.5,\ 0.45,\ 0.4,\ 0.35,\ 0.3,\ 0.25,\ 0.2,\ 0]$$

che restituisce l'indice della prima soglia che $c$ supera — livello 0 («Inutilizzabile») per $c > 0.5$, livello 7 («Magnifico») per $c \le 0.2$. I livelli sono etichettati su una scala da 0 a 4 con i più: `0, 1, 1+, 2, 2+, 3, 3+, 4`.

La **posizione continua della lancetta** $\phi \in [0,1]$ è una mappa lineare a due tratti, limitata a entrambe le estremità e che si incontra esattamente in $c = 0.5$:

$$\phi = \begin{cases} (1.5 - c) \cdot 0.2 & c > 0.5 \\[4pt] 1 - (c - 0.2)\cdot\frac{8}{3} & c \le 0.5 \end{cases}$$

Verificate la giunzione: in $c = 0.5$ il ramo superiore dà $(1.5-0.5)\times 0.2 = 0.2$ e quello inferiore dà $1 - 0.3 \times 8/3 = 0.2$. Continua.

La conseguenza progettuale è che il 20 % inferiore dell'indicatore — la fascia «NON SIGNIFICATIVO», tutto ciò che sta sotto la **soglia stronzate** a $c = 0.5$ — assorbe l'intero intervallo $c \in (0.5, 1.5]$, mentre l'80 % superiore distende l'intervallo $c \in (0.2, 0.5]$ sulle sei frontiere di livello che contano. In altre parole, l'indicatore comprime deliberatamente la regione in cui i vostri dati non valgono nulla in un'unica fascia visiva e spende la propria risoluzione dove le distinzioni contano. Un gruppo da 3 colpi ($c = 2.27$) e uno da 10 colpi ($c = 0.72$) stanno entrambi vicino al fondo, e giustamente: nessuno dei due vi dice alcunché, e l'indicatore si rifiuta di lusingare la differenza tra loro.

La soglia a $c = 0.5$ corrisponde a $n = 19$. È l'opinione ponderata dello strumento sull'ampiezza campionaria minima per un'affermazione di precisione difendibile, ed è derivata, non asserita.

### 11.10 Conversione angolare

I risultati angolari usano le conversioni esatte condivise della suite anziché le solite approssimazioni da campo. Entrambe le unità sono convertite attraverso la loro misura esatta in radianti: un milliradiante sottende esattamente $1/1000$ della distanza, e un minuto d'angolo sottende

$$1' = \frac{\pi}{10800} = 2.908882 \times 10^{-4}\ \text{rad}$$

cioè 0,29089 mm per metro di distanza, ovvero **1,0472 pollici a 100 iarde** — non «1 pollice» della regola pratica dei tiratori. Quella regola porta un errore del 4,7 %, maggiore della differenza tra molte delle ricariche che si cerca di distinguere.

$$\theta_{\text{mrad}} = \frac{d_{\text{mm}}}{\text{distanza}_{\text{m}}}, \qquad \theta_{\text{MOA}} = \frac{d_{\text{mm}}}{0.29089 \cdot \text{distanza}_{\text{m}}}$$

I passi di griglia offerti nelle Opzioni immagine (0,1 mrad, 0,05 mrad, 1/4 MOA, 1/8 MOA) hanno il loro passo reale in millimetri calcolato dalla distanza propria del progetto nel momento in cui li selezionate, ed è per questo che la griglia resta un vero riferimento angolare qualunque sia la distanza a cui avete sparato.

### 11.11 Note numeriche

- La ricerca dell'**estensione** è una forza bruta in $O(n^2)$ sulle coppie all'interno di un gruppo. I gruppi sono piccoli; un diametro dell'inviluppo con calibri rotanti sarebbe asintoticamente migliore e praticamente irrilevante.
- Le tabelle ($c_n$, entrambi i moltiplicatori chi-quadro, i quantili *t*) sono distribuite precalcolate per $n = 2 \ldots 1000$ anziché valutate a runtime. Sono costanti statistiche esatte, verificate analiticamente come documentato sopra, e distribuirle evita di trascinare una libreria di funzioni speciali per gamma e beta incompleta dentro un pacchetto destinato al browser.
- Il tetto di 1000 colpi è il limite della tabella, non un limite algoritmico. Se avete sparato più di mille cartucce in un unico progetto, vi siete guadagnati il diritto di dividerlo.

---

## 12. Origine e licenza

Il Calcolatore di precisione di tiro è il successore di **TARAN**, uno strumento autonomo dello stesso autore. Il nucleo statistico — il modello, i fattori di correzione, le tabelle di confidenza, il confidenziometro e la sua irriverenza — è ripreso deliberatamente immutato, così che i risultati dei due strumenti siano direttamente confrontabili. La conversione in mrad è l'unico scostamento deliberato: la costante ereditata portava un errore di un fattore dieci ed è stata corretta rispetto alle conversioni angolari esatte della suite.

Ciò che è nuovo è la struttura attorno: una gerarchia progetto/bersaglio/gruppo con calibrazione per bersaglio al posto di un unico modello piatto in coordinate pixel, la ricalibrazione retroattiva, la marcatura regolabile per trascinamento, l'archiviazione persistente con backup e fusione, l'esportazione SVG e CSV, e l'integrazione con il resto della suite balistica.

La suite è rilasciata sotto licenza **AGPL-3.0-or-later**. Il codice TARAN ereditato da cui deriva è sotto GPLv3, © 2015 lo stesso autore.

---

*Pacifico. Preciso. Armato.*
