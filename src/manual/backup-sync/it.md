# Backup e sincronizzazione — cosa sono, come si configurano, e perché in qualche modo odiano gli iPhone

## Perché non c'è un bottone "Cloud"

Lo dico fin dal primo giorno: questa app è integralista in fatto di privacy — tutto gira nel vostro browser, nulla viene mai raccolto o inviato a un server mio, e ho intenzione che resti così. Quindi no, non ci innesterò una funzione "crea un account, accedi, sincronizza con Geladen Cloud™". Significherebbe far girare un server, quindi memorizzare i vostri dati da qualche parte sotto il mio controllo — esattamente ciò che ho costruito questa app per *non* fare.

Ma "nessuna funzione cloud nell'app" non deve per forza significare "nessun modo di tenere sincronizzati due dispositivi". Quasi certamente avete già un servizio di sincronizzazione cloud attivo da qualche parte — OneDrive, Google Drive, iCloud, Dropbox, NextCloud, quello che il vostro lavoro o la vostra famiglia già pagano. Questi servizi sono molto bravi in un compito ben preciso: far sì che una cartella sul vostro computer/telefono appaia identica alla stessa cartella su un altro computer/telefono. Quindi, invece di reinventare male quella ruota (e in modo meno sicuro), Backup e sincronizzazione si limita a scrivere il proprio piccolo file di backup in una cartella *che scegliete voi* — e lascia che il vostro servizio cloud esistente trasporti quel file per voi. L'app non parla mai direttamente con OneDrive, Google o chiunque altro. Non sa nemmeno quale state usando. Si limita a leggere e scrivere file in una cartella, esattamente come già vi lascia salvare/caricare le vostre librerie a mano oggi.

Ognuno dei vostri dispositivi fa la stessa cosa: scrive il proprio file nella cartella condivisa e legge qualsiasi file che gli *altri* dispositivi vi abbiano lasciato, unendo tutto ciò che è più recente. Puntate due o tre dispositivi sulla stessa cartella sincronizzata, e finiranno per vedere lo stesso Arsenale, le stesse Località, gli stessi progetti di Precisione fucile — senza che io veda mai nulla di tutto questo.

Questa è una funzione genuinamente nuova e sperimentale. Fate il backup delle vostre librerie con i normali bottoni di esportazione prima di attivarla. Lo dico sul serio — anche l'interruttore nelle Impostazioni lo dice.

## Configurazione

In **Impostazioni → Backup e sincronizzazione**:

1. Spuntate **Abilita backup e sincronizzazione**. Vi ricorderà di esportare prima le vostre librerie — fatelo, richiede dieci secondi.
2. Date al dispositivo un **nome** che riconoscerete davvero in seguito — "Portatile di Guns", non il nome generico indovinato di default. Questo conta più di quanto sembri, specialmente una volta che avete due dispositivi simili (vedi sotto, nella sezione dove mi lamento degli iPhone).
3. Premete **Scegli cartella…** e scegliete una cartella che il vostro servizio cloud sincronizza già. Non "create una nuova cartella e sperate in un miracolo" — sceglietene una che sia *già* dentro la struttura di cartelle di OneDrive/Drive/Dropbox/NextCloud/iCloud, così viene effettivamente portata sugli altri dispositivi.
4. Fate lo stesso sugli altri dispositivi, puntando sulla stessa cartella sincronizzata.
5. Premete **Sincronizza ora**, oppure attivate **Automaticamente** se volete che succeda da solo ogni pochi minuti e ogni volta che tornate su questa scheda.

Questo è tutto. Nessun account, nessuna password, nessuna chiave API, nulla da configurare lato fornitore cloud a parte "assicuratevi che questa cartella si sincronizzi".

## Indicazioni per i veri fornitori cloud

Non scriverò un manuale completo per software che non ho sviluppato io, ma ecco l'essenziale per ciascuno:

- **Microsoft OneDrive** — installate l'app desktop di OneDrive (di solito viene già inclusa con Windows) e accedete. Crea una cartella "OneDrive" sul vostro computer che rispecchia ciò che è online. Create una sottocartella al suo interno — es. `OneDrive/BallisticsSync` — e puntate l'app lì.
- **Google Drive** — installate "Google Drive per desktop". Vi dà una cartella "Google Drive" (o vi lascia scegliere "Rispecchia file", che si comporta più come una cartella normale). Create una sottocartella al suo interno e usate quella.
- **NextCloud** — installate il client desktop di sincronizzazione NextCloud, puntatelo sul vostro server NextCloud, e vi dà una cartella locale che rispecchia il vostro account. Stesso principio: create una sottocartella, sincronizzate su quella.
- **Dropbox** — installate l'app desktop di Dropbox; crea una cartella "Dropbox" che si sincronizza automaticamente. Stesso schema, create una sottocartella per questo.
- **Yandex Disk** — per chi vive oltre il muro del consenso politico: installate l'app desktop Yandex.Disk e accedete; crea una cartella "YandexDisk" che rispecchia il vostro account proprio come le altre. Create una sottocartella al suo interno e puntate l'app lì.
- **iCloud Drive** — su un Mac è integrato (Finder → iCloud Drive); su Windows installate "iCloud per Windows" dal Microsoft Store, che vi dà una cartella iCloud Drive. Va bene usarlo, con un asterisco: iCloud Drive su un vero iPhone/iPad è dove le cose diventano fastidiose — vedi la sezione successiva.

Uno qualsiasi di questi funziona. All'app non importa davvero quale scegliete, o se li mescolate — per es. un portatile che sincronizza via OneDrive e un computer fisso che sincronizza esattamente la stessa cartella fisica tramite uno strumento basato su NAS funzionerebbero comunque insieme, finché entrambi finiscono per vedere gli stessi file. Tutto ciò che conta è che lo stesso file che atterra nella cartella sul Dispositivo A finisca per apparire, identico byte per byte, in quella cartella sul Dispositivo B.

## Il momento in cui devo essere onesto riguardo a Chrome

Ecco la limitazione che non posso aggirare con l'ingegneria, e preferisco essere schietto piuttosto che lasciarvela scoprire nel modo difficile.

L'unico modo ragionevolmente automatico perché un sito web ricordi "sì, continua a usare *quella* cartella che l'utente ha scelto, senza richiederla ogni singola volta" esiste, oggi, solo nei **browser basati su Chromium** — Google Chrome, Microsoft Edge, Ungoogled Chromium, Brave e affini. Tutto qui. Firefox non ce l'ha (e per quel che vale, vorrei sinceramente che ce l'avesse — non è una frecciata a Firefox, mi piacerebbe che fosse universale). Nemmeno Safari su Mac ce l'ha.

E Safari su iPhone o iPad non è nemmeno davvero "Safari" nel senso che conta qui — su iOS, **ogni browser è Safari sotto il cofano**, Chrome compreso, perché le regole dell'App Store di Apple vietano a qualsiasi browser di portarsi dietro il proprio motore su iOS. Quindi "userò semplicemente Chrome sul mio iPhone" non vi salva: Apple ha deciso, al posto vostro, che non potete usare il vero motore Chrome sul vostro telefono, ma solo un Safari travestito con un'icona Chrome addosso. Questa non è una limitazione tecnica dei telefoni, né una svista — è una politica aziendale deliberata per tenervi dentro la piattaforma che controllano, camuffata da argomento di "sicurezza" e "coerenza" che, guarda caso, blocca fuori anche qualunque tecnologia concorrente. Genuinamente uno degli esempi più fastidiosi di una grande azienda che tratta lo "standard di settore" come qualcosa da aggirare piuttosto che da sostenere.

Conseguenza pratica: la sincronizzazione automatica, invisibile, "funziona da sola in background" appartiene solo ai **browser della famiglia Chrome** — su Windows, Mac o Linux da desktop, oppure su Android. Conta il browser, non il sistema operativo: Chrome o Edge su un Mac ce l'hanno, Safari su quello stesso Mac no. Ovunque altrove — Firefox dovunque, Safari su Mac, e assolutamente tutto su iPhone o iPad — la sincronizzazione è **manuale**: premete un bottone, vi viene dato un file da salvare (o una piccola danza tra selettore documenti e foglio di condivisione su iOS), e lo rifate su ogni dispositivo, ogni volta che volete sincronizzare. Funziona. Sono solo un paio di tocchi in più invece di essere invisibile.

## Perché mescolare dispositivi non-Chrome vi costa davvero qualcosa

Questo non è solo "meno comodo", ha un peso reale, e vale la pena capirlo prima di costruire una rete a cinque dispositivi con un iPad, un portatile da lavoro su Firefox, e due macchine Chrome.

**Ogni dispositivo pubblica l'intera libreria, ogni volta.** Il file di backup che ogni dispositivo scrive non è un diff — è una copia completa di tutto: ogni proiettile, ogni fucile, ogni località, ogni progetto di precisione fucile. Aggiungete un dispositivo alla rete, e aggiungete un'altra copia completa dell'intera libreria a quella cartella condivisa. Con due o tre dispositivi è un errore di arrotondamento. Vale comunque la pena sapere che non si riduce magicamente man mano che aggiungete dispositivi — cresce con ognuno che aggiungete.

