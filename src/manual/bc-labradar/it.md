# geladen.ch ballistics Manuale d'uso — BC Labradar

*Parte della* [suite balistica geladen.ch](https://bc.geladen.ch)*. Una delle quattro schede della pagina Strumenti BC. Successore dello strumento autonomo Labrabaco.*

---

## 1. A cosa serve questo strumento

Il coefficiente balistico è l'unico numero di tutto il calcolo di traiettoria che normalmente ti si chiede di prendere per fede. La velocità alla volata la puoi misurare. L'altezza dell'ottica la puoi prendere col calibro. La distanza di taratura la fissi tu. Il BC arriva dal fianco di una scatola, o dal sito di un produttore, e descrive una palla sparata dalla canna di qualcun altro, nell'aria di qualcun altro, misurata con un metodo che nessuno ti mostrerà.

È anche il numero a cui la traiettoria è più sensibile a distanza, e quello che più facilmente lusinga. I BC pubblicati sono cifre di marketing tanto spesso quanto sono misure.

**BC Labradar misura il tuo.** Legge i file di traccia che un cronografo Labradar scrive sulla propria scheda SD — una registrazione completa di velocità nel tempo per ogni colpo, campionata all'incirca ogni millisecondo sul primo centinaio di metri di volo — e adatta un coefficiente balistico a ciascun colpo separatamente, contro la stessa fisica della resistenza che il resto della suite usa per calcolare le traiettorie. Poi ripulisce le tracce che il radar ha sbagliato, butta via i colpi che non concordano con gli altri e fa la media di ciò che sopravvive.

Ne esce un BC per la **tua** palla, dalla **tua** canna, nella **tua** aria. Riportalo nell'Arsenale e ogni altro strumento della suite lavora su una misura invece che su un'affermazione.

Nulla di questa pulizia e di questo adattamento è stato progettato a tavolino e poi lasciato andare sperando bene. È stato calibrato su un corpus di **1.297 tracce Labradar reali**, dal quale il rumore proprio del radar — come cresce lungo la traccia e quanto selvaggiamente varia da sessione a sessione — è stato misurato e non ipotizzato. Il §12 espone che cosa quella misura ha trovato e che cosa vi è stato costruito sopra.

La cosa notevole di questo metodo è che non richiede alcuna attrezzatura a valle. Nessun secondo cronografo a 300 m, nessun bersaglio acustico, nessun radar Doppler grande come un'auto. Il dispositivo sta già registrando i dati — semplicemente non ti dice quanto valgono.

### Che cosa non è

**Non è una lettura da cronografo.** Non gli importa della tua velocità alla volata, della tua escursione estrema o della tua deviazione standard in fps. Quelle te le dà il file di report del dispositivo, e questo strumento lo ignora. Quello che vuole è la *forma* del decadimento di velocità, che è proprio ciò che il report riassuntivo butta via.

**Funziona solo con il Labradar v1** — la grande scatola arancione, quella che scrive file `Shot0001 Track.csv`. I dispositivi successivi, e ogni altra marca di cronografo, o non registrano alcuna traccia o non la scrivono in questo formato. Per loro non esiste una via di importazione.

**Non è un risolutore di curve Cd.** Adatta un solo numero contro un modello di resistenza standard. Se la forma di resistenza reale della tua palla non è quella del modello, l'adattamento ti dà il miglior BC singolo per quel modello sulla banda di velocità misurata, non la verità sulla palla. È lo strumento **Curva Cd–Mach** che ricava la curva di resistenza propria di una palla, e vuole un tipo di misura completamente diverso.

**Ti dice quanto è sicuro riguardo ai colpi, e soltanto riguardo ai colpi.** Accanto alla media riporta un intervallo di confidenza al 95 % su quella media, in percentuale di essa, calcolato dalla dispersione dei BC colpo per colpo che ha accettato. Quell'intervallo è onesto sui numeri che gli hai dato e sul campionamento, e muto su tutto il resto — un'atmosfera digitata male sposta media e intervallo insieme, e nessuna statistica calcolata sulle tracce può accorgersene. §10.3.

---

## 2. Riservatezza, memorizzazione e requisiti

**Nulla di ciò che dai a questo strumento lascia il tuo dispositivo.** Il file zip che scegli non viene mai caricato. Viene decompresso nel tuo browser, analizzato nel tuo browser e adattato nel tuo browser, da JavaScript che gira sulla tua macchina. Nessun account, nessun server, nessuna telemetria.

**Nemmeno viene memorizzato alcunché.** A differenza dell'Arsenale o del Calcolatore di precisione di tiro, questo strumento non tiene alcuna libreria. Il lotto caricato, le scelte dei filtri, il modello di resistenza e l'atmosfera sopravvivono a un giro verso un altro strumento e ritorno — vivono in memoria per la sessione — ma non sopravvivono a un ricaricamento della pagina. Ricarica, e riscegli lo zip. È voluto: un lotto di tracce è un intermedio, non un documento. Ciò che vale la pena conservare è il BC risultante, e il suo posto è nell'Arsenale (§11.1).

**Requisiti.** Un browser ragionevolmente recente. L'adattamento è davvero pesante — una integrazione completa della resistenza viene eseguita alcune centinaia di volte per traccia — perciò è distribuito su un pool di worker in background, un incarico per traccia, e le righe si riempiono man mano che finiscono. Un lotto di trenta tracce si risolve in un paio di secondi su un computer da scrivania e richiede sensibilmente di più su un telefono. L'app si installa come PWA e questo strumento funziona del tutto offline una volta caricato — il che conta, perché il posto in cui più vorrai usarlo è un poligono senza campo.

---

## 3. Che cos'è davvero un export Labradar

Capire come sono disposti i file evita molta confusione sul perché alcune righe della lista dicano *non è una traccia*.

Quando copi una sessione dalla scheda SD del dispositivo, ottieni una cartella così:

```
SR0013/
  SR0013.lbr            il file di progetto del dispositivo
  SR0013 Report.csv     il riepilogo della sessione — velocità, ES, SD
  TRK/
    Shot0001 Track.csv  un file per colpo: la traccia radar vera e propria
    Shot0002 Track.csv
    ...
```

Comprimi quella cartella — tutta quanta, sottocartelle incluse — e quello zip è ciò che lo strumento vuole.

**Il file di traccia** è quello interessante. Dopo una breve intestazione del dispositivo porta una riga per ogni eco radar:

```
Time (s);Vel (m/s);Dist (m);SNR
0.000000;767.75;0.00;-
0.007021;765.35;5.37;33.07
0.008021;765.05;6.14;40.15
0.009021;764.57;6.90;39.80
...
```

Quattro colonne: tempo trascorso in secondi, velocità, distanza dal dispositivo e rapporto segnale/rumore (SNR) in decibel. All'incirca una riga per millisecondo, dalla volata fino a dove il radar ha perso la palla — un centinaio scarso di righe per un tipico colpo di carabina.

Tre cose su quella tabella vale la pena saperle, perché lo strumento le tratta tutte in modo diverso:

- **La prima riga non è una misura.** Il suo tempo è esattamente zero, la sua distanza esattamente zero, e il suo campo SNR è letteralmente un trattino. Il dispositivo la calcola a ritroso — è la sua velocità alla volata estrapolata, non un eco radar. Questo strumento la esclude da ogni adattamento e da ogni indicatore di qualità. Viene disegnata nel grafico, e per il resto ignorata.
- **L'SNR è un indice di qualità per singolo punto**, e varia enormemente lungo la traccia. Nell'esempio sopra parte da circa 40 dB e nelle ultime righe è sceso a 8. Questo strumento pesa ogni punto con il suo SNR (§12.4), così che gli echi iniziali, affidabili, dominino l'adattamento e quelli finali, dubbi, lo spostino a malapena.
- **La colonna delle velocità non è monotona.** Guarda le ultime righe di una traccia reale e spesso troverai la velocità che *risale*. Non è la palla che accelera; è il radar che legge una riflessione su qualcos'altro. Ripulire quelle è la maggior parte di ciò che questo strumento fa prima di adattare qualunque cosa (§12.3).

**Le unità si leggono dall'intestazione del file stesso.** Se il tuo dispositivo è impostato su fps e yard, l'intestazione lo dice e lo strumento converte in ingresso. Non devi dirglielo, e non devi far combaciare la sua impostazione con la tua preferenza di visualizzazione.

### 3.1 Una nota sulle unità

Questo è l'unico strumento della suite in cui le unità quasi non compaiono, perché un coefficiente balistico non ne ha di riconoscibili. Si cita per tradizione in libbre per pollice quadrato di carico sezionale, il che da sempre si scrive come numero nudo, e questo strumento lo scrive come numero nudo a quattro decimali.

Tre punti in cui le unità compaiono comunque:

- **I campi dell'atmosfera** — temperatura, pressione alla stazione, umidità — seguono la tua preferenza nelle Impostazioni come ogni altro blocco atmosfera della suite, con l'unità mostrata come suffisso vivo sull'etichetta del campo.
- **I file di traccia** portano le proprie unità nelle proprie intestazioni, convertite all'importazione come descritto sopra. La tua preferenza non ha effetto su di loro.
- **Gli assi del grafico della traccia** sono l'eccezione, e un'eccezione onesta: l'asse orizzontale è in millisecondi e quello verticale in metri al secondo, sempre, quale che sia l'unità di velocità configurata altrove. È un tracciato diagnostico di valori interni al motore, non un rapporto.

---

## 4. Avvio rapido

Per gli impazienti. I dettagli seguono nei §5–§10.

1. Spara una sessione col Labradar, curando la mira, l'offset del proiettile e il resto dei §5.1–§5.5. Venti colpi o più, tutti con la stessa palla.
2. Annota temperatura, pressione **alla stazione** e umidità **alla linea di tiro** (§5.6). Non le previsioni.
3. Copia la cartella della sessione dalla scheda SD e comprimila, sottocartelle incluse.
4. **Strumenti BC** dal menu degli strumenti → scheda **BC Labradar**.
5. Imposta il **modello di resistenza** — G7 per un boat-tail moderno, G1 per una base piatta o un'ogiva tonda (§6.1).
6. Compila l'**atmosfera** dai tuoi appunti.
7. **Scegli file .zip Labradar…** e seleziona il file. La lista delle tracce compare subito.
8. **Calcola**. Le righe si riempiono man mano che l'adattamento di ciascun colpo termina.
9. Leggi il BC medio sulla scheda **Risultato**, con il suo intervallo di confidenza al 95 % accanto e la deviazione standard sopra.
10. Clicca una riga qualsiasi per vedere la traccia di quel colpo, i suoi punti mantenuti e scartati, e la curva che vi è stata adattata.

Non fidarti di un risultato ottenuto da meno di dieci colpi, e leggi il §10.3 prima di fidarti di uno ottenuto da meno di venti.

---

## 5. Ottenere dati che meritino un'analisi

Lo strumento sa solo ripulire il rumore. Non può inventare una misura che non è mai stata fatta, e non può accorgersi di un errore sistematico nelle condizioni che hai digitato. Tutto ciò che sta in questa sezione avviene prima che tu apra l'app, e ognuno di questi errori è poi invisibile.

**Comincia dal manuale del dispositivo**, o quantomeno dalla sua guida rapida. Ci sono le figure. Ogni raccomandazione che contiene ha la sua ragione, e le ragioni qui sotto ne sono in gran parte lo sviluppo. Quel che segue è la parte che pesa in modo sproporzionato quando l'obiettivo è un coefficiente balistico anziché una velocità alla volata — perché un allestimento che produce ottime letture di V0 può comunque produrre tracce inutilizzabili oltre i trenta metri, e il dispositivo non ti dirà quale delle due sessioni hai appena fatto.

### 5.1 Puntare il radar

**Puntalo sul bersaglio su cui stai davvero sparando**, non sulla carabina, né genericamente lungo il poligono. Il dispositivo insegue la palla lungo il proprio asse di fascio, e più la traiettoria corre vicina a quell'asse, più ogni eco è forte e pulito.

Non si tratta di un metro o due di traccia in più. L'allineamento del fascio decide fin dove il dispositivo tiene la palla, punto e basta, e la lunghezza della traccia è la leva più grande che hai sulla qualità di un adattamento di BC: una traccia più lunga significa più decadimento di velocità da misurare, più punti su cui adattare e proporzionalmente meno influenza del rumore finale.

### 5.2 L'offset del proiettile

Il dispositivo ha un'impostazione chiamata *proj. offset*, che gli dice quanto lontano dal radar passa la palla. Sbagliarla rende sbagliata ogni velocità di ogni traccia, in modo coerente e con un aspetto del tutto plausibile.

**Perché esiste.** Il radar può misurare solo la velocità *radiale* — il ritmo con cui la palla si allontana dal dispositivo — che non è la velocità reale nella direzione del tiro, perché l'asse del fascio e la traiettoria non sono la stessa retta. Passare dall'una all'altra è trigonometria elementare, ed è ciò che il dispositivo fa prima di mostrare qualunque cosa. Ma quella trigonometria deve sapere quanto distano le due rette, e quel numero è quello che imposti tu.

**Rispettalo.** Se l'impostazione dice 30 cm, metti la canna a 25–30 cm dal radar. Mettila a un metro e il dispositivo registrerà comunque qualcosa, ma ogni lettura porterà un errore significativo.

**È la distanza dall'asse della canna, misurata al fianco del radar.** Non la distanza dalla volata al dispositivo, che è un'obliqua più lunga. Se la tua volata si trova un po' più avanti o un po' più indietro del corpo del radar, non è di per sé un problema — purché la distanza laterale dalla canna sia giusta, l'errore sulla velocità alla volata mostrata è trascurabile e l'errore sul BC calcolato qui è nullo.

**E qui pesa più che sul display del dispositivo.** Un errore di offset perturba moderatamente il valore di V0. Perturba assai di più un BC ricavato dalla *forma* della traccia. Se di solito tolleri un offset approssimativo perché i numeri del cronografo continuano a sembrare sensati, quella tolleranza non si trasferisce a questo strumento. Il §12.1 spiega perché.

### 5.3 Tenere il radar assolutamente fermo

Se il dispositivo si muove durante una misura, i risultati non sono peggiorati — sono casuali.

- **Usa un treppiede davvero solido, ben piantato.** Non esitare a zavorrare la piattaforma. È uno di quei rari casi in cui la soluzione più pesante e più brutta è semplicemente quella giusta.
- **Se spari qualcosa con un freno di bocca serio, ripara il dispositivo dal soffio.** Un'asse di legno, una cassa di munizioni, qualunque cosa consistente tra volata e radar. L'involucro è plastica antiurto e sopravvive; il punto non è proteggere la plastica ma impedire che l'onda di pressione scuota la scatola. Un dispositivo che sussulta a ogni colpo produce una sessione in cui le tracce peggiorano silenziosamente col procedere della serie — esattamente il tipo di guasto più difficile da riconoscere a posteriori.

### 5.4 Il poligono in sé

Il radar Doppler si entusiasma per tutto ciò che riflette, e ogni riflessione spuria è candidata alle code a velocità crescente descritte nel §3.

- **Meglio un campo aperto.** Nessun dosso alto entro la portata del radar, e la traiettoria libera da ostacoli per circa cinque metri a sinistra, a destra e in alto.
- **Guarda anche che cosa sta accanto alla linea di tiro**: un terrapieno, un telaio portabersaglio, un tavolo, un veicolo, il tiratore della corsia accanto. Una corsia ingombra produce tracce su cui la pulizia deve faticare molto di più, e più tracce respinte del tutto.
- **Non usare bersagli d'acciaio entro circa 200 m.** Solo legno, cartone o carta. Una piccola palla metallica sullo sfondo di una grande piastra metallica è un problema di rilevamento davvero difficile, e il dispositivo perderà la palla presto o seguirà la piastra al suo posto.

### 5.5 Un'impostazione del dispositivo che riguarda specificamente il BC

**Imposta la distanza massima di visualizzazione a 200 m, o 200 yd.**

La traccia molto probabilmente non arriverà fin lì — in pratica, solo calibri molto grandi con traiettoria tesa ci si avvicinano. Quello che l'impostazione fa è dire al dispositivo di continuare a provarci finché il segnale regge, invece di fermarsi a un limite configurato più corto. Traccia più lunga, più decadimento, adattamento migliore. Non c'è alcun rovescio della medaglia, dato che il dispositivo spegne comunque il fascio radar non appena perde la palla.

### 5.6 L'atmosfera: il dato che ti morderà davvero

Immondizia dentro, immondizia fuori, e un'atmosfera di scarsa qualità in ingresso può causare errori seri in uscita.

La forza di resistenza sulla palla è proporzionale alla densità dell'aria, e il BC che lo strumento cerca è quello che fa combaciare la resistenza modellata con la decelerazione osservata. Sbaglia la densità del 3 % e il tuo BC è sbagliato di circa il 3 %, in silenzio, senza che da nessuna parte compaia un segnale che qualcosa non va.

- **Misura alla linea di tiro.** Un Kestrel o equivalente basta. «Quel che diceva l'app del meteo per il paese più vicino» non basta — quella stazione può essere a quaranta chilometri e trecento metri più in basso.
- **Usa la pressione alla stazione — la pressione assoluta, alla tua quota reale.** È di gran lunga l'errore più comune, e vale la pena essere pedanti, perché Kestrel usa infelicemente il termine *pressione barometrica* per il valore riportato al livello del mare, che è proprio quello che **non** vuoi. Questo strumento prende ciò che digiti alla lettera alla tua quota e ne ricava a ritroso una quota (§12.10).

  La verifica di buon senso: se leggi 1000 hPa o più a 500 m di quota o oltre (29,5 inHg a 1500 ft, per i nostri amici menomati dal sistema imperiale), quasi certamente stai leggendo un valore riportato al livello del mare — oppure sta accadendo nell'atmosfera qualcosa che presto ti preoccuperà più del tuo coefficiente balistico.
- **Se davvero non conosci l'umidità, metti 50 %.** È di gran lunga la meno influente delle tre, e 50 % non è mai lontano dal vero.

### 5.7 Quanti colpi

Un colpo è un colpo. Non dice quasi nulla, e lo strumento ne calcolerà volentieri un BC a quattro decimali.

- **Munizione commerciale decente: venti cartucce** è il minimo operativo. Abbastanza perché la dispersione colpo per colpo si medi fino a qualcosa di difendibile.
- **Surplus economico, lotti misti, bossoli stanchi: trenta o più.** La dispersione è maggiore e serve più colpi perché si medi.
- **Proiettili match davvero buoni: dieci possono bastare.** Sono abbastanza regolari perché le tracce concordino strettamente tra loro, e la deviazione standard sulla scheda Risultato te lo dirà.

Di più è sempre meglio, e il costo marginale è una cartuccia.

Sparali tutti nelle stesse condizioni, dalla stessa carabina, con la stessa palla. Questo strumento fa la media sul lotto. Mediare due palle diverse non dà il BC né dell'una né dell'altra. Nota che le velocità alla volata non devono essere uguali, e nemmeno simili; misurare un BC su una serie di messa a punto della carica è perfettamente lecito.

### 5.8 Tirare fuori lo zip dal dispositivo

Copia l'intera cartella della sessione dalla scheda SD e comprimila. Non serve andare a scovare la cartella `TRK`, non serve rinominare nulla, e non fa alcun male lasciare al loro posto il report e il file di progetto — vengono ignorati automaticamente (§7.2). Le sottocartelle non sono un problema.

Lo strumento prende esattamente uno zip per volta. Se vuoi unire più sessioni in un solo BC, o le metti in un unico zip oppure le elabori separatamente e medi a mano.

---

## 6. La scheda «Impostazione»

Tutto ciò che sta sulla scheda di sinistra, dall'alto in basso.

### 6.1 Modello di resistenza

Contro quale modello di resistenza standard viene espresso il BC. Il valore predefinito è **G7**, e il selettore elenca ogni modello supportato dalla suite, filtrato in base a ciò che hai scelto di mostrare nelle Impostazioni.

Qui la scelta pesa più che nella maggior parte dei casi, perché l'adattamento avviene contro la forma reale della curva del modello sulla banda di velocità reale della tua palla, e non tramite una conversione:

- **G7** per le palle boat-tail moderne — ogiva lunga, base rastremata. In pratica ogni palla match o da caccia progettata negli ultimi trent'anni.
- **G1** per basi piatte, ogive tonde e la maggior parte dei disegni più vecchi o smussati. È anche quello che cita la maggior parte dei produttori, il che è una ragione a sé per usarlo.

Il modello che scegli è fissato dentro ogni adattamento di traccia, perciò cambiarlo dopo il calcolo richiede un nuovo **Calcola** (§6.7). Sul passo di pulizia non ha alcun effetto.

Non c'è nulla di male nel passare lo stesso lotto due volte, una per modello, e tenere entrambi i numeri. Per i calcoli di traiettoria, usa il modello che meglio corrisponde alla forma della tua palla.

### 6.2 Atmosfera

Temperatura, pressione alla stazione, umidità relativa. Il §5.6 spiega perché contano e come procurartele.

A differenza dei blocchi atmosfera altrove nella suite, **questo non ha preimpostazioni** né un campo quota separato. Non c'è «atmosfera standard», né condizione di riferimento svizzera o sovietica. Questo strumento serve a ridurre una misura reale fatta in aria reale, e una preimpostazione sarebbe solo un modo per fingere in sordina di sapere qualcosa che non si sa.

I valori predefiniti — 15 °C, 1013,25 hPa, 0 % di umidità — sono un punto di partenza neutro, non una stima del tuo tempo atmosferico. Sono le condizioni standard ICAO al livello del mare, e a meno che tu non abbia sparato al livello del mare in una giornata standard, sono sbagliate. Sostituiscili tutti e tre.

La quota non viene chiesta e non serve che lo sia: è ricavata dalla pressione alla stazione che hai digitato (§12.10).

Come il modello di resistenza, anche l'atmosfera è fissata al momento dell'adattamento. Cambiarla dopo richiede un nuovo **Calcola**.

### 6.3 Soglia di qualità del segnale

Il primo dei due filtri che agiscono sulla traccia intera. Decide quali tracce siano abbastanza affidabili da essere mediate, in base a quanto pulitamente i punti ripuliti del colpo si dispongono su una retta.

Tre impostazioni:

- **Normale (R² > 0,95)** — il valore predefinito, e quello giusto per la maggior parte delle sessioni.
- **Rumore alto (R² > 0,90)** — per una corsia davvero ingombra, dove troppi colpi perfettamente buoni vengono respinti. Usalo quando, scorrendo le righe, vedi che le tracce respinte hanno un bell'aspetto.
- **Nessuna** — nessun controllo di qualità. Tutto ciò che ha prodotto un BC entra nella media.

L'R² mostrato nella lista delle tracce è il numero con cui questa soglia si confronta. Il §12.8 spiega che cosa misuri davvero, e perché una retta sia il riferimento giusto per un controllo di *qualità* pur essendo il riferimento sbagliato per un *adattamento*.

Cambiare questa impostazione ridecide quali tracce siano incluse e aggiorna la media **immediatamente**. Nessun ricalcolo è necessario, perché nessun BC cambia — cambia solo il verdetto su ciascuno.

### 6.4 Scarta valori anomali

Il secondo filtro sulla traccia intera, e una prova di tutt'altro genere: a questo la qualità del segnale non interessa affatto, gli interessa solo se il BC di una traccia concordi con quello delle altre.

Tre impostazioni:

- **Conservativo (2,0σ)** — il valore predefinito. Una traccia viene scartata quando il suo BC si allontana dalla media del lotto più di quanto dovrebbero mai fare tutti i colpi onesti tranne una piccola percentuale. Quella distanza si misura in deviazioni standard — è ciò che sta a indicare il σ nel nome dell'opzione — e questa impostazione traccia la linea a due di esse.
- **Aggressivo (1,64σ)** — scarta di più. Utile in un poligono affollato con calibri simili accanto, o quando non hai riallineato il radar tra un bersaglio e l'altro. Butterà via anche dati genuinamente validi, il che costa accuratezza attraverso un campione più piccolo. Usalo quando hai colpi da spendere.
- **Nessuna** — nessuno scarto degli anomali. Ricorrici quando sei sicuro dei tuoi dati e il campione è piccolo. Sotto la decina di colpi il lotto non concorda ancora abbastanza con sé stesso da giudicare quale suo membro stoni, cosicché la prova butta via buoni colpi più spesso dei cattivi.

Il caso classico che questo intercetta è una traccia che non è affatto la tua palla: il radar ha captato un colpo dalla corsia accanto, l'ha seguito in modo perfettamente pulito e ha prodotto un adattamento splendido per il proiettile di qualcun altro. Il suo R² sarà eccellente. Solo il suo disaccordo col resto del lotto lo tradisce.

Come per la soglia di qualità, ogni cambiamento qui ridecide e rimedia immediatamente.

### 6.5 Soglia di riduzione del rumore

Questa differisce dalle due precedenti per natura, non solo per grado. I due filtri buttano via *tracce* intere. Questo cursore regola con quanta decisione i *punti* cattivi vengano tolti **dentro** ciascuna traccia, prima che quella traccia venga adattata.

Va da **Permissiva** (0,970) a **Normale** (0,990) a passi di 0,005, e sta per impostazione predefinita su 0,990, all'estremo destro. Il valore numerico è mostrato accanto all'etichetta.

**Lasciala a 0,990.** Quel valore non è un'ipotesi né un gusto; è l'esito di una scansione diretta su tracce reali con anomali iniettati noti, e dimezza all'incirca l'errore di BC risultante rispetto al più mite 0,970 di prima (§12.7). L'unica ragione per spostarla è un ambiente davvero estremo in cui vedi che punti reali e buoni vengono scartati — scorri qualche riga e guarda il grafico prima di deciderlo.

0,970 esiste come opzione perché è ciò che lo strumento precedente ha usato per anni. Se stai riproducendo un vecchio risultato, quella è l'impostazione che lo riprodurrà.

A differenza dei due filtri precedenti, questa cambia l'adattamento stesso, perciò cambiarla richiede un nuovo **Calcola**.

### 6.6 Scegli file .zip Labradar…

Apre il selettore di file del tuo dispositivo. Una volta scelto un file, lo strumento lo decomprime subito, individua le voci CSV e stabilisce quali di esse siano vere tracce — il tutto nel tuo browser, senza caricare nulla. Il nome del file compare accanto al pulsante e la lista delle tracce si riempie all'istante.

Questo passo non calcola **nulla**. Ogni traccia atterra nella lista con lo stato *non ancora calcolato*, tranne le voci che non sono affatto tracce, marcate come tali immediatamente (§7.2).

Qui possono comparire due errori:

- ***Impossibile aprire quel file***, con la ragione sottostante — il file non era un archivio zip valido.
- ***Nessun file di traccia trovato in quello zip*** — si è aperto, ma non conteneva assolutamente nulla con un nome in `.csv`. Di solito significa che è stata compressa la cartella sbagliata, o che l'archivio contiene uno zip annidato invece dei file stessi.

Scegliere un nuovo zip azzera qualunque lotto esistente, comprese tutte le decisioni manuali di inclusione o esclusione che avevi preso.

### 6.7 Calcola

Deliberatamente un pulsante separato dalla scelta del file, così puoi impostare modello di resistenza e atmosfera *dopo* aver visto che cosa c'è nello zip e prima di spenderci calcolo.

Un clic avvia in background un adattamento per ogni traccia analizzata. Le righe si aggiornano una per una man mano che il rispettivo incarico finisce — puoi guardare il lotto risolversi — e la media viene ricalcolata a ognuna. Il pulsante è disattivato mentre il lotto gira e riabilitato quando l'ultima traccia si assesta.

**Che cosa ricalcola che cosa** vale la pena tenerlo d'occhio, per sapere quando questo strumento può mostrarti in sordina un numero stantio:

| Cambiamento | Effetto |
|---|---|
| Soglia di qualità del segnale | Verdetti e media aggiornati immediatamente |
| Scarta valori anomali | Verdetti e media aggiornati immediatamente |
| Una casella **Includi** | Verdetti e media aggiornati immediatamente |
| Modello di resistenza | **Richiede Calcola** — nulla cambia finché non clicchi |
| Atmosfera | **Richiede Calcola** |
| Soglia di riduzione del rumore | **Richiede Calcola** |

Cliccare di nuovo **Calcola** scarta ogni risultato di traccia esistente e riadatta l'intero lotto da capo con le impostazioni correnti. Mentre gira, azzera anche grafico e riepilogo. Le tue decisioni manuali di inclusione ed esclusione sopravvivono.

---

## 7. La lista delle tracce

Una riga per ogni voce CSV trovata nello zip, nell'ordine proprio dello zip — che, per un export normale, è l'ordine dei colpi.

### 7.1 Le colonne

- **File** — il percorso completo della voce dentro lo zip, dunque `SR0013/TRK/Shot0007 Track.csv` e non il solo numero di colpo. Prolisso, ma privo di ambiguità quando uno zip contiene più di una sessione.
- **Stato** — il verdetto, come pastiglia colorata. Vedi §7.2.
- **BC** — il coefficiente balistico adattato per questo colpo, a quattro decimali, o un trattino se non è stato ancora calcolato.
- **R²** — quanto pulitamente i punti ripuliti di questo colpo si dispongono su una retta, a quattro decimali. È ciò che la soglia di qualità del segnale (§6.3) verifica. È un indice di qualità del dato, **non** una misura di quanto bene sia riuscito l'adattamento del BC.
- **Includi** — una casella che scavalca il verdetto automatico.

Cliccare ovunque su una riga tranne che sulla sua casella seleziona quella traccia e la disegna nel grafico sopra (§8).

### 7.2 Gli stati

| Stato | Significato |
|---|---|
| **non ancora calcolato** | Analizzata con successo, in attesa di **Calcola** |
| **calcolo in corso…** | Il suo incarico è in coda o in esecuzione |
| **non è una traccia** | Il file non è una traccia Labradar. Ignorato del tutto |
| **valida** | Adattata, superati entrambi i filtri, inclusa nella media |
| **segnale di scarsa qualità** | Adattata, ma con R² sotto la soglia (§6.3) |
| **valore anomalo** | Adattata, di buona qualità, ma il suo BC stona col lotto (§6.4) |
| **esclusa** | L'hai deselezionata a mano |
| **errore** | L'adattamento è fallito. Vedi §10.4 |

***Non è una traccia*** è lo stato normale di diverse voci in ogni export reale, e non è un problema. Lo riceve il `Report.csv` del dispositivo, perché è un riepilogo e non una traccia. Così pure qualunque altra cosa finisca per caso in `.csv` — inclusi gli invisibili file compagni `._` che macOS sparge negli archivi che ha toccato. Lo strumento decide guardando il contenuto e non il nome: un file è una traccia se contiene un'intestazione di traccia Labradar con un'unità di velocità dichiarata e produce almeno quattro righe di dati utilizzabili.

### 7.3 La casella «Includi»

La casella rispecchia il verdetto corrente — spuntata per *valida*, non spuntata per i tre stati di rifiuto — e cliccarla scavalca quel verdetto a mano.

- **Spuntare una traccia respinta** la forza dentro la media, oltre il controllo di qualità. Diventa inoltre **esente dallo scarto degli anomali**: una decisione manuale è fatta per reggere, non per essere re-respinta in sordina dalla statistica stessa che stava scavalcando.
- **Togliere la spunta a una traccia valida** la caccia fuori, e resta fuori a prescindere da entrambi i filtri.

La casella è disponibile solo sulle righe che hanno davvero un verdetto da scavalcare. Una riga non calcolata, che non è una traccia, o andata in errore, non ha nulla da includere, e la sua casella è disattivata.

Le decisioni manuali sopravvivono a un **Calcola** e vengono azzerate quando scegli un nuovo zip.

Usale con parsimonia e per ragioni che sai formulare. «Ho guardato il grafico, il radar si è chiaramente agganciato a qualcos'altro a metà strada, e il filtro automatico non l'ha visto» è una ragione. «Toglierla ha spostato il BC nella direzione che speravo» non è una ragione, ed è esattamente il meccanismo con cui ci si convince di un numero.

---

## 8. Il grafico della traccia

Clicca una riga e la sua curva velocità/tempo viene disegnata sopra la lista.

Tre serie:

- **Mantenuti** — i punti sopravvissuti alla pulizia e contro cui si è adattato.
- **Scartati** — i punti che la pulizia ha tolto, in un colore proprio, così vedi esattamente che cosa è stato respinto e giudichi se sei d'accordo.
- **BC = *n*** — una linea continua: la curva di velocità che il BC adattato effettivamente prevede, tracciata sullo stesso intervallo di tempo dei dati. È una previsione del modello e non un dato misurato, ed è per questo che è una linea mentre tutto il resto è a nuvola di punti.

La curva adattata parte dalla prima misura reale sopravvissuta e non dalla volata. È lì che l'adattamento è ancorato, e da lì si può solo procedere in avanti (§12.5). Il punto di volata inventato dal dispositivo viene comunque disegnato — fa parte della traccia — ma nulla vi viene adattato attraverso.

La curva è estesa fino al tempo più tardo di **qualunque** punto tracciato, mantenuto o scartato, così che un anomalo tardivo resti visivamente confrontabile con la curva che l'ha correttamente ignorato. È la cosa più utile di questo grafico: in una buona traccia i punti scartati si staccano verso l'alto da una curva che resta incollata a quelli mantenuti.

**Scarica il grafico come SVG** lo esporta, come gli altri grafici della suite.

Selezionare una traccia in errore disegna comunque qualcosa: poiché non c'è adattamento né divisione tra mantenuti e scartati, ogni punto grezzo tranne il punto di volata inventato dal dispositivo è disegnato come respinto, così puoi almeno vedere che cosa il radar ha registrato e farti un'idea tua sul perché non ci si sia potuto adattare nulla.

L'asse orizzontale è in millisecondi e quello verticale in metri al secondo, sempre. Vedi §3.1.

---

## 9. La scheda «Risultato»

Tre righe, sopra il grafico.

- **Tracce valide** — quante, sul totale, entrano attualmente nella media. `24 / 31` significa che trentuno colpi hanno prodotto un coefficiente balistico e ventiquattro di essi vengono mediati. Il denominatore conta solo le tracce effettivamente adattate, perciò le voci che non sono mai state tracce, e quelle andate in errore, mancano da entrambe le metà. Se quel denominatore è minore del numero di colpi che hai sparato, scorri la lista in cerca di errori.
- **Deviazione standard del BC** — la dispersione dei singoli BC colpo per colpo entrati nella media, a cinque decimali. È il numero che ti dice se credere a quello sotto. Vedi §10.3.
- **Il BC stesso** — grande, nel colore d'accento, a quattro decimali. La semplice media aritmetica non pesata dei BC di tutte le tracce incluse. Accanto, più sommesso, l'intervallo di confidenza al 95 % su quella media, scritto in percentuale di essa: `0.2812 (± 1.6%)`. Con una sola traccia valida non compare alcun intervallo, dato che un colpo solo non ha dispersione da cui ricavarlo. Vedi §10.3.

Tutte e tre si aggiornano nell'istante in cui cambi un filtro o spunti una casella.

---

## 10. Leggere il risultato

### 10.1 Che cosa hai davvero misurato

Il numero è il miglior BC singolo, contro il modello di resistenza che hai scelto, che riproduca la decelerazione che la tua palla ha davvero mostrato sul primo centinaio di metri del suo volo, nell'aria che hai dichiarato allo strumento.

Tre riserve al riguardo, tutte reali:

**È una misura della palla, così come esce dalla tua canna e attraversa la tua aria.** Non della carica di polvere. La velocità alla volata non fa parte di ciò che viene misurato — l'adattamento legge la *forma* del decadimento, e una palla che parte a 780 m/s decelera secondo la stessa curva di resistenza di una che parte a 700 m/s. È per questo che il §5.7 può dire che un lotto non deve essere omogeneo in velocità. Ciò che la canna invece contribuisce è reale: l'incrostazione, l'usura del cono di forzamento e tutto ciò che disturba la palla in uscita possono cambiare come vola davvero, e qui si vedrà.

**È adattato su una banda di velocità limitata.** La palla è nel campo del radar solo per una frazione del suo volo, e per tutto quel tempo è veloce. Un BC singolo contro un modello standard è un compromesso sulla banda su cui è stato adattato — quanto più la curva di resistenza reale della tua palla segue la forma del modello, tanto meglio quel compromesso si estrapola verso il regime transonico, dove conta di più. Ma dal tratto ravvicinato che il radar registra davvero non si può dedurre quale modello estrapoli meglio a lunga distanza. È una proprietà della palla, non dello strumento, ed è per questo che i due modelli di resistenza possono adattarsi bene qui e comunque contraddirsi a distanza.

**Vale solo quanto vale la tua atmosfera.** Di nuovo. Vedi §5.6.

### 10.2 Il confronto col numero pubblicato

Aspettati una differenza. Sarebbe più sorprendente se non ce ne fosse.

Un BC misurato **inferiore** al valore pubblicato è il caso comune, e di solito quello onesto. I numeri pubblicati sono spesso misurati in condizioni ideali, sulla banda di distanza che più li lusinga, su un lotto che può non essere il tuo.

Un BC misurato **molto** inferiore — trenta per cento, diciamo — non è un problema di palla. È un problema di dati inseriti. Controlla prima la pressione (alla stazione contro riportata al livello del mare, §5.6), poi il modello di resistenza, poi l'offset del proiettile.

Un BC misurato **superiore** al valore pubblicato merita una seconda occhiata alla tua atmosfera prima di festeggiare.

### 10.3 Leggere l'intervallo di confidenza e la deviazione standard

I due numeri rispondono a domande diverse, e tutta la questione sta lì.

**La deviazione standard** è la dispersione dei singoli BC colpo per colpo. È una proprietà del tuo tiro, della tua munizione e della giornata che ha avuto il tuo radar, e sparare di più non necessariamente la riduce.

**L'intervallo di confidenza** dice quanto bene quei colpi abbiano inchiodato la media. A differenza della dispersione, questo si stringe davvero man mano che spari — ma lentamente. Quattro volte i colpi per metà intervallo. Si allarga quando i tuoi colpi si contraddicono di più, ed è deliberatamente generoso sui lotti piccoli, perché una manciata di colpi davvero non può dire molto. Il §12.9 dà la formula.

Così un lotto di 25 tracce valide con una deviazione standard del BC di 0,010 dà un intervallo di circa ±0,004 attorno alla media. Contro un BC di 0,250 si legge come ±1,6 %, che è una misura davvero utile.

La stessa deviazione standard su sole 4 tracce valide dà circa ±0,016, ossia ±6 %, che non lo è. Il grosso di quella differenza è semplicemente il campione più piccolo; il resto è lo strumento che si rifiuta di lusingare un lotto di quattro colpi.

**Che cosa copre l'intervallo.** La dispersione da colpo a colpo, e nient'altro. Non comprende l'errore nella tua atmosfera, la discordanza tra la tua palla e il modello di resistenza standard, né l'offset del proiettile che hai stimato. Quelli spostano la media stessa, e una media sbagliata resta sbagliata, per quanto stretto sia l'intervallo attorno ad essa — vedi §5.6 e §10.2 prima di credere a una percentuale piccola.

Ne discendono direttamente due regole pratiche, e sono la ragione di ciò che dice il §5.7:

- **La dispersione è una proprietà dei tuoi dati; la precisione è una proprietà della dimensione del tuo campione.** Le tracce rumorose si curano sparandone di più.
- **Una dispersione è ampia rispetto a ciò che la cartuccia e la finestra rendono normale.** Nelle campagne di validazione dietro questo strumento (§12.6) — tracce sintetiche che portano rumore copiato da registrazioni Labradar reali, ripulite e adattate esattamente come fa lo strumento pubblicato — la dispersione per traccia andava da circa l'1,5 % al 5 % del coefficiente, la più ampia per cartucce pesanti e lente a decelerare su una finestra corta, la più stretta per quelle veloci su una finestra lunga. Un valore dentro quella fascia non dice nulla di particolare. Ben sopra, scorri le righe e guarda i grafici prima di mediarci sopra: il radar faticava, la corsia era ingombra, l'offset era sbagliato, oppure la tua munizione è davvero così irregolare. Nota che quelle campagne misuravano il rumore radar contro una verità nota, per cui un lotto reale porta la vera variazione da palla a palla sopra quella fascia, non dentro.

### 10.4 Quando una traccia va in errore

Una riga marcata *errore* significa che è fallito l'adattamento stesso, non che abbia prodotto una risposta cattiva. In pratica significa che i punti di quella traccia implicavano una palla come non ne esistono — un coefficiente ben fuori dall'intervallo di qualunque cosa sia mai stata sparata, o una velocità iniziale lontanissima da ciò che il radar stesso ha registrato — cosicché lo strumento si è rifiutato di dichiarare un numero. I limiti esatti sono nel §12.11.

Lo strumento tratta la cosa come un fallimento invece di riportare il bordo dell'intervallo verso cui è andato alla deriva; è il comportamento giusto, ma comporta che la riga ti dica solo che è fallito, non perché. Selezionala e guarda il grafico: una traccia in errore si rivela quasi sempre visibilmente non essere affatto la traccia di una palla.

Uno o due errori in un lotto grande non hanno nulla di notevole. Un lotto in cui la maggior parte delle tracce fallisce indica un problema di allestimento — il più delle volte un cattivo allineamento tra il radar e la traiettoria del proiettile, poi un modello di resistenza che non si adatta affatto ai dati, o un'atmosfera sbagliata abbastanza da portare il BC richiesto fuori dall'intervallo di ricerca.

---

## 11. Metterlo al lavoro

### 11.1 Riportare il valore nell'Arsenale

È lo scopo dell'esercizio. Apri **Armi → Arsenale**, modifica la palla che hai appena misurato e sostituisci il BC pubblicato con il tuo, contro il modello di resistenza con cui l'hai adattato.

Non c'è alcun passaggio automatico — il numero lo digiti tu. Sono quattro cifre, e la deliberatezza vale la pena: qui sei tu a decidere che la tua misura sostituisce l'affermazione del produttore, e quella decisione merita di essere consapevole.

Da quel momento ogni strumento della suite — Traiettoria, Probabilità di colpire, Calcolatore di campo, il grafico di confronto — lavora su un valore di resistenza misurato. Il miglioramento non si vede a cento metri e si vede benissimo oltre i seicento.

### 11.2 Confrontare lotti e cariche

Poiché lo strumento riporta una deviazione standard colpo per colpo oltre a una media, è un discreto strumento anche per domande che con la resistenza non c'entrano nulla:

- **Due lotti della stessa palla.** Sparane venti per ciascuno ed elaborali come lotti separati. Un BC medio sensibilmente diverso significa che i lotti differiscono davvero, molto probabilmente nell'uniformità dell'ogiva o della base.
- **L'effetto di una matrice per punte, o della selezione sulla quota base-ogiva.** Stesso trattamento. Qui il numero interessante è la *deviazione standard*, non la media: palle regolari danno BC regolari.
- **Rivestita contro non rivestita, moly, o qualunque sia l'entusiasmo del momento.** La misura è onesta e l'effetto è di solito più piccolo del marketing.

Tieni onesta l'atmosfera tra un confronto e l'altro, altrimenti misurerai il tempo che fa.

Un lotto lo hai gratis: **una serie di messa a punto della carica è già una sessione di BC valida.** Poiché all'adattamento della velocità alla volata non importa nulla (§5.7), venti o trenta cartucce che spaziano su una gamma di cariche, tutte con la stessa palla, si mediano in un coefficiente balistico perfettamente buono. La serie l'avresti sparata comunque, e il Labradar avrebbe comunque registrato ogni traccia. Comprimi la sessione e falla girare.

---

## 12. La gioia del nerd: che cosa succede davvero alle tue tracce

Tutto ciò che segue è ciò che lo strumento calcola davvero, con il ragionamento e le prove. Non è lettura obbligatoria per usare lo strumento, ed è la parte più interessante dello strumento.

**Le unità di tutta questa sezione sono quelle del motore.** Internamente è tutto metrico — metri, secondi, metri al secondo, temperature riferite al kelvin — e la conversione avviene solo ai due confini: le unità dichiarate dal file di traccia in entrata, e la tua preferenza di visualizzazione in uscita.

### 12.1 Che cosa misura il dispositivo, e che cosa no

Un cronografo Doppler non misura la posizione per poi derivarla. Misura lo spostamento di frequenza della propria emissione riflessa dalla palla, che è direttamente proporzionale alla componente di velocità della palla *lungo il fascio*. La velocità è la misura primaria. La distanza ne è integrata, ed è per questo che la colonna delle distanze è liscia anche quando quella delle velocità non lo è.

Due conseguenze plasmano tutto il resto:

**L'offset del proiettile è una vera correzione geometrica, non una finezza.** Ciò che il fascio vede è la componente radiale della velocità. Convertirla nella vera velocità nella direzione del tiro richiede l'angolo tra fascio e traiettoria, che si ricava dall'offset che hai impostato. Un errore di offset è un errore in coseno, e gli errori in coseno sono i peggiori: piccoli, sistematici e del tutto invisibili in uscita.

Spiega anche l'asimmetria affermata nel §5.2 — perché un offset sciatto costi a una misura di BC più di quanto costi a una velocità alla volata. L'angolo tra fascio e traiettoria non è costante: è più aperto proprio alla volata e si chiude verso zero man mano che la palla si allontana. Il fattore di correzione è dunque una *funzione della distanza*, e sbagliare l'offset non riscala l'intera traccia con un'unica costante sbagliata. La incurva. I punti iniziali vengono corretti più di quelli finali, o meno, e ne esce una curva di decadimento della velocità dalla forma sbagliata.

Una velocità alla volata è un punto singolo su quella curva e assorbe l'errore come un modesto scostamento. Un coefficiente balistico è adattato alla forma della curva e lo assorbe come una distorsione sistematica. La stessa sciatteria che lascia le tue letture di cronografo perfettamente ragionevoli può spostare un BC di diversi punti percentuali.

**L'SNR è una misura diretta di quanto dell'eco sia reale.** È riportato punto per punto, in decibel, e si degrada costantemente man mano che la palla si allontana — la potenza di ritorno cala con la quarta potenza della distanza, cosicché una palla al doppio della distanza restituisce un sedicesimo del segnale. È il peso giusto per un adattamento, e lo strumento lo usa come tale (§12.4).

### 12.2 Che aspetto ha davvero il rumore

Prima che qualunque cosa di tutto ciò fosse progettata, il rumore è stato misurato e non ipotizzato: 1.297 tracce reali distinte, deduplicate da un export in blocco, con residui presi contro una retta di riferimento adattata solo sul **primo 30 %** della finestra temporale di ciascuna traccia — deliberatamente al riparo da contaminazione della coda.

Residuo di velocità aggregato, in m/s, per decile di posizione lungo la traccia:

| Decile | media | dev. std. | p5 | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 0 (inizio) | -0,00 | 0,69 | -0,68 | 0,01 | 0,65 | 1,97 |
| 2 | -0,01 | 0,82 | -1,15 | -0,03 | 1,13 | 2,53 |
| 4 | 0,41 | 3,69 | -2,07 | 0,01 | 3,12 | 18,65 |
| 6 | 1,97 | 8,64 | -2,86 | 0,28 | 15,78 | 43,25 |
| 8 | 5,77 | 15,67 | -3,97 | 1,18 | 38,97 | 67,87 |
| 9 (fine) | 10,41 | 19,46 | -3,62 | 3,44 | 52,06 | 81,03 |

Leggi le due code una contro l'altra, perché tutta la storia sta lì. All'inizio della traccia il rumore è stretto e davvero simmetrico — un eco Doppler ben educato, ad alto SNR. In fondo alla traccia il lato **basso** si muove appena: il p5 resta attorno a -3 / -4 m/s per tutto il percorso. Il lato **alto** cresce di quasi due ordini di grandezza, fino a un 99º percentile di 81 m/s.

I punti Labradar cattivi in pratica sovrastimano sempre la velocità, e non la sottostimano mai. È esattamente l'aspetto di un eco spurio — una riflessione su qualcosa di più vicino, o un arrivo per cammini multipli, che si leggono entrambi come una minore perdita di velocità radiale rispetto a quella davvero subita dalla palla. Non è rumore simmetrico e non va trattato come tale.

Altri due fatti dallo stesso corpus, entrambi portanti per il progetto:

- **Il 55 % delle tracce reali non ha bisogno di alcuna potatura di punti.** La pulizia non è una passata di lisciatura di routine; è una gestione di eccezioni.
- **La gravità del problema varia enormemente da sessione a sessione e non è prevedibile dall'interno di una traccia.** Il numero di punti scartati sul corpus va da 0 a 73. Il calibro (quanto è riflettente la base della palla), l'ingombro vicino alla linea di volo, l'allineamento del fascio e la stabilità della scatola sotto il soffio contribuiscono tutti indipendentemente.

Quest'ultimo punto ha ucciso due distinti progetti di soglia adattativa per traccia, che entrambi tentavano di calibrare l'aggressività della pulizia sulla parte iniziale di ciascuna traccia. Non può funzionare: la gravità reale abita quasi interamente nella coda, e un segnale calibrato sulla testa non può strutturalmente vederla. Uno dei due è stato scartato su una traccia sintetica *senza rumore*, dove buttava via da 18 a 26 punti perfettamente buoni; l'altro ha superato quel controllo ma poi non ha mai, nemmeno una volta, differito da una soglia fissa su tracce reali con gravità autentica. Entrambi sono documentati nel rapporto sull'esperimento di pulizia del repository, e la soglia fissa che li ha rimpiazzati ha battuto tutti e due.

### 12.3 Pulizia: rimozione golosa del punto peggiore con barriera di ripristino su R²

Ogni traccia viene ripulita prima che vi si adatti qualunque cosa. L'algoritmo è ereditato dallo strumento precedente, portato deliberatamente immutato, e non è né sigma-clipping né RANSAC:

1. Adatta una retta ai minimi quadrati pesata sull'SNR attraverso i punti.
2. Trova il punto col residuo assoluto maggiore rispetto a quella retta. Rimuovilo. Annota l'R² dell'adattamento *prima* della rimozione.
3. Ripeti, fino a un pavimento di 10 punti rimasti.
4. Poi percorri dall'inizio la storia degli R² annotati. Al **primo** passo il cui R² era già entro una soglia relativa dal miglior R² mai visto durante la potatura, ripristina il punto di quel passo **e tutto ciò che è stato scartato dopo di esso**.

Il passo 4 è la parte sottile e la ragione per cui l'algoritmo funziona. Il ciclo di potatura arriva sempre fino al pavimento, buttando via punti buoni insieme a quelli cattivi; la passata di ripristino chiede allora «da che punto in poi potare ancora non ha più portato nulla?» e riavvolge tutto fino a lì. Una traccia che non aveva bisogno di alcuna pulizia ha il suo miglior R² possibile già al passo zero, cosicché il primissimo controllo di ripristino passa e ogni punto scartato torna subito indietro. È così che il 55 % delle tracce reali esce correttamente intatto da un ciclo che ne aveva rimosso incondizionatamente decine di punti.

Tre asimmetrie d'indice in questa routine sembrano bug e non lo sono:

- **Il punto sintetico t = 0 del dispositivo è escluso dall'adattamento, dall'R² e dalla ricerca del punto peggiore.** Non è una misura (§3), e il suo campo SNR è letteralmente un trattino. Non può influenzare un adattamento e non può nemmeno essere «rimosso» in modo sensato.
- **L'ultimo punto è escluso dall'adattamento e dall'R², ma resta eleggibile alla rimozione.** Il dispositivo è più rumoroso proprio in coda, perciò un ultimo punto cattivo non deve corrompere l'indicatore di qualità — pur restando un legittimo candidato alla potatura. La conseguenza è un comportamento preciso e verificabile: una traccia il cui *unico* problema sia un ultimo punto cattivo ha già il suo miglior R² possibile al passo zero, cosicché il primo controllo di ripristino passa e quel punto torna. Resta potato solo se coincide con un problema autentico dentro l'intervallo di adattamento.
- **Due diversi intervalli di adattamento** servono per quella che è matematicamente la stessa regressione lineare pesata: uno che esclude l'ultimo punto (per l'R² e la ricerca del punto peggiore) e uno che lo include (per leggervi velocità, nel vecchio stimatore a due punti). Confonderli è un errore facile e davvero dannoso — i due intervalli producono velocità che concordano solo a circa tre cifre significative, il che è invisibile nell'R² e vale in sordina circa mezzo punto percentuale di BC.

