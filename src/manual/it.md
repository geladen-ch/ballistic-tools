# geladen.ch ballistics — Manuale utente

*Pacifico. Preciso. Armato.*

geladen.ch ballistics è una suite di balistica esterna interamente lato
client. Tutto — l'integrazione della traiettoria, l'analisi di probabilità
di colpire, i tuoi fucili e proiettili salvati — viene eseguito nel tuo
browser. **Nessun dato viene mai raccolto o trasmesso a un server.**
Funziona offline una volta caricata e si installa come app su desktop e
dispositivi mobili (PWA).

Questo software viene fornito senza alcuna garanzia di idoneità per uno
scopo particolare, o quel che è — bla bla bla. Ho fatto del mio meglio
per renderlo utile (mi ci sono tenuto occupato per un weekend piovoso), e
credo sia ragionevolmente accurato, ma se trovi un modo creativo per
usare in modo improprio una calcolatrice balistica fino a farti male,
sono affari tuoi — chi sono io per mettermi di traverso alla selezione
naturale?

Questo manuale copre gli strumenti pienamente funzionanti — **Traiettoria**,
**Armi**, **Curva Cd-Mach** e **Impostazioni** — oltre a
**Probabilità di colpire**, al **Calcolatore per il poligono** e agli
**Strumenti BC**, tutti utilizzabili per i loro scenari attuali ma ancora in
sviluppo attivo. Tutto il resto nella Home
è elencato alla fine, sotto **Pianificato / in corso**.

---

## Installazione dell'app

### Android (Chrome)

Chrome può installare questa app in modo che si comporti come qualsiasi
altra app sul telefono — una propria icona sulla schermata Home, una
propria finestra senza barra del browser, e continua a funzionare offline.

- Apri l'app in Chrome.
- Tocca il menu **⋮** (in alto a destra) e scegli **Installa app** (nelle
   versioni precedenti di Chrome si chiama **Aggiungi a schermata Home**).
- Conferma. Un'icona apparirà sulla schermata Home o nel cassetto delle
   app, come qualsiasi altra app installata.

**Un'icona separata per il Calcolatore per il poligono.** Poiché il
Calcolatore per il poligono fa parte della stessa app, puoi dargli una
propria icona che si apre direttamente, saltando la Home:

- In Chrome, apri l'app e vai al **Calcolatore per il poligono**.
- Apri di nuovo il menu **⋮** — mentre il Calcolatore per il poligono è
   aperto — e scegli **Aggiungi a schermata Home**.
- Quando Chrome chiede un nome, indica ad esempio "Calcolatore per il
   poligono" così puoi distinguere facilmente le due icone.

Toccando questa seconda icona l'app si apre direttamente sul Calcolatore
per il poligono, saltando la Home — comodo se è l'unico strumento che usi
sul campo. Al momento entrambe le icone mostrano la stessa immagine; cambia
solo il nome.

### iPhone / iPad (Safari)

Questo funziona solo in **Safari** — gli altri browser su iPhone (incluso
Chrome) non possono installare app sulla schermata Home.

- Apri l'app in Safari.
- Tocca il pulsante **Condividi** (il quadrato con la freccia verso
   l'alto, nella barra degli strumenti in basso — su iPad si trova in
   alto).
- Scorri verso il basso nel foglio che appare e tocca **Aggiungi a
   Home**.
- Conferma il nome (o modificalo) e tocca **Aggiungi**, in alto a destra.

Un'icona apparirà sulla schermata Home e aprirà l'app in una propria
finestra, senza la barra degli indirizzi di Safari — come su Android.

**Un'icona separata per il Calcolatore per il poligono** funziona allo
stesso modo: apri prima il **Calcolatore per il poligono** nell'app, poi
ripeti **Condividi → Aggiungi a Home** mentre questa pagina è aperta, e
assegna un nome distintivo come "Calcolatore per il poligono". Come su
Android, al momento entrambe le icone mostrano la stessa immagine; cambia
solo il nome.

## Traiettoria

Calcola una tabella completa di caduta/deriva/velocità/tempo di volo e un
grafico per il fucile, la cartuccia e il proiettile attivi (impostati in
**Armi**, sotto), usando un integratore RK4 a massa puntiforme.

