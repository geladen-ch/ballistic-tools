# geladen.ch ballistics Manuale d'uso — Scheda di tiro stampabile

*Parte della* [suite balistica geladen.ch](https://bc.geladen.ch)*.*

---

## 1. A cosa serve questo strumento

Una scheda di tiro è un foglio di carta che tieni con l'arma: cosa regolare a ogni distanza, quanto il vento sposta la palla e cosa cambia quando fa più freddo o più caldo o quando spari in salita o in discesa. La carta non ha bisogno né di batteria né di campo, e la leggi con un'occhiata nel mezzo di una serie.

La scheda **Scheda stampabile** di Traiettoria crea una scheda del genere in PDF, pronta da stampare. Usa l'arma, la cartuccia e l'atmosfera impostate nella scheda **Dati** e le unità scelte nelle Impostazioni, così la scheda si legge come il resto dell'app.

Una scheda copre un'arma con una sola cartuccia, in un solo insieme di condizioni. Non può sostituire il calcolatore in tutte le situazioni: quando l'aria, la distanza o il vento si discostano molto da quelli per cui è stata fatta, i suoi numeri sono solo un punto di partenza. La sezione 7 spiega quanto ci si può fidare.

---

## 2. Avvio rapido

1. Apri **Traiettoria**. Nella scheda **Dati**, scegli l'arma e la cartuccia e inserisci l'atmosfera che ti aspetti dove andrai a sparare.
2. Passa alla scheda **Scheda stampabile**. Il riquadro **Sulla scheda** in alto mostra l'arma, la cartuccia e le condizioni di riferimento come la scheda le stamperà. Se qualcosa è sbagliato, correggilo nella scheda Dati o in Armi.
3. In **Impostazioni della scheda**, scegli la carta, la distanza più lontana e il passo di distanza.
4. Fai clic su **Scarica il PDF** e stampa il file a grandezza reale.

Tutto ciò che imposti in questa scheda viene ricordato, anche dopo un riavvio. Le impostazioni sono le stesse per tutte le armi: non vengono salvate arma per arma.

---

## 3. Per cosa è calcolata la scheda

- **Arma, cartuccia e palla** — quelle scelte nella scheda Dati, da Armi.
- **Azzeramento** — la distanza di azzeramento propria dell'arma, definita in Armi. La **Distanza di azzeramento alternativa** della scheda Dati non vale per la scheda di tiro. Se la cartuccia è stata azzerata in un'altra aria (un'atmosfera di azzeramento in Armi), l'azzeramento resta in quell'aria.
- **Condizioni di riferimento** — l'atmosfera della scheda Dati: altitudine, pressione, temperatura e umidità. La scheda le stampa sulla riga sopra la tabella.
- **Tiro** — in piano. La pendenza è trattata da colonne proprie (sezione 5.6), non dall'angolo della linea di mira della scheda Dati.
- **Vento** — il vento laterale di riferimento proprio della scheda (sezione 4.4). Il vento della scheda Dati non viene usato.
- **Correzioni** — nell'unità del Calcolatore per il poligono: click, mrad o MOA (Impostazioni → **Output del Calcolatore per il poligono**), con gli stessi indicatori di direzione, frecce o **+ / −** (Impostazioni → **Indicatori di output del Calcolatore per il poligono**). I click seguono i valori di click dell'arma definiti in Armi.

---

## 4. Impostazioni della scheda

### 4.1 Scheda

- **Carta** — **A4** o **Letter** stampano tutta la scheda su una pagina. **A5** e **Mezza lettera (Half-letter)** la dividono su due pagine orizzontali: la tabella sulla prima, il reticolo e la foto del luogo sulla seconda. Stampale fronte e retro su uno stesso foglio. La carta stabilisce anche quante righe può contenere la tabella (sezione 5.1).
- **Titolo** — fino a 44 caratteri, stampato in cima alla scheda. Se vuoto, la scheda s'intitola «arma · cartuccia».
- **Data** — stampata nel piè di pagina e usata nel nome del file. È la data di oggi finché non ne scegli un'altra.

### 4.2 Distanze

- **Distanza massima** — dove finisce la tabella. Scegli **Distanza** e inseriscila (1000 m o 1000 iarde per impostazione predefinita), oppure **Mach 1,1** o **Mach 1,0** per far finire la tabella dove la palla rallenta a quella velocità. La precisione peggiora quando una palla si avvicina alla velocità del suono, quindi così la scheda resta nel campo in cui i suoi numeri reggono. In una modalità Mach, una nota sotto il campo dice a quale distanza la palla raggiunge quella velocità. La scheda finisce all'ultima riga prima di essa.
- **Passo di distanza** — 200, 100, 50 o 25, nella tua unità di distanza. La prima riga è a un passo dalla volata.
- **Infittisci i passi oltre** — infittisce la tabella dove la traiettoria si fa ripida. Quando la correzione di elevazione fino alla distanza successiva cambierebbe di più di questo valore, il passo scende al successivo più fine (200 → 100 → 50 → 25). Una volta più fine, non torna più largo. Il valore è nell'unità di correzione (click, mrad o MOA). 0 disattiva l'infittimento.

Un'impostazione tipica: passo 100 m, infittisci oltre circa 16 click (va bene qualsiasi valore da 10 a 20). La parte vicina della tabella resta corta, e la parte lontana, dove un piccolo errore di distanza costa di più, riceve righe ogni 50 o 25 m.

### 4.3 Riga di stato

Sotto le impostazioni, una riga conta le righe della tabella: «24 righe su 37». Se le distanze e i bersagli richiedono più righe di quante ne contenga la carta, un avviso indica la distanza più lontana che ci sta ancora e quante righe restano fuori. Per recuperarle, usa un passo più largo, una soglia di infittimento più alta, una distanza massima più corta o una carta più grande.

### 4.4 Vento

Il **Vento laterale di riferimento** è il vento per cui è calcolata la colonna **Vento**: pieno, da destra. La scheda stampa la correzione per il vento senza direzione: correggi in torretta o a reticolo contro vento.

Scegli un vento facile da riproporzionare a mente. La sezione 6.3 mostra come.

### 4.5 Temperatura

**Correzioni di temperatura** (attivo per impostazione predefinita) aggiunge cinque colonne. Ognuna dà la variazione di elevazione rispetto alle condizioni di riferimento quando l'aria **e la polvere** sono a quella temperatura.

- La velocità alla volata cambia secondo la variazione di velocità per grado della cartuccia, definita in Armi. Senza di essa, cambia solo l'aria.
- L'azzeramento resta dove è stato fatto. La colonna mostra di quanto si sposta il punto d'impatto quando fa più freddo o più caldo del riferimento della scheda. Non presuppone che quel giorno tu abbia rifatto l'azzeramento.
- Per impostazione predefinita le colonne sono centrate sulla temperatura di riferimento, a 5 °C (10 °F) l'una dall'altra. La colonna centrale è la temperatura di riferimento stessa e contiene solo zeri. Modifica la **Prima temperatura** o il **Passo di temperatura** per scegliere un'altra scala. Una riga sotto i campi elenca le colonne. **Valori predefiniti** torna alla scala centrata.

### 4.6 Contenuto

- **Colonna deriva giroscopica** — la deriva dovuta alla rotazione della palla a ogni distanza, senza vento, con la sua direzione. È offerta solo se la deriva giroscopica è attiva nelle Impostazioni e l'app sa abbastanza per calcolarla: il passo di rigatura dell'arma, la lunghezza e il diametro della palla. La colonna Vento non include mai la deriva giroscopica.
- **Correzioni di pendenza (da 10° a 30°)** — cinque colonne, per il tiro a 10, 15, 20, 25 e 30° in salita o in discesa. Vedi la sezione 5.6.

**Luogo.** La scheda può usare la postazione attiva del Calcolatore per il poligono (vedi Postazioni e bersagli nel manuale principale). Qui è mostrato il nome della postazione. Se non c'è una postazione attiva, **Apri Luoghi** ti porta lì.

- **Righe dei bersagli** — una riga della tabella per ogni bersaglio della postazione, calcolata alla sua distanza e al suo angolo della linea di mira (sezione 5.5).
- **Foto del luogo con i bersagli** — la foto della postazione, con ogni bersaglio segnato sopra. Se la postazione non ha una foto, una nota lo dice e la scheda la omette.

**Reticolo.** Se l'arma ha nell'Arsenale un'ottica con reticolo, **Reticolo e BDC** stampa quel reticolo sulla scheda, con le sue tacche BDC (dall'inglese «Bullet Drop Compensation», cioè «compensazione della caduta del proiettile»; in parole povere, segni di correzione a reticolo) se ne ha. Sotto la casella compare una vista cannocchiale. Funziona come quella del Calcolatore per il poligono, e ciò che mostra è ciò che la scheda stampa:

- L'**anello degli ingrandimenti** imposta l'ingrandimento, e **Zoom sul reticolo** ingrandisce la vista di un cannocchiale a ingrandimento fisso; un pizzico a due dita o la rotellina del mouse sopra il reticolo agiscono su entrambi.
- Le **Distanze BDC** indicano su ogni tacca BDC la distanza a cui corrisponde, nelle condizioni di riferimento della scheda, senza vento e in piano.
- Le **Correzioni per il vento** segnano una correzione a reticolo per ogni quarto del vento laterale della scheda, fino a una volta e mezza, da entrambi i lati. Il vento laterale pieno ha il segno più grande.

Sulla scheda non c'è un punto di mira. L'ingrandimento e i due pulsanti di sovrapposizione sono propri della scheda: cambiarli qui non cambia la vista cannocchiale del Calcolatore per il poligono, e viceversa. Il reticolo si stampa in nero, le sovrapposizioni in grigio.

Il reticolo su carta è un'immagine del reticolo, non un disegno in scala. Non misurarci sopra una correzione con il righello.

---

## 5. Leggere la scheda

### 5.1 Impaginazione

- **Intestazione** — il nome dell'app e il titolo della scheda.
- **Arma** — il nome dell'arma, la distanza di azzeramento, l'altezza dell'ottica e il valore di click dell'ottica, verticale · orizzontale.
- **Cartuccia** — il nome della cartuccia, la palla con la sua massa, la velocità alla volata con la sua variazione per grado, e il coefficiente balistico con il suo modello di resistenza (o «curva Cd personalizzata»).
- **Correzioni** — il titolo indica l'unità di correzione. Le condizioni di riferimento sono sulla stessa riga, a destra: altitudine, pressione, temperatura, umidità.
- **La tabella** — sezioni da 5.2 a 5.6.
- **Reticolo** e **Bersagli** — il reticolo e la foto della postazione. Se ne lasci fuori uno, la scheda mette al suo posto un riquadro a righe **Note**.
- **Piè di pagina** — l'indirizzo dell'app, la sua versione e la data della scheda. Se due schede non concordano, dicono quale è più recente e quale versione dell'app l'ha creata.

A4 e Letter contengono fino a 37 righe, A5 e Mezza lettera fino a 26. Con poche righe, ogni riga è alta: la distanza sopra, l'elevazione sotto, a caratteri grandi. Con molte righe, ognuna sta su una sola linea. Se un valore è troppo largo per la sua colonna, tutto il testo della tabella si rimpicciolisce un po', così le colonne restano allineate.

### 5.2 Distanza ed elevazione

La colonna **Distanza**, in grassetto, elenca le distanze di riferimento, da un passo fino alla distanza massima. Sotto ogni distanza, o accanto su una scheda fitta, c'è l'elevazione da regolare a partire dall'azzeramento, con la sua direzione.

### 5.3 Più vicino e più lontano

Due colonne su ogni lato della distanza di riferimento danno l'elevazione per le distanze vicine. Servono per un bersaglio che sta tra due righe. Quanto distano dipende dal passo in vigore su quella riga:

| Passo | Più vicino | Più lontano |
| --- | --- | --- |
| 200 | −100, −50 | +50, +100 |
| 100 | −50, −25 | +25, +50 |
| 50 | −20, −10 | +10, +20 |
| 25 | −10, −5 | +5, +10 |

Una distanza vicina alla volata o prima di essa resta vuota. Ogni cella mostra la sua distanza in piccole cifre grigie e l'elevazione sotto o accanto.

Esempio, con passo di 100 m: il bersaglio è a 640 m. Trova la riga 600 m e leggi la cella **+50**, cioè 650 m. È più vicina di 600 o 700 m, e più precisa di una stima a occhio tra due righe.

### 5.4 Vento e deriva giroscopica

**Vento** è la correzione per il vento laterale della scheda (stampato nel titolo della colonna), come valore senza direzione: correggi contro vento. **Giro** è la deriva giroscopica senza vento, con la sua direzione. Non dipende dal vento, quindi aggiungila sopra.

### 5.5 Righe dei bersagli

Ogni bersaglio della postazione attiva è una riga grigia, inserita per distanza tra le distanze di riferimento. Un'etichetta nera porta la sua sigla (T1, T2 … dal più vicino), e accanto è stampato il suo angolo della linea di mira, + in salita. L'elevazione tiene già conto di quell'angolo: regolala così com'è e non aggiungere una correzione di pendenza. Vento e deriva giroscopica come nelle altre righe. Una riga di bersaglio non ha celle più vicino e più lontano. Un bersaglio oltre la distanza massima resta fuori. La foto della postazione, se l'hai inclusa, mostra dove si trova ogni sigla.

### 5.6 Correzioni di pendenza

In un tiro in salita o in discesa, la palla cade meno, perpendicolarmente alla linea di mira, che in piano, e il tiro richiede meno elevazione. Ogni colonna di pendenza dà la variazione da aggiungere all'elevazione in piano a quella distanza, per quell'angolo. Il valore è lo stesso, a meno di un soffio, in salita e in discesa, quindi una sola colonna copre entrambi i casi: la scheda stampa la media dei due.

Esempio: 500 m, 20° in discesa. Prendi l'elevazione della riga 500 m e aggiungi il valore della colonna **20** (di solito una piccola correzione verso il basso).

Usa la colonna più vicina all'angolo misurato, oppure la riga del bersaglio se il bersaglio fa parte della postazione.

### 5.7 Correzioni di temperatura

Ogni colonna ha come titolo la sua temperatura. Aggiungi all'elevazione della riga il valore della colonna più vicina alla temperatura del giorno. La colonna alla temperatura di riferimento della scheda contiene solo zeri. Aria e polvere più fredde significano una palla più lenta e più frenata, quindi le correzioni sul lato freddo vanno verso l'alto e quelle sul lato caldo verso il basso.

---

## 6. La scheda al poligono

### 6.1 Prima di stampare

- Inserisci l'atmosfera che ti aspetti nel luogo e nella stagione in cui sparerai. Una scheda fatta per 400 m di altitudine è sensibilmente sbagliata a 1800 m. Se spari in luoghi molto diversi, stampa una scheda per ciascuno.
- Controlla il riquadro **Sulla scheda**: nome, azzeramento, altezza dell'ottica, valore di click, velocità alla volata e BC. La scheda non è migliore di questi dati.
- Usa la velocità alla volata che hai misurato, con la sua temperatura, e la variazione di velocità per grado, se la conosci. Le colonne di temperatura ne dipendono.

### 6.2 Stampa

Stampa a grandezza reale, non «adatta alla pagina». Usa una carta che regga il campo, oppure metti la scheda in una busta trasparente o plastificala. Per A5 e Mezza lettera, stampa le due pagine fronte e retro su uno stesso foglio: la tabella da un lato, il reticolo e la foto dall'altro.

### 6.3 Riproporzionare il vento

La correzione per il vento cresce quasi in proporzione al vento laterale. Se la scheda è fatta per 4 m/s e il vento è di 2 m/s, prendi metà del valore. A 6 m/s, una volta e mezza. Per un vento che non è perfettamente laterale, usa solo la sua componente laterale: metà della velocità a 30° dalla linea di tiro, circa 0,7 a 45° e circa 0,9 a 60°. Un vento laterale di riferimento tondo rende facile questo conto. Con le **Correzioni per il vento** attive, il reticolo sulla scheda mostra gli stessi quarti del vento laterale come correzioni a reticolo.

### 6.4 Mettere tutto insieme

Per un tiro: l'elevazione della riga (o di una cella più vicino/più lontano), più la correzione di temperatura, più la correzione di pendenza se il bersaglio è più in alto o più in basso di te. Poi la correzione per il vento, riproporzionata al vento, più la deriva giroscopica.

---

## 7. Quanto fidarsi della scheda

- **Pressione e altitudine** — le colonne di temperatura cambiano solo la temperatura. Se la pressione del giorno si discosta molto dal riferimento della scheda, le elevazioni alle lunghe distanze sono sbagliate. Usa un calcolatore, o stampa una scheda per quelle condizioni.
- **Le correzioni si sommano solo in modo approssimato** — ogni colonna è calcolata da sola, rispetto alle condizioni di riferimento. Sommare una correzione di pendenza e una di temperatura è un'ottima approssimazione alle distanze e agli angoli usuali, ma non è esatto.
- **Vicino alla velocità del suono** — i numeri della scheda diventano meno affidabili man mano che la palla rallenta verso Mach 1. Far finire la tabella a **Mach 1,1** ti tiene dal lato sicuro.
- **I dati di partenza** — la scheda ripete la tua configurazione. Una velocità alla volata, un BC, un'altezza dell'ottica o un valore di click sbagliati danno una scheda ordinata con numeri sbagliati. Verifica la scheda al poligono su alcune distanze prima di farci affidamento, e stampane una nuova dopo un cambio di cartuccia, di azzeramento o di ottica.

---

## 8. File e privacy

Il PDF viene creato nel tuo browser e salvato sul tuo dispositivo. Non viene caricato nulla. Il file prende il nome dalla scheda e dalla sua data, per esempio «Scheda di tiro - Tikka T3x - 6.5 Creedmoor 140 ELD-M - 2026-11-09.pdf».