C'è un onesto incidente conservato dall'originale: la condizione di arresto è verificata *dopo* la rimozione, cosicché il ciclo può rimuovere, e tipicamente rimuove, un punto oltre il pavimento, fermandosi a nove invece che a dieci. Nel codice d'origine non si è trovata alcuna giustificazione di dominio. È conservato perché il porting è stato validato nel suo insieme su tracce reali, e cambiarlo invaliderebbe quella validazione senza guadagno noto.

### 12.4 Pesatura sull'SNR

La colonna SNR è in decibel. Il peso di ciascun punto è quel valore riconvertito in rapporto di potenza lineare:

$$w_i = 10^{\,\text{SNR}_i/10}$$

il che non è una trasformazione cosmetica. Un punto a 40 dB pesa 10.000; un punto a 10 dB pesa 10. Lungo una traccia reale è un fattore mille tra gli echi iniziali, affidabili, e quelli finali, dubbi — esattamente la forma che la tabella del rumore del §12.2 richiede. L'adattamento è dominato dalla porzione di traccia di cui il radar era davvero sicuro, e la coda rumorosa non vi contribuisce quasi nulla — pur restando *presente*, cosicché una coda che davvero contraddice il modello compare ancora nei residui e viene ancora intercettata dalla pulizia.

Il punto sintetico t = 0 non ha alcun SNR e gli viene assegnato peso zero — anche se in pratica non arriva mai a una pesatura, dato che ogni adattamento dello strumento lo esclude strutturalmente per indice prima ancora che la pesatura entri in gioco.