**I parametri** partono dal fucile e dalla carica attivi, mostrati come un
breve riepilogo con un pulsante **Cambia** verso Armi, seguito da una
sezione Atmosfera e da alcune impostazioni specifiche di questa tabella e di
questo grafico:

- **Distanza massima** / **Passo di distanza** — fino a dove, e con quale
  incremento, viene calcolata la tabella.
- **Angolo linea di mira** — inclinazione del tiro (in salita/discesa), in
  gradi, positivo verso l'alto. Lascia a 0 per un tiro in piano.

**La tabella** mostra una riga per ogni passo di distanza, con colonne
attivabili (caduta, deriva, correzioni di elevazione/deriva in
click/mrad/MOA, velocità, tempo di volo, Mach, energia). La correzione di
elevazione è segnata in base a come si regola realmente un'ottica: un
proiettile caduto sotto la linea di mira viene mostrato come un numero
*positivo* di click da girare verso l'**alto**.

Puoi **scaricare la tabella come file CSV**, oppure **copiarla negli
appunti** in formato CSV — entrambe le opzioni usano esattamente le colonne
attualmente attivate e il separatore di campo/decimale impostato in
Impostazioni → Esportazione CSV (in modo che si apra correttamente con le
impostazioni internazionali del tuo foglio di calcolo).

**Il grafico** traccia una qualsiasi colonna rispetto alla distanza, con
zoom/scorrimento propri e indipendenti (trascina i due cursori di distanza
sottostanti — finestra minima di 50 m). Può essere **scaricato come SVG**
(la piccola icona sopra il grafico), un formato che non dipende da questa
app per essere visualizzato o modificato in seguito.

## Probabilità di colpire

Stima la probabilità di colpire un bersaglio per uno scenario di tiro
scelto, combinando il tuo fucile e la tua carica con la tua precisione di
tiro e l'incertezza nella stima di distanza, temperatura, pressione e
vento. **Ancora in sviluppo attivo** — sono previsti altri scenari e
bersagli; considera i risultati come indicativi, non come una previsione
certificata.

**Fucile e proiettile** mostra lo stesso riepilogo di Traiettoria — la
configurazione attiva impostata in **Armi**; usa **Cambia** per sceglierla o
modificarla.

**Incertezza** imposta l'ampiezza di ogni fonte di errore:

- **Errori propri** — costanza della velocità alla volata (deviazione
  standard), e in dettaglio la precisione dell'arma da banco + l'abilità del
  tiratore + la posizione di tiro, oppure un unico valore di precisione
  combinata semplificato (una dimensione di gruppo e la sua convenzione:
  ES-5, ES-10, R50 o R99).
- **Errori di condizione** — errore di stima di distanza, temperatura,
  pressione e vento; se **Bersaglio in movimento** è selezionato, anche la
  velocità laterale del bersaglio e il tuo errore nello stimarla.

**Simulazione** imposta la distanza, il bersaglio, l'atmosfera (temperatura,
pressione, altitudine, umidità), un azzeramento da combattimento opzionale
(fucile azzerato a una distanza diversa dal bersaglio) e uno scostamento del
punto di mira.

**Scenari:**

- **Colpo singolo** — un solo colpo; ogni fonte di errore proprio e di
  condizione si applica direttamente.
- **Colpo corretto da osservatore** — viene sparato un colpo di prova e il
  suo impatto viene comunicato da un osservatore, annullando in media lo
  scostamento sistematico; l'errore residuo del colpo corretto è la propria
  dispersione più l'imprecisione della correzione dell'osservatore. Gli
  errori di condizione non si ripresentano nel colpo corretto, poiché la
  comunicazione dell'osservatore tiene già conto del loro effetto sul colpo
  di prova.

**Bersagli** — una piastra 40 × 60 cm (una singola zona colpito/mancato) e
il bersaglio ISSF 300 m (dieci anelli di punteggio). Sono previsti altri
bersagli.

**I risultati** mostrano la probabilità di colpire totale, la probabilità
per zona, il punteggio come percentuale del massimo, una tabella del
contributo orizzontale/verticale/totale di ogni fonte di errore, e
un'illustrazione del bersaglio con una nuvola di impatti di esempio, il
punto medio di impatto e l'ellisse al 95% — scaricabile come SVG.

