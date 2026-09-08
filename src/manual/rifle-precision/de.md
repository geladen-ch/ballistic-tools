# geladen.ch ballistics Benutzerhandbuch — Gewehr-Präzisionsrechner

*Teil der* [Ballistik-Suite von geladen.ch](https://bc.geladen.ch)*. Nachfolger des eigenständigen Werkzeugs TARAN.*

---

## 1. Wozu dieses Werkzeug dient

Jeder Schütze hat eine Zahl, die er über sein Gewehr nennt. Sie ist fast immer falsch, und sie ist fast immer in dieselbe Richtung falsch: zu optimistisch.

Der Grund ist keine Unehrlichkeit, sondern Arithmetik. Die überlieferte Methode, die Präzision eines Gewehrs zu messen, besteht darin, eine Fünf-Schuss-Gruppe zu schießen, den Abstand zwischen den beiden am weitesten auseinanderliegenden Löchern zu messen und diese Zahl „die Präzision meines Gewehrs" zu nennen. Diese Messung ist eine einzige Ziehung aus einer sehr breiten Zufallsverteilung. Schießen Sie zehn solcher Gruppen mit demselben Gewehr, derselben Munition, von derselben Bank am selben Tag: die beste wird regelmäßig halb so groß sein wie die schlechteste. Wenn Sie dann die beste zitieren — und alle zitieren die beste — beschreiben Sie nicht Ihr Gewehr. Sie beschreiben Ihr Glück.

Der Gewehr-Präzisionsrechner macht das Gegenteil. Statt zu fragen *wie groß war diese Gruppe*, fragt er *wie groß ist die zugrunde liegende Streuung dieser Gewehr-/Laborierungs-Kombination, und wie sicher bin ich mir dieser Antwort*. Er tut das, indem er **jeden Schuss, den Sie je in das Projekt eingetragen haben** — über so viele Zielscheiben und so viele Gruppen, wie Sie zu schießen bereit sind — zu einer einzigen Schätzung zusammenfasst, und indem er neben jeder Zahl ein Vertrauensintervall angibt, damit Sie sofort sehen, ob Sie etwas Reales gemessen oder bloß wieder eine Anekdote gesammelt haben — oder ein hübsches Foto fürs Forum.

Der Arbeitsablauf ist bewusst schlicht. Sie brauchen weder Chronograph noch akustische Zielscheibe noch Laser-Entfernungsmesser noch irgendetwas App-Verbundenes. Sie brauchen Papierscheiben, ein Lineal und eine Handykamera.

### Was es nicht ist

Es ist kein Auswertungsprogramm für Wettkämpfe. Ringe, Zehnerzahl und Matchwert sind ihm gleichgültig. Es misst Streuung und Treffpunkt, sonst nichts.

Es ist auch kein Ersatz für das Werkzeug **Trefferwahrscheinlichkeit**, das Gewehrpräzision mit Wind, Entfernungsschätzfehler und Können des Schützen verbindet, um die Wahrscheinlichkeit eines Ersttreffers auf Distanz vorherzusagen. Dieses Werkzeug hier misst *eine* der Eingangsgrößen, die jenes verbraucht — die mechanische Präzision des Gewehrs selbst — und kann sie direkt übergeben (siehe §10.3).

---

## 2. Datenschutz, Speicherung und Voraussetzungen

**Nichts, was Sie in dieses Werkzeug eingeben, verlässt Ihr Gerät.** Kein Konto, kein Hochladen, keine Telemetrie, keine „anonymen Nutzungsstatistiken". Ihre Scheibenfotos — die schließlich Fotos Ihres Eigentums sind, aufgenommen an einem Ort, an dem Sie schießen — werden in der IndexedDB-Datenbank Ihres eigenen Browsers auf Ihrer eigenen Maschine gespeichert und von dort wieder gelesen. Die gesamte Berechnung, von den Pixelkoordinaten bis zu den Vertrauensintervallen, läuft als JavaScript in Ihrem Browser.

Die Folgerung ist die erwartbare: **wenn Sie die Website-Daten Ihres Browsers löschen, sind Ihre Projekte weg.** Es gibt keine serverseitige Kopie zum Wiederherstellen. Nutzen Sie die Sicherungsfunktionen (§9), wenn Ihnen die Daten wichtig sind.

**Voraussetzungen.** Jeder halbwegs aktuelle Browser. Das Werkzeug ist auf dem Telefon benutzbar — Treffer durch Antippen eines Fotos auf dem Handybildschirm zu markieren ist wohl die natürlichste Art, es zu benutzen — aber der Präzisionsbericht mit Diagramm, Legende und Zahlentabelle nebeneinander ist auf einem Tablet oder Desktop-Bildschirm bequemer. Die App installiert sich als PWA und funktioniert nach dem Laden vollständig offline.

---

## 3. Das Datenmodell: Projekte, Zielscheiben, Gruppen, Treffer

Vier Verschachtelungsebenen, und es lohnt sich, sie zu verstehen, bevor Sie zu klicken beginnen, denn hier etwas falsch zu machen ist mit Abstand die häufigste Art, einen sinnlosen Bericht zu erzeugen.

```
Projekt          ein Gewehr + eine Laborierung + eine Distanz
  └─ Zielscheibe ein Foto eines Blattes Papier
       └─ Gruppe  ein Zielpunkt und die darauf abgegebenen Schüsse
            └─ Treffer   ein Einschussloch
```

**Ein Projekt** ist die Auswertungseinheit. Alles innerhalb eines Projekts wird zu einer einzigen statistischen Schätzung zusammengefasst, was bedeutet, dass alles innerhalb eines Projekts vergleichbar sein muss: dasselbe Gewehr, dieselbe Munition, dieselbe Distanz. Ein Projekt trägt einen **Namen**, die **Distanz zur Zielscheibe** und das **Kaliber**. Die Distanz wird gebraucht, weil jedes Winkelergebnis (mrad, MOA) von ihr abhängt; das Kaliber wird gebraucht, damit das Diagramm die Einschusslöcher in ihrer wahren Größe zeichnen kann.

Wenn Sie *irgendetwas* am Gewehr oder an der Laborierung ändern — eine andere Pulverladung, ein anderes Geschoss, ein Laufreinigungsregime, an das Sie tatsächlich glauben — beginnen Sie ein neues Projekt. Zwei verschiedene Laborierungen zusammenzufassen liefert Ihnen die Streuung von keiner der beiden.

**Eine Zielscheibe** ist ein Foto. Jede Zielscheibe trägt ihre eigene Maßstabskalibrierung, weil jedes Foto aus leicht anderer Entfernung und anderem Winkel aufgenommen wird. Deshalb ist die Kalibrierung pro Zielscheibe und nicht pro Projekt: das Werkzeug nimmt nie an, dass zwei Fotos dieselben Pixel pro Millimeter haben.

**Eine Gruppe** ist ein Zielpunkt plus die darauf abgegebenen Schüsse. Ein Scheibenblatt kann, und sollte in der Regel, mehrere Gruppen tragen — ein Blatt mit vier aufgedruckten Rauten, je fünf Schuss, ist eine Zielscheibe mit vier Gruppen.

**Ein Treffer** ist ein Einschussloch, gespeichert als Position auf dem Foto.

### Warum Gruppen statistisch zählen

Jeder Schuss wird **relativ zum Zielpunkt seiner eigenen Gruppe** gemessen, nicht zu irgendeinem absoluten Ursprung auf dem Blatt. Das ist der ganze Grund, warum Gruppen als Ebene in der Hierarchie existieren.

Stellen Sie sich vier Gruppen auf einem A4-Blatt vor, auf vier verschiedene Rauten gezielt. Würde das Werkzeug einfach die rohen Lochpositionen zusammenfassen, berechnete es eine Streuung von über 200 mm — den Abstand der *Rauten*, nicht die Streuung des *Gewehrs*. Indem jeder Schuss auf den Zielpunkt zentriert wird, auf den er abgegeben wurde, fallen alle vier Gruppen auf einen gemeinsamen Ursprung zusammen, und übrig bleibt die echte Schuss-zu-Schuss-Streuung.

Das bedeutet auch, dass Ihre Zielpunktmarkierungen ehrlich sein müssen. Wenn Sie den Zielpunkt in die optische Mitte der Gruppe setzen statt an die Stelle, auf die Sie tatsächlich gezielt haben, versauen Sie die Fähigkeit des Werkzeugs, Ihren Nullpunktversatz zu messen (§8.3) — und, ehrlich gesagt, alles andere auch.

### 3.1 Anmerkung zu den Einheiten

**Jede Zahl, die dieses Werkzeug Ihnen zeigt, und jede Zahl, die es Sie eingeben lässt, steht in den Einheiten, die Sie in den Einstellungen gewählt haben.** Es gibt keine versteckten Ausnahmen und kein Feld, das klammheimlich etwas anderes erwartet. Wenn Sie in Zoll und Yards arbeiten, sehen und tippen Sie in diesem Werkzeug nirgends einen Millimeter.

Zwei der Einheitengruppen der Suite sind im Spiel:

- **Distanz** (`m`, `yd`, `ft`) — die Distanz des Projekts.
- **Kleine Länge** (`mm`, `cm`, `in`) — alles, was auf dem Papier gemessen wird: das Kalibrierlineal, das Sie eingeben, das Kaliber, die Streuung und jedes Ergebnis im Bericht, wenn die Ergebniseinheiten auf absolut statt auf winkelbezogen stehen. Da dies Messungen im Geschossmaßstab sind, werden sie feiner angezeigt als der allgemeine Standard der Suite: **2 Nachkommastellen in mm, 3 in cm und Zoll**.

Intern arbeitet die Rechenmaschine ausschließlich in Millimetern und Metern, und die Umrechnung geschieht nur an der Anzeigegrenze. Das hat eine praktische Folge, die man kennen sollte: **eine Änderung Ihrer Einheiteneinstellung verändert niemals gespeicherte Daten oder irgendein berechnetes Ergebnis.** Wechseln Sie von mm auf Zoll, und jedes bestehende Projekt wird korrekt neu angezeigt — die Kalibrierung, die Sie letztes Jahr als 100 mm eingegeben haben, liest sich nun als 3,937 in, beschreibt dasselbe Lineal und liefert genau dieselben Streuungsstatistiken.

**Wo Einheiten angezeigt werden.** Eingabefelder tragen die Einheit als lebendigen Zusatz an ihrer Beschriftung — *„Tatsächliche Länge (in)"* — der sich mitändert, wenn Sie Ihre Einstellung wechseln, statt in der Übersetzung festzustecken. Angezeigte Werte tragen die Einheit inline: *„ES 1,78 in"*. Der CSV-Export nennt die Einheit in jeder Spaltenüberschrift (§8.7).

**Die eine Ausnahme.** Der Wähler **Anzeigeeinheiten der Ergebnisse** im Bericht (§8.1) kann die Statistiken statt in einer Länge in **mrad** oder **MOA** ausdrücken. Er regiert nur Legende und Zahlentabelle; die Kopfzeile der Seite und der **Maßstab** des Diagramms folgen weiterhin Ihrer globalen Einstellung, und der CSV-Export ignoriert ihn vollständig, da rohe Koordinaten immer eine Länge sind.

In diesem ganzen Handbuch sind Rechenbeispiele der Anschaulichkeit halber in Millimetern und Metern geschrieben. Lesen Sie sie als „was auch immer Ihre eingestellte Einheit ist".

---

## 4. Schnellstart

Für Ungeduldige. Einzelheiten folgen in §5–§9.

1. **Gewehrpräzision** aus dem Werkzeugmenü → **Projekt hinzufügen**. Geben Sie ihm einen Namen, die Distanz, das Kaliber. Speichern.
2. **Zielscheibe hinzufügen** → **Foto auswählen…** → wählen Sie ein Foto Ihres Scheibenblatts → bei Bedarf drehen, die Zuschnittecken nach innen ziehen, falls gewünscht → **Dieses Foto verwenden**.
3. Sie landen direkt im Markierbereich, beim Schritt **Kalibrierung**. Tippen Sie auf ein Ende des Lineals in Ihrem Foto, tippen Sie auf das andere Ende, geben Sie die tatsächliche Länge zwischen den beiden Punkten ein — in Ihren eigenen Einheiten, wie die Feldbeschriftung sagt — und tippen Sie **Kalibrierung abschließen**.
4. Tippen Sie dorthin, wo Sie gezielt haben. Das setzt den **Zielpunkt**.
5. Tippen Sie jedes Einschussloch an. Immer weiter tippen. Wenn fertig, **Treffer-Erfassung beenden**.
6. **Gruppe hinzufügen** und ab Schritt 4 für jede weitere Gruppe auf dem Blatt wiederholen.
7. Zurück zum Projekt. **Zielscheibe hinzufügen** für das nächste Blatt, oder, wenn Sie genug Schüsse haben, **Bericht anzeigen**.

Erwarten Sie nicht, dass der Bericht vor etwa zwanzig Schuss irgendetwas Vertrauenswürdiges sagt. Siehe §8.6.

---

## 5. Projekte

### 5.1 Ein Projekt anlegen

**Projekt hinzufügen** öffnet ein kurzes Formular:

- **Projektname** — erforderlich. Wenn Sie einen Namen eingeben, den es in Ihrer Bibliothek schon gibt, erscheint eine Warnung, dass das Speichern den bestehenden Eintrag überschreibt. Es ist eine Warnung, keine Sperre.
- **Distanz** — die Entfernung von der Mündung zur Zielscheibe. Eingegeben und angezeigt in der Distanzeinheit, die Sie in den **Einstellungen** konfiguriert haben (m, yd oder ft); intern in jedem Fall in Metern gespeichert, sodass eine spätere Änderung Ihrer Einstellung bestehende Projekte korrekt neu anzeigt, statt sie zu beschädigen.

  Dieser Wert steuert jede Winkelumrechnung im Bericht, achten Sie also darauf, dass die Zahl zu der daneben angezeigten Einheit passt. Steht Ihre Einstellung auf Meter und Sie tippen `100` für eine Scheibe, die Sie in Wirklichkeit auf 100 *Yards* geschossen haben, fällt jede mrad- und MOA-Angabe im Bericht etwa 9 % zu klein aus — und nirgends wird Sie etwas warnen, denn 100 m ist eine vollkommen plausible Absicht.
- **Kaliber** — entweder aus der Standard-Bezeichnungsliste gewählt (derselben, die das Arsenal verwendet) oder direkt eingegeben, in Ihrer eingestellten Einheit für kleine Längen. Es dient dazu, Treffer im wahren Laufdurchmesser auf dem Berichtsdiagramm zu zeichnen, und sonst nirgends — es beeinflusst keine Statistik.

### 5.2 Die Projektliste

Jedes gespeicherte Projekt zeigt seinen Namen und seine Scheibenzahl. Sobald ein Projekt genug markierte Treffer für aggregierte Statistiken hat, zeigt seine Zeile zusätzlich das Hauptergebnis — den aggregierten **R50** sowohl in mrad als auch in MOA — und ein farbiges **Vertrauens-Kennzeichen**, das die Vertrauensstufe auf einen Blick angibt (siehe §8.6). So können Sie eine Liste von einem Dutzend Laborierungsprojekten überfliegen und sofort sehen, welche Sie tatsächlich genug geschossen haben, um ihnen zu glauben.

Zwei Hinweise können in einer Projektzeile erscheinen:

- **Nicht nutzbare Zielscheiben vorhanden** — mindestens einer Zielscheibe in diesem Projekt fehlt etwas, und sie wird von der Auswertung ausgeschlossen.
- **Keine nutzbare Zielscheibe gefunden** — in diesem Projekt kann noch nichts ausgewertet werden.

### 5.3 Aktionen je Projekt

- **Bearbeiten** / **Löschen** — ein Projekt zu löschen löscht alle seine Zielscheiben, Gruppen, Treffer und Fotos. Sie werden um Bestätigung gebeten.
- **In Datei sichern** — schreibt dieses eine Projekt samt Fotos in eine JSON-Datei.
- **Als Patronenpräzision übernehmen…** — übergibt die gemessene Präzision dieses Projekts an eine Arsenal-Patrone. Siehe §10.3.

---

## 6. Eine Zielscheibe hinzufügen

### 6.1 Die Zielscheibe fotografieren

Die Qualität Ihres Fotos setzt eine harte Obergrenze für die Qualität jeder Zahl, die das Werkzeug später erzeugt. Dreißig Sekunden Sorgfalt lohnen sich.

- **Fotografieren Sie senkrecht zum Papier.** Das Werkzeug wendet einen einzigen gleichförmigen Maßstabsfaktor an, abgeleitet aus Ihren beiden Kalibrierpunkten. Es korrigiert keine Perspektive. Ein schräg aufgenommenes Foto staucht eine Achse gegenüber der anderen, und dieser Fehler geht direkt in Ihre Streuungszahlen ein, waagerecht anders als senkrecht. Stellen Sie sich vor die Scheibe, halten Sie die Kamera senkrecht zum Papier und füllen Sie das Bild mit dem Blatt.
- **Legen Sie ein Lineal in die Papierebene.** Kleben Sie einen Stahlmaßstab oder eine gedruckte Skala auf die Scheibenfläche, bevor Sie darauf schießen, oder legen Sie eines vor dem Fotografieren auf. Ein vor die Scheibe gehaltenes Lineal, näher an der Kamera, erscheint größer als das Papier und lässt Ihre Gruppen kleiner wirken, als sie sind.
- **Nutzen Sie eine lange Kalibrierbasis.** Der Kalibrierfehler ist ein Prozentfehler auf jedem einzelnen Ergebnis. Kalibrieren Sie auf ein 20-mm-Merkmal und Ihre Antippen liegen einen Pixel daneben, ist das ein viel größerer relativer Fehler als dasselbe Pixel Spiel über eine 200-mm-Basis. Nehmen Sie das längste verfügbare Merkmal bekannter Länge.
- **Flaches, gleichmäßiges Licht.** Einschusslöcher im Papier sind Schatten. Hartes Seitenlicht macht aus jedem Loch einen Kometen mit hellem Rand und dunklem Schweif, und Sie markieren am Ende den Schatten statt des Lochs.
- **Nicht zu stark verkleinern.** Die App verkleinert sehr große Bilder für die Speicherung, aber Sie wollen genug Auflösung, dass ein Einschussloch im Zoom bequem mehrere Pixel breit ist.

### 6.2 Das Foto importieren

**Zielscheibe hinzufügen** → **Foto auswählen…** öffnet die Datei- bzw. Kameraauswahl Ihres Geräts. Ist eine Datei gewählt, erhalten Sie einen Vorschaubildschirm mit drei Operationen:

- **Nach links drehen** / **Nach rechts drehen** — jeweils 90°. Beachten Sie, dass das Drehen die Zuschnittauswahl auf das volle Bild zurücksetzt, denn ein vor einer Drehung gezogenes Zuschnittrechteck bezeichnet danach nicht mehr denselben Bildteil.
- **Zuschneiden** — ziehen Sie die Eckgriffe nach innen. Lassen Sie sie an den Rändern, um das ganze Foto zu behalten. Die leeren Teile des Bildes wegzuschneiden lohnt sich: es bedeutet mehr Zielscheibe auf Ihrem Bildschirm, wenn Sie zum Markieren hineinzoomen.
- **Dieses Foto verwenden** — bestätigt. Drehung und Zuschnitt werden gemeinsam in einem Durchgang auf das Originalbild in voller Auflösung angewandt, nicht auf die verkleinerte Vorschau, die Sie betrachtet haben. Eine Datei auszuwählen erzeugt für sich allein nie eine Zielscheibe; nur dieser Knopf tut das.

Das Bestätigen führt Sie direkt in den Markierbereich.

Lässt sich die Datei nicht dekodieren, erhalten Sie *„Dieses Foto konnte nicht verarbeitet werden"* — versuchen Sie ein anderes Format (PNG und JPEG sind die sicheren Wahlen).

---

## 7. Eine Zielscheibe markieren

Der Markierbereich ist eine bildschirmfüllende, verschiebbare und zoombare Ansicht des Fotos mit einer Schrittanzeige und Bedienelementen darunter. Er führt Sie der Reihe nach durch drei Schritte — Kalibrierung, Zielpunkt, Treffer — und geht dann in einen Ruhezustand über, aus dem heraus Sie weitere Gruppen hinzufügen können.

**Alles speichert automatisch.** Jeder Punkt, den Sie setzen, jeder Punkt, den Sie ziehen, jeder Treffer, den Sie löschen, wird sofort in den Speicher geschrieben. Es gibt keinen Speicherknopf und keine Möglichkeit, durch Wegnavigieren Arbeit zu verlieren.

**Alles ist ziehbar.** Es gibt nirgends eine gesonderte Aktion „diesen Punkt bestätigen": Antippen *ist* Setzen. Landet ein Punkt leicht daneben, zoomen Sie hinein und ziehen Sie ihn. Beide Kalibrierpunkte, der Zielpunkt der aktiven Gruppe und jeder ihrer Treffer lassen sich jederzeit nachjustieren.

Nur die Punkte der **aktiven** Gruppe sind ziehbar. Die Zielpunkte anderer Gruppen bleiben als feste Bezugspunkte sichtbar, sodass Sie die Aufteilung des ganzen Blattes sehen, ohne bereits fertige Arbeit stören zu können.

### 7.1 Schritt 1 — Maßstab kalibrieren

*„Tippen Sie auf dem Foto den ersten Kalibrierpunkt an — ein Ende eines Lineals oder ein Merkmal bekannter Länge auf der Zielscheibe."*

Tippen Sie einmal für den ersten Punkt, ein weiteres Mal für den zweiten, und geben Sie dann die **tatsächliche Länge** zwischen den beiden Punkten ein.

**Geben Sie sie in Ihren eigenen Einheiten ein.** Die Feldbeschriftung trägt einen lebendigen Einheitenzusatz — *„Tatsächliche Länge (mm)"*, *„(cm)"* oder *„(in)"* je nach Ihrer Einstellung für kleine Längen — legen Sie also einen 6-Zoll-Maßstab auf die Scheibe, während Zoll gewählt ist, und Sie tippen schlicht **6**. Keine Umrechnung, keine Rechnerei, nichts, was man verkehrt herum machen könnte. Der Wert wird auf dem Weg in den Speicher in die internen Millimeter der Rechenmaschine umgerechnet, und genau deshalb zeigt eine spätere Änderung Ihrer Einstellung dasselbe Lineal korrekt neu an, statt es zu beschädigen.

Die Schrittweite des Feldes und sein kleinster akzeptierter Wert sind die Anzeigegenauigkeit dieser Einheit — 0,01 mm oder 0,001 cm/in — sodass alles, was Ihnen gezeigt werden kann, auch eingegeben werden kann.

Die auf dem Foto gezeichnete Kalibrierlinie ist mit demselben Wert in derselben Einheit beschriftet und lässt überflüssige Nullen weg: ein 100-mm-Lineal liest sich als *„100 mm"*, nicht als *„100,00 mm"*. Prüfen Sie diese Beschriftung, bevor Sie weitergehen; sie ist die eine Zahl im Projekt, an der alles andere skaliert wird, und ein Ausrutscher hier skaliert die Ergebnisse einer ganzen Zielscheibe, ohne irgendetwas zu erzeugen, das nach einem Fehler aussieht.

Die Kalibrierlinie wird grün mit beschrifteter Länge gezeichnet. Zoomen Sie hinein und ziehen Sie die Endpunkte, bis sie genau auf den Marken liegen, zwischen denen Sie gemessen haben.

**Kalibrierung abschließen** geht weiter. Das ist ein bewusst ausdrücklicher Schritt statt eines automatischen Weiterspringens, damit das Nachjustieren der Endpunkte oder das Neueingeben der Länge beim Doppelprüfen Ihrer Arbeit Sie nie unerwartet aus dem Schritt wirft.

**Neu kalibrieren**, später aus dem Ruhezustand verfügbar, bringt Sie hierher zurück, ohne die bereits gesetzten Punkte zu verwerfen. Ein Neukalibrieren skaliert jede Messung dieser Zielscheibe rückwirkend neu — Treffer sind als Positionen auf dem Foto gespeichert, nicht als Millimeter, also behebt das Korrigieren einer schlechten Kalibrierung Monate später auch alle ihre Ergebnisse.

### 7.2 Schritt 2 — Zielpunkt

*„Tippen Sie auf das Foto, um den Zielpunkt dieser Gruppe zu setzen."*

Ein Antippen. Markieren Sie, wohin Sie *gezielt* haben, nicht wo die Gruppe gelandet ist. Als rotes Fadenkreuz gezeichnet.

Das Setzen des Zielpunkts geht sofort zum Trefferschritt weiter.

### 7.3 Schritt 3 — Treffer markieren

*„Tippen Sie auf das Foto, um jedes Einschussloch zu erfassen — für weitere einfach weitertippen."*

Tippen Sie jedes Loch an. Jeder Treffer wird als nummerierter Punkt in Ihrer eingestellten **Trefferfarbe** gezeichnet (Einstellungen → Trefferfarbe, geteilt mit dem Werkzeug Trefferwahrscheinlichkeit), umringt von einem weiß-dunklen Doppelrand, damit er auf jedem Teil eines echten Fotos sichtbar bleibt — schwarzer Spiegel, weißes Papier oder Aufdruck. Keine Begrenzung pro Gruppe.

Sobald eine Gruppe zwei oder mehr Schüsse hat, zeichnet die Überlagerung die **Streuungslinie** zwischen den beiden am weitesten auseinander liegenden Löchern, beschriftet mit ihrer Länge, und markiert den **mittleren Treffpunkt** der Gruppe — ihren Schwerpunkt. Auch die Streuungslinie folgt der Trefferfarbe, sodass sich die ganze Gruppe als Einheit liest.

Beide Beschriftungen auf dem Bildschirm — die Streuungslänge und die grüne Kalibrierlänge — stehen in Ihrer eingestellten Einheit für kleine Längen.

Tippen Sie konsequent. Ob Sie die Mitte jedes Lochs oder seine linke obere Kante markieren, ist weniger wichtig, als es jedes Mal gleich zu tun; ein systematischer Versatz auf alle Schüsse hebt sich in der Streuung auf, ein zufälliger nicht.

**Treffer löschen** schaltet in einen Löschmodus: *„Tippen Sie auf den Treffer, den Sie entfernen möchten, oder Abbrechen, um ihn zu behalten."* Tippen Sie die Marke eines Schusses an, um ihn zu entfernen, Abbrechen, um den Modus zu verlassen. Das ist ein eigener Modus statt eines langen Drucks oder einer Wischgeste, gerade weil das Entfernen eines Schusses aus einem Datensatz, den Sie ehrlich halten wollen, Absicht erfordern sollte.

Die Schaltfläche **Treffer-Erfassung beenden** tut, was draufsteht — sie versetzt diese ganze Mechanik zurück in den sogenannten „Ruhezustand".

### 7.4 Mehrere Gruppen je Zielscheibe

Aus dem Ruhezustand — *„Wählen Sie unten eine Gruppe, um weitere Schüsse hinzuzufügen, oder fügen Sie eine neue Gruppe hinzu"* — erhalten Sie eine Reiterleiste mit einem Reiter je Gruppe, jeder mit Nummer und Schusszahl beschriftet.

- Einen Gruppenreiter anzutippen macht sie aktiv und tritt wieder in den Trefferschritt ein, sodass Sie Schüsse an eine Gruppe anhängen können, die Sie für abgeschlossen hielten.
- **Gruppe hinzufügen** startet eine frische Gruppe: Sie werden zum Zielpunktschritt zurückgeführt, und die Schüsse der neuen Gruppe beginnen von dort.

Die Zeile jeder Gruppe zeigt ihre Schusszahl und ihre **ES** — die Streuung, den Abstand zwischen ihren beiden am weitesten auseinander liegenden Treffern, in Ihrer eingestellten Einheit für kleine Längen. Diese Zahl wird angezeigt, weil sie jeder sehen will und weil sie nützlich ist, um einen falsch markierten Schuss zu erkennen — behalten Sie aber im Kopf, dass sie genau die Kenngröße ist, von der abzubringen dieses ganze Werkzeug existiert.

### 7.5 Gruppenübersichtsbild speichern

Lädt ein PNG der **derzeit aktiven Gruppe** genau so herunter, wie sie markiert ist — Zielpunkt, nummerierte Treffer, Streuungslinie mit Beschriftung, mittlerer Treffpunkt und Kalibrierlinie mit ihrer Länge — zugeschnitten auf das, was Sie gerade gezoomt und verschoben auf dem Bildschirm haben. Treffer werden im wahren Kaliber des Projekts gezeichnet.

Das exportierte Bild ist eine getreue Kopie dessen, was auf dem Bildschirm steht: gleiche Trefferfarbe, gleicher Doppelrand, und beide Beschriftungen — Streuung und Kalibrierlänge — in denselben Einheiten, die Sie ansehen. Daran zu denken lohnt sich, wenn Sie das Bild irgendwo veröffentlichen, denn der Empfänger hat keine Möglichkeit zu wissen, welche Einheiteneinstellung beim Speichern aktiv war. Geht das Bild an ein imperiales Publikum, wechseln Sie die Einstellung vor dem Export.

Die Kalibrierlinie ist hier enthalten, obwohl die Markieransicht sie nur während des Kalibrierschritts selbst zeigt — ein exportiertes Bild sollte den Nachweis seines eigenen Maßstabs mit sich führen.

Nützlich für ein Laborierungs-Notizbuch, einen Forenbeitrag oder um einem Büchsenmacher den Beleg eines Problems zu geben, ohne das ganze Projekt zu exportieren.

### 7.6 Wann ist eine Zielscheibe nutzbar?

Eine Zielscheibe muss **alle drei** der folgenden Dinge haben, bevor sie zu einem Bericht beitragen kann:

1. eine abgeschlossene **Kalibrierung** (beide Punkte gesetzt *und* eine von null verschiedene tatsächliche Länge eingegeben),
2. mindestens eine Gruppe mit einem **Zielpunkt**,
3. mindestens einen **Treffer**.

Eine Zielscheibe, der eines davon fehlt, trägt das Kennzeichen **Unbrauchbar** und einen Hinweis, der genau ausbuchstabiert, was noch fehlt — *„Erforderlich: Kalibrierung, mindestens 1 Treffer"*. Unbrauchbare Zielscheiben werden stillschweigend aus dem aggregierten Bericht ausgeschlossen; sie sind kein Fehler, nur noch nicht fertig.

---

## 8. Der Präzisionsbericht

**Bericht anzeigen** erscheint bei einem Projekt, sobald mindestens eine seiner Zielscheiben nutzbar ist. Der Bericht fasst jeden Schuss aus jeder nutzbaren Gruppe auf jeder nutzbaren Zielscheibe zu einer einzigen Auswertung zusammen.

Die Zeile unter dem Titel wiederholt die Projektparameter und den Stichprobenumfang: *Distanz, Kaliber, N Schuss*. Prüfen Sie sie. Ist die Schusszahl nicht die erwartete, haben Sie irgendwo eine unbrauchbare Zielscheibe.

### 8.1 Anzeigeeinheiten der Ergebnisse

Ein Wähler oben regiert die Einheiten jedes Wertes in der Legende und der Zahlentabelle darunter. Er bietet drei Möglichkeiten:

- **Ihre eingestellte Einheit für kleine Längen** — die Option ist mit der tatsächlichen Einheit beschriftet (`mm`, `cm` oder `in`, je nach Einstellung), nicht mit einem allgemeinen Wort, sodass Sie auf einen Blick sehen, was Sie gleich lesen werden. Das ist die absolute, lineare Größe auf dem Papier, angezeigt mit 2 Nachkommastellen in mm und 3 in cm oder Zoll.
- **mrad** — Milliradiant, mit 3 Nachkommastellen.
- **MOA** — Winkelminuten, mit 2 Nachkommastellen.

Winkeleinheiten werden über die projekteigene Distanz umgerechnet. Lineare Einheiten sind das, was tatsächlich gemessen wurde; Winkeleinheiten sind die, in denen Ihr Zielfernrohrturm geteilt ist. Um Gewehre zu vergleichen, die auf verschiedene Distanzen geschossen wurden, nehmen Sie die Winkelansicht — eine 20-mm-Gruppe auf 100 m und eine 40-mm-Gruppe auf 200 m unterscheiden sich in absoluten Zahlen um den Faktor zwei, spiegeln aber dieselbe (winkelbezogene) Präzision wider. Um zu überlegen, ob ein Geschoss durch ein Loch passt, nehmen Sie die lineare.

### 8.2 Das aggregierte Diagramm

**Aggregierte Ergebnisse** ist das zusammengefasste Streudiagramm: jeder Schuss des Projekts, gezeichnet relativ zum Zielpunkt seiner eigenen Gruppe, alle auf einem gemeinsamen Ursprung. Die **Legende** steht daneben und listet jedes gerade gezeichnete Element mit Farbe, Namen und Wert auf.

Drei Elemente werden immer gezeichnet und lassen sich nicht abschalten:

- **Alle Treffer** — die zusammengefassten Schüsse, gezeichnet in Ihrer eingestellten **Trefferfarbe** (Einstellungen → Trefferfarbe; die Voreinstellung ist ein dunkles Beerenrot) mit demselben weiß-dunklen Doppelrand wie in der Markieransicht, damit Punkte dort lesbar bleiben, wo sie einander oder das Gitter überlappen. Die Farbmarke der Legende liest aus derselben Quelle und kann daher nie von dem abweichen, was gezeichnet wurde.
- **Zielpunkt** (rotes Fadenkreuz) — konstruktionsbedingt im Ursprung,
- **Treffpunkt** (orange) — der zusammengefasste Schwerpunkt.

Die Trefferfarbe wird zum Zeichenzeitpunkt gelesen, eine Änderung in den Einstellungen erscheint also beim nächsten Zeichnen des Diagramms — auch in einem exportierten SVG.

Alles andere ist optional, und jedes optionale Element wird über die Spalte **Auf Bild anzeigen** der Zahlentabelle (§8.4) oder über die **Bildoptionen** (§8.5) geschaltet. Etwas zu schalten aktualisiert Diagramm, Legende und exportiertes Bild gemeinsam — was Sie sehen, ist genau das, was Sie exportieren.

### 8.3 Was die Zahlen bedeuten

Jeder Wert unten wird in dem angezeigt, worauf der Wähler **Anzeigeeinheiten der Ergebnisse** steht (§8.1). Die Rechenbeispiele hier sind der Anschaulichkeit halber in Millimetern geschrieben; lesen Sie sie in Ihrer eigenen Einheit.

**Schusszahl** — wie viele Schüsse zusammengefasst wurden. Das ist die Zahl, auf die es am meisten ankommt, und die, von der alle wollen, dass sie kleiner sein darf, als sie sein muss.

**Vertrauensintervall** — ausgedrückt als Prozentpaar, z. B. `-15%/+22%`. Das ist das 95-%-Vertrauensintervall auf die Streuungsschätzung selbst. Lesen Sie es so: *die wahre Streuung dieses Gewehrs liegt mit 95 % Vertrauen irgendwo zwischen 15 % kleiner und 22 % größer als die Zahl, die ich Ihnen zeige*. Diese eine Zeile ist die Ehrlichkeitsprüfung für alles andere auf der Seite.

**Mittlerer Treffpunkt** — wo die Gruppenmitte relativ zum Zielpunkt liegt, als waagerechtes und senkrechtes Paar, stets mit ausdrücklichem Vorzeichen. Das ist Ihr Nullpunktfehler.

Die Konvention ist die des Schützen: **positives H nach rechts, positives V nach oben**, dieselben Richtungen, in denen Ihre Türme beschriftet sind. Eine Anzeige von `H +6 mm, V -14 mm` bedeutet also, dass Ihr Gewehr **6 mm rechts und 14 mm tief** schießt, und das zu korrigieren heißt, nach links und nach oben zu gehen.

**Vertrauensbereich des Treffpunkts** — wie gut Sie diesen Nullpunktfehler tatsächlich kennen, als `H ±…, V ±…`. Das ist die Zahl, die Ihnen sagt, ob es sich lohnt, die Türme anzufassen. Liegt Ihr Versatz 8 mm tief und der Vertrauensbereich darauf bei ±11 mm, haben Sie keinen Nullpunktfehler gemessen; Sie haben Rauschen gemessen. Schießen Sie weiter.

**Standardabweichung (Sigma, σ)** — der Streuungsparameter des angepassten Modells. An der Bank nicht direkt nützlich, aber es ist die Größe, aus der alle Radien unten abgeleitet werden, und die Größe, auf die sich das Vertrauensintervall bezieht.

**R50** — der Radius des Kreises um den Treffpunkt, der 50 % der Schüsse enthält. Klassisch **kreisförmiger Wahrscheinlichkeitsfehler** (CEP) genannt. Das ist die beste einzelne Kennzahl für die Präzision eines Gewehrs: sie ist ein Median, also robust, und sie ist die Form, die der Rest dieser Anwendung verbraucht (§10.3).

**R95** — der Radius, der 95 % der Schüsse enthält.

**R99** — der Radius, der 99 % der Schüsse enthält. Hüten Sie sich davor, hier zu viel hineinzulesen: Sie extrapolieren den Schwanz eines angepassten Modells weit über den Bereich hinaus, in dem Sie Daten haben, und das Modell nimmt an, dass es keine Ausreißer gibt.

**Das Vertrauensintervall von R95** — der R95-Radius mit seinem eigenen Unsicherheitsband, auf dem Diagramm als blasser Ring endlicher Dicke statt als Linie dargestellt. Ein gutes Element, um es eingeschaltet zu lassen: es macht die Unsicherheit geometrisch sichtbar, statt sie in einer Tabelle zu verstecken.

**ES5x** — die durchschnittliche Streuung, die Sie von einer Fünf-Schuss-Gruppe dieses Gewehrs *erwarten* sollten. **ES10x** — ebenso für zehn Schuss.

Diese beiden verdienen einen Absatz, denn sie sind die Brücke zwischen diesem Werkzeug und der Art, wie alle anderen über Präzision reden. Sagt Ihr Projekt ES5x = 22 mm, so heißt das: wenn Sie hinausgehen und Fünf-Schuss-Gruppen mit diesem Gewehr schießen, werden sie im *Durchschnitt* 22 mm messen. Nicht „werden" — *im Durchschnitt*. Manche werden 14 mm sein und manche 32 mm, und die mit 14 mm ist die, die im Internet landet. ES5x ist die ehrliche Fassung der Zahl, mit der Sie gerade angeben wollten, und sie erlaubt Ihnen zugleich, dieses Werkzeug gegen Ihre eigenen früheren Aufzeichnungen zu prüfen.

**1-MOA-Referenz** — ein gestrichelter Kreis von genau einer MOA Durchmesser auf die Distanz des Projekts, mit seiner realen Größe beschriftet. Ein Lineal fürs Auge: es macht aus „ist das ein Sub-MOA-Gewehr" eine Frage, die man durch Hinsehen statt durch Rechnen beantwortet.

### 8.4 Die Zahlentabelle

Alle Statistiken von oben in einer Tabelle: **Beschreibung**, **Bezeichnung**, **Wert** und **Auf Bild anzeigen**. Das Kästchen in der letzten Spalte fügt dieses Element gleichzeitig dem Diagramm, der Legende und dem exportierten Bild hinzu. Schusszahl, Vertrauensintervall und mittlerer Treffpunkt haben kein Kästchen — die ersten beiden sind nicht geometrisch, und der Treffpunkt wird immer gezeichnet.

### 8.5 Bildoptionen

- **Legende mit Ergebnisbild speichern** (standardmäßig an) — ob der SVG-Export das Legendenfeld und den Vertrauensmesser enthält oder nur das nackte Diagramm. Siehe §8.7.
- **Gitter** — ein optionales Bezugsgitter mit **0,1 mrad**, **0,05 mrad**, **1/4 MOA** oder **1/8 MOA** Abstand, oder keines. Der Abstand ist winkelbezogen, seine reale Größe wird also aus der Distanz des Projekts berechnet. Stellen Sie ihn auf den Klickwert Ihres Zielfernrohrs, und das Diagramm wird unmittelbar in Turmklicks lesbar.
- **Treffer maßstabsgetreu** (standardmäßig an) — zeichnet jeden Treffer im wahren Laufdurchmesser des Projekts statt in fester Markengröße. Das ist die ehrliche Darstellung, und zugleich die, die ein gutes Gewehr auf kurze Distanz wie einen unlesbaren Klumpen überlappender Kreise aussehen lässt. Schalten Sie sie aus, wenn die Überlappung stört.
- **1 MOA** — der oben beschriebene gestrichelte Bezugskreis.
- **Trefferwahrscheinlichkeitsradius** — ein Schieberegler von 0 % bis 99 %. Ziehen Sie ihn, und auf dem Diagramm erscheint ein dunkelroter Kreis mit dem Radius, der diesen Anteil der Schüsse enthält. Die Anzeige gibt diesen Radius auf drei Arten zugleich — in Ihrer eingestellten Längeneinheit, in mrad und in MOA — sodass Sie ihn gegen eine Zielgröße, eine Absehen-Teilung oder eine Turmskala halten können, ohne irgendetwas von Hand umzurechnen.

  Das ist die praktische Form von *„wie groß muss das Ziel sein, damit ich es neun von zehn Mal treffe?"* — und rückwärts gelesen: *„welcher Anteil meiner Schüsse landet in einem Ziel dieser Größe?"*

  **Es ist ein Radius, kein Durchmesser.** Ein 100-mm-Gong hat 50 mm Radius: ziehen Sie den Regler, bis die Anzeige 50 mm sagt, und lesen Sie den Prozentwert am Regler ab. Das Halbieren zu vergessen ist der hier mit Abstand am leichtesten gemachte Fehler, und er schmeichelt Ihnen kräftig.
- **Maßstab** — ein Maßstabsbalken auf dem Diagramm, damit das exportierte Bild ohne Legende lesbar ist.

Jede dieser Einstellungen — der Einheitenwähler, jedes Kästchen „Auf Bild anzeigen", das Gitter, die Bildoptionen, die Reglerstellung — wird gemerkt und beim nächsten Öffnen irgendeines Berichts wiederhergestellt, auch nach einem Neustart der App. Es sind Anzeigeeinstellungen, keine Projektdaten: sie folgen Ihnen von Projekt zu Projekt.

### 8.6 Der Vertrauensmesser

Eine senkrechte Skala mit einem Zeiger, und das mit Abstand wichtigste Element der Seite.

Er beantwortet eine Frage: **habe ich genug geschossen, um überhaupt etwas sagen zu können?** Die Zeigerstellung wird von der Breite des Vertrauensintervalls auf die Streuungsschätzung getrieben — schmales Intervall, hoher Zeiger. Der Balken ist von unten nach oben in Bänder geteilt: **KEIN VERTRAUEN**, **NIEDRIG**, **MITTELMÄSSIG**, **HOCH**, **SEHR HOCH**, mit einer gestrichelten Linie am oberen Rand des Bandes „KEIN VERTRAUEN", beschriftet mit der für dieses Werkzeug typischen Zurückhaltung: *„(Bullshit-Schwelle)"*.

Unterhalb dieser Linie stützen Ihre Daten keine Aussage über Ihr Gewehr.

Das Feld neben der Skala gibt eine Qualität in Worten, eine **Vertrauensstufe** auf einer Skala von 0 bis 4 mit Plus-Noten, und den Vertrauensbereich als Gesamtprozentsatz nebst seinen beiden Grenzen.

Und so viel kostet das an Munition. Diese Zahlen sind exakt, und sie sind eine Eigenschaft der Mathematik, nicht Ihres Gewehrs — ein gutes Gewehr erreicht Vertrauen nicht schneller als ein schlechtes:

| Schüsse | Vertrauensbereich | σ bekannt auf | Stufe | Qualität |
|---:|---:|:---|:---:|:---|
| 3 | 227 % | −40 % … +187 % | 0 | Unbrauchbar |
| 5 | 124 % | −32 % … +92 % | 0 | Unbrauchbar |
| 10 | 72 % | −24 % … +48 % | 0 | Unbrauchbar |
| 15 | 56 % | −21 % … +35 % | 0 | Unbrauchbar |
| **19** | 49 % | −19 % … +30 % | 1 | Kaum zu gebrauchen |
| 22 | 45 % | −18 % … +27 % | 1+ | Schlecht |
| 27 | 40 % | −16 % … +24 % | 2 | Mittelmäßig |
| 35 | 35 % | −14 % … +20 % | 2+ | Über dem Durchschnitt |
| 46 | 30 % | −13 % … +17 % | 3 | Gut |
| 65 | 25 % | −11 % … +14 % | 3+ | Sehr gut |
| 99 | 20 % | −9 % … +11 % | 4 | Hervorragend |

Lesen Sie den Kopf dieser Tabelle, und lesen Sie ihn noch einmal. **Eine Fünf-Schuss-Gruppe sagt Ihnen die Streuung Ihres Gewehrs auf etwa minus ein Drittel, plus einen Faktor zwei genau.** Zehn Schuss — zwei „Gruppen", nach den Maßstäben der meisten eine respektable Sitzung — lassen Sie noch immer unfähig, ein Gewehr von einem anderen zu unterscheiden, das 40 % schlechter ist. Aus *Unbrauchbar* kommen Sie erst bei neunzehn Schuss heraus, und eine wirklich enge Antwort bekommen Sie erst nahe der Hundert.

Daraus folgt, dass die einzige Aussage, die eine einzelne, ins Internet gestellte 3-Schuss-Gruppe wirklich zulässt, eine Aussage über die statistische Unbildung des Posters ist — oder über seine intellektuelle Unredlichkeit.

Das ist kein Mangel des Werkzeugs. Es ist das, was das Messen einer zweidimensionalen Zufallsgröße tatsächlich kostet, und jede Präzisionsbehauptung, die Sie je gelesen haben und die auf einer Fünf-Schuss-Gruppe beruhte, unterlag genau derselben Arithmetik — sie hat es Ihnen nur nicht gesagt.

Die gute Nachricht ist, dass diese Schüsse nicht in einem Zug, nicht an einem Tag und nicht auf ein Blatt Papier abgegeben werden müssen. Das ist der ganze Sinn der Struktur Projekt/Zielscheibe/Gruppe: schießen Sie fünf Patronen pro Woche über fünf Monate und lassen Sie das Werkzeug sie ansammeln.

### 8.7 Exporte

**Bild speichern** (neben der Überschrift Aggregierte Ergebnisse) schreibt das Diagramm als **SVG** — vektoriell, es skaliert also ohne Pixelbildung auf jede Größe. Ist *Legende mit Ergebnisbild speichern* eingeschaltet, trägt die exportierte Datei eine Kopfzeile mit Projektname, Distanz, Kaliber und Schusszahl, das vollständige Legendenfeld und eine Darstellung des Vertrauensmessers, sodass das Bild für sich steht und nicht seiner Unsicherheit entkleidet zitiert werden kann. Der Export wird frisch mit weißem Hintergrund erzeugt, er druckt und fügt sich also sauber in Dokumente ein, unabhängig davon, welches App-Design Sie benutzen.

**CSV exportieren** schreibt die Rohkoordinaten jedes zusammengefassten Schusses, eine Zeile je Schuss:

| Spalte | Bedeutung |
|---|---|
| `ShotRight (mm)` | waagerechter Versatz zum Zielpunkt seiner Gruppe, positiv nach **rechts** |
| `ShotUp (mm)` | senkrechter Versatz zum Zielpunkt seiner Gruppe, positiv nach **oben** |
| `Target` | der Name der Zielscheibe |
| `Group` | die Nummer der Gruppe innerhalb ihrer Zielscheibe |
| `Distance (m)` | die Distanz des Projekts |
| `Description` | der Name des Projekts |

**Jede Spalte nennt sowohl ihre Richtung als auch ihre Einheit.** Stellen Sie auf Zoll und Yards, und die Überschriften lauten `ShotRight (in)`, `ShotUp (in)`, `Distance (yd)`, mit passend umgerechneten Werten — die Koordinaten in der Genauigkeit Ihrer kleinen Länge (2 Nachkommastellen in mm, 3 in cm oder Zoll), die Distanz in der ihrer eigenen Gruppe. Die Datei sagt damit auf ihrer Stirn, was sie bedeutet: nichts daran muss erinnert, nachgeschlagen oder aus den Einstellungen erschlossen werden, die beim Schreiben zufällig aktiv waren. Die Spalten*namen* bleiben unabhängig von der App-Sprache englisch, da sie Bezeichner für das Werkzeug sind, an das die Datei geht.

Der Wähler **Anzeigeeinheiten der Ergebnisse** reicht nicht bis zum CSV. Er kann Statistiken winkelbezogen ausdrücken, in mrad oder MOA, aber dies hier sind Rohkoordinaten, und die sind immer eine Länge.

> **Formatänderung.** Diese Spalten hießen früher `ShotX` und `ShotY`, und `ShotY` war positiv nach *unten* — das Gegenteil von `ShotUp`. Die Umbenennung ist beabsichtigt: eine Tabellenkalkulation, die `ShotY` beim Namen ansprach, scheitert nun sichtbar, statt still verkehrte Zahlen einzulesen. Haben Sie archivierte Exporte, stehen sie in der alten Konvention; kehren Sie das Vorzeichen ihres `ShotY` um, um sie mit einer neuen Datei zu vergleichen.

Feld- und Dezimaltrennzeichen folgen Ihren Einstellungen unter **Einstellungen → CSV-Export**, sodass die Datei in der von Ihnen verwendeten Tabellen-Locale sauber öffnet — das regiert die *Formatierung* der Zahlen, unabhängig von den obigen Einheiten. Das ist die Hintertür: wenn Sie Ihre eigene Auswertung fahren, Ihr eigenes Modell anpassen oder die Arithmetik des Werkzeugs prüfen wollen, hier sind Ihre Rohdaten.

---

## 9. Sicherung, Wiederherstellung und Datenverwaltung

Der Speicher des Werkzeugs liegt in Ihrem Browser. Sichern Sie ihn.

- **In Datei sichern** (je Projekt) — ein Projekt, in sich abgeschlossen.
- **Bibliothek in Datei sichern…** — ein Dialog, in dem Sie wählen, welche Projekte einbezogen werden, und dann eine einzige JSON-Datei mit allen.
- **Sicherung aus Datei laden…** — importiert eine zuvor gespeicherte Datei.

Fotos reisen innerhalb der Sicherungsdatei mit, was diese Dateien groß, aber wirklich vollständig macht: ein wiederhergestelltes Projekt ist voll neu markierbar und voll neu auswertbar.

### Umgang mit Konflikten beim Import

Importierte Projekte werden **über den Namen** mit Ihrer bestehenden Bibliothek abgeglichen, ohne Rücksicht auf Groß-/Kleinschreibung und Leerzeichen. Wo ein Name kollidiert, wählen Sie, wie aufgelöst wird:

- **Überschreiben** — die importierte Fassung ersetzt die bestehende.
- **Überschreiben, wenn neuer** — ersetzt nur, wenn der Änderungszeitstempel des importierten Projekts später ist als der des bestehenden; sonst wird es übersprungen. Die sichere Wahl beim Zusammenführen zweier Geräte.
- **Umbenennen** — importiert als Kopie, benannt *„<Name> - Kopie (1)"*, und so weiter.

Der Import meldet, wie viele Einträge gespeichert und wie viele übersprungen wurden. Ist die Datei kein gültiges JSON, oder gültiges JSON, aber kein Gewehrpräzisions-Export, erhalten Sie einen konkreten Fehler statt einer stillen Nichtreaktion.

---

## 10. In die Praxis umgesetzt

### 10.1 Laborierungsentwicklung

Die Versuchung ist, eine Drei-Schuss-Gruppe je Pulverladung zu schießen, die kleinste auszuwählen und einen Knoten auszurufen. Die Tabelle in §8.6 sagt Ihnen genau, was dieses Vorgehen wert ist: bei drei Schuss umspannt die Streuungsschätzung ungefähr einen Faktor fünf. Sie wählen Rauschen aus.

Das richtige Vorgehen mit diesem Werkzeug ist:

1. Ein **Projekt je Laborierung**. Identische Namen bis auf den variierten Parameter, damit die Projektliste sinnvoll sortiert.
2. Schießen Sie jede Laborierung wiederholt, über mehrere Sitzungen, und fügen Sie ihrem Projekt dabei Zielscheiben hinzu.
3. Beobachten Sie das Vertrauens-Kennzeichen in der Projektliste. Schießen Sie weiter, bis jeder Kandidat wenigstens aus dem Band *Unbrauchbar* heraus ist, vorzugsweise bei *Mittelmäßig*.
4. Vergleichen Sie Laborierungen über **R50 samt Vertrauensintervall**, nicht über R50 allein.

Die Entscheidungsregel ist einfach und sie ist streng: **wenn sich die Vertrauensintervalle zweier Laborierungen überlappen, haben Sie nicht gezeigt, dass sie verschieden sind.** Sie mögen durchaus verschieden sein — aber nicht nach Ihrer Beweislage. Entweder schießen Sie mehr, oder Sie akzeptieren, dass Sie sie nicht auseinanderhalten können, und wählen auf anderer Grundlage (Geschwindigkeitskonstanz, Verfügbarkeit der Komponenten, wovon Sie ohnehin eine Kiste haben).

Diese Regel wird, wenn Sie sie ehrlich anwenden, die meisten Laborierungsschlüsse der Schießliteratur disqualifizieren. Das ist beabsichtigt — diese „Mehrheit der Schlussfolgerungen" ist ungebildeter Bullshit.

### 10.2 Einschießen

Der **mittlere Treffpunkt** und sein **Vertrauensbereich** sind die Werkzeuge zum Einschießen, und der Vertrauensbereich ist der, den die Leute überspringen.

Die Regel: **verstellen Sie nichts, solange der Vertrauensbereich des Treffpunkts nicht kleiner ist als die Korrektur, die Sie vornehmen wollen** — und idealerweise kleiner als ein Turmklick auf Ihrer Distanz. Zeigt Ihr Treffpunkt 12 mm tief ±15 mm, ist das Verstellen ein Münzwurf, der Ihren Nullpunkt irgendwohin verschiebt, wo Sie nicht gemessen haben. Schießen Sie mehr, sehen Sie zu, wie das Intervall schrumpft, und verstellen Sie dann einmal.

Stellen Sie die Ergebniseinheiten auf **mrad** oder **MOA** passend zu Ihren Türmen, und die Korrektur wird eine Zahl, die Sie unmittelbar einstellen können, statt einer, die Sie aus einer linearen Messung auf eine erinnerte Distanz umrechnen müssen.

Die Vorzeichen sind die auf Ihren Turmkappen — positives V nach oben, positives H nach rechts — die Korrektur ist also die Anzeige mit umgekehrtem Vorzeichen: ein Treffpunkt von `V -14 mm` verlangt 14 mm nach oben.

Stellen Sie das **Gitter** auf den Klickwert Ihres Zielfernrohrs und lesen Sie die Korrektur unmittelbar in Klicks vom Diagramm ab.

### 10.3 Den Rest der Suite füttern

**Als Patronenpräzision übernehmen…** in einer Projektzeile übergibt die gemessene Präzision dieses Projekts an eine Arsenal-Patrone. Der Dialog listet jedes Projekt mit berechenbaren Statistiken auf und zeigt zu jedem den aggregierten R50 in mrad und MOA nebst seinem Vertrauens-Kennzeichen, damit Sie sehen, worauf Sie sich einlassen. Eines auszuwählen schreibt diesen R50 in die gewählte Patrone.

Von dort fließt er in **Trefferwahrscheinlichkeit**, wo er mit Windunsicherheit, Entfernungsschätzfehler und Können des Schützen zu Ersttreffer-Wahrscheinlichkeiten auf Distanz verrechnet wird. Das ist der Lohn der ganzen Übung: der Unterschied zwischen einer Trefferwahrscheinlichkeit, die aus einem gemessenen, vertrauensbegrenzten R50 berechnet wurde, und einer, die aus einer von einer Fünf-Schuss-Gruppe erinnerten Zahl berechnet wurde, ist der Unterschied zwischen einer wissenschaftlichen Berechnung und einer rosaroten Illusion.

Das Arsenal speichert die Gewehrpräzision intern als R50 in mrad, nimmt aber Eingaben in der Konvention entgegen, die Ihnen am leichtesten fällt — R50, R95, R99, ES5 oder ES10 — und rechnet automatisch nach R50 um (§11.7). Wenn Sie eine Zahl von Hand eintippen, statt ein Projekt zu wählen, benutzen Sie die Konvention, die Sie tatsächlich gemessen haben.

### 10.4 Die eigene Ausrüstung auf Plausibilität prüfen

Zwei schnelle Anwendungen, die aus den Zahlen folgen:

**Passt die Vergrößerung meines Zielfernrohrs zu meinem Gewehr?** *Ein Zielfernrohr hilft Ihnen, besser zu sehen, nicht, besser zu schießen.*

Liegt der R95 Ihres Gewehrs etwa bei 1–1,5 MOA, reicht ein Zielfernrohr mit 12-facher oder 15-facher Vergrößerung völlig aus, um bequem auf das kleinste Ziel zu zielen, das Sie sicher treffen können — und das noch vor Wind, Entfernung, Mündungsgeschwindigkeitsstreuung und den anderen Fehlerquellen, die sich obendrauf summieren. Höhere Vergrößerung kann für anderes nützlich sein — Zielansprache, Beobachtung, Windablesen und so weiter — aber fürs eigentliche Zielen ist sie totes Gewicht: Sie haben mehr Vergrößerung, als Sie brauchen, und das Geld für diese zusätzliche Vergrößerung wäre anderswo besser angelegt.

**Ist ein „Ausreißer" wirklich einer?** Schalten Sie **R99** ein und sehen Sie nach, wo der fragliche Schuss liegt. Ein Schuss innerhalb von R99 ist kein Ausreißer; er ist der Schwanz Ihrer Normalverteilung, der sich genau wie vorhergesagt verhält. Echte Ausreißer sitzen auffällig außerhalb. Das wird Ihnen in den meisten Fällen Ihre Lieblingsausrede nehmen.

---

## 11. Freude des Nerds: das Modell und die Mathematik

Alles Folgende ist das, was das Werkzeug tatsächlich berechnet, samt Herleitungen. Es ist keine Pflichtlektüre für die Benutzung des Werkzeugs, und es ist der interessanteste Teil des Werkzeugs.

**Die Einheiten in diesem Abschnitt sind die der Rechenmaschine, nicht Ihre.** Intern arbeitet das Werkzeug ausschließlich in **Millimetern** für Längen auf dem Papier und in **Metern** für die Distanz, und jede benutzerseitige Einheit — mm, cm, Zoll, Yards, Fuß, mrad, MOA — ist eine Umrechnung, die an der Anzeigegrenze und sonst nirgends angewandt wird. Keine Statistik unten wird von Ihren Einstellungen berührt; Ihre Einheiten zu ändern ändert, wie eine Zahl gedruckt wird, nie das, was gerechnet wurde.

### 11.1 Das zugrunde liegende Modell

Das Werkzeug nimmt an, dass die waagerechten und senkrechten Abweichungen eines Schusses, gemessen von der wahren Gruppenmitte, **unabhängige, mittelwertfreie, normalverteilte Zufallsgrößen gleicher Varianz σ²** sind:

$$x \sim \mathcal{N}(0, \sigma^2), \qquad y \sim \mathcal{N}(0, \sigma^2), \qquad x \perp y$$

Das ist das übliche kreisnormale (isotrope bivariat-normale) Modell der Schussstreuung. Seine Folge ist, dass die **radiale** Abweichung $r = \sqrt{x^2 + y^2}$ einer **Rayleigh-Verteilung** mit Parameter σ folgt:

$$f(r) = \frac{r}{\sigma^2} \exp\left(-\frac{r^2}{2\sigma^2}\right), \qquad F(r) = 1 - \exp\left(-\frac{r^2}{2\sigma^2}\right)$$

Ein Parameter, σ, beschreibt die gesamte Streuung. Jeder Radius, den das Werkzeug angibt, ist ein Quantil dieser einen Verteilung, und das Vertrauensintervall jedes einzelnen davon ist das Vertrauensintervall dieses einen Parameters.

**Die Annahmen, ehrlich benannt.** Das Modell ist isotrop: es nimmt an, dass senkrechte und waagerechte Streuung gleich sind. Wirkliche Gewehre verletzen das häufig — senkrechtes Ziehen durch Geschwindigkeitsschwankungen ist der klassische Fall, waagerechtes Ziehen durch Wind ein weiterer. Das Modell sieht nichts vor für Ausreißer, für eine heteroskedastische Mischung oder für eine Gruppenmitte, die zwischen Sitzungen wandert (Lauferwärmung, Verschmutzung, ein wandernder Zweibein). Es ist gleichwohl die richtige Voreinstellung: es hat einen Parameter, konvergiert also etwa so schnell wie irgend möglich, und seine Versagensarten sind auf dem Streudiagramm mit bloßem Auge sichtbar. Ist Ihre zusammengefasste Wolke sichtbar eine Ellipse statt eines Kreises, ist das σ, das man Ihnen zeigt, ein Kompromiss zwischen zwei verschiedenen Zahlen, und das sollte man im Hinterkopf behalten.

Beachten Sie ferner, dass das Werkzeug die Streuung des *gesamten Systems misst, so wie Sie geschossen haben* — Gewehr, Munition, Optik, Auflage und Schütze. Es kann diese nicht trennen. Ein vom Zweibein im Wind geschossenes Projekt misst Sie und das Wetter ebenso sehr wie das Gewehr.

### 11.2 Zusammenfassung

Für jeden Schuss $i$ in Gruppe $g$ auf Zielscheibe $T$:

1. Der Schuss und der Zielpunkt seiner Gruppe werden als Bruchteile der natürlichen Pixelmaße des Fotos gespeichert, in $[0,1]^2$. Sie werden in native Pixel umgerechnet, indem mit Breite und Höhe des Fotos multipliziert wird.
2. Der Maßstab $s_T$ der Zielscheibe (px/mm) stammt von ihrem Kalibrierlineal:

   $$s_T = \frac{\sqrt{(\Delta x_{\text{px}})^2 + (\Delta y_{\text{px}})^2}}{L_{\text{real}}}$$

   wobei der Zähler der Pixelabstand zwischen den beiden Kalibrierpunkten ist und $L_{\text{real}}$ die von Ihnen eingegebene Länge, in mm.
3. Die Pixelkoordinaten werden durch $s_T$ geteilt, was Millimeter ergibt.
4. Der Schuss wird auf den Zielpunkt seiner eigenen Gruppe zentriert:

   $$(x_i, y_i) = (x_i^{\text{mm}} - x_{g,\text{ZP}}^{\text{mm}},\; y_i^{\text{mm}} - y_{g,\text{ZP}}^{\text{mm}})$$

Positionen als Fotobruchteile statt als Millimeter zu speichern ist das, was die rückwirkende Neukalibrierung möglich macht: das Lineal Monate später zu korrigieren skaliert automatisch jeden Treffer dieser Zielscheibe neu. Es ist auch das, was das Werkzeug konstruktionsbedingt einheitenagnostisch macht — ein gespeicherter Schuss hat überhaupt keine Einheit, nur eine Position auf einem Bild. Millimeter treten zum ersten Mal in Schritt 2 auf, über $L_{\text{real}}$, das seinerseits aus der Einheit umgerechnet wird, in der Sie es eingegeben haben; von da an ist die ganze Kette metrisch, und Ihre bevorzugten Einheiten tauchen erst wieder auf, wenn eine fertige Zahl gedruckt wird.

**Bezugssystem.** Der Ursprung des Fotobruchteils ist die linke obere Ecke des Bildes, und seine senkrechte Achse wächst **nach unten**, die zusammengefassten $y_i$ sind also positiv *unterhalb* des Zielpunkts. Die Rechenmaschine behält dieses Bezugssystem bewusst durchgehend bei: es ist auch das Bezugssystem von SVG, und genau das erlaubt dem Diagramm, die zusammengefassten Schüsse, die Radienkreise, das Gitter und den Treffpunktkasten unmittelbar aus diesen Millimetern zu zeichnen, ganz ohne Transformation.

Auf keine Streuungsstatistik hat das eine Auswirkung. Jede Größe ab §11.3 hängt von $y$ nur über quadrierte Abweichungen vom Mittelwert ab, und die sind gegen einen Vorzeichenwechsel unempfindlich. Es zählt allein für die eine vorzeichenbehaftete Größe, die das Werkzeug angibt — den senkrechten Nullpunktversatz — die von einem Menschen gegen einen Turm gelesen wird und daher positiv *nach oben* sein muss.

Diese Umrechnung geschieht an genau einer Stelle, einem Helfer `toShooterFrame()`, der $(x, y) \mapsto (x, -y)$ abbildet und durch den alle drei menschenlesbaren Pfade laufen: der mittlere Treffpunkt der Zahlentabelle, die Treffpunktzeile der Legende (und mit ihr die Legende des SVG-Exports) sowie die Spalte `ShotUp` des CSV. Der Zeichner umgeht ihn, denn das Bild war ohnehin immer richtig.

Die beiden Bezugssysteme sind eine echte Gefahr, solange sie unausgesprochen bleiben, und das ist das Argument dafür, die Grenze zu benennen, statt Vorzeichenwechsel zu verstreuen: frühere Fassungen dieses Werkzeugs trugen eine zweite, widersprüchliche, nach oben positive Konvention in einem ungenutzten Versatzpaar je Gruppe, und der begleitende Kommentar behauptete das Gegenteil dessen, was der Bericht tatsächlich anzeigte. Diese Felder wurden entfernt.

Die zusammengefasste Stichprobe ist die Vereinigung dieser zentrierten Schüsse über alle Gruppen und alle Zielscheiben. Jede Zielscheibe steuert über ihren eigenen Maßstabsfaktor bei, und deshalb lassen sich Fotos, die aus verschiedenen Entfernungen aufgenommen wurden, korrekt kombinieren.

**Grenzen.** Weniger als 3 zusammengefasste Schüsse liefert `tooFewShots`; mehr als 1000 liefert `tooManyShots`. Die rohe zusammengefasste Liste wird in jedem Fall zurückgegeben, sodass der CSV-Export auch dann funktioniert, wenn die Statistiken es nicht tun.

### 11.3 σ schätzen

Sei $n$ die zusammengefasste Schusszahl und $(\bar{x}, \bar{y})$ der Stichprobenschwerpunkt. Die achsenweisen Stichprobenvarianzen benutzen den Bessel-korrigierten Nenner $n-1$:

$$v_x = \frac{1}{n-1}\sum_i (x_i - \bar{x})^2, \qquad v_y = \frac{1}{n-1}\sum_i (y_i - \bar{y})^2$$

und werden gemittelt, da das Modell behauptet, sie schätzten dieselbe Größe:

$$v = \frac{v_x + v_y}{2}$$

Nun ist $\sqrt{v}$ **kein** erwartungstreuer Schätzer für σ, obwohl $v$ für σ² erwartungstreu ist. Die Quadratwurzel ist konkav, nach der Jensen-Ungleichung gilt also $E[\sqrt{v}] < \sqrt{E[v]} = \sigma$: der naive Schätzer ist nach *unten* verzerrt, und zwar umso stärker, je kleiner die Stichprobe. Das Werkzeug korrigiert das exakt.

Unter dem Modell gilt $\dfrac{k \, v}{\sigma^2} \sim \chi^2_k$ mit

$$k = 2(n-1)$$

Freiheitsgraden — zwei je Schuss, abzüglich zwei für den geschätzten Schwerpunkt. Der Erwartungswert der Quadratwurzel einer Chi-Quadrat-Größe ist in geschlossener Form bekannt,

$$E\left[\sqrt{\chi^2_k}\right] = \sqrt{2}\,\frac{\Gamma\!\left(\frac{k+1}{2}\right)}{\Gamma\!\left(\frac{k}{2}\right)}$$

woraus sich der Entzerrungsfaktor ergibt

$$c_n = \sqrt{\frac{k}{2}} \cdot \frac{\Gamma\!\left(\frac{k}{2}\right)}{\Gamma\!\left(\frac{k+1}{2}\right)}, \qquad k = 2(n-1)$$

und der Schätzer, den das Werkzeug tatsächlich benutzt:

$$\boxed{\hat{\sigma} = c_n \sqrt{v}}$$

Das ist das genaue Gegenstück zum Korrekturfaktor $c_4$ aus der statistischen Prozesslenkung, verallgemeinert auf $2(n-1)$ Freiheitsgrade. Der Faktor wird als vorberechnete Nachschlagetabelle mitgeliefert, indiziert über $n$ von 2 bis 1000, und er stimmt mit der obigen geschlossenen Form in allen zehn gespeicherten Nachkommastellen bei jedem Eintrag überein:

| n | 2 | 3 | 5 | 10 | 20 | 50 | 100 | 1000 |
|---|---|---|---|---|---|---|---|---|
| $c_n$ | 1,1284 | 1,0638 | 1,0317 | 1,0140 | 1,0066 | 1,0026 | 1,0013 | 1,0001 |

Bei $n=2$ beträgt die Korrektur 12,8 %, was kein Rundungsdetail ist — eine unkorrigierte Zwei-Schuss-Schätzung unterschätzt die Streuung um ein Achtel. Bei $n=20$ liegt sie unter 1 % und bei $n=100$ ist sie kosmetisch, aber sie kostet ein Nachschlagen in einer Tabelle, es gibt also keinen Grund, nicht exakt zu sein.

### 11.4 Das Vertrauensintervall auf σ

Derselbe Chi-Quadrat-Pivot, andersherum benutzt. Mit $k = 2(n-1)$,

$$\Pr\left(\chi^2_{0.025,k} \le \frac{k\,v}{\sigma^2} \le \chi^2_{0.975,k}\right) = 0.95$$

Umstellen nach σ² und Ziehen der Quadratwurzeln liefert das zweiseitige 95-%-Intervall, ausgedrückt als Multiplikatoren auf die Punktschätzung:

$$\boxed{\;\lambda_{\text{lo}} = \sqrt{\frac{k}{\chi^2_{0.975,k}}}, \qquad \lambda_{\text{hi}} = \sqrt{\frac{k}{\chi^2_{0.025,k}}}\;}$$

sodass das Intervall $[\lambda_{\text{lo}}\hat\sigma,\ \lambda_{\text{hi}}\hat\sigma]$ ist. Das Werkzeug speichert die *Varianz*-Verhältnisgrenzen $k/\chi^2$ in seinen Tabellen und zieht die Wurzel beim Gebrauch; der Entzerrungsfaktor und $\sqrt{v}$ kürzen sich algebraisch aus dem Verhältnis heraus, die Multiplikatoren hängen also allein von $n$ ab und überhaupt nicht von Ihren Daten. Gegen die exakten Chi-Quadrat-Quantile geprüft, stimmt jeder Tabelleneintrag auf sieben Nachkommastellen.

Der in der Oberfläche angezeigte **Vertrauensbereich** ist schlicht $\lambda_{\text{hi}} - \lambda_{\text{lo}}$, und die angezeigten Prozentwerte sind $(\lambda_{\text{lo}} - 1)$ und $(\lambda_{\text{hi}} - 1)$.

Die Asymmetrie ist bei kleinem $n$ heftig und ist das mathematische Herz von §8.6. Bei $n=5$: $\lambda_{\text{lo}} = 0.676$, $\lambda_{\text{hi}} = 1.916$. Ihre Fünf-Schuss-Schätzung ist verträglich mit einer wahren Streuung von zwei Dritteln dessen, was Sie gemessen haben, und ebenso verträglich mit fast dem Doppelten. Bei $n=2$ beträgt der obere Multiplikator $\sqrt{39.5} = 6.28$.

Das Intervall verengt sich wie $O(1/\sqrt{n})$ — die übliche, brutale Rate. Die Breite zu halbieren kostet die vierfache Munition.

### 11.5 Die Präzisionsradien

Jeder Radius ist die inverse Rayleigh-Verteilungsfunktion bei der zugehörigen Wahrscheinlichkeit. $F(r) = p$ gesetzt und aufgelöst:

$$r_p = \sigma\sqrt{-2\ln(1-p)}$$

woraus sich die angegebenen Konstanten unmittelbar ergeben:

| Statistik | Herleitung | Multiplikator auf σ | Verwendet |
|---|---|---|---|
| **R50** (CEP) | $\sqrt{2\ln 2}$ | 1,17741 | 1,18 |
| **R95** | $\sqrt{-2\ln 0.05}$ | 2,44775 | 2,45 |
| **R99** | $\sqrt{-2\ln 0.01}$ | 3,03485 | 3,03 |

R50 ist der **Median** der Rayleigh-Verteilung, und darum ist er die bevorzugte Hauptkennzahl: er ist das robusteste Quantil der Verteilung und das gegen die Schwanzannahmen des Modells unempfindlichste.

Der interaktive **Trefferwahrscheinlichkeits-Regler** ist dieselbe Formel, kontinuierlich ausgewertet. Für einen Prozentsatz $p$ rechnet er

$$r = \sigma\sqrt{-\ln\left((1 - p/100)^2\right)} \;=\; \sigma\sqrt{-2\ln(1 - p/100)}$$

— die beiden Formen sind algebraisch identisch. Der Regler ist bei 99 % gedeckelt, weil $p = 100$ den Logarithmus ins Unendliche schickt.

Das auf dem Diagramm gezeichnete **Vertrauensintervall von R95** ist $[\lambda_{\text{lo}} R_{95},\ \lambda_{\text{hi}} R_{95}]$ — das σ-Intervall durch eine lineare Skalierung fortgepflanzt, was exakt ist, da $R_{95}$ zu σ proportional ist.

### 11.6 Erwartete Streuung — ES5x und ES10x

Die Streuung ist der größte paarweise Abstand unter $n$ Schüssen:

$$\text{ES}_n = \max_{i<j} \lVert p_i - p_j \rVert$$

Das ist der **Durchmesser der konvexen Hülle** der Stichprobe, und er hat für die bivariate Normalverteilung jenseits von $n=2$ keine handhabbare geschlossene Form. Sein Erwartungswert wird numerisch gewonnen (Monte-Carlo-Integration großer Stichproben über die Kreisnormale) und ist wegen Skaleninvarianz linear in σ:

$$E[\text{ES}_5] = 3.06\,\sigma, \qquad E[\text{ES}_{10}] = 3.79\,\sigma$$

Das sind die Werte ES5x und ES10x. Beachten Sie ihre wichtigste Eigenschaft: **es sind Erwartungswerte, keine Schranken.** Die Streuung einer einzelnen Gruppe ist selbst eine Zufallsgröße mit erheblicher eigener Streuung — was genau der Grund ist, warum sie ein miserabler Schätzer ist und warum dieses Werkzeug sich die Mühe macht, sie nicht zu verwenden.

Beachten Sie auch die Gestalt des Zusammenhangs. Von 5 auf 10 Schuss je Gruppe zu gehen vergrößert die *erwartete* Gruppengröße um 24 %, allein weil Sie der Stichprobe mehr Gelegenheiten gegeben haben, ein extremes Paar zu erzeugen, ohne die geringste Änderung am zugrunde liegenden Gewehr. Das ist der Mechanismus, durch den „mein Gewehr schießt Halb-MOA-Gruppen" und „mein Gewehr schießt MOA-Gruppen" beide wahre Aussagen über dasselbe Gewehr sein können, die sich nur darin unterscheiden, wie viele Schüsse der Sprecher vor dem Messen abgibt. Die Streuung ist keine Eigenschaft des Gewehrs; sie ist eine Eigenschaft des Gewehrs *und des Stichprobenumfangs*, und sie ohne letzteren zu nennen ist bedeutungslos.

Weil ES mit $n$ wächst, σ, R50 und R95 aber nicht, sind nur letztere zwischen Schützen vergleichbar. Das ist das Argument für R50 in einem Satz.

### 11.7 Umrechnung zwischen Konventionen

Zur Verträglichkeit mit dem Rest der Suite — das Arsenal speichert die Präzision als R50 in mrad — rechnet sich jede Konvention in σ um, indem durch ihren Multiplikator aus §11.5 geteilt wird, und σ rechnet sich in R50 um, indem mit 1,1774 multipliziert wird. ES5 und ES10 werden durch 3,06 bzw. 3,79 geteilt. So hat zum Beispiel ein Gewehr, das als 1-MOA-Zehn-Schuss-Gewehr angegeben wird,

$$\sigma = \frac{1.0}{3.79} = 0.264\ \text{MOA} \quad\Rightarrow\quad R_{50} = 1.1774 \times 0.264 = 0.311\ \text{MOA}$$

was beim Büchsenmacher im Kopf ausrechnen zu können nützlich ist.

### 11.8 Das Vertrauensintervall auf den Treffpunkt

Ein anderes Problem als das Streuungsintervall, und ein anderer Pivot. Der zusammengefasste Schwerpunkt $(\bar{x}, \bar{y})$ schätzt die wahre Gruppenmitte; seine Unsicherheit ist der Standardfehler eines Mittelwerts, was für eine normalverteilte Grundgesamtheit mit unbekannter Varianz ein Problem der Studentschen *t*-Verteilung ist:

$$\text{VI}_x = t_{q,\,n-1} \cdot \frac{\sqrt{v_x}}{\sqrt{n}}, \qquad \text{VI}_y = t_{q,\,n-1} \cdot \frac{\sqrt{v_y}}{\sqrt{n}}$$

Beachten Sie, dass hier die achsenweisen Varianzen $v_x$ und $v_y$ **getrennt** verwendet werden, nicht der zusammengefasste Mittelwert $v$ — das Vertrauensintervall des Treffpunkts ist also wirklich elliptisch und wird ehrlich berichten, dass ein senkrecht ziehendes Gewehr waagerecht besser bekannt ist als senkrecht. (Die Streuungsschätzung aus §11.3 fasst sie zusammen; die Treffpunktschätzung nicht. Das ist Absicht: die Isotropieannahme ist eine Modellierungsentscheidung für die radialen Quantile, aber es gibt keinen Grund, sie einem einfachen Mittelwert aufzuzwingen.)

Das Quantil wird bei

$$q = 1 - \frac{0.05}{4} = 0.9875$$

genommen statt beim naiven 0,975. Das ist eine **Bonferroni-Korrektur über die beiden Achsen**: das angezeigte Intervall ist ein *gemeinsamer* 95-%-Bereich über Waagerechte und Senkrechte zugleich, jeder Achse wird also α/2 = 0,025 des Gesamtfehlers zugeteilt, zweiseitig aufgeteilt in 0,0125 je Schwanz. 0,975 je Achse zu nehmen ergäbe zwei marginale 95-%-Intervalle, deren gemeinsame Überdeckung nur etwa 90 % betrüge. Gegen exakte *t*-Quantile bei $q = 0.9875$ mit $n-1$ Freiheitsgraden geprüft, stimmt die mitgelieferte Tabelle durchgehend auf fünf Nachkommastellen.

Das Intervall wird auf dem Diagramm als gestrichelter Kasten um die Treffpunktmarke gezeichnet.

### 11.9 Die Skala des Vertrauensmessers

Die Skala bildet den Vertrauensbereich $c = \lambda_{\text{hi}} - \lambda_{\text{lo}}$ auf eine Zeigerstellung ab, und getrennt davon auf eine von acht diskreten Stufen.

Die **diskrete Stufe** ist ein Schwellendurchlauf über

$$[0.5,\ 0.45,\ 0.4,\ 0.35,\ 0.3,\ 0.25,\ 0.2,\ 0]$$

der den Index der ersten Schwelle liefert, die $c$ überschreitet — Stufe 0 („Unbrauchbar") für $c > 0.5$, Stufe 7 („Hervorragend") für $c \le 0.2$. Die Stufen sind auf einer Skala von 0 bis 4 mit Plus-Noten beschriftet: `0, 1, 1+, 2, 2+, 3, 3+, 4`.

Die **stetige Zeigerstellung** $\phi \in [0,1]$ ist eine zweiteilige lineare Abbildung, an beiden Enden begrenzt und bei $c = 0.5$ genau zusammentreffend:

$$\phi = \begin{cases} (1.5 - c) \cdot 0.2 & c > 0.5 \\[4pt] 1 - (c - 0.2)\cdot\frac{8}{3} & c \le 0.5 \end{cases}$$

Prüfen Sie die Nahtstelle: bei $c = 0.5$ ergibt der obere Zweig $(1.5-0.5)\times 0.2 = 0.2$ und der untere $1 - 0.3 \times 8/3 = 0.2$. Stetig.

Die gestalterische Folge ist, dass die unteren 20 % der Skala — das Band „KEIN VERTRAUEN", alles unterhalb der **Bullshit-Schwelle** bei $c = 0.5$ — den gesamten Bereich $c \in (0.5, 1.5]$ aufnehmen, während die oberen 80 % den Bereich $c \in (0.2, 0.5]$ über die sechs bedeutsamen Stufengrenzen auffächern. Mit anderen Worten: die Skala staucht den Bereich, in dem Ihre Daten wertlos sind, bewusst in ein einziges optisches Band und verwendet ihre Auflösung dort, wo die Unterschiede zählen. Eine 3-Schuss-Gruppe ($c = 2.27$) und eine 10-Schuss-Gruppe ($c = 0.72$) sitzen beide nahe am unteren Ende, und zwar zu Recht: keine von beiden sagt Ihnen irgendetwas, und die Skala weigert sich, dem Unterschied zwischen ihnen zu schmeicheln.

Die Schwelle bei $c = 0.5$ entspricht $n = 19$. Das ist die wohlerwogene Meinung des Werkzeugs zum kleinsten Stichprobenumfang für eine vertretbare Präzisionsbehauptung, und sie ist hergeleitet, nicht behauptet.

### 11.10 Winkelumrechnung

Winkelergebnisse benutzen die gemeinsamen exakten Umrechnungen der Suite statt der üblichen Feldnäherungen. Beide Einheiten werden über ihr exaktes Bogenmaß umgerechnet: ein Milliradiant spannt genau $1/1000$ der Distanz auf, und eine Winkelminute spannt

$$1' = \frac{\pi}{10800} = 2.908882 \times 10^{-4}\ \text{rad}$$

auf, also 0,29089 mm je Meter Distanz oder **1,0472 Zoll auf 100 Yards** — nicht den „1 Zoll" der Schützenfaustregel. Diese Faustregel trägt einen Fehler von 4,7 %, größer als der Unterschied zwischen vielen der Laborierungen, die Leute auseinanderzuhalten versuchen.

$$\theta_{\text{mrad}} = \frac{d_{\text{mm}}}{\text{Distanz}_{\text{m}}}, \qquad \theta_{\text{MOA}} = \frac{d_{\text{mm}}}{0.29089 \cdot \text{Distanz}_{\text{m}}}$$

Die in den Bildoptionen angebotenen Gitterabstände (0,1 mrad, 0,05 mrad, 1/4 MOA, 1/8 MOA) bekommen ihren realen Millimeterabstand aus der projekteigenen Distanz in dem Moment berechnet, in dem Sie sie auswählen, und darum bleibt das Gitter eine echte Winkelreferenz, ganz gleich auf welche Distanz Sie geschossen haben.

### 11.11 Numerische Anmerkungen

- Die Suche nach der **Streuung** ist eine Brute-Force-Suche in $O(n^2)$ über die Paare innerhalb einer Gruppe. Gruppen sind klein; ein Hüllendurchmesser per rotierender Schieblehre wäre asymptotisch besser und praktisch belanglos.
- Die Nachschlagetabellen ($c_n$, beide Chi-Quadrat-Multiplikatoren, die *t*-Quantile) werden für $n = 2 \ldots 1000$ vorberechnet mitgeliefert statt zur Laufzeit ausgewertet. Es sind exakte statistische Konstanten, analytisch geprüft wie oben dokumentiert, und sie mitzuliefern erspart es, eine Bibliothek für spezielle Funktionen (Gamma und unvollständige Beta) in ein Browser-Bündel zu schleppen.
- Die Obergrenze von 1000 Schuss ist die Tabellengrenze, keine algorithmische Schranke. Wenn Sie mehr als tausend Patronen in ein einziges Projekt geschossen haben, haben Sie sich das Recht verdient, es zu teilen.

---

## 12. Herkunft und Lizenz

Der Gewehr-Präzisionsrechner ist der Nachfolger von **TARAN**, einem eigenständigen Werkzeug desselben Autors. Der statistische Kern — das Modell, die Korrekturfaktoren, die Vertrauenstabellen, der Vertrauensmesser und seine Respektlosigkeit — ist bewusst unverändert übernommen, damit die Ergebnisse der beiden Werkzeuge unmittelbar vergleichbar sind. Die mrad-Umrechnung ist die eine bewusste Abweichung: die ererbte Konstante trug einen Fehler um den Faktor zehn und wurde gegen die exakten Winkelumrechnungen der Suite korrigiert.

Neu ist die Struktur ringsum: eine Hierarchie Projekt/Zielscheibe/Gruppe mit Kalibrierung je Zielscheibe anstelle eines einzigen flachen Pixelkoordinatenmodells, die rückwirkende Neukalibrierung, das Markieren mit Ziehen zum Nachjustieren, dauerhafte Speicherung mit Sicherung und Zusammenführung, SVG- und CSV-Export sowie die Einbindung in den Rest der Ballistik-Suite.

Die Suite steht unter der Lizenz **AGPL-3.0-or-later**. Der ererbte TARAN-Code, von dem sie abstammt, steht unter GPLv3, © 2015 derselbe Autor.

---

*Friedlich. Präzise. Bewaffnet.*