### 12.5 L'adattamento: la fisica su tutta la finestra

È la parte che è stata ricostruita invece che portata, ed è da lì che viene l'accuratezza.

L'approccio ovvio, quello che il predecessore ha seguito per anni, è: passa una retta per i punti ripuliti, leggine una velocità a ciascuna estremità, e cerca per bisezione il BC che porti il modello di resistenza dalla prima velocità alla seconda nel tempo trascorso. Due punti, una forma di curva presupposta.

Ciò che questo strumento fa invece è adattare la **fisica stessa** contro tutti i punti mantenuti in una volta. Due parametri vengono risolti congiuntamente:

- $v_1$, la vera velocità al punto d'ancoraggio, e
- il coefficiente balistico.

Per una coppia candidata, l'integratore di traiettoria dell'app viene percorso in avanti dall'ancora e la sua velocità prevista è valutata al tempo proprio di ciascun campione mantenuto. L'obiettivo è la somma dei quadrati dei residui pesata sull'SNR:

$$\text{SSE}(v_1, \text{BC}) = \sum_i w_i \left(v_{\text{modello}}(t_i;\, v_1, \text{BC}) - v_i\right)^2$$

e viene minimizzata da una **ricerca per sezione aurea annidata** — ricerca interna sul BC per un $v_1$ candidato, ricerca esterna su $v_1$ — anziché per bisezione, perché qui si minimizza una somma di quadrati e non si cerca la radice di una grandezza monotona. Trenta iterazioni ciascuna, col BC racchiuso in [0,05, 1,5] e $v_1$ entro il 15 % dalla velocità d'ancoraggio grezza.