## Calcolatore per il poligono

Una soluzione rapida per una singola distanza: i valori da impostare per un
colpo, subito, abbastanza grandi da leggersi a distanza di un braccio o
sotto il sole diretto — non una tabella, non un'analisi. Il suo intero
obiettivo di progettazione è mostrare solo ciò che serve nel momento in cui
si regola l'ottica: nessuna intestazione, nessun elemento superfluo oltre a
una piccola navigazione, nessun numero che non si sta per usare.

Aprendolo, la normale navigazione dell'app viene sostituita dalla propria —
**Bersaglio**, **Vento**, **Atmosfera**, **Armi** (porta a Personalizzato/
Arsenale; "Fatto" riporta qui) ed **Esci dal calcolatore** (torna sempre
alla Home). Su un telefono o tablet che lo supporta, lo schermo viene
impedito di spegnersi finché il Calcolatore per il poligono è aperto, così
non si oscura a metà di una serie di colpi.

- **Bersaglio** — distanza e angolo della linea di mira. Deliberatamente
  solo questi due campi per ora; è previsto un modo bersaglio/posizione più
  completo che sostituirà questa scheda senza toccare Vento o Atmosfera.
- **Vento** — velocità (grande selettore +/−) e direzione (la stessa
  manopola usata altrove, qui ingrandita).
- **Atmosfera** — temperatura, pressione, altitudine, umidità e preimpostazioni
  — gli stessi campi di Traiettoria, senza il vento, che qui ha una scheda
  propria.

**Il risultato** si ricalcola in tempo reale a ogni modifica di un campo —
senza pulsante Calcola. Elevazione e vento vengono mostrati in click interi
(secondo le impostazioni di click del fucile attivo definite in Armi),
ciascuno preceduto da un indicatore di direzione: su/giù per l'elevazione,
sinistra/destra per il vento. Scegli tra una freccia o un segno **+ / −**
(Impostazioni → **Indicatori di output del Calcolatore per il poligono**) —
**+** significa sempre regolare verso l'alto o verso destra. Una piccola
riga in fondo aggiunge tempo di volo, velocità residua ed energia residua.
Se un campo è in fase di modifica (ad esempio momentaneamente vuoto), la
lettura mostra un semplice **—** invece di un risultato errato.

Usa lo stesso fucile, cartuccia e proiettile attivi di Traiettoria e
Probabilità di colpire (impostati in **Armi**) e lo stesso azzeramento —
qui non c'è un'impostazione separata di azzeramento da combattimento.

## Armi

Il fucile, la cartuccia e il proiettile usati da ogni strumento che ne ha
bisogno — attualmente **Traiettoria** e **Probabilità di colpire**. Ovunque
uno strumento abbia bisogno di questa configurazione, mostra un breve
riepilogo (nome, origine, velocità alla volata) con un pulsante **Cambia**
che porta qui; ciò che scegli o modifichi si applica ovunque e **persiste
dopo un riavvio**.

**Cambia** ti porta a quale dei due tab sottostanti corrisponde all'origine
del fucile attivo — **Arsenale** se è uno dei tuoi fucili salvati,
**Personalizzato** altrimenti. Su mobile, aprendo Armi la barra inferiore
viene sostituita da **Personalizzato** / **Arsenale** / **Fatto**; su
desktop, la barra laterale cambia allo stesso modo. **Fatto** ti riporta
allo strumento da cui sei arrivato.

### Personalizzato

Scegli un fucile integrato, uno dei tuoi fucili dell'Arsenale, oppure
inserisci un fucile e un proiettile interamente a mano — tutte e tre le
opzioni vivono nello stesso modulo. Alcuni campi meritano una spiegazione:

- **Distanza di azzeramento** — la distanza a cui il fucile è azzerato. Il
  motore calcola da sé l'angolo di lancio che porta il proiettile sulla
  linea di mira a questa distanza; l'angolo non si imposta manualmente.
- **Velocità alla volata in funzione della temperatura** — modella
  facoltativamente come la velocità alla volata di una cartuccia varia con
  la temperatura della polvere, invece di usare un valore fisso.
