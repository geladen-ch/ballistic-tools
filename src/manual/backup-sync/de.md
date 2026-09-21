# Sicherung & Synchronisierung — was das ist, wie man sie einrichtet, und warum sie iPhones ein bisschen hasst

## Warum es keinen „Cloud"-Knopf gibt

Ich sage seit dem ersten Tag, dass diese App datenschutz-fundamentalistisch ist: Alles läuft in Ihrem Browser, nichts wird jemals gesammelt oder an irgendeinen Server von mir gesendet, und das soll auch so bleiben. Also nein, ich werde keine Funktion „Konto erstellen, anmelden, mit Geladen Cloud™ synchronisieren" dranschrauben. Das würde bedeuten, einen Server zu betreiben, also Ihre Daten irgendwo unter meiner Kontrolle zu speichern — genau das, wofür ich diese App gebaut habe, es *nicht* zu tun.

Aber „keine Cloud-Funktion in der App" muss nicht heißen „keine Möglichkeit, zwei Geräte synchron zu halten". Sie haben fast sicher schon irgendwo einen Cloud-Sync-Dienst laufen — OneDrive, Google Drive, iCloud, Dropbox, NextCloud, was auch immer Ihre Firma oder Familie schon bezahlt. Diese Dienste sind sehr gut in einer ganz bestimmten Aufgabe: einen Ordner auf Ihrem Computer/Telefon identisch mit demselben Ordner auf einem anderen Computer/Telefon aussehen zu lassen. Statt dieses Rad schlecht (und unsicher) neu zu erfinden, schreibt Sicherung & Synchronisierung einfach ihre eigene kleine Sicherungsdatei in einen Ordner, den *Sie* auswählen — und lässt Ihren bestehenden Cloud-Dienst diese Datei für Sie transportieren. Die App spricht nie direkt mit OneDrive, Google oder sonst wem. Sie weiß nicht einmal, welchen Sie verwenden. Sie liest und schreibt einfach Dateien in einem Ordner, genau wie sie Sie heute schon Ihre Bibliotheken von Hand sichern/laden lässt.

Jedes Ihrer Geräte macht dasselbe: Es schreibt seine eigene Datei in den geteilten Ordner und liest, was die *anderen* Geräte dort abgelegt haben, wobei alles Neuere übernommen wird. Richten Sie zwei oder drei Geräte auf denselben synchronisierten Ordner, und sie sehen am Ende dasselbe Arsenal, dieselben Standorte, dieselben Präzisionsprojekte — ohne dass ich je etwas davon zu sehen bekomme.

Das ist eine wirklich neue und experimentelle Funktion. Sichern Sie Ihre Bibliotheken mit den normalen Export-Knöpfen, bevor Sie sie aktivieren. Ich meine das ernst — der Schalter in den Einstellungen sagt das auch.

## Einrichtung

In **Einstellungen → Sicherung & Synchronisierung**:

1. Haken Sie **Sicherung & Synchronisierung aktivieren** an. Die App wird Sie nerven, zuerst Ihre Bibliotheken zu exportieren — tun Sie das, es dauert zehn Sekunden.
2. Geben Sie dem Gerät einen **Namen**, den Sie später auch wirklich wiedererkennen — „Guns' Laptop", nicht irgendeinen generischen Standardnamen. Das ist wichtiger, als es klingt, besonders sobald Sie zwei ähnliche Geräte haben (siehe unten, im Abschnitt, wo ich mich über iPhones beschwere).
3. Drücken Sie auf **Ordner wählen…** und wählen Sie einen Ordner, den Ihr Cloud-Dienst bereits synchronisiert. Nicht „neuen Ordner anlegen und auf ein Wunder hoffen" — wählen Sie einen, der sich *bereits* in Ihrer OneDrive-/Drive-/Dropbox-/NextCloud-/iCloud-Ordnerstruktur befindet, damit er tatsächlich zu Ihren anderen Geräten transportiert wird.
4. Machen Sie dasselbe auf Ihren anderen Geräten, mit Verweis auf denselben synchronisierten Ordner.
5. Drücken Sie **Jetzt synchronisieren**, oder schalten Sie **Automatisch** ein, wenn es von selbst passieren soll, alle paar Minuten und jedes Mal, wenn Sie zum Tab zurückkehren.