Tre scelte di progetto meritano di essere dette apertamente:

**L'ancora è il primo punto *interno mantenuto***, non il punto t = 0 del dispositivo né il primo campione grezzo. La sua velocità registrata è solo il *valore di partenza*; il $v_1$ effettivo viene adattato. Conta, perché quella singola lettura è essa stessa una misura rumorosa, e tenerla fissa propagherebbe il suo errore dritto nel BC.

**Adattare anche $v_1$ costa quasi nulla in rischio di sovradattamento**, ed è l'argomento a favore. Due parametri fisicamente significativi sono un modello assai più stretto di una parabola a tre coefficienti, e non può inseguire il rumore come farebbe un termine polinomiale in più — la forma è vincolata da fisica della resistenza autentica e non da un termine di curvatura libero.

**La forma della curva non è mai presupposta.** È quella che il modello di resistenza produce davvero a quelle velocità in quell'aria, ed è tutto il punto.

L'integrazione usa il passo RK4 condiviso della suite, a passo fisso di 20 ms fuori dalla banda transonica e di 3 ms dentro, con l'atmosfera rivalutata a ogni passo dalla quota corrente della palla. Centrare esattamente un tempo obiettivo usa la stessa interpolazione quadratica a tre punti che il resto del motore usa per centrare una distanza obiettivo — leggere il passo grezzo che per caso la supera sarebbe un errore reale a queste velocità, di parecchie decine di metri.