- **Resistenza del proiettile** — un coefficiente balistico (BC) con un
  modello di resistenza standard (G1, G7 e altri — vedi
  **Impostazioni**), oppure, per i proiettili di libreria che ne
  dispongono, una tabella Cd-Mach misurata direttamente (più
  precisa, senza BC).

**Aggiungi fucile all'arsenale** / **Aggiungi proiettile all'arsenale**,
accanto ai rispettivi campi, salvano la voce corrente nella tua libreria
Arsenale (sotto) per il riutilizzo.

### Arsenale

La tua libreria personale di fucili e proiettili, memorizzata solo su
questo dispositivo (archiviazione locale del browser) — nulla qui lascia
mai il tuo browser.

**Librerie integrate.** L'app include una libreria integrata di fucili e
proiettili comuni, mostrata accanto a tutto ciò che aggiungi tu stesso (le
tue voci personali sono contrassegnate da un "*" iniziale). Se non vuoi che
le voci integrate affollino i tuoi elenchi di selezione — ad esempio se usi
solo i tuoi dati personalizzati — **disattivale singolarmente in
Impostazioni → Generale** ("Mostra libreria fucili integrata" / "Mostra
libreria proiettili integrata"). Le tue voci salvate non sono influenzate in
nessuno dei due casi.

**Aggiungere e gestire le voci.** Aggiungi un proiettile completamente da
zero (nome, calibro, massa, BC/modello di resistenza o una tabella Cd-Mach
incollata) oppure copiando un proiettile integrato e modificandolo. Aggiungi
un fucile con la propria altezza ottica, distanza di azzeramento e valori
dei click, quindi collega una o più cartucce (ciascuna con il proprio
proiettile e la propria velocità alla volata). "Imposta attivo" su un
fucile lo rende la configurazione attiva ovunque, e ti riporta allo
strumento da cui hai aperto Armi.

I filtri per calibro e produttore riducono elenchi lunghi. Un proiettile o
un fucile modificato ma non ancora esportato mostra un badge "Non salvato".

**Salvare e caricare la libreria.** Poiché nulla risiede su un server, la
tua libreria è sicura quanto lo è l'archiviazione locale del tuo browser.
**Salva su file** (per singolo fucile/proiettile, oppure "Salva libreria…"
per un'esportazione a selezione multipla) scrive un file JSON che puoi
salvare come backup o trasferire su un altro dispositivo; **Carica
libreria…** lo reimporta, con una scelta per ciascun elemento su come
risolvere i conflitti di nome (sovrascrivi, sovrascrivi solo se più recente,
oppure mantieni entrambi).

**Confronto.** Contrassegna fino a due delle tue configurazioni
fucile+cartuccia salvate "per il confronto" (dalla riga di ciascun fucile).
Una volta contrassegnate due configurazioni, appare una sezione Confronto
con un grafico condiviso che traccia le traiettorie di entrambe le
configurazioni per la stessa colonna e la stessa finestra di distanza —
utile per confrontare direttamente due cariche, o due fucili. Come il
grafico di Traiettoria, ha zoom/scorrimento propri e può essere **scaricato
come SVG**.

## Strumenti BC

Calcola un coefficiente balistico da dati noti, oppure converte un BC tra
modelli diversi — raggruppati in un unico strumento con le schede
**Calcolo BC**, **Conversione BC** e **BC Labradar**. Il **Calcolo BC** e
**BC Labradar** sono già pienamente utilizzabili; la **Conversione BC** è
**ancora prevista**.

Il **Calcolo BC** ricava un coefficiente balistico da una coppia
velocità/distanza vicina e da una velocità lontana oppure da un tempo di
volo misurato tra le due distanze, più un modello di resistenza (G1/G7) e
l'atmosfera. Passa tra le modalità di inserimento **Velocità** e **Tempo di
volo** a seconda di cosa hai misurato (ad es. due letture al cronografo,
oppure una singola misura di tempo di volo su una distanza nota) — tutto il
resto (velocità vicina, entrambe le distanze, modello di resistenza,
atmosfera) resta invariato in entrambi i casi. Utile quando hai misurato
una perdita di velocità reale, o un tempo di volo reale, su una distanza
nota e vuoi il BC che lo spiega, invece di affidarti a un valore pubblicato.

**BC Labradar** calcola un BC per ogni colpo a partire da un'esportazione
del cronografo Labradar — uno **.zip** di file di traccia che il
dispositivo scrive sulla sua scheda SD, uno per colpo, registrando la
velocità circa ogni millisecondo durante il volo. Scegli un modello di
resistenza e l'atmosfera (qui non ci sono preimpostazioni — inserisci
direttamente la tua pressione di stazione/temperatura/umidità), poi scegli
lo zip; ogni traccia viene analizzata, ripulita dai punti rumorosi/errati e
adattata automaticamente per ottenere un BC. I file nello zip che non sono
vere tracce (il report o il file di progetto del dispositivo, o altri file
estranei) vengono ignorati. Due filtri regolabili scartano le tracce
inaffidabili prima che vengano mediate: una **soglia di qualità del
segnale** (quanto bene i punti ripuliti di una traccia seguono una retta) e
un **rigetto dei valori anomali** (quanto il BC di una traccia si discosta
dagli altri) — utile per escludere ad esempio una traccia captata da una
corsia di tiro vicina, o una in cui il radar ha semplicemente ricevuto un
segnale scadente. Fai clic sulla riga di una traccia per vedere il suo
grafico velocità-tempo, con i punti mantenuti e quelli scartati mostrati
separatamente, e deseleziona la casella di una traccia per escluderla
manualmente dal risultato medio (o riseleziona una traccia scartata dai
filtri automatici).

**Ricorda:** garbage in = garbage out (spazzatura in entrata, spazzatura
in uscita). L'atmosfera è *molto* importante. Se non conosci l'umidità,
imposta 50%. Un Kestrel va bene (anche se avrei preferito un termometro
più preciso). "Dati presi da Internet dalla presunta 'stazione meteo più
vicina'" non bastano. Assicurati *assolutamente* di usare la pressione
assoluta (detta anche pressione di stazione), e non un valore corretto
per l'altitudine (il Kestrel usa in modo fuorviante il termine
"barometric pressure" per indicare la pressione ridotta al livello del
mare — questa *non* è quella che vogliamo). In genere, se stai misurando
1000+ hPa a un'altitudine di 500 m o superiore (29,5 inHg e 1500 ft per i
nostri amici poco avvezzi al sistema metrico), probabilmente significa o
che stai leggendo il valore di pressione sbagliato (corretto anziché
assoluto/di stazione), oppure che la Fine del Mondo è più vicina del
previsto.

