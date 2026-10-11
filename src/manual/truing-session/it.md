# geladen.ch ballistics Manuale utente — Sessione di taratura

*Parte della* [suite geladen.ch ballistics](https://bc.geladen.ch)*. Sperimentale.*

---

## 1. Prima di iniziare: vi serve questo strumento?

Il fucile e l'app non sono d'accordo: impostate ciò che l'app prevede, e il proiettile arriva altrove. L'errore da solo non dice perché. Una velocità alla volata sbagliata, un BC sbagliato, uno zero spostato, un cannocchiale che rende meno del valore di click dichiarato e una lettura del vento sbagliata possono produrre tutti lo stesso errore. Questo strumento pianifica una breve sessione che distingue queste cause, vi guida nel tiro e riporta ciò che ha trovato. Quando due cause non si possono separare, lo dice.

È l'ultimo passo della messa a punto di un fucile, non il primo. Non può decifrare un fucile di cui non sapete nulla, e da solo non vi porterà al tiro a distanze estreme. Ogni incognita che portate nella sessione le costa precisione su tutte le altre.

### 1.1 Prima le basi

1. **Velocità alla volata e sua deriva con la temperatura.** Misurate al cronografo almeno 10 colpi dello stesso lotto e inserite la media in Arsenale, con la temperatura a cui l'avete misurata. Per la deriva, ripetete in un giorno più caldo o più freddo di almeno 15 °C (27 °F) e inserite la variazione per grado. Lasciate prima che le munizioni raggiungano la temperatura dell'aria, tenetele al riparo dal sole e non lasciate una cartuccia in una camera calda prima di sparare. Le derive tipiche vanno da 0,5 a 2 m/s per °C. Una deriva sbagliata significa una velocità sbagliata in ogni giorno diverso da quello della misura: 10 m/s di errore, appena 10 °C a 1 m/s per °C, a 800 m sembrano un errore di BC del 4,6 %.
2. **Altezza di mira entro 2–3 mm (0,1").** Misuratela dall'asse della canna all'asse del cannocchiale. Non usate un valore tipico per gli attacchi. Un errore qui pesa di più vicino all'arma e si scambia facilmente per un errore di zero.
3. **Il vostro zero.** Verificatelo il giorno stesso con una vera rosata, sparata in piano e senza vento. Il Calcolatore di precisione dell'arma mostra con quanta precisione una rosata individua il punto d'impatto. Una sola rosata di tre colpi spesso lo individua meno bene di quanto si pensi.
4. **Tracking del cannocchiale (valore di click).** Fate un test tall-target, o la versione breve: a distanza nota, impostate un numero noto di click tra due colpi e misurate di quanto si sposta l'impatto (1 mm per metro di distanza è 1 mrad). Un cannocchiale sbagliato del 2 % sulla distanza sembra un BC sbagliato.
5. **Un BC o una curva di resistenza affidabili.** Usate un BC G7 misurato con radar Doppler o una curva Cd-Mach propria, non un numero dalla scatola. Un BC G1 per una palla boat-tail lunga è un compromesso che vale solo per una parte del volo. Se il produttore pubblica più BC per fasce di velocità, la scheda «BC multipli» degli Strumenti BC li combina in una curva di resistenza.

La pagina «Prepara» di questo strumento ha la stessa lista, più la dispersione del vostro fucile e la dispersione di velocità. Spuntare una voce dice al pianificatore che quella causa è già sistemata, così le dedica meno colpi e ne dedica di più a quelle ancora aperte. Fatta bene, questa preparazione elimina la maggior parte dei disaccordi tra fucile e app prima di qualsiasi taratura. Dopo, il BC dovrebbe essere l'unica vera incognita rimasta.

### 1.2 Se potete, misurate il BC direttamente

Ci sono due modi diretti per misurare un BC, e ciascuno è di solito almeno preciso quanto una sessione di taratura:

- **Un Labradar originale** che scrive un file di traccia per ogni colpo sulla sua scheda SD. [Labrabaco NG](#/manual/bc-labradar) (negli Strumenti BC) adatta un BC a ogni traccia registrata.
- **Due cronografi**, uno alla volata e uno più avanti, inseriti nella scheda «Calcolo BC» degli Strumenti BC. Posizionate l'apparecchio lontano in modo che un colpo basso non possa colpirlo, e proteggetelo con qualcosa di solido.

### 1.3 Quando passare alla taratura

Usate questo strumento quando le basi sono fatte e non potete misurare il BC direttamente. È anche un buon modo per controllare un BC già misurato.

---

## 2. Cosa può dirvi una sessione

### 2.1 Perché una sessione pianificata e non il vostro registro di tiro

Qualche registrazione a qualche distanza sembra bastare per adattare tutto. Non basta. Velocità alla volata, resistenza e tracking del cannocchiale cambiano la traiettoria quasi allo stesso modo alle distanze di tiro abituali. Aggiungere rosate dello stesso tipo non le separa. L'adattamento può distinguerle solo se qualcos'altro ne fissa una: un cronografo, un test tall-target o un secondo bersaglio a una distanza scelta apposta per separarle. Queste distanze le sceglie lo strumento per voi.

### 2.2 Con un cronografo, e senza

Un cronografo è la cosa più preziosa che potete portare. Un errore di velocità e un errore di resistenza curvano la traiettoria quasi allo stesso modo, quindi i colpi da soli non li distinguono. Il cronografo misura la velocità direttamente, nell'aria del giorno e alla temperatura della polvere del giorno, e lascia la resistenza come unica grande incognita.

- **Con un cronografo** che riporta ogni colpo man mano (un radar Doppler o un apparecchio montato alla volata), una sessione su un campo fino a circa 800 m misura la resistenza di una .308 al ±1,5–2 % con 20–30 colpi. È il voto A, e lo strumento propone di salvare il risultato nella vostra cartuccia. Una correzione del BC richiede almeno cinque letture del cronografo registrate durante la sessione.
- **Senza cronografo** lo strumento non propone mai una correzione del BC. La resistenza dipenderebbe allora interamente dalla velocità media misurata un altro giorno, e nulla nella sessione può verificare quella media. A 800 m, un errore di 1 m/s su di essa sposta il risultato della resistenza di circa lo 0,5 %. La pagina «Prepara» può comunque dare voto A a un piano del genere; il §8.8 spiega perché quel voto non basta per un BC. Se non avete verificato nemmeno la media, la sessione si ferma al voto C qualunque sia il numero di colpi, poco meglio del BC pubblicato. In entrambi i casi ottenete comunque alzi corretti per le distanze sparate e un controllo dello zero. Valgono solo per quelle distanze e per un'aria simile.

Senza cronografo, una sessione è **molto** meno utile. Se potete farvene prestare uno, fatelo. Il campo conta quasi altrettanto: su un campo che finisce a 600 m, anche con cronografo e preparazione completa una .308 non supera il voto B (vedi §8.8).

### 2.3 I voti

La pagina «Prepara» valuta il piano prima del primo colpo, e la pagina «Conclusione» valuta il risultato. Il voto deriva dall'incertezza sul fattore di resistenza (una deviazione standard):

| Voto | Incertezza sulla resistenza | Cosa ottenete |
|---|---|---|
| **A** | fino al 2 % | Una vera correzione del BC, valida ad altre distanze e con altro tempo. |
| **B** | 2–3 % | Una correzione del BC con una banda ampia. Lo strumento vi lascia salvarla, ma fidatevene solo vicino alle distanze e alle condizioni in cui avete sparato. |
| **C** | 3–4 % | Poco più del BC pubblicato. Nessuna correzione del BC. |
| **D** | oltre il 4 % | Alzi corretti per le distanze sparate, e nessuna conclusione sul BC. |

Prima di qualsiasi colpo, lo strumento assume che il BC sia sbagliato di circa il 4 %. Una sessione con voto D quindi non ha imparato quasi nulla sulla resistenza che non fosse già assunto.

**Solo il voto A dà un risultato trasferibile ad altre distanze e ad altro tempo.** Con B e sotto, la sessione ha misurato l'effetto combinato di tutte le cause, a quelle distanze e in quell'aria. È utile per quelle distanze, ma non dice quanta parte dell'effetto venga dal BC.

### 2.4 Limiti

- **Solo supersonico.** Ogni bersaglio pianificato è abbastanza vicino perché il proiettile sia ancora sopra Mach 1,1. Questa versione non tratta il volo transonico né subsonico.
- **Lo strumento non tara la velocità alla volata dagli impatti.** La velocità è un dato che avete misurato. Una lettura del cronografo durante la sessione la corregge, ma lo strumento non ricava mai una velocità dai soli alzi. Sposterebbe soltanto l'errore su un'altra causa.
- **Sperimentale.** La statistica è stata verificata su sessioni simulate con errori noti inseriti di proposito, ma lo strumento è stato finora poco usato sul campo. Considerate una correzione del BC come un forte indizio da verificare, non come un valore definitivo.

---

## 3. Prepara

### 3.1 Fucile, postazione e meteo

Lo strumento usa il fucile e la cartuccia attivi dall'Arsenale e la postazione di tiro attiva. Non ha un proprio selettore di fucile.

Tiene i propri dati meteo, e nulla di ciò che inserite in un altro strumento li modifica. Inserite la **pressione di stazione**, cioè ciò che legge un barometro sul campo. Un telefono o un'app meteo dà di solito la pressione ridotta al livello del mare (QNH), e quel valore qui è sbagliato. Se la postazione ha un'altitudine, lo strumento vi avvisa quando la pressione sembra un QNH. Leggete la temperatura sul campo con un'approssimazione di circa 3 °C. L'umidità conta poco.

Confermate le condizioni prima di iniziare. Da quel momento restano fissate come aria di partenza della sessione, così un cambio di meteo fatto altrove in seguito non può alterare colpi già sparati. Una correzione del BC presuppone che queste condizioni fossero giuste, perché una temperatura o una pressione sbagliata finisce nel termine di resistenza. La pagina «Conclusione» ve lo ricorda.

Lo zero si assume impostato in piano, senza vento e nell'atmosfera di zero della cartuccia, se l'Arsenale ne indica una. Altrimenti si usa l'aria di partenza della sessione. Se avete azzerato un altro giorno o a un'altra quota, impostate l'atmosfera di zero nell'Arsenale. Conta soprattutto per zeri a 200 m o più, e quasi per nulla per zeri a 100 m o meno.

### 3.2 Preparazione

La lista copre le voci del §1.1: zero riverificato il giorno stesso, valore di click testato, altezza di mira misurata, velocità media verificata. Mostra anche la dispersione del fucile e la dispersione di velocità dall'Arsenale, o un valore predefinito se l'Arsenale non ne ha. Nessuna voce è obbligatoria, ma ogni voce non spuntata è una causa che la sessione deve misurare con i propri colpi.

Spuntate una voce solo se l'avete fatta davvero. Le bande di incertezza e il voto considerano fatta ogni voce spuntata. Per lo zero e la velocità media, l'adattamento confronta inoltre le spunte con i colpi, e la pagina «Conclusione» segnala quando i colpi ne contraddicono una. Il valore di click non si può verificare dai colpi. Una spunta sbagliata lì lascia di solito l'errore reale fuori dalla banda indicata.

### 3.3 Bersagli e piano

Lo strumento verifica se i bersagli registrati sono abbastanza lontani da dire qualcosa sulla resistenza e trova la migliore coppia di bersaglio vicino e lontano per questa cartuccia. Se non arrivano abbastanza lontano, o se nulla è vicino alla distanza di zero, chiede una volta se avete un riferimento naturale da misurare col telemetro, come una roccia o il bordo di un terrapieno.

Indicate anche quanto vento vi aspettate: debole o moderato, oppure forte (il limite è circa 5 m/s, 11 mph, 18 km/h). Influisce solo sul piano e sul numero di colpi. Sul campo impostate il vento reale per ogni rosata.

La casella «Questo campo è piatto» non viene mai spuntata al posto vostro. Una postazione non può distinguere un campo piatto da uno di cui nessuno ha misurato la pendenza. Spuntatela solo se lo sapete. Disattiva i controlli di pendenza per questa sessione e non scrive angoli da nessuna parte. Se il campo in realtà non è piatto, una pendenza esclusa può essere scambiata per una distanza sbagliata o una resistenza sbagliata.

Se correggete qui la distanza o l'angolo di un bersaglio, la correzione vale solo per questa sessione e la postazione non cambia. Alla sessione serve la distanza dal parapalle su cui vedete gli impatti, che può differire da quella del bersaglio. Per modificare la postazione stessa, usate la gestione postazioni.

### 3.4 Colpi

Fissate il numero totale di colpi, compresi i gradini di sicurezza della scala. Portatene il 20–25 % in più per i colpi che l'osservatore non vede e per i colpi palesemente anomali. Il piano mette un colpo alla distanza più vicina e divide il resto tra una distanza intermedia e il bersaglio lontano. La ripartizione è scelta per separare le cause quanto contano alla vostra distanza massima e per raggiungere il voto A sulla resistenza. Il piano mostra come i colpi di ogni distanza si dividono in serie di al massimo tre.

Sotto il campo lo strumento propone quattro numeri di colpi per questo campo e la vostra preparazione, ciascuno con il voto che dà:

- **Minimo**: il minor numero di colpi che resta entro il 10 % dell'incertezza ottimale sulla resistenza;
- **Ottimale**: il punto oltre il quale altri colpi rendono molto meno;
- **Potenziato**: dieci in più dell'ottimale, per un risultato sensibilmente più stretto;
- **Deluxe**: venti in più dell'ottimale, per il risultato più stretto.

Premendone uno si crea il piano per quel numero. Sono minimi che contano solo i colpi di cui vedete l'impatto; portatene quindi di più. Ogni miglioramento proposto dallo strumento (un cronografo, più colpi, un controllo dello zero, un bersaglio più lontano) è mostrato con il risultato che darebbe, accanto a quello attuale.

### 3.5 Rimisurare il bersaglio lontano

Prima di iniziare, lo strumento vi chiede di misurare di nuovo il bersaglio lontano. Misuratelo più volte col telemetro e controllate che il raggio non agganci qualcosa davanti al bersaglio. Se il campo non è dichiarato piatto, misuratene anche l'angolo con l'inclinometro.

È il minuto più importante della sessione. Il risultato dipende dalla distanza lontana più che da qualsiasi altra cosa, e i colpi non possono quasi verificarla, perché un bersaglio più lontano di quanto pensate sembra esattamente un proiettile con un BC più basso. Una distanza lontana sbagliata di 20 m lascia tipicamente il risultato sbagliato di circa 0,3 mrad su quel bersaglio, circa 30 cm a 1000 m, e lo strumento non può segnalarlo.

Usate un parapalle alto almeno 2 m (1 m sopra e sotto il punto di mira). Con 1 m, circa una sessione su tre perde un impatto fuori; con 2 m, solo poche su cento.

---

## 4. Spara

### 4.1 La scala

Lo strumento parte vicino e si allontana un gradino alla volta, solo dopo che il gradino precedente è arrivato sul parapalle. Un'ipotesi sbagliata nell'app potrebbe mandare un primo colpo lontano ben fuori da un parapalle distante, e la scala evita questo rischio. Un gradino arriva al massimo a quattro volte la distanza più lontana su cui una rosata è già arrivata. Un gradino più lungo è ammesso solo se non resta nulla di più vicino e la previsione dice che il colpo arriverà ancora sul parapalle. Prima del primissimo colpo, lo strumento avvisa se quel colpo rischia di mancare il parapalle e propone invece la distanza di zero. Potete comunque proseguire.

Se non vedete dove è arrivata una serie, premete il pulsante apposito («Non riesco a vedere dove ha colpito»). È un esito normale, e un'informazione utile. Lo strumento torna indietro circa a metà strada e, appena lì è arrivata una rosata, ritenta la distanza mancata con l'alzo corretto. Finché sotto restano distanze non provate, una distanza mancata di nuovo resta in gioco (fino a cinque colpi non visti lì). Se non si può sparare nulla di più vicino, una rosata in più su una distanza già raggiunta sblocca il nuovo tentativo. Un colpo non visto così lontano che solo un BC grossolanamente sbagliato può spiegarlo porta la scala ad ammettere un errore di quella grandezza nel cammino verso il bersaglio lontano. A 800 m su un parapalle di 2 m, il BC di una .308 dovrebbe essere sbagliato di circa il 20 %. I colpi non visti più vicini vengono attribuiti ad altre cause. Se i colpi non visti si ripetono, verificate prima che BC e modello di resistenza della cartuccia corrispondano alla fonte pubblicata, poi lo zero, la velocità alla volata e la pressione inserita.

Se la prossima distanza pianificata è più di quattro volte la più lontana già raggiunta, o se il parapalle è troppo piccolo per essa, lo strumento dice quale delle due. Solo allora chiede una distanza intermedia; un riferimento naturale va bene, e potete rispondere «Nessuno disponibile». Su una postazione senza terreno intermedio la scala può fermarsi prima del bersaglio lontano, e la pagina «Prepara» ve lo segnala in anticipo.

### 4.2 Ogni serie

Sparate serie di al massimo tre colpi e registrate dopo ciascuna, perché nessuno legge in modo affidabile il centro di una dozzina di impatti a 800 m. Il primo passaggio visita ogni distanza pianificata una volta, la più vicina per prima. Dopo, ogni serie va alla distanza con più colpi rimasti (la più lontana in caso di parità), e ciascuna è impostata dall'adattamento più recente. Non potete scegliere l'ordine.

Prima di ogni serie lo strumento mostra cosa impostare, alzo e deriva, nell'unità e con i segni di direzione scelti per il Calcolatore per il poligono, con una banda al 95 %. Finché nulla è registrato è la previsione dell'app stessa; dopo viene dall'adattamento. Impostatela per intero. Poi registrate l'**alzo che porterebbe gli impatti sul punto di mira**: ciò che avete impostato, corretto per la posizione degli impatti nel reticolo. Inserite l'alzo completo, non solo la differenza rispetto al numero dello strumento. Gli alzi si inseriscono in click del cannocchiale (positivo verso l'alto). Tutte le altre distanze, velocità e angoli seguono le unità delle Impostazioni, e l'indicazione mostra anche i click quando il Calcolatore per il poligono è in mrad o MOA.

Potete registrare una serie come centro (un solo alzo) o colpo per colpo (un alzo per colpo e, con il cronografo, la sua velocità). Se il cronografo ha dato meno velocità dei colpi sparati, lo strumento chiede se completarle o proseguire. Lo strumento non scarta i colpi anomali: se un colpo è palesemente anomalo (uno strappo evidente, una raffica, uno sgancio sbagliato), non registratelo e sparatene un altro al suo posto. È a questo che serve il 20–25 % in più. Un valore che non può ragionevolmente essere giusto riceve un avviso accanto al campo: mrad inseriti al posto dei click, la differenza invece dell'alzo completo, un segno sbagliato, una cifra mancante, una velocità nell'unità sbagliata. L'avviso è solo un consiglio, e il valore viene registrato come inserito.

Per ogni serie indicate anche quanto bene avete letto gli impatti nel reticolo:

- **Buona** (±0,1 mrad, predefinita): impatti chiari, letti sul reticolo.
- **Discreta** (±0,2 mrad): miraggio, parapalle confuso o impatti visti a metà.
- **Scarsa** (±0,3 mrad): un'idea approssimativa di dove sono arrivati.

Siate onesti. Uno «Scarsa» onesto aiuta l'adattamento più di una stima troppo sicura.

### 4.3 Vento e aria

Ogni rosata ha il proprio vento, impostato sul selettore del vento. Parte dal vento della rosata precedente (calma per la prima). L'indicazione per il colpo successivo segue il selettore mentre lo ruotate. **Prima di registrare una rosata, impostate il vento (intensità e direzione) che corrisponde alla deriva effettivamente osservata.** Lo strumento prevede la deriva dal vento impostato, ma non impara nulla dalla posizione laterale degli impatti.

Con il vento indicate quanto bene lo leggete: Eccellente (±0,5 m/s), Buona (±1), Discreta (±2) o Scarsa (±3). Lo strumento considera sempre la direzione incerta di 7,5°. Vento e affidabilità passano alla rosata successiva finché non li cambiate.

Se l'aria cambia durante la sessione, spuntate che è cambiata e inserite ciò che legge la vostra stazione meteo tascabile. Le rosate successive mantengono i nuovi valori finché non li cambiate di nuovo. Le letture del cronografo di ogni rosata sono confrontate con la velocità che la cartuccia ha nell'aria di quella rosata.

### 4.4 Rimisurare durante la sessione

Se lo strumento sospetta che la distanza o l'angolo di un bersaglio sia sbagliato, vi chiede di rimisurarlo e, a meno che il campo sia piatto, di misurarne l'angolo. Una distanza sbagliata e una pendenza non misurata sembrano uguali nei colpi; solo l'angolo le distingue. Lo strumento lo chiede appena c'è circa una probabilità su cinque che qualcosa non vada, perché rimisurare richiede pochi secondi, e un bersaglio misurato male è l'errore che i colpi distinguono meno da una resistenza sbagliata.

Prima della vostra prima serie sul bersaglio lontano pianificato, chiede sempre questo controllo. Potete farlo anche voi in qualsiasi momento con «Rimisura» accanto a distanza e angolo del bersaglio attuale. «Conferma» corregge ogni serie già sparata lì e l'impostazione per la successiva. «Annulla» lascia tutto com'era.

### 4.5 L'indicazione dal vivo

Dopo ogni rosata lo strumento mostra ciò che ha imparato finora. È provvisoria, e una rosata successiva può cambiarla, per questo è mostrata diversamente dal rapporto finale. Finché una lettura del cronografo o un colpo ben piazzato non le separa, mostra «velocità alla volata, resistenza — non ancora separabili, finora» invece di tirare a indovinare.

---

## 5. Conclusione

Il risultato è un elenco ordinato di riscontri, non un verdetto unico. Ogni riscontro mostra quanto è probabile che conti alla vostra distanza d'impiego massima e quanto è grande, con il suo margine. Quando due cause non si possono separare, vengono riportate insieme.

- **Resistenza (BC).** Con voto A o B e almeno cinque letture del cronografo della sessione, lo strumento propone di salvare la correzione nella vostra cartuccia (il §2.3 dice quanto fidarsi di una B). Prima di confermare vedete i valori prima e dopo la modifica. Un risultato a più di circa il 12 % dal BC in uso, o un fattore di guadagno fuori da 0,8–1,2, non viene mai proposto. Lo strumento vi chiede allora di verificare BC e modello di resistenza e mostra il BC adattato a titolo informativo.
- **Zero.** Una correzione dello zero viene riportata solo se conta molto probabilmente. Se conta solo forse, vedete «possibile, ma non ancora chiaro»; non cambiate lo zero solo per questo.
- **Alzi per le distanze sparate.** Quando non viene proposta alcuna correzione del BC, ottenete la modifica da impostare a ogni distanza sparata, ma solo quando supera la propria incertezza. Una correzione più piccola è solo il rumore di poche rosate, e applicarla può lasciarvi peggio di prima.
- **Velocità alla volata.** Appena il cronografo ha dato la prima lettura, le letture della sessione prevalgono sulla media verificata prima. Quella media è stata misurata un altro giorno, forse con altro tempo o un altro lotto. Se la velocità misurata differisce da quella della cartuccia, l'elenco dice quanti colpi misurare al cronografo per fissare la media a circa ±2 m/s.
- **Non determinato.** Una causa che la sessione non ha potuto misurare è elencata come «non determinato da questa sessione», mai come nella norma. Il valore di click è l'esempio tipico: solo un test tall-target o con righello lo risolve.

L'elenco ripete anche le voci di preparazione che avete spuntato, per ricordare che le bande presuppongono che ciascuna sia stata davvero fatta.

«Inizia una nuova sessione» cancella la sessione e mantiene le vostre scelte di valori predefiniti.

### 5.1 Un risultato implausibile

Una correzione della resistenza di decine di punti percentuali, o una velocità sbagliata di centinaia di metri al secondo, non è un riscontro sottile. Significa che qualcosa di più basilare non va, di solito un BC implausibile sul proiettile o il modello di resistenza sbagliato (G1 inserito per un BC misurato in G7, o il contrario). Verificate BC e modello della cartuccia con la fonte pubblicata prima di fidarvi di qualsiasi altra cosa della sessione. Una sessione che ha mancato il parapalle a più distanze indica lo stesso problema.

---

## 6. Il fattore di guadagno BC

Una correzione della resistenza tarata viene salvata nella **cartuccia** come «fattore di guadagno BC», 1,00 per impostazione predefinita. Un fattore di 1,05 significa che il proiettile si comporta come se il suo BC pubblicato fosse più alto del 5 % (meno resistenza, traiettoria più tesa); 0,95 significa il contrario. Appartiene alla cartuccia e non al proiettile, perché lo stesso proiettile sparato da un altro fucile a un'altra velocità ha una resistenza leggermente diversa. I dati pubblicati del proiettile non vengono modificati.

Una volta salvato, ogni strumento dell'app (Traiettoria, Calcolatore per il poligono, Probabilità di colpire e questo) usa il valore corretto. Tarare una cartuccia una seconda volta moltiplica la nuova correzione per la prima invece di sostituirla, e la seconda sessione parte dalla stessa ipotesi del 4 % della prima.

---

## 7. Privacy

Tutto funziona e resta sul vostro dispositivo, come il resto dell'app: nessun account, nessun caricamento, nessuna telemetria. La sessione è conservata nella memoria locale del browser. Lo strumento scrive altrove solo quando lo scegliete voi: un fattore di guadagno BC o una nuova dispersione di velocità nella vostra cartuccia. Una distanza o un angolo corretti durante una sessione non vengono mai scritti nella postazione.

---

## 8. La gioia del nerd: il modello, la statistica e le salvaguardie

Questa sezione descrive cosa calcola lo strumento, perché lo calcola così e da dove vengono i numeri. Non vi serve per usare lo strumento. Le unità sono quelle del motore: metri, metri al secondo, milliradianti. Gli esempi numerici riguardano una .308 di riferimento: BC G7 0,2623, 792 m/s, altezza di mira 50 mm, zero a 100 m, aria ICAO al livello del mare. Con questo caricamento il proiettile scende a Mach 1,1 verso 870 m.

### 8.1 La grandezza osservata e il modello

L'unica cosa che lo strumento misura sul bersaglio è l'**alzo**: l'elevazione, in mrad, che porta il centro di una serie sul punto di mira. La deriva è prevista dal vento impostato e vi viene mostrata, ma non entra nell'adattamento. Uno scarto laterale porta tutto l'errore di lettura del vento, molto più grande di qualsiasi cosa potrebbe rivelare sulle quattro cause qui sotto.

Un alzo alla distanza presunta $R$ sul bersaglio $t$ è modellato come

$$c(R) = c_\text{app}\big(R + \Delta R_t;\; v_0 + \delta v,\; G\,/\,(1 + \delta d/100),\; \alpha_t\big) \;+\; z \;+\; \tfrac{\tau}{100}\,c_\text{app}(R) \;+\; \varepsilon$$

dove $c_\text{app}$ è la soluzione di traiettoria dell'app stessa (lo stesso integratore di tutti gli altri strumenti) nell'aria e nel vento di quella rosata. I termini sono:

| Simbolo | Nome nel motore | Cos'è | Entra come |
|---|---|---|---|
| $z$ | `zeroMrad` | scostamento dello zero | costante aggiunta a ogni distanza |
| $\delta v$ | `v0Ms` | errore di velocità alla volata, m/s | sommato a $v_0$ nella fisica |
| $\delta d$ | `dragPct` | fattore di resistenza, % | divide il fattore di guadagno BC $G$ nella fisica |
| $\tau$ | `trackPct` | errore del valore di click, % | proporzionale all'alzo |
| $\Delta R_t$ | `rangeErrM_t` | errore di distanza del bersaglio $t$, m | per bersaglio, solo nel controllo degli errori grossolani (§8.10) |
| $u_t$ | `losU_t` | pendenza non registrata del bersaglio $t$, $u = 1-\cos\alpha$ | per bersaglio, solo nel controllo degli errori grossolani |
| $\varepsilon$ | | rumore della serie | gaussiano, $\sigma$ dal §8.5 |

$\delta d > 0$ significa più resistenza di quanta ne preveda il BC in uso. Il salvataggio moltiplica il fattore di guadagno della cartuccia per $1/(1+\delta d/100)$, così una seconda taratura si somma alla prima. Il fattore di resistenza passa per il fattore di guadagno e non per `bc` stesso, perché 247 dei 385 proiettili della libreria sono tabelle Cd-Mach e non hanno un `bc` da scalare.

$\delta v$ e $\delta d$ sono non lineari e agiscono dentro la traiettoria. $z$ e $\tau$ vengono aggiunti dopo. Altezza di mira, densità dell'aria e vento non vengono adattati. Sono dati in ingresso, e un errore su uno di essi finisce nelle quattro cause, come mostra il §8.2.

Lo zero è un unico angolo di canna per tutta la sessione. Viene risolto una volta, in piano e senza vento, nell'atmosfera di zero della cartuccia, con i $\delta v$ e $\delta d$ adattati, così una variazione di uno dei due sposta lo zero esattamente come sul fucile. Vento, pendenza e aria di una rosata compaiono allora nel suo alzo e non spostano lo zero.

### 8.2 Perché le cause sono così difficili da distinguere

L'adattamento è linearizzato attorno alla stima corrente. L'influenza di ogni causa su un alzo è una colonna della jacobiana: la variazione dell'alzo per unità di quella causa a ogni distanza. Per la .308 di riferimento:

| Distanza | alzo | per m/s di $v_0$ | per % di resistenza | per % di click | per m di distanza | per m/s di vento (qualsiasi direzione) |
|---|---|---|---|---|---|---|
| 200 m | 0,66 | −0,0024 | 0,0014 | 0,0066 | 0,0084 | 0,0003 |
| 300 m | 1,58 | −0,0050 | 0,0041 | 0,0158 | 0,0101 | 0,0007 |
| 400 m | 2,66 | −0,0081 | 0,0084 | 0,0266 | 0,0116 | 0,0015 |
| 500 m | 3,89 | −0,0116 | 0,0150 | 0,0389 | 0,0132 | 0,0028 |
| 600 m | 5,29 | −0,0157 | 0,0244 | 0,0529 | 0,0150 | 0,0048 |
| 700 m | 6,88 | −0,0205 | 0,0377 | 0,0687 | 0,0171 | 0,0076 |
| 800 m | 8,69 | −0,0262 | 0,0562 | 0,0869 | 0,0196 | 0,0116 |
| 900 m | 10,78 | −0,0331 | 0,0816 | 0,1078 | 0,0226 | 0,0174 |

(tutto in mrad; la colonna dello zero vale 1 ovunque)

Due colonne si distinguono solo nella misura in cui le loro **forme** differiscono sulle distanze sparate. La loro grandezza non conta, perché un parametro può sempre scalare per adattarsi. Il coseno tra due colonne misura proprio questo: ±1 significa che sono identiche a meno di un fattore. Su 300, 600 e 800 m:

- velocità contro resistenza: **−0,987**;
- valore di click contro resistenza: **0,987**;
- valore di click contro velocità: **−0,99993**;
- zero contro resistenza: 0,80.

Valore di click e velocità sono quasi perfettamente collineari. Un errore di click dell'1 % e un errore di velocità con lo stesso alzo sono praticamente la stessa curva. Per questo la sessione riporta il valore di click come «non determinato» e lo lascia a un test tall-target. Il prior dello 0,15 % dopo un tale test gli impedisce di assorbire ciò che velocità e resistenza non spiegano.

Velocità e resistenza differiscono di poco, e in modo noto: la colonna della resistenza cresce con la distanza più in fretta di quella della velocità, perché la resistenza agisce per tutto il tempo di volo, mentre un errore di velocità agisce soprattutto attraverso la partenza. L'errore di velocità che imita l'1 % di resistenza è 0,6 m/s a 200 m, 1,0 m/s a 400 m, 1,6 m/s a 600 m e 2,1 m/s a 800 m. Solo questo rapporto variabile separa le due cose, ed è piccolo. Per questo un piano ha bisogno di un bersaglio lontano, per questo più colpi a una sola distanza non aiutano, e per questo un cronografo, che fissa $\delta v$ direttamente, è la leva singola più forte.

Lo zero è una costante, quindi un bersaglio vicino alla distanza di zero, dove ogni altra colonna è nulla, lo misura quasi da solo. Per questo il piano include sempre un colpo vicino alla distanza di zero.

Anche ogni dato che fornite finisce in queste quattro cause. Espresso come la variazione di resistenza che produrrebbe lo stesso alzo a quella distanza:

| Errore d'ingresso | a 300 m | a 600 m | a 800 m |
|---|---|---|---|
| velocità +10 m/s | −12,2 % | −6,3 % | −4,6 % |
| valore di click 2 % | 7,7 % | 4,3 % | 3,1 % |
| zero 0,1 mrad | 24,5 % | 4,1 % | 1,8 % |
| altezza di mira +3 mm | −4,9 % | −1,0 % | −0,5 % |
| distanza +20 m | 49,9 % | 12,4 % | 7,0 % |
| pendenza di 10° non inserita | −9,8 % | −3,7 % | −2,4 % |
| temperatura +3 °C | −0,9 % | −0,9 % | −0,9 % |
| pressione +10 hPa | 1,0 % | 1,0 % | 1,0 % |

Le ultime due righe sono costanti per un motivo preciso. La forza di resistenza è proporzionale alla densità dell'aria, quindi un errore dell'1 % sulla densità è *esattamente* un errore dell'1 % sulla resistenza a ogni distanza (a parte un piccolo effetto attraverso la velocità del suono). La sessione non può accorgersi affatto di una temperatura o di una pressione sbagliate e le passa direttamente al BC. Per questo lo strumento insiste sulla pressione di stazione e avvisa sul QNH (§8.13), e per questo la pagina «Conclusione» ricorda che la correzione del BC presuppone l'aria che avete inserito.

La riga della distanza spiega il §3.5. A 800 m, 20 m di errore di distanza valgono il 7 % di resistenza, più dell'intero prior. Solo un secondo bersaglio vicino potrebbe accorgersene, e nemmeno allora in modo affidabile.

### 8.3 Due obiettivi: previsione e attribuzione

Una sessione serve due obiettivi, e il motore li tratta in modo diverso.

**Previsione**: l'alzo a una data distanza in una data aria. La sua incertezza è la varianza predittiva $J(R)^\top\Sigma J(R)$, che dipende solo dalla combinazione di cause che la colonna $J(R)$ vede.

**Attribuzione**: quanto è grande ciascuna causa. La sua incertezza è la varianza marginale $\Sigma_{ii}$, e la sua separazione dalle altre è la correlazione a posteriori.

Quando due cause sono quasi collineari (§8.2), l'a posteriori è un'ellisse lunga e stretta. La combinazione che i colpi vedono è stretta; quella che non possono vedere è larga circa quanto il prior. Alle distanze sparate, $J(R)$ è quasi trasversale all'asse lungo, quindi la previsione è buona anche quando l'attribuzione è scarsa. Fuori da quelle distanze, $J(R)$ ruota verso l'asse lungo e la previsione peggiora. Un piano fino a 600 m con 20 colpi per la .308 di riferimento:

| | dev. std. resistenza | dev. std. velocità | dev. std. alzo a 300 m | 600 m | 800 m | 1000 m |
|---|---|---|---|---|---|---|
| prima della sessione (solo prior) | 4,1 % | 20 m/s | 0,27 | 0,42 | 0,63 | 0,99 |
| nessuna preparazione, senza cronografo | 3,85 % | 10,0 m/s | 0,06 | 0,07 | 0,16 | 0,33 |
| nessuna preparazione, con cronografo | 3,20 % | 1,3 m/s | 0,06 | 0,06 | 0,15 | 0,32 |
| preparazione completa, con cronografo | 2,91 % | 1,3 m/s | 0,05 | 0,06 | 0,14 | 0,31 |

(deviazioni standard dell'alzo in mrad)

Senza cronografo, la sessione migliora l'alzo a 600 m di sei volte e il fattore di resistenza quasi per nulla. Il cronografo cambia appena gli alzi previsti alle distanze sparate, ma riduce l'incertezza sulla velocità di quasi otto volte. La previsione i colpi la danno quasi gratis; l'attribuzione è ciò per cui la sessione va progettata.

I due obiettivi possono anche dare risposte contraddittorie che nei dati sembrano identiche. Una velocità di 10 m/s inferiore a quella registrata, assorbita da una variazione del BC del 6,4 %, coincide esattamente a 600 m. È poi sbagliata di 0,11 mrad a 800 m, di 0,16 mrad a 800 m in una giornata a −10 °C, e di 0,35 mrad a 1000 m. I residui dell'adattamento non lo mostrano, perché a 600 m l'attribuzione sbagliata e quella giusta prevedono lo stesso alzo.

**Cosa fa il motore per la previsione.** Il valore da impostare prima di ogni serie e la tabella degli alzi nella conclusione sono previsioni, ciascuna con la propria deviazione standard predittiva (§8.14). Il controllo di sicurezza della scala è una previsione alla distanza successiva (§8.12). Nessuno di questi ha bisogno di cause separate.

**Cosa fa il motore per l'attribuzione.** Gran parte dei meccanismi di questa sezione esiste per questo obiettivo:

- *Il piano valuta l'attribuzione, non la previsione.* L'obiettivo (§8.9) somma varianze marginali $\Sigma_{ii}$, ciascuna misurata dopo aver tenuto conto delle altre cause, quindi un disegno che lascia confuse due cause ottiene un punteggio cattivo su entrambe. Un pianificatore orientato alla previsione minimizzerebbe $J(R)^\top\Sigma J(R)$ alle distanze a cui sparate e metterebbe lì i suoi colpi.
- *Una geometria scelta per separare.* Un colpo vicino alla distanza di zero, dove solo la colonna dello zero è diversa da zero. Il bersaglio lontano il più vicino possibile a Mach 1,1 che la postazione consenta, dove la colonna della resistenza differisce di più da quella della velocità. Un piano deve andare oltre i 300 m quando la postazione lo consente, così da non poter ottenere un buon punteggio sparando solo dove tutto è facile.
- *Misure dirette per le cause collineari.* Il cronografo osserva $\delta v$ direttamente (§8.6), quindi la coppia velocità–resistenza non deve più essere distinta dalla forma. Un test tall-target fa lo stesso per il valore di click, quasi esattamente collineare con la velocità (coseno −0,99993).
- *Cause adattate anche quando non vengono riportate.* Un valore di click testato resta nell'adattamento con il suo prior dello 0,15 %. Toglierlo lascerebbe attribuire alla resistenza ogni errore residuo di tracking (§8.4).
- *Gli errori sul campo hanno spiegazioni proprie.* Un bersaglio misurato male o in pendenza è un'ipotesi concorrente per ogni bersaglio (§8.10), così da non poter essere attribuito alla resistenza. I bersagli vengono decisi insieme, così una causa comune non viene attribuita a un solo bersaglio. La misura dell'angolo rompe l'esatta degenerazione tra distanza e pendenza.
- *Una preparazione dubbia allarga il risultato.* Uno zero o una velocità media spuntati che i colpi contraddicono allargano il risultato (§8.11) invece di spingere la discrepanza su un'altra causa.
- *Le cause inseparabili vengono riportate insieme.* Le cause con correlazione a posteriori superiore a 0,8 vengono riportate come un unico contributo combinato, mai come riscontri separati di singole cause (§8.14).
- *Il ritorno verso il prior non è una misura.* Una causa con risoluzione inferiore a 0,2 è «non determinata», mai «nella norma» (§8.14). Un piccolo valore adattato significa poco quando è stato il prior a metterlo lì.
- *Un riscontro sulla velocità richiede letture.* Senza letture del cronografo, una velocità adattata è solo l'errore di un'altra causa spostato sulla velocità, e viene riportata come non determinata.
- *Il BC viene scritto solo se l'attribuzione è riuscita.* Cioè almeno cinque letture del cronografo, voto A o B, un risultato entro 3σ dal prior e un fattore di guadagno compreso tra 0,8 e 1,2 (§8.13). «Prepara» e «Conclusione» condividono questa regola, così un piano non promette mai un BC che la conclusione rifiuterebbe.
- *Ciò che nessun colpo può attribuire viene protetto all'inserimento.* La densità dell'aria è esattamente collineare con la resistenza (§8.2), quindi una pressione o una temperatura sbagliate non si possono separare dopo. Per questo esistono il controllo del QNH e la nota sulle condizioni presupposte.

**Dove i due obiettivi divergono nel motore.**

- *I colpi vanno dove le colonne differiscono, non dove sparerete.* Gli alzi alle distanze intermedie risultano comunque buoni, perché la previsione all'interno dell'intervallo sparato costa poco.
- *Il prior di resistenza allargato dopo un colpo non visto serve la scala e i valori da impostare, non la conclusione* (§8.12). Un prior allargato dopo un colpo non visto prevede meglio il nuovo tentativo, ma usato per l'attribuzione farebbe abbassare il voto da un singolo impatto non visto.
- *La tabella degli alzi viene proposta solo quando non lo è una correzione del BC.* Quando l'attribuzione riesce, la cartuccia corretta prevede ogni distanza e la tabella non aggiunge nulla. Quando fallisce, la tabella è la parte del risultato che vale ancora, e solo alle distanze sparate.
- *I riscontri vengono giudicati a $R_\text{max}$.* L'attribuzione viene riportata in base alle sue conseguenze sulla previsione alla vostra distanza d'impiego massima (§8.14), così una causa reale ma irrilevante viene elencata come non rilevante anziché come un riscontro.

### 8.4 I prior

L'adattamento è bayesiano: ogni causa parte da un prior normale a media nulla, e i colpi lo restringono.

| Causa | Non verificata | Dopo la preparazione |
|---|---|---|
| zero | 0,25 mrad | 0,08 mrad (zero riverificato) |
| velocità | 20 m/s | $t_{N-1}\cdot \text{SD}/\sqrt{10}$ (media verificata) |
| resistenza | 4,1 % | 4,1 % |
| valore di click | 1 % | 0,15 % (test tall-target) |

**Resistenza.** Due parti indipendenti si sommano in quadratura. I BC G7 pubblicati differiscono dal BC che meglio riproduce la curva di resistenza di riferimento di ciascun proiettile del 3,6 % RMS (56 proiettili di tre produttori). Lo stesso proiettile, misurato allo stesso modo, varia di circa l'1,9 % da canna a canna. $\sqrt{3.6^2+1.9^2}\approx 4.1\,\%$. Si usa l'RMS e non la deviazione standard, così lo scostamento medio di ciascun produttore conta come dispersione invece di essere dichiarato come una distorsione nota. Il campione è troppo piccolo per dire qualcosa sulla forma della distribuzione. Una miscela di BC «tipici» e «anomali» adattata su di esso dava bande troppo sicure ogni volta che gli errori veri erano normali, perciò il prior è un'unica normale con l'ampiezza tratta dai dati. Con la varianza giusta e un modello quasi lineare, un prior normale mantiene oneste le bande dichiarate qualunque sia la forma vera. Una cartuccia già tarata parte dallo stesso prior, perché un fattore di guadagno è una correzione e non una misura più affidabile del valore pubblicato.

**Velocità.** Una media verificata vale come dieci colpi alla dispersione registrata della cartuccia. La deviazione standard registrata è a sua volta una stima, perciò l'errore standard viene allargato dal fattore di Student $t_{0.975,N-1}/z_{0.975}$, dove $N$ è il numero di colpi dietro la deviazione standard: lo inserite voi, oppure si assume 10 per una deviazione standard salvata nell'Arsenale. Il fattore vale 1,15 con $N=10$ e 1,42 con $N=5$. Una deviazione standard predefinita non viene allargata, perché la sua incertezza riguarda se valga del tutto per il vostro fucile, cosa che la statistica dei piccoli campioni non copre. Con una deviazione standard di 6 m/s e $N=10$ il prior vale 2,2 m/s.

**Valore di click.** Un valore di click testato viene comunque adattato con il suo prior dello 0,15 %, ma non viene riportato. Lasciarlo fuori dall'adattamento farebbe finire ogni errore residuo di tracking nella resistenza: in una simulazione Monte Carlo di sessioni complete, la banda al 95 % della resistenza mancava allora la verità circa un terzo di punto percentuale più spesso. Con il valore di click adattato, la banda la mancava nel 5,0 % dei casi.

### 8.5 Il rumore

Il $\sigma$ verticale di un colpo ha tre parti indipendenti:

$$\sigma_\text{round}^2 = \left(\frac{R_{50}}{1.1774}\right)^2 + \left(\frac{\partial c}{\partial v_0}\,\text{SD}_v\right)^2 + \sigma_\text{read}^2$$

la dispersione del fucile (R50 convertito in un $\sigma$ per asse), la dispersione di velocità da colpo a colpo moltiplicata per la sensibilità dell'alzo alla velocità a quella distanza, e la lettura. La parte di velocità è nulla alla distanza di zero e vale 0,16 mrad a 800 m con 6 m/s di dispersione, vicina al σ per asse di un fucile che spara R50 = 0,25 mrad (0,21 mrad). I livelli di affidabilità della lettura sono semiampiezze al 95 %, quindi $\sigma_\text{read}$ vale 0,05, 0,1 o 0,15 mrad.

Una serie di $n$ colpi legge la loro media. Il suo errore di vento si aggiunge:

$$\sigma_\text{string}^2 = \frac{\sigma_\text{round}^2}{n} + \sigma_\text{wind}^2, \qquad \sigma_\text{wind}^2 = \left(\frac{\partial c}{\partial w}\,\sigma_w\right)^2 + \left(\frac{\partial c}{\partial \phi}\,\sigma_\phi\right)^2$$

con $\sigma_w$ l'affidabilità del vento indicata (0,5, 1, 2 o 3 m/s), $\sigma_\phi = 7.5°$ ed entrambe le derivate calcolate per differenze finite attorno al vento impostato. Sotto 0,5 m/s una direzione non significa nulla, quindi la sensibilità è l'RMS delle sensibilità al vento frontale e al vento laterale, applicata all'intero errore d'intensità. L'errore di vento appartiene alla serie: non diminuisce con i suoi colpi, e gli errori delle diverse serie sono indipendenti. Nell'adattamento non c'è un'incognita di vento comune. Il vento è un disturbo, non una causa.

Le serie sono limitate a tre colpi, perché un osservatore legge il centro di più impatti a distanza molto peggio di quanto prometta $1/\sqrt n$. Le serie di una distanza si leggono insieme come una sola serie di tutti i suoi colpi, salvo che il termine di vento cala con il numero delle serie. Il pianificatore ripartisce quindi i colpi per distanza, e le serie decidono solo come vengono sparati.

Prima che sia stato letto un vento, il piano usa l'intensità prevista: moderato è 3 ± 1 m/s, forte è 7 ± 2 m/s, direzione ignota. Allora $\sigma_\text{wind} = W_\text{rms}\sqrt{\sigma_w^2 + (w\,\sigma_\phi)^2}$, con $W_\text{rms}$ la colonna per qualsiasi direzione del §8.2.

**La dispersione di velocità stessa.** La deviazione standard in questi pesi non è semplicemente quella registrata. Dalla seconda lettura del cronografo in poi, viene combinata con la dispersione del giorno secondo i gradi di libertà:

$$\hat\sigma_v^2 = \frac{(N_0-1)\,\text{SD}_0^2 + (n-1)\,s^2}{N_0+n-2}$$

$N_0$ è il numero di colpi indicato, oppure 5 se non è indicato. Il valore combinato vale come $N_0+n-1$ colpi. Ogni lettura viene prima confrontata con la velocità della cartuccia nell'aria della propria rosata, e lo scostamento medio viene tolto, così un cambio di tempo o una media sbagliata non contano come dispersione. Le serie già registrate vengono ripesate a ogni nuovo valore. Oltre dieci letture, un test F bilaterale al 5 % ($s^2/\text{SD}_0^2$ contro $F_{n-1,\,N_0-1}$) decide se la dispersione del giorno è davvero diversa. Se lo è, lo strumento lo dice e propone di aggiornare la cartuccia. Il test F guida solo questa segnalazione. La combinazione avviene comunque e non cambia nulla quando la deviazione standard registrata è giusta.

### 8.6 Il cronografo

Le letture di ogni rosata formano un'osservazione diretta di $\delta v$. Il residuo è (lettura media − velocità della cartuccia nell'aria di quella rosata), e il suo $\sigma$ è $t_{0.975,N-1}/z\cdot\hat\sigma_v/\sqrt n$, la stessa forma del prior di velocità. Un colpo che l'apparecchio ha mancato è semplicemente una lettura in meno.

Dalla prima lettura in poi, le letture della sessione sostituiscono la media verificata come informazione sulla velocità. La media è stata misurata in un'altra occasione e può essere sbagliata per una polvere sensibile alla temperatura o un altro lotto. Le letture portano la propria incertezza, ampia con una o due letture. Sono state confrontate soglie da una a cinque letture, con un cronografo che mancava la maggior parte dei colpi. Una sola lettura lasciava l'errore più piccolo ogni volta che la media verificata era sbagliata, e costava al massimo un millesimo di mrad quando era giusta. La stessa informazione non viene mai contata due volte, come prior più stretto e come osservazione insieme.

### 8.7 L'adattamento

La stima è il punto di massimo a posteriori (MAP) di

$$-\log p(\theta\mid y) = \tfrac12\sum_k \frac{r_k(\theta)^2}{\sigma_k^2} + \tfrac12\sum_i\frac{\theta_i^2}{\sigma_{0,i}^2} + \text{const}$$

trovato con Gauss-Newton. Ogni iterazione rilinearizza la fisica al $\theta$ corrente, costruisce $A = P_0 + J^\top W J$ e $b = J^\top W r - P_0\theta$, e avanza di $A^{-1}b$. Si ferma quando ogni passo è sotto l'1 % della deviazione standard del prior della causa, o dopo cinque iterazioni. La covarianza $\Sigma = A^{-1}$ viene da un'ultima linearizzazione nella soluzione, che fornisce anche, senza costo aggiuntivo, un ulteriore passo di Newton. Applicarlo rende la risposta precisa ben oltre la tolleranza di arresto, che l'iterazione sia partita a freddo o a caldo.

Dopo ogni rosata, la soluzione dell'analisi precedente è il punto di partenza (avvio a caldo). Ha due iterazioni. Se non è arrivata a convergenza, l'adattamento riparte da zero, così la risposta non dipende mai dal punto di partenza.

Il residuo di una riga del cronografo o di una rimisura viene rilinearizzato come ogni altro: $r = (\bar v - v_\text{expected}) - \delta v_\text{current}$. Usare il residuo grezzo a ogni iterazione aggiungerebbe la stessa correzione a ogni passaggio. Quando il cronografo si discosta molto dal valore registrato, come per due sessioni dello stesso fucile a circa 20 °C di distanza, questo diverge fino a più volte il valore giusto.

La colonna della resistenza è una differenza centrata su ±1 %. L'alzo è curvo rispetto al fattore di resistenza, quindi un passo unilaterale di +5 % leggerebbe a 800 m una pendenza più ripida del 2,7 % di quella locale, e l'adattamento dichiarerebbe la resistenza più stretta di quanto la conosca: in una simulazione Monte Carlo di sessioni complete, la sua banda al 95 % mancava la verità nel 5,7 % dei casi con il passo unilaterale, contro il 5,2 % con quello centrato.

### 8.8 Cosa può risolvere una sessione

Risultati del pianificatore per la .308 di riferimento (R50 0,25 mrad, dispersione di velocità 6 m/s, vento moderato). I numeri sono la deviazione standard a posteriori del fattore di resistenza, con il voto:

| Campo | Preparazione | Cronografo | 12 colpi | 20 colpi | 30 colpi | 40 colpi |
|---|---|---|---|---|---|---|
| 100/300/600 m | nessuna | no | 3,88 C | 3,85 C | 3,83 C | 3,82 C |
| 100/300/600 m | nessuna | sì | 3,43 C | 3,22 C | 3,01 C | 2,85 B |
| 100/300/600 m | completa | sì | 3,01 C | 2,81 B | 2,62 B | 2,46 B |
| 100/300/500/800 m | nessuna | no | 3,68 C | 3,66 C | 3,64 C | 3,63 C |
| 100/300/500/800 m | zero + click | no | 3,65 C | 3,48 C | 3,37 C | 3,29 C |
| 100/300/500/800 m | nessuna | sì | 2,49 B | 2,18 B | 1,98 A | 1,86 A |
| 100/300/500/800 m | completa, media verificata | no | 1,95 A | 1,77 A | 1,60 A | 1,49 A |
| 100/300/500/800 m | completa | sì | 1,93 A | 1,70 A | 1,49 A | 1,35 A |

Cosa mostra la tabella:

- **Senza cronografo né media verificata non funziona nulla.** Con un prior di velocità di 20 m/s, la correlazione velocità–resistenza resta a 0,7–0,9, e 40 colpi non fanno meglio di 12. La resistenza si muove appena dal suo prior del 4,1 %.
- **La distanza batte il numero di colpi.** Con preparazione completa e cronografo, 40 colpi fino a 600 m danno il 2,5 %. Dodici colpi fino a 800 m danno l'1,93 %. Per questa .308 a 600 m, la colonna della resistenza somiglia ancora troppo a quella della velocità.
- **La riga «media verificata, senza cronografo» è voto A sulla carta**, eppure lo strumento non propone per essa alcuna correzione del BC. Il piano prende la media con la sua incertezza dichiarata, ma quella media viene da un altro giorno. Una deriva con la temperatura sbagliata, un altro lotto o un cronografo stanco la spostano, e a 800 m ogni m/s passa direttamente nella resistenza come 0,5 %. Nulla nella sessione può vedere uno spostamento del genere. Le cinque letture del cronografo sono l'unica informazione misurata nella stessa aria e alla stessa temperatura della polvere dei colpi, e quindi l'unica che attribuisce l'alzo alla velocità anziché alla resistenza nelle condizioni del giorno.

Altri due numeri della pagina «Prepara» vengono dallo stesso a posteriori. La **distanza lontana richiesta** è il bersaglio lontano più vicino al quale una rosata vicina e una lontana raggiungono una data deviazione standard della resistenza. La **soglia di invalidità** è la distanza lontana sotto la quale nemmeno una lettura precisa quanto un click (σ = 0,1/√12 mrad), con un numero qualsiasi di colpi, può portare la resistenza sotto il 4 %. Sotto quella soglia nessun piano sfugge al voto D, e la pagina lo dice.

### 8.9 Il pianificatore

Il piano è progettato per l'attribuzione (§8.3): valuta la varianza propria di ciascuna causa, non l'alzo previsto. Per un disegno (un insieme di distanze e i colpi su ciascuna), l'a posteriori è quello del modello linearizzato al BC in uso:

$$\Sigma^{-1} = P_0 + \sum_g \frac{J_g J_g^\top}{\sigma_g^2}$$

Il pianificatore minimizza

$$\sum_i \min\!\left(\frac{\Sigma_{ii}}{s_i^2},\; 4.5\right)$$

dove $s_i$ è la grandezza oltre la quale la causa $i$ conta. Per zero, velocità e valore di click è la grandezza che sposta l'alzo di 0,1 mrad alla distanza utile più lontana. Per la resistenza è il 2 %, il limite del voto A. Ogni termine è la varianza a posteriori di una causa dopo aver tenuto conto delle altre, quindi un disegno che lascia confuse due cause ottiene un punteggio cattivo su entrambe. Il tetto di 4,5 (circa il doppio della grandezza rilevante) significa che una causa che resta indeterminata non guadagna nulla da piccoli miglioramenti, così i colpi vanno dove possono cambiare un verdetto. Una causa fissata dalla preparazione ha un prior stretto e poco da guadagnare, il che libera colpi per le altre. Fare la preparazione non può mai peggiorare un piano.

Fino a tre rosate, la varianza di ogni causa ha una forma chiusa. Con $q_i$ le varianze del prior, $u_i$ la colonna della causa $i$ sulle distanze del disegno, $G_{gh}=\sum_i q_i u_{g,i}u_{h,i}$ e $M = G + \operatorname{diag}(\sigma_g^2)$:

$$\Sigma_{ii} = q_i - q_i^2\, u_i^\top M^{-1} u_i$$

Basta un'inversa 3×3, quindi ogni ripartizione dei colpi viene enumerata. I disegni con più rosate (gradini della scala) vengono ripartiti in modo goloso e poi migliorati con scambi a coppie. Solo il vincitore riceve l'a posteriori esatto. I gradini di cui un disegno ha bisogno si trovano percorrendo la scala stessa, con l'a posteriori dopo ogni passo. I candidati sono limitati a dodici: il più vicino, il più lontano e i dieci più vicini al punto di Mach 1,1. Se la postazione ha qualcosa oltre i 300 m, il piano deve raggiungerlo. Senza questa regola, senza cronografo e senza zero verificato, un piano che spara tutti i colpi alla distanza di zero potrebbe ottenere un punteggio buono quanto uno che impara poco al bersaglio lontano, e non tarerebbe nulla.

I gradini della scala ricevono un colpo ciascuno: sono controlli di sicurezza, non misure, e tre colpi per gradino non portavano nulla in simulazione. I quattro numeri di colpi proposti vengono dalla deviazione standard della resistenza pianificata su una griglia di budget da 6 a 60 colpi. La curva viene prima resa non crescente, perché un budget più grande può sempre essere speso come uno più piccolo e un avvallamento è un artefatto del pianificatore. Con entrambi gli assi riportati a 0–1, il numero ottimale è il punto più lontano sotto la retta dal primo budget all'ultimo: il ginocchio, tipicamente 16–32 colpi (18–24 con cronografo su un campo con molti bersagli). Il numero minimo è il più piccolo la cui deviazione standard della resistenza resta entro il 10 % di quella ottimale. Potenziato e Deluxe aggiungono 10 e 20 colpi. Quando passare da 6 a 60 colpi migliora la deviazione standard della resistenza di meno del 10 %, la pagina dice che il limite sono la preparazione e le distanze, non i colpi.

Il vento di pianificazione e le letture del cronografo previste entrano esattamente come entreranno nell'adattamento, così la previsione della pagina «Prepara» e il risultato finale concordano su quanto vale ogni elemento.

### 8.10 Bersagli misurati male e in pendenza

Un errore di distanza e una pendenza trascurata sono i due errori sul campo che i colpi distinguono meno da una resistenza sbagliata. Ogni bersaglio riceve quindi una scelta a tre esiti, confrontati in base all'evidenza:

| Esito | Termini aggiuntivi | Peso a priori |
|---|---|---|
| corretto | $\Delta R_t \sim N(0,\;0.002R)$ | 0,9 |
| misurato male | $\Delta R_t \sim N(0,\;20\text{ m})$ | 0,05 |
| in pendenza | $\Delta R_t \sim N(0,\;0.002R)$, $u_t \sim N(0,\;u(20°))$ | 0,05 |

Quando l'esito «in pendenza» non è proposto (vedi sotto), «misurato male» prende tutto lo 0,1.

Il σ dello 0,2 % di «corretto» è la precisione di una lettura laser dopo l'arrotondamento al metro del display. Dopo che il bersaglio è stato rimisurato, i pesi diventano 0,98 / 0,01 / 0,01 (o 0,98 / 0,02). Un bersaglio sbagliato è allora molto meno probabile, ma non escluso: più letture sullo stesso oggetto identificato male concordano comunque tra loro. La seconda lettura entra come osservazione di $\Delta R_t$ con il σ di «corretto». La divisione in parti uguali tra i due tipi di errore è una convenzione, non una misura. Non c'è alcuna base per mettere un errore del telemetro sopra una pendenza non registrata.

**La pendenza è parametrizzata con u, non in gradi:** $u = 1-\cos\alpha$. Una pendenza vi fa sempre impostare meno che in piano, in salita come in discesa, e l'effetto cresce come $1-\cos\alpha$, in modo quadratico vicino a zero. Una colonna in gradi è esattamente nulla in $\alpha=0$, e un adattamento linearizzato non riesce a partire da lì. Misurata sulla .308 a 600 m, la pendenza numerica vicino a zero risultava $+4.1\times10^{-4}$, $-2.8\times10^{-5}$ e $-9.0\times10^{-4}$ mrad/° per passi di 0,5, 1 e 2°: nemmeno con un segno coerente, perché è rumore del risolutore in un punto stazionario. In $u$ l'effetto è quasi lineare: effetto/$u$ varia di un fattore 1,08 tra 10° e 30°, mentre effetto/grado varia di un fattore 28. Il σ del prior è $u(20°) = 0.060$, scelto direttamente in $u$. Convertire un «σ = 8°» in $u$ renderebbe una pendenza di 20° un evento a 6σ, perché $u$ è convessa nell'angolo. Con $u(20°)$, una pendenza di 15° sta a 0,56σ e una di 30° a 2,2σ.

Due regole escludono in partenza le ipotesi impossibili. Un $u<0$ adattato significherebbe una pendenza che fa impostare di più, quindi riceve peso nullo. E l'esito «in pendenza» viene proposto solo se il residuo del bersaglio è negativo (avete impostato meno del previsto) e il suo angolo non è stato misurato. Un angolo misurato, piano compreso, rende la pendenza un valore noto. Una scheda di postazione non distingue «confermato piano» da «mai misurato», perché entrambi sono salvati come 0°. Perciò solo una misura con l'inclinometro fatta durante la sessione, o la dichiarazione «Questo campo è piatto», toglie il termine.

Per una sola rosata, errore di distanza e pendenza sono **esattamente** degeneri: a 700 m una pendenza di 20° e un errore di distanza di −25,1 m spostano entrambi l'alzo di −0,418 mrad. Un terzo esito «entrambi insieme» dividerebbe arbitrariamente il peso tra due spiegazioni che i dati non possono separare, quindi non esiste. Solo una misura d'angolo separa le due, ed è per questo che ogni rimisura chiede anche l'inclinometro. Un bersaglio viene segnalato in base alla somma di «misurato male» e «in pendenza», mai in base a uno solo.

**Confronto tra modelli.** Ogni combinazione di esiti viene adattata, e la sua evidenza è approssimata con il metodo di Laplace nel proprio punto MAP:

$$\log p(y) \approx \log p(y\mid\theta^*) + \log p(\theta^*) + \tfrac p2\log 2\pi - \tfrac12\log|A|$$

Il peso a posteriori di una combinazione è proporzionale a (peso a priori) × (evidenza). Le combinazioni vengono fuse in un'unica gaussiana con la legge della varianza totale:

$$\bar\theta = \sum_k w_k\theta_k,\qquad \Sigma = \sum_k w_k\big(\Sigma_k + (\theta_k-\bar\theta)(\theta_k-\bar\theta)^\top\big)$$

Una combinazione il cui adattamento è sfuggito verso un valore non finito viene scartata. Succede con un prior di resistenza ampio, più bersagli autorizzati a essere sbagliati insieme e troppo poche rosate per fissarli. I numeri riportati vengono sempre da questo adattamento fuso, mai da un adattamento semplice con una segnalazione aggiunta dopo: segnalare un bersaglio non corregge da solo i numeri.

L'evidenza in forma chiusa di un modello lineare, linearizzato una sola volta in $\theta = 0$, qui non vale, perché il modello viene rilinearizzato a ogni iterazione. Provata su sessioni pulite senza alcun errore grossolano, quella scorciatoia favoriva «errore grossolano» a circa il 90 % ogni volta. La forma di Laplace qui sopra è scritta in un unico punto e condivisa da ogni confronto dello strumento.

**Insieme, non uno alla volta.** Due bersagli vicini in distanza hanno quasi la stessa sensibilità a una grande causa comune, come una deriva con la temperatura non corretta. Controllati uno alla volta, ciascuno fa sembrare sbagliato l'altro. In un caso costruito per provocarlo, il controllo uno alla volta dava il 99,5 % e il 98,6 % di «errore grossolano» al vero colpevole e al suo vicino innocente a 5 m. La decisione congiunta dava il 99,5 % e il 13,7 %, con la stessa stima finale.

L'enumerazione congiunta esatta cresce in modo esponenziale con il numero di bersagli $k$ (fino a $3^k$ combinazioni). Misurato con due esiti per bersaglio, il costo cresceva di circa 2,2× per bersaglio: 0,24 s per 4 bersagli, 9,4 s per 8, e un campo con 12 bersagli è stato interrotto dopo due minuti. Perciò ogni bersaglio viene prima preselezionato uno alla volta (circa 7 ms ciascuno). I quattro più sospetti vengono poi enumerati insieme, e le combinazioni con più di due bersagli sbagliati contemporaneamente vengono escluse. Con i pesi dopo la rimisura, tre sbagliati su quattro hanno una massa a priori di circa $3\times10^{-5}$. Su 585 analisi reali, l'elenco della conclusione, il voto e l'insieme «niente di rilevante» erano identici con e senza quel tetto, a una velocità 1,5 volte maggiore. La preselezione può sbagliare solo includendo un vicino innocente, mai mancando il colpevole, perché il residuo comune deve pur finire su un bersaglio e quello vero mantiene la sua parte. Su una scala di sette bersagli e su una disposizione sfavorevole con bersagli a 600/610, 750/760 e 860/870 m, il colpevole è sempre entrato nella preselezione, e i numeri della preselezione coincidevano con l'enumerazione completa entro un decimo di punto, in circa un ottavo del tempo.

Un bersaglio viene segnalato, e chiesta una rimisura, appena il suo peso «qualcosa non va» supera il 20 %. In simulazione, una soglia del 50 % non scattava quasi mai. Al 20 % scatta circa una sessione su dieci e migliora sia i valori da impostare sia la stima della resistenza. Rimisurare richiede pochi secondi.

### 8.11 Verifica delle spunte di preparazione

Uno zero o una velocità media spuntati non vengono presi sulla parola. Ciascuno diventa una scelta a due esiti nella stessa enumerazione: il prior verificato con peso 0,9, quello non verificato (0,25 mrad, 20 m/s) con 0,1. Se i colpi contraddicono una spunta, il risultato fuso si allarga invece di spingere la discrepanza su un'altra causa. La pagina «Conclusione» nomina una spunta appena il suo peso «non ha tenuto» supera il 50 %. La spunta della velocità decade appena subentra il cronografo della sessione (§8.6). Il valore di click non viene verificato così. I colpi non dicono quasi nulla su di esso (§8.2), e ogni asse aggiuntivo raddoppia il calcolo.

### 8.12 La scala e i colpi non visti

Ogni gradino deve superare due controlli.

1. **La previsione.** Lo scarto previsto alla distanza successiva, $z\,\sigma_c\,R/1000$ metri con $\sigma_c=\sqrt{J^\top\Sigma J}$ la deviazione standard predittiva dell'alzo in mrad, deve restare entro la metà dell'altezza del parapalle (1 m su un parapalle di 2 m). $z$ vale 2, e 3 dopo qualsiasi colpo non visto.
2. **Il tetto.** Un gradino può arrivare al massimo a 4 volte la distanza più lontana su cui una rosata è davvero arrivata. Prima che arrivi la prima rosata, non si fa alcun gradino basato sulla sola previsione: la scala parte dalla distanza disponibile più vicina.

La previsione da sola non basta, perché è costruita sul modello assunto: misura l'incertezza *dentro* quel modello e non può vedere che il modello ha la forma sbagliata. Con i soli prior e nessun colpo, ha approvato un primo colpo a 800 m per un proiettile assunto G1 ma in realtà G7, prevedendo uno scarto di al massimo 1,59 m a 2σ. Lo scarto reale su un parapalle di 2 m era di 3,70 m. Il tetto non deve nulla al modello. Un tetto di 2× bloccava ogni sessione sulle disposizioni 100/300/600 m e 100/300/600/900 m dopo la prima rosata. 3× eliminava questi blocchi, e 4× ammette un salto di quattro volte. Quando sotto il tetto non resta nulla, è ammessa la distanza più vicina oltre di esso se supera la previsione a 3σ. Misurato sui gradini della simulazione, il 99° percentile dello scarto reale era di circa 3σ, anche con un modello di resistenza volutamente sbagliato.

Il primissimo colpo viene controllato a parte: lo scarto previsto con i soli prior, a 3σ. Se può uscire dal parapalle, lo strumento propone la distanza di zero e vi lascia proseguire consapevolmente.

**Un colpo non visto** è una prova concreta che il modello è sbagliato a quella distanza, cosa che nessuno dei due controlli può vedere. Lo strumento:

1. torna alla distanza disponibile più vicina al punto medio tra l'ultima raggiunta e quella mancata;
2. porta $z$ a 3 per il resto della sessione;
3. blocca la distanza mancata e tutto ciò che sta oltre finché una rosata non arriva più vicino, poi la libera per un nuovo tentativo impostato dall'adattamento corretto. Reimpostare la previsione dell'app ripete l'errore: in simulazione nessuna sessione con un colpo non visto si è ripresa senza l'alzo dell'adattamento, e l'82 % si è ripreso con esso;
4. mantiene in gioco una distanza mancata di nuovo finché sotto resta terreno non provato, fino a cinque colpi non visti. Con un BC troppo alto del 25 % e un parapalle di 2 m, abbandonare il bersaglio lontano dopo il secondo colpo non visto lo faceva perdere in 92 sessioni su 100, e il risultato, ridotto a due terzi del vero, veniva poi proposto per il salvataggio. Mantenendolo in gioco veniva raggiunto in ogni sessione, con al massimo tre colpi non visti;
5. quando non si può sparare nulla di più vicino, chiede una rosata aggiuntiva di tre colpi su una distanza già raggiunta, per spostare l'adattamento quanto basta a sbloccare il nuovo tentativo.

Un colpo non visto dice anche quanto deve essere grande, come minimo, l'errore di resistenza. Il colpo è uscito dal parapalle, quindi l'impostazione era sbagliata di più della metà della sua altezza $h$. Un errore di resistenza da solo ci riesce solo se

$$|\delta d| \ge \frac{h/2}{R}\Big/\frac{\partial c}{\partial d}$$

Su un parapalle di 2 m per la .308 questo vale il 22 % a 800 m, il 38 % a 700 m, il 68 % a 600 m e l'815 % a 300 m. Il prior di resistenza usato dalla scala e dai valori da impostare viene allargato finché quella grandezza non sta a due deviazioni standard. Un errore di BC grossolano viene allora seguito invece di essere riportato verso il valore pubblicato, cosa che farebbe mancare di nuovo il tentativo di quasi altrettanto. Se l'errore richiesto supera il 50 %, nessun BC è così sbagliato: il colpo non visto aveva un'altra causa (una raffica, un errore d'impostazione, un impatto semplicemente non visto), e allargare costerebbe solo precisione. La stima lineare qui basta; risolvere esattamente la traiettoria non ha cambiato alcun esito simulato. L'adattamento per la conclusione usa il prior normale. Altrimenti un colpo che era solo un impatto non visto costerebbe un voto a una sessione senza cronografo, e la regola dei 3σ del §8.13 intercetta comunque un errore di BC grossolano.

### 8.13 Salvaguardie sugli inserimenti

Nessuna vi blocca. Ciascuna avvisa, spiega o trattiene un risultato.

- **Plausibilità dell'alzo.** Un alzo inserito viene confrontato con un intervallo pari alla previsione dell'app stessa ± 4σ. Questo σ combina la dispersione della previsione per un tiratore che non ha verificato nulla (prior non verificati, qualunque cosa abbiate spuntato), il rumore della serie e l'errore di vento con affidabilità «Scarsa». L'intervallo ignora di proposito l'adattamento e gli inserimenti precedenti: un errore di battitura precedente che ha deformato l'adattamento non deve far sembrare sbagliato un inserimento corretto. Fuori dall'intervallo, lo strumento verifica se il numero andrebbe bene come differenza dall'alzo raccomandato, come mrad o MOA inseriti al posto dei click, con il segno invertito o spostato di un fattore dieci, e indica l'errore probabile.
- **Plausibilità della velocità.** La velocità della cartuccia nell'aria di quella rosata ± $4\sqrt{20^2 + \text{SD}^2}$ m/s, limitata a 150–1500 m/s. I 20 m/s valgono anche quando la media è spuntata come verificata, perché la spunta può essere sbagliata. Fuori dall'intervallo, lo strumento prova le altre unità di velocità e un fattore dieci.
- **Pressione di stazione.** Oltre 40 hPa sopra la pressione dell'atmosfera standard alla quota della postazione, la lettura sembra un QNH. Oltre 60 hPa sotto, sembra troppo bassa. La pressione di stazione reale varia con il tempo di circa 35 hPa in entrambe le direzioni. A 1500 m, usare il QNH costa 0,39 mrad, e l'adattamento lo trasformerebbe in una correzione del BC (§8.2).
- **Variazione dell'aria.** Quando l'aria di una rosata differisce da quella di partenza di 8 °C o 15 hPa, lo strumento vi dice che il piano sta invecchiando (per un caricamento che deriva di 0,8 m/s per grado, 8 °C sono oltre 6 m/s). Il piano non viene ricalcolato dopo l'avvio, ma l'adattamento segue comunque l'aria di ogni rosata.
- **Correzione del BC.** Proposta solo con almeno cinque letture del cronografo raccolte durante la sessione, con voto A o B, quando il risultato della resistenza è entro 3σ dal prior (3 × 4,1 ≈ 12 %) e il nuovo fattore di guadagno è compreso tra 0,8 e 1,2. Un risultato più lontano viene trattato come un errore d'inserimento: il prior trattiene un tale adattamento verso il BC pubblicato, quindi il suo numero è troppo piccolo e la sua banda troppo stretta. In simulazione, con un BC sbagliato del 25 %, un tale risultato sarebbe stato proposto per il salvataggio a due terzi della correzione vera. Viene mostrato, con il BC adattato, solo a titolo informativo.
- **Riscontro sulla velocità.** Riportato come correzione misurata solo se ci sono letture del cronografo dietro. Senza di esse, una velocità ricavata dagli alzi è solo l'errore di un'altra causa spostato sulla velocità, e viene elencata come non determinata.
- **Bersaglio lontano pianificato non raggiunto.** La pagina «Conclusione» lo dice e valuta solo ciò che è stato sparato.

### 8.14 Cosa viene riportato

$R_\text{max}$ è la vostra distanza d'impiego massima: la distanza supersonica più lontana della postazione, o la distanza più lontana sparata se è maggiore. Ogni riscontro viene giudicato a $R_\text{max}$.

**Rilevanza.** Una causa conta se il suo effetto a $R_\text{max}$ supera 0,1 mrad. Per una causa con valore adattato $\theta_i$, deviazione standard $\sigma_i$ e colonna $J_i$ a $R_\text{max}$, quindi media $m = J_i\theta_i$ e deviazione standard $s=|J_i|\sigma_i$:

$$P(\text{material}) = \Phi\!\left(\frac{-0.1-m}{s}\right) + 1 - \Phi\!\left(\frac{0.1-m}{s}\right)$$

I riscontri vengono ordinati in base a questa probabilità.

**Risoluzione.** $\tilde R = I - \Sigma P_0$, scalata con le deviazioni standard del prior. La sua diagonale è $1 - \Sigma_{ii}/\sigma_{0,i}^2$, la quota della varianza a priori che i colpi hanno eliminato. Sotto 0,2 la sessione non ha misurato quella causa. È allora «non determinata», o elencata come irrisolta se il suo effetto adattato probabilmente conta comunque, ma mai «nella norma», perché un valore riportato verso il suo prior non è una misura. È il corrispettivo, sul lato dell'attribuzione, della deviazione standard predittiva della tabella degli alzi: una causa può restare irrisolta mentre l'alzo a cui contribuisce è noto con precisione.

**Degenerazione.** Le cause legate da una correlazione a posteriori superiore a 0,8 vengono raggruppate come componenti connesse, così i legami possono concatenarsi. Ogni gruppo viene riportato come un unico contributo combinato $m=\sum_{k} J_k\theta_k$ con varianza $J^\top\Sigma J$ sui suoi membri. Quando il gruppo è velocità e resistenza, il consiglio è portare un cronografo. Le correlazioni tra 0,5 e 0,8 tra cause riportate ricevono una nota.

**Zero.** Riportato come correzione con $P \ge 0.8$, e come «possibile, ma non ancora chiaro» tra 0,5 e 0,8.

**Tabella degli alzi.** Quando non viene proposta alcuna correzione del BC, la variazione dell'alzo a ogni distanza sparata è $\Delta c(R) = c_\text{fit}(R) - c_\text{app}(R)$ nell'aria dell'ultima rosata, con deviazione standard $\sqrt{J(R)^\top\Sigma J(R)}$. Una voce conta se $|\Delta c| \ge 0.05$ mrad e $|\Delta c| \ge$ la propria deviazione standard. La tabella viene mostrata quando almeno una voce conta. La lettura di una rosata è precisa solo a circa 0,07–0,15 mrad, quindi una soglia di 0,05 mrad da sola lascerebbe passare il rumore.

Le soglie per lo zero e per la tabella degli alzi sono state scelte provando regole candidate su migliaia di sessioni simulate. Insieme dimezzano circa le sessioni in cui seguire il risultato rende gli alzi peggiori che non fare nulla, a un piccolo costo quando lo zero è davvero un po' spostato.

### 8.15 Cosa il modello lascia fuori

- **La forma della curva di resistenza.** $\delta d$ scala la curva di resistenza assunta e non la rimodella mai. Un BC G1 usato per un proiettile la cui resistenza segue G7 è un errore di forma. Sopra Mach 1,1 un unico fattore ne assorbe la maggior parte sulle distanze sparate, ma non tutto, e non si estende al transonico. È la ragione principale per cui lo strumento resta nel supersonico, e il motivo del tetto della scala.
- **L'altezza di mira** non viene adattata. Oltre qualche centinaio di metri il suo effetto è quasi costante (−0,020, −0,025 e −0,026 mrad a 300, 600 e 800 m per 3 mm), quindi somiglia a un piccolo scostamento dello zero, e i colpi non possono distinguerli. Misuratela.
- **La densità dell'aria** non viene adattata e non può esserlo (§8.2).
- **Il vento** è rumore, non una causa, e la deriva non viene mai usata.
- **La deriva giroscopica** agisce solo lateralmente, e la componente laterale non viene adattata. La rotazione terrestre non è modellata.
- **Validazione.** Ogni soglia qui sopra è stata fissata per simulazione: sessioni con errori noti inseriti (BC, velocità, zero, click, distanza, pendenza, vento), sparate attraverso la stessa scala, lo stesso adattamento e lo stesso rapporto. La banda al 95 % della resistenza contiene la verità in circa il 95 % di queste simulazioni. Le sessioni reali sono ancora poche, ed è per questo che lo strumento è contrassegnato come sperimentale.