### 12.6 Perché non una retta, e perché non una parabola

Entrambe le alternative sono state provate invece che liquidate, contro tracce sintetiche che portavano rumore **reale** — ricampionato con bootstrap dal corpus di 1.297 tracce del §12.2 anziché estratto da un modello parametrico, proprio perché il modello parametrico sottostimava la coda severa. Quattro configurazioni di riferimento, tre lunghezze di finestra, 300 prove per cella.

Il risultato singolo più netto viene dal caso senza alcun rumore — una traccia sintetica perfettamente pulita per un BC noto di 0,202:

| Metodo | BC recuperato | Errore |
|---|---|---|
| Lineare | 0,1838 | -9,0 % |
| Quadratico | 0,2028 | +0,4 % |
| Adattamento fisico | 0,2020 | **+0,01 %** |

Questo isola qualcosa che le prove rumorose da sole non possono isolare: **una retta è un modello davvero scadente del vero decadimento di velocità, fisicamente curvo**, su una finestra di 150–200 m. Nove per cento di errore, con un cronografo perfetto, prima ancora di considerare il rumore. È una distorsione strutturale, non un problema di robustezza.

Con rumore reale aggiunto, su ogni configurazione e lunghezza di finestra provata:

- **Il quadratico sovrastima il BC in ogni singola cella**, dal +4 % al +9 %. Segue troppo bene la coda rumorosa — e poiché il §12.2 ha stabilito che gli errori di coda sono unilaterali verso l'alto, seguirli bene significa essere tirati verso l'alto. Riproduce esattamente il fallimento che l'autore dello strumento precedente aveva già trovato a mano.
- **La distorsione del lineare dipende dalla configurazione e cresce con la lunghezza della finestra.** Quasi piatta per un .338 pesante che decelera dolcemente; una distorsione negativa forte e crescente per un 5,56 veloce a BC basso — da -3,4 % a 120 m fino a -8,4 % a 200 m. È la distorsione di forma di cui sopra, sommata alla sensibilità al rumore.
- **L'adattamento fisico ha avuto l'errore minore in ogni singola cella**, tipicamente da tre a nove volte minore di entrambe le alternative, e per giunta con la dispersione più stretta.