**Ricorda #2:** il Labradar ha un'impostazione chiamata "proj. offset";
definisce la distanza prevista tra la volata e il lato del radar.
Rispettala (con una tolleranza di -5 cm) — è importante! L'offset si
riferisce alla distanza dalla canna, *non* dalla volata; tienilo a mente
se la tua volata non è allineata con il radar, ma leggermente più avanti
o più indietro.

**Ricorda #3:** un colpo non fa primavera. Ne servono almeno 20 (per
munizioni da fabbrica decenti) per compensare gli errori. Proiettili
scadenti di surplus ne richiedono di più (conta almeno 30), mentre con
proiettili di alta qualità 10 colpi possono bastare. In generale, più
sono meglio è.

## Curva Cd-Mach

Ricava la curva di resistenza propria di un proiettile (Cd in funzione di
Mach) da una tabella distanza/velocità misurata — ad es. letture radar
Doppler o multi-cronografo —, risolvendo il coefficiente di resistenza
segmento per segmento invece di assumere una forma standard G1/G7.
Funziona meglio con una tabella poco densa (letture al cronografo ogni
~100 m); anche le tabelle dense (passi di 10-20 m) funzionano, ma l'errore
di arrotondamento di ogni riga pesa di più sul risultato di quel singolo
segmento.

**Tabella distanza / velocità** — incolla una coppia distanza/velocità per
riga (separate da tabulazione, spazio o punto e virgola; punto o virgola
decimale sono entrambi validi), almeno 3 righe. **Unità della tabella**
indica se i numeri incollati sono in **Moderne (m, m/s)** o **Arcaiche
(yd, fps)** — indipendentemente dalla tua preferenza di unità personale,
poiché le unità dei dati di origine non devono corrispondere a quelle che
preferisci vedere altrove nell'app.

