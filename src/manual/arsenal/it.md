# geladen.ch ballistics Manuale d'uso — Armi/Arsenale

*Parte della* [suite balistica geladen.ch](https://bc.geladen.ch)*. La libreria di fucili e proiettili condivisa da tutti gli altri strumenti.*

---

## 1. A cosa serve questo strumento

Prima o poi ogni altro strumento di questa suite ti pone le stesse tre domande: quale fucile, quale proiettile, quale carica. Traiettoria la pone. Probabilità di colpire la pone. Calcolatore per il poligono la pone. Rispondere a mano ogni volta — riscrivere un'altezza ottica, un coefficiente balistico, una velocità alla volata che hai già citato a memoria cento volte — è faticoso e un po' un insulto alla tua intelligenza, e i computer sono stati inventati apposta perché nessuno dovesse farlo a mano.

L'Arsenale è dove rispondi a queste domande **una volta sola**, per ogni fucile e ogni proiettile che possiedi davvero, e mai più dopo. Un fucile che salvi porta con sé la sua altezza ottica, la sua distanza di azzeramento, il suo passo di rigatura, i valori di click del suo ottica. Un proiettile che salvi porta il suo calibro, la sua massa, i suoi dati di resistenza. Una cartuccia — una carica precisa sparata da un fucile preciso — collega un proiettile a una velocità alla volata, e facoltativamente ai due numeri più difficili da conquistare di tutta la balistica esterna: quanto sia davvero costante la velocità di quella carica, e quanto precisamente quel fucile la spari — entrambe cose che altrimenti saresti tentato di indovinare.

Una volta salvati, i tuoi fucili e proiettili compaiono **ovunque** sia possibile scegliere un fucile o un proiettile in questa app, accanto alla libreria integrata e contrassegnati da un `*` iniziale, così sai sempre quali sono i tuoi. Scegli il tuo fucile una volta in Armi, e Traiettoria, Probabilità di colpire e Calcolatore per il poligono sanno già tutti e tre con cosa stai sparando.

### Cosa non è

Non è di per sé un calcolatore balistico. L'Arsenale memorizza gli *input* — BC, passo di rigatura, velocità alla volata e così via — che il motore di Traiettoria e Probabilità di colpire consumano; non calcola da solo un grafico di caduta, a parte la piccola funzione di confronto descritta al §7, che esiste apposta per permetterti di confrontare due configurazioni salvate l'una con l'altra.

Non è il **Calcolatore di precisione di tiro**, che misura la dispersione meccanica reale di un fucile a partire da fotografie di gruppi sparati. L'Arsenale consuma l'output di quello strumento — vedi §5.6 — non lo produce.

---

## 2. Privacy, memorizzazione e requisiti

**Nulla di ciò che inserisci in questo strumento lascia il tuo dispositivo.** Nessun account, nessun caricamento, nessuna telemetria. I tuoi fucili e proiettili sono memorizzati nel `localStorage` del tuo browser, sulla tua macchina, e riletti da lì. L'intero calcolo gira in JavaScript nel tuo browser.

La conseguenza è quella prevedibile: **se cancelli i dati del sito del tuo browser, il tuo Arsenale sparisce.** Non esiste alcuna copia lato server da cui ripristinare. Usa le funzioni di backup (§8) se questi dati contano per te — e l'Arsenale ti segnala, voce per voce, quando qualcosa non è mai stato salvato in backup (§9).

A differenza della precisione di tiro, l'Arsenale non memorizza fotografie né dati binari di grandi dimensioni, quindi il suo ingombro nel `localStorage` resta piccolo indipendentemente da quanti fucili e proiettili conservi. Non esiste alcun limite integrato al numero di entrambi che puoi salvare.

**Requisiti.** Qualsiasi browser ragionevolmente recente. L'app si installa come PWA e funziona interamente offline una volta caricata.

---

## 3. Il modello dei dati: Proiettili, Fucili, Cartucce

Tre tipi di record, e una relazione tra loro che vale la pena capire prima di iniziare a cliccare:

```
Proiettile     un progettile preciso: calibro, massa, dati di resistenza
Fucile         un fucile preciso: altezza ottica, distanza di azzeramento, passo di rigatura, click
  └─ Cartuccia   una carica sparata da quel fucile: un Proiettile + una velocità alla volata
```

**Un Proiettile** esiste da solo. Descrive un progettile — il suo calibro, la sua massa, e o un coefficiente balistico rispetto a un modello standard oppure una curva di resistenza misurata personalmente — e nulla su cosa lo spara. Lo stesso record di proiettile può essere referenziato da cartucce su più fucili diversi.

**Un Fucile** esiste da solo allo stesso modo: descrive la piattaforma — altezza ottica sopra l'anima della canna, la distanza a cui lo azzeri normalmente, il suo passo di rigatura (rateo e direzione), e il valore di click delle torrette del suo ottica — e nulla su cosa spara. Un fucile non ha **alcun calibro proprio**; il suo calibro è quello che dicono i proiettili delle sue cartucce (§5.5).

**Una Cartuccia** è ciò che effettivamente collega i due. Vive incorporata in un fucile, mai da sola, e nomina un proiettile più la velocità alla volata che quel fucile raggiunge con esso. È anche qui che vivono, facoltativamente, i due numeri più determinanti e più spesso indovinati di tutta la balistica esterna: la costanza della velocità della carica (§5.4) e la precisione propria misurata del fucile (§5.6) — entrambi alimentano direttamente Probabilità di colpire.

**Un fucile camera un calibro.** Nel momento in cui una cartuccia di un fucile si risolve in un proiettile reale, la selezione di proiettile di ogni altra cartuccia che aggiungi a quel fucile si blocca su proiettili dello stesso calibro (§5.5). Questo è imposto, non semplicemente suggerito — riflette un fatto sui fucili, non un limite dello strumento. (E se possiedi un drilling o un'altra arma combinata multicalibro, non c'è bisogno di fare i furbi — basta creare una voce separata per ciascun calibro.)

### 3.1 Una nota sulle unità

**Ogni numero che questo strumento ti mostra, e ogni numero che ti permette di digitare, è nelle unità che hai scelto nelle Impostazioni** — con due eccezioni deliberate, entrambe segnalate qui sotto.

I gruppi di unità coinvolti:

- **Velocità** (`m/s`, `ft/s`, `mph`, `km/h`) — velocità alla volata e la sua deviazione standard.
- **Distanza** (`m`, `yd`, `ft`) — la distanza di azzeramento di un fucile, e la distanza massima del grafico di confronto.
- **Lunghezza piccola** (`mm`, `cm`, `in`) — altezza ottica, calibro e lunghezza del proiettile. Calibro e lunghezza sono mostrati con una precisione più fine, a scala di proiettile (2 decimali in mm, 3 in cm e pollici), la stessa precisione che il Calcolatore di precisione di tiro usa per lo stesso motivo.
- **Passo di rigatura** (`mm`, `in`) — un proprio gruppo di unità, deliberatamente **indipendente** dalla lunghezza piccola. Un tiratore che pensa in millimetri per l'altezza ottica molto spesso cita comunque il passo di rigatura nel modo tradizionale, in pollici per giro, e cambiare la tua preferenza generale di lunghezza piccola non convertirà silenziosamente un passo di rigatura digitato come «1:8 in» in un numero in millimetri che non riconosci più.
- **Temperatura** (`°C`, `°F`) — la temperatura di riferimento di una cartuccia per la sensibilità velocità-temperatura.
- **Massa** — il peso del proiettile è l'unico campo che non sta mai dietro a una singola preferenza di unità. Viene mostrato come una **coppia di caselle collegate in tempo reale**, grammi e grain affiancati; digita in una e l'altra si aggiorna immediatamente. Questo rispecchia come il peso di un proiettile viene realmente citato nella pratica — grain negli ambienti di ricarica, grammi quasi ovunque altrove in ambito metrico — invece di imporre una scelta.

**Le due eccezioni**, entrambe volute:

- **I click dell'ottica** (valore di click orizzontale e verticale di un fucile) portano una **propria** scelta di unità, mrad o MOA, fissata una volta per fucile e indipendente dalla tua preferenza globale di dispersione angolare. Il campo lo dice direttamente: *«Sempre nell'unità scelta qui, indipendentemente dalle preferenze di unità in Impostazioni.»* La torretta di un ottica è incisa in un'unità per tutta la sua vita di servizio — e chi possiede un ottica graduata in MOA soffre già abbastanza di suo, senza che questo strumento gli imponga pure una conversione manuale in unità sensate.
- **Il valore di precisione d'arma di una cartuccia** (§5.6) porta allo stesso modo una propria scelta di unità, mrad o MOA, indipendente dalla stessa preferenza globale, per lo stesso motivo: la dimensione di gruppo propria misurata di un fucile non dovrebbe reinterpretarsi silenziosamente la prossima volta che cambi un'impostazione non correlata a quel fucile.

Internamente il motore lavora esclusivamente in metri, metri al secondo e chilogrammi; la conversione avviene solo al confine di visualizzazione. Cambiare la tua preferenza di unità non altera mai i dati memorizzati — un'altezza ottica digitata come 45 mm continua a leggersi come 1,772 in se cambi, e descrive esattamente lo stesso fucile.

---

## 4. Avvio rapido

Per gli impazienti. I dettagli seguono ai §5–§9.

1. **Armi** dal menu degli strumenti, oppure il link **Cambia** mostrato accanto al riepilogo attuale di fucile/proiettile in Traiettoria, Probabilità di colpire o Calcolatore per il poligono → scheda **Arsenal**.
2. **+ Aggiungi proiettile** per primo, se non ne hai ancora salvato uno. Dagli un nome, un calibro e una massa, e o un coefficiente balistico con un modello standard oppure una tabella Cd-Mach incollata. **Salva proiettile**.
3. **+ Aggiungi fucile**. Dagli un nome, imposta almeno altezza ottica e distanza di azzeramento; passo di rigatura e valori di click se li conosci. **Salva fucile**.
4. Sul fucile appena reso attivo, **+ Aggiungi cartuccia**. Dai un nome alla carica, scegli il proiettile appena salvato (o aggiungine uno in linea), e digita la velocità alla volata. **Salva cartuccia**.
5. Il tuo fucile è ora pronto per essere scelto ovunque nell'app. Premi **Fatto** per renderlo il fucile attivo dell'app, oppure continua ad aggiungere altri fucili e cartucce prima.

Un fucile con zero cartucce viene salvato ma contrassegnato **Inutilizzabile** (§6.4) — non può diventare il fucile attivo dell'app finché non ne ha almeno una.

---

## 5. Proiettili e cartucce

### 5.1 Aggiungere un proiettile

**+ Aggiungi proiettile** apre un modulo:

- **Nome** — obbligatorio. Un avviso in tempo reale compare se il nome esiste già nella tua libreria; salvando si sovrascrive la voce esistente. È un avviso, non un blocco.
- **Produttore** — testo libero, con completamento automatico tratto sia dalle librerie di proiettili integrate sia dai tuoi proiettili salvati. Lasciato vuoto, viene memorizzato come *«Custom»*.
- **Calibro** — **obbligatorio**. Un controllo doppio: un menu a tendina di designazioni di calibro standard (*«Seleziona calibro…»*) più un numero digitato liberamente nella tua unità di lunghezza piccola configurata. Scegli una designazione e il diametro esatto della canna viene compilato; digita invece un numero e, se cade entro 0,03 mm da una designazione nota, quella designazione viene selezionata automaticamente — altrimenti il menu mostra **Altro** senza scartare ciò che hai digitato. Questa è esattamente la stessa lista di designazioni e la stessa logica di corrispondenza che il Calcolatore di precisione di tiro usa per il proprio campo calibro.
- **Lunghezza** — facoltativo, lasciato vuoto se sconosciuto. Alimenta solo due cose e nient'altro: la stabilità del proiettile (formula di Miller) e la deriva giroscopica, descritte ai §5.5 e §9.3 — entrambi i metodi di calcolo della deriva giroscopica offerti da questa suite, la semplice formula di Litz e il più completo modello McCoy 4-DOF, ne hanno ugualmente bisogno.
- **Massa** — obbligatorio, inserita come la coppia grammi/grain collegata descritta al §3.1.
- **Dati di resistenza** — obbligatorio, e mutuamente esclusivi:
  - **Coefficiente balistico + modello standard** — un valore di BC (0,05–1,5) abbinato a un modello standard (G1, G7, e gli altri modelli standard della suite).
  - **Tabella Cd-Mach personalizzata** — per un proiettile di cui possiedi la propria curva di resistenza misurata (ad es. da dati radar pubblicati), incollata come testo semplice: una riga per coppia Mach-Cd, almeno due righe, Mach strettamente crescente lungo tutta la lista, ogni Cd tra 0,05 e 3,0. Il modulo la analizza in tempo reale e riporta quante righe ha trovato, o esattamente quale riga è sbagliata — per esempio «Riga 3: i valori di Mach devono crescere rigorosamente da una riga alla successiva.» — invece di un errore di analisi generico.
- **Fonte / note** — testo libero, facoltativo. Da dove viene questo numero, o cosa e come hai effettivamente misurato.

### 5.2 La lista dei proiettili

**I tuoi proiettili** elenca ogni proiettile salvato: nome, un'etichetta **Senza backup** se non è mai stato esportato in un file dall'ultima modifica, poi produttore, calibro e peso, e una data di ultima modifica. Ogni riga offre **Backup su file**, **Modifica**, e **Elimina**.

**Eliminare un proiettile ha effetti a cascata.** Se una qualsiasi cartuccia, su un qualsiasi fucile, fa riferimento al proiettile che stai eliminando, la conferma indica esattamente quante configurazioni di cartuccia verranno eliminate insieme a esso. Non esiste modo di eliminare un proiettile lasciando dietro un riferimento orfano.

### 5.3 Aggiungere un fucile

**+ Aggiungi fucile** apre un modulo:

- **Nome** — obbligatorio, con lo stesso avviso di sovrascrittura dei proiettili.
- **Altezza ottica** — obbligatorio, altezza dell'asse ottico dell'ottica sopra l'anima della canna, nella tua unità di lunghezza piccola (intervallo 0–500 mm). Alimenta il calcolo di caduta di Traiettoria per qualsiasi configurazione che usi questo fucile.
- **Distanza di azzeramento** — obbligatorio, la distanza a cui azzeri normalmente questo fucile, nella tua unità di distanza (intervallo 0–5000 m).
- **Passo di rigatura (distanza per giro)** e **Direzione di rigatura** (destra o sinistra) — facoltativo, lasciato vuoto se sconosciuto, nell'unità indipendente di passo di rigatura descritta al §3.1 (intervallo 1–1000 mm/in). Necessario solo per stabilità e deriva giroscopica, nient'altro.
- **Unità di click**, **Valore click orizzontale**, **Valore click verticale** — i valori propri delle torrette dell'ottica, in mrad o MOA come scelto qui (0,01–5, indipendente dalla tua preferenza globale, secondo il §3.1).
- **Fonte / note** — testo libero, facoltativo.

Un fucile appena creato si salva con una lista di cartucce vuota; aggiungi le sue cartucce subito dopo, dalla riga propria del fucile (§5.4).

### 5.4 Aggiungere una cartuccia

Le cartucce si gestiscono dalla scheda del **fucile attivo**, mai da un modulo autonomo — una cartuccia non ha senso senza il fucile a cui appartiene. **+ Aggiungi cartuccia** apre un modulo:

- **Nome** — obbligatorio, ad es. *«175 SMK, 41,5 gr N550»*. Un avviso in tempo reale compare se un'altra cartuccia dello *stesso* fucile ha già questo nome; i nomi possono ripetersi liberamente tra fucili diversi.
- **Proiettile** — **obbligatorio**. Un menu a tendina offre ogni proiettile del tuo Arsenale, con prefisso `*`, accanto alle librerie integrate visibili, ciascuna tra parentesi con il proprio nome di libreria. Una nuova cartuccia parte su **«+ Aggiungi nuovo proiettile…»** invece che su una prima voce arbitraria, così un salvataggio distratto non agganci il progettile sbagliato.

  **Scegliere un proiettile integrato ne copia una in tua libreria.** Poiché una cartuccia deve puntare a un record di proiettile che ti *appartiene* (in modo che modifiche successive al catalogo integrato non possano cambiare retroattivamente una carica già caratterizzata), salvare una cartuccia contro un proiettile integrato ne crea silenziosamente una copia unica in **I tuoi proiettili**, e fa puntare la cartuccia a quella copia da quel momento in poi. Un avviso lo segnala prima di salvare; se un proiettile con lo stesso nome esiste già nella tua libreria, un secondo avviso ti informa che la copia lo sovrascriverà.

  Se il fucile ha già un'altra cartuccia con un proiettile risolto, la selezione è **bloccata sul calibro di quel proiettile** — vedi §5.5.
- **Velocità alla volata** — obbligatorio, nella tua unità di velocità (50–1500 m/s).
- **La velocità alla volata varia con la temperatura** — una coppia facoltativa di caselle di spunta: **Temperatura di riferimento** (la temperatura a cui è stata misurata la velocità alla volata sopra) e **Variazione di velocità per grado** (intervallo 0–20 m/s per °C per il valore di sensibilità stesso). Lasciare la casella deselezionata omette entrambi; l'indicazione sopra la coppia — *«Presuppone che la cartuccia sia alla stessa temperatura dell'aria (temperatura inserita sopra).»* — vale la pena leggerla se spari la stessa carica su un ampio intervallo di temperature stagionali.
- **Regolarità della velocità iniziale (SD)** — facoltativo; secondo l'indicazione del campo, usato solo dallo strumento Probabilità di colpire. Se hai la deviazione standard riportata dal tuo cronografo per questa carica, inseriscila qui (0–20 m/s), e Probabilità di colpire la offrirà come opzione già pronta **«Questo fucile»** per il suo input di incertezza di velocità, invece di costringerti a ricordarla o reinserirla lì.
- **Specifica la precisione dell'arma per questa cartuccia** — facoltativo, descritto interamente al §5.6; secondo l'indicazione del campo, usato anch'esso solo dallo strumento Probabilità di colpire.

### 5.5 Blocco del calibro e stabilità

Un fucile non porta un proprio campo calibro (§3). Al suo posto, **la prima cartuccia che colleghi a un fucile ne fissa il calibro**, implicitamente, per ogni cartuccia aggiunta dopo: la selezione di proiettile di ogni cartuccia *successiva* su quel fucile offre allora solo proiettili del diametro di canna corrispondente. Il blocco si allenta solo se stai modificando l'ultima cartuccia rimasta del fucile — a quel punto non resta nulla con cui restare coerenti, e puoi di nuovo scegliere qualsiasi calibro.

Ogni riga di cartuccia, così come il modulo cartuccia stesso, mostra in più un **indicatore di stabilità** calcolato in tempo reale — `Stabile`, `Marginale`, o `Instabile`, con il fattore di stabilità giroscopica Sg calcolato accanto — non appena tutti e cinque gli input necessari sono noti: massa del proiettile, calibro, lunghezza, velocità alla volata di quella cartuccia, e passo di rigatura del fucile. Se manca uno dei cinque, l'indicatore mostra invece **«Stabilità sconosciuta»**, con un suggerimento a comparsa *«Cosa manca?»* che elenca esattamente quale dei cinque è assente. Vedi §9.3 per la formula.

### 5.6 Precisione dell'arma su una cartuccia

Questo è il ponte diretto tra l'Arsenale, il Calcolatore di precisione di tiro e Probabilità di colpire.

Spuntare **«Specifica la precisione dell'arma per questa cartuccia»** rivela:

- **Precisione espressa come** — una scelta tra **«Precisione propria (al banco) dell'arma»** e **«Precisione semplificata (combinata) arma + tiratore»**. La prima è ciò che il fucile raggruppa da solo, meccanicamente, da un appoggio. La seconda è ciò che tu, questo fucile, e la tua posizione di tiro abituale producete insieme — un numero più grezzo, più onesto per chiunque non sia un benchrester. Probabilità di colpire tratta le due in modo completamente diverso: la prima viene combinata lì *con* una stima separata dell'abilità del tiratore; la seconda *sostituisce* del tutto quella combinazione, e attiva di conseguenza l'interruttore proprio «Usa l'inserimento semplificato della precisione combinata» di Probabilità di colpire.
- **Valore di precisione**, espresso secondo una delle cinque convenzioni per cui hai davvero un numero — **R50**, **R95**, **R99**, **ES su 5 colpi**, o **ES su 10 colpi** — e in mrad o MOA, indipendentemente dalla tua preferenza angolare globale (§3.1). Qualunque tu scelga, il valore viene convertito e memorizzato internamente come **R50 in mrad**, così inserire la stessa dimensione di gruppo fisica sotto una convenzione o un'unità diversa produce sempre la stessa precisione memorizzata — esiste esattamente una rappresentazione interna, e il modulo esiste solo per permetterti di inserire il numero nella forma in cui l'hai effettivamente misurato. Cambiare il selettore di unità converte il numero mostrato sul posto, così la dimensione di gruppo fisica che hai digitato viene preservata invece di essere reinterpretata.
- L'indicazione che l'accompagna non usa mezzi termini: *«Sii onesto. Usa la media, non il migliore. Fai riferimento al «Calcolatore di precisione di tiro» per valori significativi e affidabili.»*
- **«Scegli da un progetto di precisione di tiro…»** — apre un selettore che elenca ogni progetto del Calcolatore di precisione di tiro con abbastanza colpi aggregati per calcolare un numero utilizzabile, ogni riga mostra il suo R50 sia in mrad sia in MOA accanto alla propria pastiglia di confidenza (la stessa pastiglia che usa il rapporto del Calcolatore di precisione di tiro, §8.6 del manuale di quello strumento) — quindi scegli un numero di cui puoi anche vedere l'affidabilità, non una cifra nuda. Scegliere un progetto compila automaticamente R50/mrad/«Propria»; devi comunque premere **Salva cartuccia** perché resti valido. Se nessun progetto si qualifica ancora, il selettore lo dice chiaramente: *«Non hai ancora nessuna cartuccia nell'Arsenal — aggiungi prima un fucile e una cartuccia.»* compare sul lato del Calcolatore di precisione di tiro quando è vero l'inverso (nessun fucile/cartuccia idoneo a ricevere una misura); il messaggio equivalente qui è *«Nessun progetto di precisione di tiro ha ancora dati sufficienti per un valore di precisione utilizzabile.»*

**Il percorso inverso — dal Calcolatore di precisione di tiro all'Arsenale — è documentato per intero al §10.1.**

### 5.7 Azzerare una cartuccia con una cartuccia diversa

Lo zero *fisico* di un fucile è un unico fatto meccanico riguardante il fucile e la sua ottica — ovunque siano attualmente regolate le torrette — non una proprietà di una particolare carica. In pratica, però, quello zero è stato stabilito sparando *una cartuccia specifica* alla distanza di azzeramento, e se poi spari una carica diversa attraverso lo stesso zero invariato, la sua traiettoria si discosta da ciò che predirebbe il calcolo dello zero proprio di quella carica — esattamente nella misura in cui la balistica delle due cariche differisce realmente. Il caso classico: azzeri con munizioni surplus o da allenamento economiche, poi porti con te una carica premium da caccia o di servizio il cui punto d'impatto reale, a qualunque distanza, è spostato rispetto a quello che avrebbe dato il suo proprio zero indipendente.

La versione estrema dello stesso problema è un fucile che spara sia una carica supersonica sia una subsonica soppressa, senza mai essere riazzerato tra l'una e l'altra — una configurazione comune per un lavoro silenzioso a corta distanza. Le traiettorie delle due cariche divergono enormemente oltre una breve distanza (un proiettile subsonico cade molte volte più velocemente), quindi dichiarare la cartuccia subsonica azzerata con quella supersonica non è qui una semplice questione di ordine — è l'unico modo perché la tabella di caduta propria di entrambe le cariche rifletta ciò che il fucile, fisicamente invariato, fa realmente.

**Azzerata con**, un campo del modulo cartuccia, permette di indicare all'Arsenale quale cartuccia ha effettivamente stabilito lo zero fisico, così che ogni strumento che calcola l'alzo per questa cartuccia possa tenere conto della differenza, invece di presumere silenziosamente che questa cartuccia si sia azzerata da sé.

- Il campo compare solo quando il fucile ha **almeno un'altra cartuccia** a cui puntare, e solo su una cartuccia che non è **essa stessa** già donatrice per un'altra cartuccia (vedi sotto).
- Scegliere una cartuccia dal menu a tendina la rende la **donatrice**; questa cartuccia ne diventa la **ricevente**. L'alzo della ricevente viene allora calcolato chiedendo «quale angolo di lancio manderebbe la balistica della *donatrice* attraverso la linea di mira alla distanza di azzeramento di questo fucile», e poi facendo volare la velocità alla volata e il proiettile *propri della ricevente* da quell'angolo preso in prestito — non azzerando la ricevente in modo indipendente.
- **Nessuna catena.** Una cartuccia già donatrice per un'altra non offre mai essa stessa il campo «Azzerata con» — non può, a sua volta, prendere in prestito uno zero da una terza cartuccia. La relazione resta una coppia semplice, mai una catena arbitrariamente profonda.
- **La condivisione va bene.** Più cartucce possono essere tutte azzerate con la stessa donatrice — il caso comune se spari una carica da allenamento prima di diverse cariche premium diverse dallo stesso fucile.
- Viene preso in prestito solo l'**alzo**. L'azzeramento della deriva laterale/giroscopica (§9.3, attivato separatamente nelle Impostazioni) si calcola sempre dalla balistica propria della ricevente.
- **Quali strumenti ne tengono conto:** Traiettoria, Calcolatore per il poligono e il grafico di Confronto (§7) calcolano tutti l'alzo della ricevente dalla sua donatrice ogni volta che ne è impostata una. **Probabilità di colpire no** — calcola sempre l'alzo dalla balistica propria della cartuccia, indipendentemente da qualunque donatrice le sia assegnata. Vedi §9.5 per il motivo.

La lista delle cartucce dell'Arsenale segnala entrambi i lati di questa relazione — vedi §6.4. Eliminare una donatrice cancella immediatamente il riferimento su ogni cartuccia che puntava a essa, invece di lasciarlo pendente; tali riceventi tornano semplicemente a calcolare il proprio zero.

---

## 6. La pagina Arsenale: liste, filtri, attivazione

### 6.1 Struttura della pagina, dall'alto in basso

1. Una breve introduzione che ricorda che tutto qui vive su questo dispositivo e compare contrassegnato da `*` ovunque sia possibile scegliere un fucile o un proiettile.
2. Il riepilogo **Per il confronto** e la sezione Confronto, mostrati solo una volta che 1–2 configurazioni sono messe in coda per esso (§7).
3. **Backup della libreria su file…** / **Carica backup da file…** (§8).
4. **Fucile attivo** — il fucile attualmente sotto la tua mano.
5. Una **scheda filtri** — filtri di calibro e produttore, nascosta interamente quando la tua libreria è vuota.
6. **Altri fucili**.
7. **I tuoi proiettili**.

### 6.2 Il fucile attivo e l'attivazione

Esattamente una combinazione fucile+cartuccia è «attiva» in tutta l'app in ogni momento — la stessa configurazione da cui leggono Traiettoria, Probabilità di colpire e Calcolatore per il poligono. Nella pagina Arsenale è mostrata nella propria scheda **Fucile attivo**, precompilata con la configurazione già in esecuzione se questa risulta essere un fucile dell'Arsenale; se la configurazione attuale dell'app è invece inserita a mano, la scheda lo segnala: *«Il fucile attualmente selezionato è definito manualmente e non è presente nel tuo Arsenale.»*

**Cliccare su una riga sotto «Altri fucili» lo attiva** — lo sposta nella scheda Fucile attivo — invece di aprirlo direttamente per la modifica; **Modifica** è offerto solo sul fucile attualmente attivo. Questo è deliberato: scegliere un fucile e modificare un fucile sono intenzioni diverse, e quella più comune (voglio sparare con questo) ottiene il clic semplice.

L'attivazione nella pagina Arsenale è provvisoria. **Nulla viene applicato alla configurazione condivisa dell'app finché non premi Fatto.** Puoi navigare liberamente tra i fucili, modificarne diversi di fila, e solo quello mostrato nella scheda Fucile attivo quando esci ha effetto. Se quel fucile ha attualmente zero cartucce, Fatto lascia intatta la configurazione precedentemente in esecuzione, invece di azzerarla.

Il selettore di cartuccia del fucile attivo ricorda quale cartuccia avevi selezionato per ultima, e la ripristina alla tua prossima visita.

### 6.3 Cartucce sotto il fucile attivo

Ogni cartuccia del fucile attivo è una riga a sé: nome, un'etichetta **Attiva** su quella attualmente scelta, la sua velocità alla volata, e l'indicatore di stabilità in tempo reale del §5.5. Cliccare su una riga la rende la cartuccia attiva. **+ Aggiungi cartuccia** si trova sotto la lista.

Un fucile senza cartucce mostra un avviso al posto della lista: *«Per questo fucile non è definita alcuna cartuccia. Questa configurazione è inutilizzabile e non verrà attivata.»*

### 6.4 Etichette

- **Senza backup** — questo proiettile o fucile è stato creato, modificato o importato dall'ultima volta che è stato scritto in un file di backup. Non compare mai su una voce integrata, dato che quelle non necessitano di backup.
- **Inutilizzabile** — un fucile con zero cartucce. Testo al passaggio del mouse: *«Nessuna cartuccia definita — questo fucile non può essere attivato.»* Un fucile del genere resta cliccabile, così puoi raggiungerlo per aggiungergli la prima cartuccia.
- **Attiva** — la cartuccia attualmente scelta sul fucile attivo.
- **Donatore di zero** — l'alzo di zero proprio di questa cartuccia è attualmente preso in prestito da una o più altre cartucce del fucile (§5.7).
- **Ricevente di zero** — questa cartuccia è azzerata con una cartuccia diversa; il passaggio del mouse indica quale.

### 6.5 Filtri

Due menu a tendina, **Filtra per calibro** e **Filtra per produttore**, predefiniti su **Tutti i calibri** / **Tutti i produttori**. Si restringono a vicenda: scegliere un produttore riduce la lista di calibri a quelli che quel produttore offre effettivamente, e viceversa. Le opzioni di calibro sono ordinate per diametro di canna reale invece che alfabeticamente, così `.223`, `6.5mm` e `.308` si ordinano come farebbe una rastrelliera di munizioni, non come un dizionario. Un fucile corrisponde a un filtro solo tramite i proiettili delle sue cartucce — i fucili non portano alcun calibro proprio, come notato al §3.

**Reimposta filtri** cancella entrambi. L'intera scheda scompare quando la tua libreria — proiettili e fucili insieme — è vuota, dato che allora non c'è nulla da filtrare.

Non esiste una ricerca in testo libero; il filtraggio avviene solo per calibro e produttore.

---

## 7. Confrontare due configurazioni

Ogni riga fucile+cartuccia porta un interruttore **Aggiungi al confronto**, limitato a **due** posti — una volta che due sono in coda, l'interruttore di ogni altra riga si disattiva con *«Rimuovi prima una configurazione dal confronto»*. Una scheda di riepilogo **Per il confronto** elenca ciò che è attualmente in coda, ciascuno con il proprio pulsante Rimuovi.

Una volta che esattamente due configurazioni sono in coda, appare una sezione completa **Confronto**: un controllo condiviso di atmosfera e vento, un campo condiviso di distanza massima, e un grafico di traiettoria — le stesse scelte di colonna, controlli di zoom e spostamento, ed esportazione SVG dello strumento Traiettoria stesso — che disegna entrambe le configurazioni come due serie con una legenda condivisa.

Il confronto viene **ricalcolato dal vivo** rispetto al tuo Arsenale a ogni rendering, ancorato all'identità di fucile e cartuccia invece che a un'istantanea congelata: modifica uno dei due fucili mentre è in coda, e il grafico si aggiorna immediatamente.

Questa selezione è **solo per la sessione** — non sono dati salvati, e si azzera al prossimo ricaricamento dell'app. Il suo scopo è un confronto rapido affiancato («la traiettoria più piatta del proiettile più pesante vale la sua partenza più lenta, alle distanze a cui sparo davvero») piuttosto che una registrazione permanente.

---

## 8. Backup, ripristino e gestione dei dati

La memorizzazione dell'Arsenale vive nel tuo browser. Fanne un backup — vedi §2 per cosa succede se non lo fai.

### 8.1 Esportare

- **Backup su file**, su qualsiasi singola riga di proiettile o fucile, esporta solo quell'unico elemento. Per un fucile, il file lo raggruppa insieme a ogni proiettile che le sue cartucce referenziano effettivamente, così il backup di un singolo fucile è sempre autosufficiente e reimportabile da solo.
- **Backup della libreria su file…** apre la finestra di dialogo **Salva libreria**: una casella di spunta per ogni proiettile e ogni fucile che possiedi, tutte spuntate per impostazione predefinita. Spuntare un fucile spunta automaticamente i proiettili di cui le sue cartucce hanno bisogno; deselezionare un proiettile deseleziona automaticamente qualsiasi fucile che ne ha bisogno — la finestra di dialogo non ti lascerà esportare un fucile con un riferimento a un proiettile orfano. **Esporta** scrive un unico file JSON contenente tutto ciò che è spuntato.

Ogni esportazione riuscita cancella l'etichetta **Senza backup** su tutto ciò che includeva.

### 8.2 Importare

**Carica backup da file…** apre un selettore di file (solo JSON). Un file che non è JSON valido, o JSON valido che non è un export dell'Arsenale, viene rifiutato con un messaggio specifico invece di un fallimento silenzioso. Un file ben formato apre la finestra di dialogo **Carica libreria**:

- Qualsiasi elemento il cui nome corrisponde a un elemento esistente nella tua libreria — confrontato senza distinzione tra maiuscole/minuscole né spazi — porta un'**etichetta di conflitto** che indica se la copia in arrivo è più recente, più vecchia, della stessa età, o di età sconosciuta rispetto alla tua copia esistente, in base alla marca temporale di ultima modifica di ciascun elemento.
- **Se un nome esiste già nella tua libreria** — una selezione che offre tre strategie, applicate a ogni elemento in conflitto di questo import:
  - **Sovrascrivi esistente** — la versione importata sostituisce completamente la tua.
  - **Sovrascrivi solo se più recente** — sostituisce solo quando la marca temporale dell'elemento in arrivo è strettamente successiva a quella del tuo elemento esistente; altrimenti quell'elemento viene saltato. La scelta predefinita sicura quando si uniscono backup di due dispositivi.
  - **Mantieni entrambi (rinomina la copia importata)** — importa come un nuovo elemento chiamato *«\<nome\> - copia (1)»*, incrementando finché il nome non è libero, così nulla di già presente nella tua libreria viene mai toccato.
- **Importa** applica le tue scelte e riporta l'esito: *«{{n}} elemento/i importati, {{n}} saltati.»*

I fucili vengono importati dopo i proiettili, e il riferimento al proiettile di ogni cartuccia viene rimappato all'id con cui il suo proiettile è effettivamente finito nella *tua* libreria — così un proiettile importato che è stato rinominato per evitare una collisione non lascia le cartucce del fucile importato a puntare al nulla.

---

## 9. Dati balistici e chi li consuma

Questa sezione è il piacere per nerd che accompagna il §5 — a cosa serve davvero ogni campo, matematicamente, una volta che lascia l'Arsenale.

### 9.1 Dati di resistenza → Traiettoria e Confronto

I dati di resistenza di un proiettile — BC-e-modello o una tabella Cd-Mach personalizzata — insieme alla sua massa, sono esattamente l'input di cui il motore di traiettoria ha bisogno per integrare un percorso di volo frenato dalla resistenza. Il grafico di Confronto proprio dell'Arsenale (§7) fa girare lo stesso motore di traiettoria che usa Traiettoria stessa, alimentato dal fucile di ogni configurazione in coda (altezza ottica, distanza di azzeramento) e dalla sua cartuccia (velocità alla volata, e la sua sensibilità opzionale alla temperatura, valutata rispetto a qualsiasi temperatura di riferimento tu abbia fornito).

### 9.2 Regolarità della velocità iniziale → Probabilità di colpire

La **regolarità della velocità iniziale (SD)** di una cartuccia, se la fornisci, non fa nulla all'interno dell'Arsenale stesso. Esiste unicamente perché, quando questa combinazione fucile+cartuccia è quella attiva, l'input di incertezza di velocità proprio di Probabilità di colpire possa offrire un'opzione già pronta **«Questo fucile»**, invece di chiederti di ricordare o rimisurare il valore del tuo stesso cronografo — con un'indicazione esplicita che questa cartuccia ne ha uno disponibile.

### 9.3 Stabilità e deriva giroscopica

L'indicatore di stabilità in tempo reale (§5.5) calcola il fattore di stabilità giroscopica Sg tramite la **regola del passo di rigatura di Miller**, ri-derivata direttamente nelle unità metriche proprie del motore di questa app invece di convertire attraverso gli input imperiali tradizionali della formula a ogni chiamata. La formula pubblicata di Miller stessa è una stima in atmosfera standard senza alcun termine di altitudine o densità dell'aria; questo motore vi applica il consueto affinamento di scala per densità, così un proiettile calcolato come marginale a livello del mare può risultare stabile in quota o in una giornata calda, e viceversa. Le tre fasce pubblicate sono:

| Sg | Valutazione |
|---|---|
| < 1,0 | Instabile |
| 1,0 – 1,3 | Marginale |
| ≥ 1,3 | Stabile |

Gli stessi cinque input — massa, calibro, lunghezza, velocità alla volata, passo di rigatura — guidano anche, nel motore di Traiettoria, la **deriva giroscopica** per qualsiasi configurazione costruita a partire da un fucile e un proiettile dell'Arsenale. La suite offre due metodi di calcolo della deriva giroscopica, scelti nelle Impostazioni: la formula semplice ed empirica di Litz, e un modello fisico più completo, McCoy 4-DOF. Nonostante la differenza di sofisticazione, entrambi i metodi al momento richiedono esattamente gli stessi cinque input — il che spiega perché vale la pena compilare la lunghezza del proiettile e il passo di rigatura del fucile appena li conosci, anche se sono contrassegnati come facoltativi in tutto questo manuale: lasciarne vuoto uno dei due ti costa, silenziosamente, la deriva giroscopica e una stima di stabilità, ovunque quel fucile venga usato, indipendentemente dal metodo scelto.

### 9.4 Precisione dell'arma → Probabilità di colpire

Trattato in dettaglio al §5.6 e, dalla direzione opposta, al §10.1. In breve: la `precision` memorizzata di una cartuccia — modalità (`own` o `combined`) più un R50 in mrad — viene letta da Probabilità di colpire nel momento esatto in cui questa combinazione fucile+cartuccia diventa lì la configurazione attiva. Un valore **«own»** precompila l'input di precisione al banco di Probabilità di colpire e lascia l'abilità del tiratore come input separato e indipendente da combinare con esso. Un valore **«combined»** precompila invece l'input semplificato, già combinato, e attiva la modalità semplificata di quello strumento, poiché una cifra combinata ha già l'abilità del tiratore incorporata e non dovrebbe esservi combinata una seconda volta.

### 9.5 Donatore di zero → Traiettoria, Calcolatore per il poligono, Confronto

La donatrice di una cartuccia (§5.7), quando impostata, cambia esattamente un passaggio del calcolo di traiettoria: invece di trovare l'angolo di lancio che manda la balistica *propria* di questa cartuccia attraverso la linea di mira alla distanza di azzeramento del fucile, il motore trova l'angolo che farebbe lo stesso per la velocità alla volata, la sensibilità alla temperatura e il profilo del proiettile **della donatrice** — tutto il resto (distanza di azzeramento, altezza ottica, angolo della linea di mira, atmosfera, vento) resta fissato ai valori propri della ricevente — e poi fa volare la balistica **propria della ricevente** da quell'angolo preso in prestito. Il risultato è esattamente ciò che accade realmente a valle quando da un fucile azzerato con una carica si spara con un'altra.

Questa sostituzione avviene esattamente nel punto in cui in questo motore avviene già ogni altro calcolo dell'angolo di zero, così si combina gratuitamente con tutto ciò che il motore di traiettoria fa già per una cartuccia normale — atmosfera, vento, deriva giroscopica, l'integratore 4-DOF — nessuno di questi ha bisogno di sapere che è coinvolta una donatrice.

L'azzeramento della deriva laterale/giroscopica (§9.3) non è toccato da una donatrice: si calcola sempre dalla balistica propria della ricevente, trattandosi di una funzionalità distinta, attivata separatamente.

**Probabilità di colpire è deliberatamente escluso.** Il suo proprio modello di dispersione calcola l'alzo in modo indipendente, alla *distanza del bersaglio stesso* (o a uno zero da combattimento impostato separatamente) invece che alla distanza di azzeramento configurata del fucile, e non legge mai la donatrice di una cartuccia — una scelta di progettazione, non una svista: Probabilità di colpire stima come un colpo raggruppa realmente attorno a un punto di mira che imposti per quel colpo, una domanda diversa da dove un zero fisico fisso, già stabilito, colloca una carica sostitutiva.

---

## 10. Metterlo in pratica

### 10.1 Riportare una precisione d'arma misurata nell'Arsenale

Il Calcolatore di precisione di tiro misura la dispersione reale, delimitata da un intervallo di confidenza, del tuo fucile a partire da gruppi realmente sparati (vedi il manuale proprio di quello strumento). Una volta che un progetto lì ha abbastanza colpi aggregati per calcolare un numero utilizzabile, alla sua riga cresce un pulsante **«Imposta come precisione della cartuccia…»**.

Premerlo apre un selettore che elenca ogni fucile dell'Arsenale che ha almeno una cartuccia, ciascuno con un menu a tendina di cartucce. Scegli il fucile e la carica con cui hai effettivamente sparato quel progetto, e atterri direttamente nell'Arsenale, con esattamente quel fucile e quella cartuccia già resi attivi e il loro modulo **Modifica cartuccia** già aperto — precompilato con **«Precisione propria (al banco) dell'arma»** spuntata e l'R50 aggregato del progetto, convertito in mrad, posto nel campo valore. Nulla viene scritto finché non premi **Salva cartuccia** — questo è un passaggio di consegna a un modulo che rivedi, non una scrittura silenziosa in background.

Questo è il flusso di lavoro più importante che questo strumento supporta, perché è quello che rende onesto il resto della suite: una cifra di Probabilità di colpire calcolata da un valore di precisione al banco che hai effettivamente misurato, con il proprio intervallo di confidenza noto, vale categoricamente di più di una calcolata da un numero ricordato da un gruppo di cinque colpi. Fallo ogni volta che finisci un progetto di sviluppo carica nella precisione di tiro, non solo una volta quando configuri per la prima volta un fucile — la tua stima di precisione migliora solo man mano che quel progetto accumula più colpi, e il record della cartuccia non si aggiorna da solo.

### 10.2 Configurare un nuovo fucile da zero

1. **Aggiungi prima il/i proiettile/i.** Se spari più di una carica attraverso un fucile, salva ogni proiettile prima di iniziare con le cartucce — l'opzione in linea «+ Aggiungi nuovo proiettile…» nel modulo cartuccia è comoda per una singola carica, ma precaricare la tua libreria di proiettili rende più veloce configurare un fucile a più cariche e mantiene la tua lista di proiettili un vero catalogo invece che un sottoprodotto di qualunque cartuccia tu abbia aggiunto per prima.
2. **Misura con precisione altezza ottica e distanza di azzeramento.** Questi due valori alimentano direttamente il calcolo di caduta di Traiettoria e sono i due numeri più probabilmente già presenti nel libretto dati del tuo fucile, se ne tieni uno — copiali invece di stimarli.
3. **Compila il passo di rigatura anche se pensi che non farà differenza.** È un'informazione gratuita già stampata sulla tua canna o nella sua scheda tecnica, ed è l'unico campo che separa «Stabilità sconosciuta» da un indicatore utile in tempo reale su ogni cartuccia di quel fucile — senza costo aggiuntivo per cartuccia, dato che vive una sola volta, sul fucile.
4. **Aggiungi una cartuccia per carica, non per sessione di tiro.** Un record di cartuccia descrive una carica, non un'uscita; chiamarla qualcosa come *«175 ELD-M, 2650 fps, N550»* la mantiene identificabile mesi dopo, quando hai diverse voci simili distribuite su più fucili.
5. **Lascia vuota la precisione dell'arma finché non l'hai effettivamente misurata.** Un numero dall'aria sicura, digitato a memoria, è peggio di nessun numero, perché Probabilità di colpire non può distinguerli — tratterà una supposizione con esattamente lo stesso peso di una misura di cento colpi delimitata da un intervallo di confidenza. Usa invece il passaggio di consegna del §10.1 una volta che hai dati reali.

### 10.3 Confrontare due cariche prima di impegnarti su una

Supponi di dover decidere tra due proiettili per lo stesso fucile, o tra lo stesso proiettile a due profondità di seduta diverse con velocità corrispondentemente diverse. Salva entrambi come cartucce separate sul fucile (o su due voci fucile, se il cambio di profondità di seduta rappresenta per te due configurazioni con nomi diversi), metti entrambi in coda per il confronto (§7), e imposta la distanza massima condivisa su ciò che ti interessa davvero. Il grafico risponde alla domanda pratica — quale è più piatta, quale mantiene più velocità, dove si incrociano le due traiettorie — senza che tu debba eseguire Traiettoria due volte e tenere due serie di numeri in testa contemporaneamente.

### 10.4 Mantenere sensata una collezione di più fucili

Una volta che possiedi più di due o tre fucili della stessa famiglia generale di calibro, la scheda filtri (§6.5) è ciò che mantiene la pagina navigabile — filtra per calibro per vedere solo i fucili camerati per ciò su cui stai lavorando in questo momento, o per produttore se stai confrontando diversi fucili in base ai proiettili dello stesso produttore. L'etichetta **Senza backup** (§6.4) funge anche da lista di cose da fare in corso: alla fine di una sessione in cui hai aggiunto o modificato diverse voci, scorri la pagina con lo sguardo cercando quell'etichetta invece di cercare di ricordare cosa hai toccato, ed esegui **Backup della libreria su file…** per cancellarle tutte in una volta.

### 10.5 Azzerare con una cartuccia sostitutiva

Supponi di azzerare un fucile con munizioni surplus o a bossolo d'acciaio economiche — più economiche da consumare durante una sessione di azzeramento e per verificare periodicamente lo zero — ma di portare con te o cacciare effettivamente con una carica premium di fabbrica o ricaricata. Salva entrambe come cartucce separate sullo stesso fucile, apri il modulo **Modifica cartuccia** proprio della carica premium, e imposta **Azzerata con** sulla carica da allenamento. Da quel momento, Traiettoria, Calcolatore per il poligono e il grafico di Confronto mostrano tutti la traiettoria della carica premium esattamente come stamperà realmente, invece dell'assunzione (sbagliata, se il tuo azzeramento è stato effettivamente fatto con quella economica) che sia azzerata con se stessa.

Se in seguito riazzeri il fucile direttamente con la carica premium, torna indietro e cancella **Azzerata con** su quella cartuccia — ora è di nuovo il proprio zero, e nient'altro nell'Arsenale lo fa automaticamente per te.

---

## 11. Provenienza

L'Arsenale fa parte della suite fin dal suo primo commit, crescendo in modo incrementale: più librerie di proiettili integrate e completamento automatico del produttore; correzioni delle preferenze di unità nella lista delle cartucce e nella lunghezza del proiettile; l'attuale motore di traiettoria a 4 gradi di libertà e i campi di deriva giroscopica/direzione di rigatura che usa; e, più di recente, regolarità della velocità iniziale e precisione dell'arma sulle cartucce, insieme al passaggio di consegna diretto dal Calcolatore di precisione di tiro descritto al §10.1 — l'integrazione che trasforma due strumenti prima separati in un'unica pipeline misurata; e, più recentemente ancora, la possibilità per una cartuccia di prendere in prestito lo zero fisico di un'altra (§5.7), per il caso comune di azzerare con una carica e portarne un'altra.

La suite è rilasciata sotto licenza **AGPL-3.0-or-later**.

---

*Pacifico. Preciso. Armato.*