Il miglioramento regge al contatto col caso d'uso reale: usare il BC adattato da ciascun metodo per prevedere la velocità a 300 m — oltre la finestra misurata, che è ciò a cui un BC *serve* — dà la stessa graduatoria.

La riserva onesta: tutto questo è sintetico. Le tracce reali sono servite a caratterizzare il rumore che le tracce sintetiche portano, non a riderivare da capo a fondo e in modo indipendente il BC di una palla vera.

### 12.7 Perché la soglia di riduzione del rumore è a 0,990 per impostazione predefinita

La soglia di pulizia è stata scandagliata direttamente, su 40 tracce a rumore reale:

| Soglia | Punti scartati (media) | Errore assoluto di BC (media) |
|---|---|---|
| 0,95 | 0,70 | 1,09 % |
| 0,97 (il vecchio valore) | 2,42 | 1,08 % |
| **0,99** | **3,10** | **0,96 %** |
| 0,999 | 11,40 | 0,56 % |

Sul corpus piatto l'effetto sembra modesto. Sulle tracce che avevano davvero bisogno di pulizia — quelle con più di quindici scarti autentici — è clamoroso: l'errore medio di BC era **piatto attorno al 21 % su tutto l'arco 0,80–0,97**, ed è sceso a 6–7 % solo a 0,99. Il richiamo contro gli anomali iniettati noti è salito dal 14–54 % al 74–98 %.