Sotto la tabella: gli stessi campi di massa e calibro dell'Arsenale, e una
sezione **Atmosfera** indipendente (predefinita: atmosfera standard al
livello del mare) — il risolutore necessita di entrambi per simulare una
traiettoria sintetica su ciascun segmento e ricavare il Cd che riproduce
la perdita di velocità misurata.

**Calcola** produce due tabelle:

- **Interpolata** — la curva ricavata, riletta su un insieme fisso e denso
  di numeri di Mach di riferimento; è quella da usare in seguito (ad es.
  per il salvataggio nell'Arsenale).
- **Calcolata (grezza, per segmento)** — i valori per segmento
  sottostanti, prima dell'interpolazione, nascosti per impostazione
  predefinita (**Mostra tabella per segmento (calcolata)**).

Entrambe le tabelle possono essere **scaricate come CSV** o **copiate
negli appunti** (il separatore di campo/decimale di Impostazioni →
Esportazione CSV si applica anche qui). Un segmento che il risolutore non
è riuscito a usare — la velocità non è diminuita, la distanza non è
aumentata, oppure la risoluzione non è convergente — viene saltato ed
elencato, senza influire sul resto della tabella.

**Il grafico** traccia i punti Calcolata e la curva Interpolata, insieme
alle curve di riferimento G1 e G7 scalate per corrispondere alla curva
propria del proiettile a Mach 2.0 — un rapido riscontro visivo di quanto
la forma di resistenza di questo proiettile sia standard, o meno.
Scaricabile come SVG, come il grafico di Traiettoria.

**Salva nell'Arsenale** ti porta al modulo "Aggiungi proiettile"
dell'Arsenale, con massa, calibro e tabella Cd-Mach precompilati — scegli
**Calcolata (grezza, per segmento)** o **Interpolata (smussata)** come
sorgente accanto al pulsante. Attivo solo quando è disponibile un
risultato.

## Impostazioni

- **Lingua** — English, Français, Русский, Deutsch, Italiano.
- **Unità** — un'unità preferita per ogni tipo di misura (velocità,
  distanza, lunghezze ridotte, altitudine, temperatura, pressione,
  dispersione angolare, energia), mescolando liberamente metrico e
  imperiale; si applica ovunque compaia quella misura.
- **Librerie integrate** — mostra/nascondi le librerie integrate di fucili
  e proiettili (vedi **Armi** sopra).
- **Modelli balistici** — mostra/nascondi i singoli modelli di resistenza
  standard (G1, G7, ...) in ogni selettore di modello dell'app, per
  ridurlo a quelli che usi davvero. Un modello nascosto resta disponibile
  ovunque sia già selezionato (un proiettile inserito manualmente, il
  modello proprio di un proiettile di libreria) — nasconderlo influisce
  solo sulle scelte future, mai su una già fatta. Almeno un modello deve
  restare sempre visibile.
- **Tema** — scelta tra tre miniature illustrate, applicata ovunque
  immediatamente: **Scuro** (predefinito), **Alto contrasto chiaro** (sfondo
  bianco, testo nero — per la massima visibilità sotto il sole diretto) e
  **Alto contrasto scuro** (sfondo nero con testo e colori al massimo
  contrasto — per quando serve alzare la luminosità dello schermo per
  vederlo all'aperto, risparmiando allo stesso tempo la batteria).
- **Indicatori di output del Calcolatore per il poligono** — se la lettura
  elevazione/vento del Calcolatore per il poligono mostra una freccia di
  direzione o un segno **+ / −** (vedi **Calcolatore per il poligono**
  sopra).
- **Esportazione CSV** — il separatore di campo (virgola/punto e
  virgola/tabulazione) e il separatore decimale (punto/virgola) usati dal
  download e dalla copia CSV di Traiettoria. Scegli la coppia attesa dal
  tuo foglio di calcolo.

---

## Pianificato / in corso

Elencati nella Home ma non ancora utilizzabili:

- **Calcolatore di precisione dell'arma** — misurare la precisione dell'arma
  usando immagini di bersagli con impatti.

Ricontrolla quando saranno disponibili.