**Le foto sono la parte costosa, e i dispositivi non-Chrome non possono prendere la scorciatoia.** I dispositivi della famiglia Chrome con vero accesso alla cartella sono furbi con le foto (bersagli, foto delle località): scrivono i byte reali della foto una sola volta, e ogni altro dispositivo della famiglia Chrome si limita a puntare a quello stesso file invece di ricopiarlo ad ogni sincronizzazione. Un dispositivo che ha solo accesso manuale, senza cartella — cioè qualsiasi iPhone/iPad, ed eventualmente anche una configurazione desktop Firefox/Safari — **non può** fare quel trucco. Non ha il tipo di accesso alla cartella necessario per separare le foto nei propri file (o, su un iPhone, anche solo per leggerle in quel modo), quindi scrive tutto — foto comprese — in un unico grande pacchetto. Decomprimere un pacchetto del genere richiede un lavoro vero rispetto al riassunto rapido che scrive Chrome, e il dispositivo — specialmente un telefono — può visibilmente bloccarsi per un secondo o due mentre succede. Quindi, nel momento in cui anche un solo dispositivo del genere entra nel mix, c'è un'impostazione — **Supporto sincronizzazione manuale iPhone**, disattivata per default, e la sua stessa descrizione vi dice esattamente cosa costa: *"Lo rende compatibile con gli iPhone, ma pesante e inefficiente per tutti gli altri."* Attivatela, e improvvisamente **ogni** dispositivo nella rete — comprese le vostre belle e veloci macchine Chrome — inizia a incorporare i dati completi delle foto in ogni singolo file di backup, ad ogni singola sincronizzazione, invece del trucco efficiente del file condiviso. Un solo iPhone nella rete tassa ogni altro dispositivo al suo interno, permanentemente, finché non lo togliete.

**In sintesi:** più dispositivi non-Chrome aggiungete, più cresce ogni sincronizzazione, più rallenta la fusione, e più dati passano attraverso la quota di upload/download del vostro fornitore cloud. Niente di tutto questo è un bug — è il costo onesto dei workaround "senza accesso alla cartella", e preferisco dirvi il vero compromesso piuttosto che far finta che sia gratis.

## Il mio consiglio

- **Usate un browser della famiglia Chrome su ogni dispositivo dove è possibile** — Chrome, Edge, quel che è (se potete scegliere, con Ungoogled Chromium non sbagliate). Desktop e Android ottengono entrambi l'esperienza reale, efficiente, completamente automatica. Questa è davvero la strada buona, e la maggior parte delle persone dovrebbe semplicemente prenderla.
- **Se avete un iPhone o un iPad nel mix, deve passare in manuale, e non c'è modo di aggirarlo** — quella è colpa di Apple, non mia. Tenete basse le aspettative: un tocco sul bottone, un foglio di condivisione, fatto. Funziona, semplicemente non è invisibile.
- **Attivate la modalità "Automaticamente" solo se ogni dispositivo della vostra rete è della famiglia Chrome.** Nel momento in cui anche un solo dispositivo è Firefox, Safari o iOS, riportate tutti alla sincronizzazione **manuale**. La modalità automatica è stata costruita per il caso "tutto Chrome".
- Se una rete mista è davvero la vostra situazione — un portatile, un telefono, un iPad — va bene, la funzione è costruita per gestirlo, basta andarci con gli occhi aperti: modalità manuale ovunque, e attivate "Supporto sincronizzazione manuale iPhone" solo se avete davvero bisogno che l'iPad/iPhone veda anche le foto, altrimenti pagherà una tassa per una funzione che non state usando.

## Un paio di reti di sicurezza, in breve

- **Verifica.** Se due dispositivi modificano davvero la stessa cosa esattamente nello stesso momento, in un modo che l'app non può risolvere automaticamente con sicurezza, non indovina — lo segnala sotto **Verifica…**, nella stessa sezione delle Impostazioni, vi mostra entrambe le versioni, e vi lascia scegliere.
- **Cronologia modifiche / Eliminati di recente.** Ogni modifica ed eliminazione — la vostra, o unita da un altro dispositivo — viene conservata localmente così potete annullarla, che abbiate mai attivato Backup e sincronizzazione oppure no. Se una sincronizzazione fa mai qualcosa che non volevate, questo è il vostro bottone di annulla.

E un'ultima volta: questo è sperimentale. Continuate a fare ogni tanto un export manuale delle vostre librerie, come un buon vecchio backup, funzione di sincronizzazione o no. Fidatevi, ma verificate — come dovreste fare con qualsiasi calcolatore che vi dice dove atterrerà il vostro proiettile.