L'errore continuava a migliorare oltre 0,99, ma facendo esplodere il numero di punti scartati — oltre sessanta su tracce che ne avevano 100–140 in partenza, ben oltre quanto mostrino le tracce reali, e dentro un regime prossimo al pavimento in cui all'adattamento vengono a mancare i dati. **0,99 è il valore che le prove sostengono; nulla oltre è stato creduto su questa base.**

Due risultati dello stesso esperimento vale la pena registrarli perché sono negativi:

- **Pulizia e adattamento non sono intercambiabili in modo indipendente.** Abbinata al *vecchio* adattamento lineare, la soglia alzata non aiutava in modo affidabile e rendeva una configurazione misurabilmente peggiore. Si guadagna il posto solo accanto all'adattamento fisico. Valuta la coppia, non i pezzi.
- **Misurare i residui della pulizia contro il modello fisico invece che contro una retta è stato costruito, validato come accurato, reso abbastanza economico da poter essere pubblicato — e non ha prodotto alcun beneficio misurabile** una volta che la soglia era già alzata. È rimasto fuori. È l'unico pezzo di infrastruttura funzionante deliberatamente non pubblicato di questo strumento, conservato nel repository come contesto per una futura riscrittura anziché come peso morto nel bundle.

### 12.8 Le due barriere sulla traccia intera

Entrambe operano su risultati di traccia già ottenuti, e nessuna delle due riadatta alcunché — per questo rispondono all'istante.

**La barriera di qualità del segnale** confronta l'R² di ciascuna traccia — il coefficiente di determinazione della retta pesata sull'SNR passante per i suoi punti *ripuliti* — con 0,95 (Normale) o 0,90 (Rumore alto), oppure salta del tutto la prova (Nessuna).

C'è qui una contraddizione apparente che conviene sciogliere: il §12.6 ha appena stabilito che una retta è il modello sbagliato per adattare un BC. È nondimeno il riferimento giusto per un controllo di *qualità*, per due ragioni. Lo scostamento di una traccia dalla linearità su una finestra di 100 m è dominato dal rumore e non dalla curvatura reale — la curvatura vale qualche punto percentuale, i punti cattivi valgono decine di metri al secondo. E usare lo stesso riferimento che la pulizia stessa usa rende l'R² riportato direttamente leggibile come «quanto è andata bene la pulizia», che è esattamente ciò su cui si chiede all'utente di giudicare.

**Lo scarto degli anomali** calcola media e deviazione standard di popolazione su ciò che resta valido dopo la barriera di qualità, poi respinge ogni traccia a più di $k\sigma$ da quella media, con $k = 2,0$ (Conservativo) o $k = 1,644854$ (Aggressivo). Quella seconda costante non è arbitraria: è il 95º percentile della normale standard, cosicché uno scarto bilaterale di quella ampiezza conserva il 90 % centrale di una popolazione normale. È la classica soglia «respingi il 10 % peggiore», scritta esattamente.

Le barriere girano in quest'ordine, e solo in quest'ordine: prima la qualità, poi lo scarto sulle sopravvissute. Una traccia già respinta per qualità non contribuisce alla media e alla deviazione standard da cui lo scarto è calcolato — il che è giusto, dato che altrimenti il BC di una traccia cattiva allargherebbe proprio il metro usato per intercettare le tracce cattive.

**Le decisioni manuali scavalcano entrambe**, e un'inclusione forzata è per giunta esente dalla passata di scarto stessa. Una decisione manuale è fatta per reggere, non per essere re-respinta in silenzio dalla statistica che stava scavalcando.

### 12.9 L'aggregazione

Una semplice media aritmetica non pesata dei BC sopravvissuti, e la loro deviazione standard di popolazione — divisa per $n$, non per $n-1$.