Das war's. Kein Konto, kein Passwort, keine API-Schlüssel, nichts, was auf Seiten des Cloud-Anbieters zu konfigurieren ist, außer „stellen Sie sicher, dass dieser Ordner synchronisiert wird".

## Hinweise zu den eigentlichen Cloud-Anbietern

Ich werde kein vollständiges Handbuch für Software schreiben, die ich nicht selbst entwickelt habe, aber hier das Wesentliche zu jedem:

- **Microsoft OneDrive** — installieren Sie die OneDrive-Desktop-App (kommt meist schon mit Windows) und melden Sie sich an. Sie erstellt einen „OneDrive"-Ordner auf Ihrem Rechner, der spiegelt, was online ist. Legen Sie darin einen Unterordner an — z. B. `OneDrive/BallisticsSync` — und richten Sie die App darauf aus.
- **Google Drive** — installieren Sie „Google Drive für Desktop". Es gibt Ihnen einen „Google Drive"-Ordner (oder lässt Sie „Dateien spiegeln" wählen, was sich am ehesten wie ein normaler Ordner verhält). Legen Sie darin einen Unterordner an und benutzen Sie ihn.
- **NextCloud** — installieren Sie den NextCloud-Desktop-Sync-Client, richten Sie ihn auf Ihren NextCloud-Server aus, und er gibt Ihnen einen lokalen Ordner, der Ihr Konto spiegelt. Gleiches Prinzip: Unterordner anlegen, damit synchronisieren.
- **Dropbox** — installieren Sie die Dropbox-Desktop-App; sie erstellt einen „Dropbox"-Ordner, der automatisch synchronisiert. Gleiches Muster, legen Sie dafür einen Unterordner an.
- **Yandex Disk** — für alle jenseits der politischen Konsensmauer: installieren Sie die Yandex.Disk-Desktop-App und melden Sie sich an; sie erstellt einen „YandexDisk"-Ordner, der Ihr Konto genauso spiegelt wie die anderen. Legen Sie darin einen Unterordner an und richten Sie die App darauf aus.
- **iCloud Drive** — auf einem Mac ist es eingebaut (Finder → iCloud Drive); unter Windows installieren Sie „iCloud für Windows" aus dem Microsoft Store, was Ihnen einen iCloud-Drive-Ordner gibt. Funktioniert gut, mit einem Sternchen: iCloud Drive auf einem echten iPhone/iPad ist der Punkt, wo es lästig wird — siehe nächster Abschnitt.

Jeder davon funktioniert. Der App ist es wirklich egal, welchen Sie wählen, oder ob Sie sie mischen — z. B. würde ein Laptop, der über OneDrive synchronisiert, und ein Desktop, der genau denselben physischen Ordner über ein NAS-basiertes Tool synchronisiert, trotzdem funktionieren, solange beide Seiten irgendwann dieselben Dateien sehen. Alles, was zählt, ist, dass dieselbe Datei, die im Ordner auf Gerät A landet, am Ende byte-identisch in diesem Ordner auf Gerät B erscheint.

## Der Teil, wo ich ehrlich zu Chrome sein muss

Hier ist die Einschränkung, die ich nicht wegprogrammieren kann, und ich möchte offen darüber sein, statt Sie es auf die harte Tour entdecken zu lassen.

Die einzige einigermaßen automatische Möglichkeit für eine Website, sich zu merken „ja, benutze weiter *diesen* Ordner, den der Nutzer ausgewählt hat, ohne jedes Mal erneut zu fragen", existiert heute nur in **Chromium-basierten Browsern** — Google Chrome, Microsoft Edge, Ungoogled Chromium, Brave und Freunde. Das war's. Firefox hat es nicht (und ehrlich gesagt wünschte ich, es hätte es — das ist kein Seitenhieb gegen Firefox, ich würde mir wünschen, das wäre überall so). Safari auf dem Mac hat es auch nicht.

Und Safari auf einem iPhone oder iPad ist in dem Sinne, der hier zählt, nicht mal wirklich „Safari" — unter iOS ist **jeder Browser darunter Safari**, Chrome eingeschlossen, weil die App-Store-Regeln von Apple es jedem Browser verbieten, seine eigene Engine unter iOS mitzubringen. Also rettet Sie „ich benutze einfach Chrome auf meinem iPhone" nicht: Apple hat für Sie entschieden, dass Sie die echte Chrome-Engine auf Ihrem eigenen Telefon nicht benutzen dürfen, sondern nur ein Safari im Chrome-Kostüm mit Chrome-Symbol. Das ist keine technische Einschränkung von Telefonen und kein Versehen — das ist eine bewusste Unternehmenspolitik, um Sie innerhalb der Plattform zu halten, die sie kontrollieren, verkleidet als „Sicherheits"- und „Konsistenz"-Argument, das praktischerweise auch jede konkurrierende Technik aussperrt. Wirklich eines der nervigeren Beispiele dafür, wie ein großer Konzern den „Industriestandard" als etwas behandelt, das man umgeht statt unterstützt.

Praktische Konsequenz: automatisches, unsichtbares „läuft einfach im Hintergrund"-Synchronisieren gibt es nur bei **Browsern der Chrome-Familie** — unter Windows, Mac oder Linux auf dem Desktop, oder auf Android. Entscheidend ist der Browser, nicht das Betriebssystem: Chrome oder Edge auf einem Mac bekommen es, Safari auf genau demselben Mac nicht. Überall sonst — Firefox überall, Safari auf dem Mac, und absolut alles auf einem iPhone oder iPad — ist die Synchronisierung **manuell**: Sie drücken einen Knopf, bekommen eine Datei zum Speichern (oder unter iOS einen kleinen Tanz mit Dokumentenauswahl/Teilen-Menü), und machen das auf jedem Gerät, jedes Mal, wenn Sie synchronisieren wollen. Es funktioniert. Es sind nur ein paar Fingertipper mehr statt unsichtbar zu sein.

## Warum das Mischen von Nicht-Chrome-Geräten Sie tatsächlich etwas kostet

Das ist nicht nur „weniger bequem", das hat echtes Gewicht, und es lohnt sich, das zu verstehen, bevor Sie ein Fünf-Geräte-Netzwerk mit einem iPad, einem Arbeits-Laptop unter Firefox und zwei Chrome-Desktops aufbauen.

**Jedes Gerät veröffentlicht bei jedem Mal seine komplette Bibliothek.** Die Sicherungsdatei, die jedes Gerät schreibt, ist kein Diff — sie ist eine vollständige Kopie von allem: jede Kugel, jedes Gewehr, jeder Standort, jedes Präzisionsprojekt. Fügen Sie ein Gerät dem Netzwerk hinzu, und Sie fügen eine weitere vollständige Kopie Ihrer ganzen Bibliothek in diesem geteilten Ordner hinzu. Bei zwei oder drei Geräten ist das ein Rundungsfehler. Es lohnt sich trotzdem zu wissen, dass es nicht wie von Zauberhand schrumpft, je mehr Geräte Sie hinzufügen — es wächst mit jedem einzelnen.

**Fotos sind der teure Teil, und Nicht-Chrome-Geräte können die Abkürzung nicht nehmen.** Geräte der Chrome-Familie mit echtem Ordnerzugriff sind clever bei Fotos (Ziele, Standort-Fotos): Sie schreiben die eigentlichen Foto-Bytes nur einmal, und jedes andere Chrome-Familien-Gerät verweist einfach auf dieselbe Datei, statt sie bei jeder Synchronisierung neu zu kopieren. Ein Gerät, das nur manuellen, ordnerlosen Zugriff hat — also jedes iPhone/iPad, und möglicherweise auch ein Desktop-Setup mit Firefox/Safari — **kann** diesen Trick nicht anwenden. Es hat nicht die Art von Ordnerzugriff, die nötig wäre, um Fotos in eigene Dateien aufzuteilen (oder sie auf einem iPhone auch nur so zu lesen), also schreibt es stattdessen alles — Fotos eingeschlossen — in ein einziges großes Bündel. Ein solches Bündel zu entpacken bedeutet echte Arbeit im Vergleich zu der kurzen Zusammenfassung, die Chrome schreibt, und das Gerät — besonders ein Telefon — kann dabei für ein, zwei Sekunden sichtbar hängen bleiben. Sobald also auch nur ein solches Gerät mit im Spiel ist, gibt es eine Einstellung — **iPhone-Unterstützung für manuelle Synchronisierung**, standardmäßig ausgeschaltet, und ihre eigene Beschreibung sagt Ihnen genau, was das kostet: *„Macht es mit iPhones kompatibel, aber für alle anderen schwerfällig und ineffizient."* Schalten Sie sie ein, und plötzlich fängt **jedes** Gerät im Netzwerk — einschließlich Ihrer schönen schnellen Chrome-Desktops — an, vollständige Fotodaten in jede einzelne Sicherungsdatei einzubetten, bei jeder einzelnen Synchronisierung, statt des effizienten Tricks mit der gemeinsamen Datei. Ein einziges iPhone im Netzwerk besteuert jedes andere Gerät darin, dauerhaft, bis Sie es wieder herausnehmen.

**Fazit:** Je mehr Nicht-Chrome-Geräte Sie hinzufügen, desto größer wird jede Synchronisierung, desto langsamer wird das Zusammenführen, und desto mehr Daten fließen durch das Upload-/Download-Kontingent Ihres Cloud-Anbieters. Nichts davon ist ein Fehler — das sind die ehrlichen Kosten von „kein Ordnerzugriff"-Workarounds, und ich sage Ihnen lieber den echten Kompromiss, als so zu tun, als wäre er kostenlos.

## Meine Empfehlung

- **Benutzen Sie auf jedem Gerät, wo es geht, einen Browser der Chrome-Familie** — Chrome, Edge, was auch immer (wenn Sie die Wahl haben: Mit Ungoogled Chromium liegen Sie nicht falsch). Desktop und Android bekommen beide die echte, effiziente, vollautomatische Erfahrung. Das ist wirklich der gute Weg, und die meisten Leute sollten ihn einfach nehmen.
- **Wenn ein iPhone oder iPad mit dabei ist, muss es manuell laufen, und daran führt kein Weg vorbei** — das geht auf Apples Kappe, nicht auf meine. Halten Sie Ihre Erwartungen niedrig: ein Knopfdruck, ein Teilen-Menü, fertig. Es funktioniert, ist nur nicht unsichtbar.
- **Schalten Sie den Modus „Automatisch" nur ein, wenn jedes Gerät in Ihrem Netzwerk zur Chrome-Familie gehört.** Sobald auch nur ein Gerät Firefox, Safari oder iOS ist, stellen Sie alle auf **manuelle** Synchronisierung um. Der automatische Modus wurde für den reinen Chrome-Fall gebaut.
- Wenn ein gemischtes Netzwerk wirklich Ihre Situation ist — ein Laptop, ein Telefon, ein iPad — ist das in Ordnung, die Funktion ist dafür gebaut, gehen Sie nur mit offenen Augen ran: überall manueller Modus, und aktivieren Sie „iPhone-Unterstützung für manuelle Synchronisierung" nur, wenn Sie wirklich brauchen, dass das iPad/iPhone auch Fotos sieht, sonst zahlt es eine Steuer für eine Funktion, die Sie gar nicht nutzen.

## Aufräumarbeiten, die von selbst laufen

Ein paar Dinge passieren im Hintergrund, die du kennen solltest, denn sie betreffen Dateien, die du in deinem eigenen Cloud-Ordner sehen kannst.

- **Ungenutzte Fotodateien werden entfernt.** Jedes Mal, wenn du ein Foto bearbeitest oder löschst, bleibt die alte Kopie im Unterordner `assets/` liegen — nichts hat sie je entfernt, der Ordner wuchs also nur. Jetzt entfernt die App etwa einmal täglich Fotodateien, auf die kein Gerät mehr verweist. Sie wartet einen Monat, bevor sie etwas anfasst, damit ein Foto, das noch durch deinen Cloud-Anbieter unterwegs ist, nie gefährdet ist, und sie sagt dir im Bereich Backup & Sync, was sie entfernt hat. Deine Fotos selbst liegen auf den einzelnen Geräten, nicht in diesem Ordner — selbst im schlimmsten Fall kommt eine entfernte Datei zurück, sobald das Gerät mit diesem Foto das nächste Mal synchronisiert.
- **„Speicher jetzt bereinigen"** macht dasselbe auf Abruf und räumt zusätzlich den gespeicherten Änderungsverlauf und das Sync-Protokoll auf. Nutze es, wenn du gerade ein großes Projekt gelöscht hast und den Platz heute zurückhaben willst. Anders als der automatische Durchlauf meldet es alles, was es gefunden hat — egal, ob du etwas dagegen tun kannst oder nicht. Es wird nur in Browsern der Chrome-Familie angezeigt, die einen Sync-Ordner nutzen können — überall sonst passiert das Aufräumen ohnehin bei jedem Start der App.
- **Überzählige Kopien der Sicherung eines Geräts werden aufgeräumt.** Ein Browser ohne Ordnerzugriff (etwa Firefox) speichert jeden manuellen Export als neue Datei, z. B. `backup-… (1).json`, wenn bereits eine vorhanden ist. Die App zählt diese als ein Gerät und verwendet nur die neueste Kopie — beurteilt nach dem in der Datei vermerkten Exportdatum, nicht nach dem Datum der Datei selbst — und löscht die älteren, sofern der Browser es erlaubt. Jedes Löschen wird als Warnung im Sync-Protokoll festgehalten.

Wenn du **„Bilder von ... konnten nicht synchronisiert werden"** siehst, erreichen Fotos von diesem Rechner dieses Gerät nicht. Öffne die App auf dem genannten Gerät, prüfe, ob dein Cloud-Anbieter fertig synchronisiert hat, und lass es einmal synchronisieren. Ist das Gerät länger weg, kannst du die Meldung bis zur nächsten Synchronisierung ausblenden — sie kommt von selbst zurück, wenn das Problem weiter besteht.

## Ein Gerät ausmustern

Wenn ein Rechner oder Telefon wirklich aus dem Verkehr ist — verkauft, ersetzt, defekt — kannst du es unter **Geräte** im Bereich Backup & Sync löschen. Das entfernt seine Sicherungsdatei aus dem Ordner und nimmt es auf *allen* deinen Geräten aus der Liste, nicht nur auf dem, das du gerade vor dir hast.

Drei Dinge prüft die App vorher und lässt dich nicht weiter: ungelöste Konflikte mit diesem Gerät, Fotos von ihm, die noch eintreffen, und ein Gerät, das auf diesem noch nie synchronisiert wurde. Alle drei heißen, dass es noch etwas hält, wovon dieses Gerät keine Kopie hat — kläre das also zuerst.

**Nur ein Browser der Chrome-Familie kann die Datei wirklich entfernen.** In Firefox, Safari oder auf einem iPhone oder iPad zählt das Löschen trotzdem — das Gerät verschwindet aus deinen Listen, und alle Geräte ignorieren seine alte Datei —, aber die Datei selbst bleibt im Ordner, bis ein Chrome- oder Edge-Gerät synchronisiert und sie entfernt. Synchronisiere nach dem Löschen einmal, damit das Löschen deine anderen Geräte erreicht.

Und wenn du ein Gerät löschst, das doch noch lebt, ist nichts kaputt: Es tritt bei der nächsten Synchronisierung einfach wieder bei. Das ist Absicht, bedeutet aber auch, dass das Löschen eines noch genutzten Geräts nichts bringt — deshalb warnt die Liste, wenn ein Gerät kürzlich synchronisiert hat.

## Ein paar Sicherheitsnetze, kurz

- **Überprüfen.** Wenn zwei Geräte wirklich exakt zum selben Zeitpunkt dasselbe bearbeiten, auf eine Weise, die die App nicht selbstsicher automatisch auflösen kann, rät sie nicht — sie markiert es unter **Überprüfen…** im selben Einstellungsabschnitt, zeigt Ihnen beide Versionen und lässt Sie wählen.
- **Änderungsverlauf / Kürzlich gelöscht.** Jede Änderung und jede Löschung — Ihre eigene, oder von einem anderen Gerät übernommen — wird lokal aufbewahrt, damit Sie sie rückgängig machen können, egal ob Sie Sicherung & Synchronisierung je aktiviert haben oder nicht. Wenn eine Synchronisierung je etwas tut, das Sie nicht wollten, ist das Ihr Rückgängig-Knopf.

Und noch einmal: Das ist experimentell. Machen Sie weiterhin hin und wieder einen manuellen Export Ihrer Bibliotheken, als gute alte Sicherung, ob mit Sync-Funktion oder nicht. Vertrauen ist gut, Kontrolle ist besser — genau wie bei jedem Rechner, der Ihnen sagt, wo Ihre Kugel landen wird.