L'intervallo di confidenza riportato è un calcolo distinto sullo stesso insieme di sopravvissute, e quello sì usa $n-1$: semiampiezza $= t_{0,975,\,n-1} \cdot s / \sqrt{n}$, con $s$ la deviazione standard campionaria, divisa per la media per dare la percentuale mostrata. I due denominatori sono voluti. La forma di popolazione è quella su cui il vecchio scarto degli anomali è stato calibrato e resta intatta; la forma campionaria è quella corretta per un intervallo su una media. Il moltiplicatore è il quantile di Student bilaterale al 95 %, tabulato per $n$ fino a 31 e ripreso da uno sviluppo di Cornish-Fisher oltre, il che conta più di quanto sembri — a cinque tracce vale 2,776, e a quattro 3,182, contro l'1,96 che un'approssimazione normale userebbe in entrambi i casi: un intervallo più ampio del 42 % e del 62 %, e considerevolmente più onesto.

Non è espressamente la tabella `TDIST_QUANTILE` che il Calcolatore di precisione di tiro porta con sé. Quelli sono quantili a 0,9875, ripartiti alla Bonferroni per dare un 95 % congiunto sulle due coordinate del punto d'impatto di una rosata insieme. Una media di BC è un singolo scalare, e prendere in prestito quella tabella darebbe un intervallo fino al doppio più ampio del 95 % che dichiara.

Con meno di due tracce valide non viene riportato alcun intervallo, invece di uno di ampiezza nulla.

La media non pesata è una scelta deliberata, non una svista. I punti dentro una traccia sono pesati sull'SNR, perché l'SNR è una misura autentica di qualità punto per punto. Le tracce dentro un lotto non sono pesate affatto, perché ogni colpo del lotto è un'estrazione dalla stessa popolazione di colpi, e non c'è ragione difendibile per lasciare che una traccia più pulita parli più forte, su ciò che fa la *palla*, di una più rumorosa. Pesare sulla qualità della traccia sovrarappresenterebbe sistematicamente i colpi graditi al radar, e quella non è la stessa popolazione dei colpi che hai sparato.

### 12.10 Che cosa l'adattamento ignora, e che cosa no

**Il vento è ignorato** — l'integrazione gira a vento nullo. Su 100 m di volo in 0,15 s, l'effetto di un vento al traverso sul *modulo* della velocità è trascurabile, e il modulo è tutto ciò che questo adattamento guarda.

**La gravità non è ignorata**, ma è pressoché irrilevante, e vale la pena vedere perché. La palla è percorsa in avanti come se fosse stata lanciata in orizzontale, perciò dopo 0,15 s ha acquisito circa 1,5 m/s di velocità verticale. Contro 760 m/s in orizzontale, la velocità risultante è $\sqrt{760^2 + 1,5^2} \approx 760,0015$ m/s. Quindici decimillesimi di metro al secondo. Includere la gravità non costa nulla e toglie un argomento di discussione.

**La quota è ricavata a ritroso dalla tua pressione alla stazione**, invece di essere assunta nulla. Lo strumento precedente assumeva sempre il livello del mare, il che era un limite del motore e non una decisione. Ricavare una quota dalla pressione consente all'integratore di applicare in modo coerente il proprio modello atmosferico in volo — anche se, su 100 m di volo e senza sostanziale cambio di quota, anche questo è un effetto piccolo. Non costa nulla e mantiene il trattamento dell'atmosfera di questo strumento identico a quello di ogni altro della suite, il che vale più della correzione stessa.

**La densità dell'aria è l'effetto che conta davvero**, e viene da tutti e tre i campi dell'atmosfera attraverso il modello condiviso di densità dell'aria umida della suite. È per questo che il §5.6 insiste come insiste.

### 12.11 Note numeriche e ingegneristiche

- **Le voci dello zip sono filtrate per estensione prima della decompressione**, non dopo. Tutto ciò che non è un `.csv` — il file di progetto `.lbr`, le voci di cartella, qualunque altra cosa nell'archivio — viene saltato senza mai essere decompresso. L'esame del contenuto avviene uno strato più sopra e non sa nulla di file zip, ed è per questo che il confine di modulo sta esattamente lì.
- **L'analisi è sincrona e immediata; l'adattamento no.** Analizzare un CSV di cento righe richiede microsecondi, perciò avviene nell'istante in cui il file viene scelto e la lista compare subito. L'adattamento sono centinaia di integrazioni di traiettoria complete per traccia e va al pool di worker.
- **Gli incarichi sono distribuiti uno a uno anziché come un'unica promessa collettiva**, proprio perché ogni riga si aggiorni appena il suo adattamento si risolve. Aspettare tutti prima di mostrare qualcosa sarebbe più semplice e peggiore.
- **Il risolutore segnala la saturazione al bordo come un fallimento.** I due intervalli di ricerca sono quelli che il §12.5 nomina: il BC confinato in [0,05, 1,5] e la velocità di riferimento entro il 15 % dalla lettura d'ancoraggio propria della traccia. Una ricerca per sezione aurea restituisce sempre *un* punto interno, anche quando il vero minimo sta fuori dal suo intervallo — allora satura in silenzio contro il bordo in cui continua a migliorare, il che ha esattamente l'aria di una convergenza senza esserlo. Era un bug vero, colto in piena validazione. Un risultato che atterra entro lo 0,1 % da uno dei due bordi è ora trattato come adattamento fallito, allo stesso modo in cui gli altri risolutori di BC della suite già rifiutano di restituire un valore di bordo per un obiettivo irraggiungibile. È tutto ciò che una riga in *errore* del §10.4 significa.
- **Modello di resistenza e atmosfera sono riposti accanto al risultato di ciascuna traccia**, invece di essere riletti dal vivo quando il grafico viene disegnato. La curva adattata sovrapposta rispecchia perciò sempre ciò con cui quella specifica traccia è stata davvero calcolata, anche se nel frattempo hai cambiato le impostazioni del pannello senza ricalcolare.
- **Una traccia ha bisogno di almeno quattro righe analizzabili** per essere considerata una traccia. Le righe cui manchi tempo, velocità o distanza vengono scartate in silenzio; così pure qualunque riga dopo la prima cui manchi l'SNR. Solo alla prima riga è concesso un SNR non numerico, perché solo la prima riga è il punto sintetico del dispositivo.
- **Il tetto di 20.000 passi d'integrazione** è una sicurezza del passo condiviso, non un vincolo qui — una traccia da 0,15 s richiede qualche decina di passi.

### 12.12 Che cosa deliberatamente non c'è

**Nessun bilancio d'errore complessivo.** L'intervallo di confidenza copre il campionamento e solo quello (§10.3). Non incorpora l'atmosfera che hai digitato, il modello di resistenza che hai scelto o l'offset che hai stimato, i quali nella maggior parte delle sessioni reali dominano interamente la dispersione da colpo a colpo. Fonderli in un'unica cifra di testata richiederebbe di fingere di sapere quanto siano sbagliati i propri dati d'ingresso, e un numero costruito su quella finzione sarebbe peggio di nessun numero.

**Nessun passaggio automatico all'Arsenale.** Ogni altro strumento di misura della suite consegna direttamente il proprio risultato. Questo no, ed è una decisione e non una dimenticanza: sostituire un BC pubblicato con uno misurato è un giudizio su quale numero ti fidi, e merita di essere preso apposta.

**Nessuna incertezza per traccia.** Ogni traccia riporta un BC e un R², non un BC con un intervallo. L'R² misura quanto fosse pulita la traccia, non quanto sia ben determinato il BC, e le due cose sono correlate ma non sono la stessa. Confonderle sarebbe peggio che non riportarne nessuna.

---

## 13. Provenienza

BC Labradar è il successore di **Labrabaco**, uno strumento autonomo dello stesso autore. La catena di ingestione — il riconoscimento delle tracce, le regole di tolleranza riga per riga, l'algoritmo di pulizia dei punti e le sue due barriere di rifiuto sulla traccia intera — ne è portata fedelmente, tracciata sito di chiamata per sito di chiamata e validata su tracce d'esempio reali, comprese le diverse asimmetrie d'indice documentate nel §12.3 che sembrano bug e non lo sono.

La novità è l'adattamento. Lo strumento originale passava una retta per i punti ripuliti e cercava per bisezione il BC corrispondente ai suoi estremi; questo adatta la fisica della resistenza propria dell'app contro tutti i punti mantenuti in una volta, congiuntamente a una velocità di riferimento. Quel cambiamento, e l'abbinato passaggio della soglia di pulizia da 0,97 a 0,99, sono stati validati su tracce sintetiche a rumore reale prima che l'uno o l'altro fosse pubblicato, e i rapporti di validazione — compresi i risultati negativi, i due progetti scartati e l'unico meccanismo funzionante costruito e poi lasciato fuori per non valere il proprio costo — stanno nel repository accanto al codice.

Ugualmente nuovi: il grafico per traccia con la sua divisione tra mantenuti e scartati e la curva adattata sovrapposta, di cui lo strumento originale non aveva alcun equivalente; una scheda di risultato strutturata al posto di un blocco di testo concatenato; l'adattamento in parallelo su un pool di worker; e un'atmosfera pienamente consapevole delle unità con una quota realmente ricavata, al posto di un livello del mare presunto.

La suite è distribuita con licenza **AGPL-3.0-or-later**.

---

*Pacifico. Preciso. Armato.*
