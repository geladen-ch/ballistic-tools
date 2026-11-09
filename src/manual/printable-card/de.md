# geladen.ch ballistics Benutzerhandbuch — Druckbare Schusskarte

*Teil der* [Ballistik-Suite von geladen.ch](https://bc.geladen.ch)*.*

---

## 1. Wofür dieses Werkzeug da ist

Eine Schusskarte ist ein Blatt Papier, das man bei der Waffe hat: was auf jeder Distanz einzustellen ist, wie weit der Wind das Geschoss versetzt und was sich ändert, wenn es kälter oder wärmer ist oder wenn man bergauf oder bergab schießt. Papier braucht weder Akku noch Empfang und lässt sich mitten in einer Serie auf einen Blick ablesen.

Der Reiter **Druckbare Karte** der Flugbahn erstellt eine solche Karte als druckfertiges PDF. Er nimmt die Waffe, die Patrone und die Atmosphäre aus dem Reiter **Daten** und die in den Einstellungen gewählten Einheiten, sodass sich die Karte genauso liest wie der Rest der App.

Eine Karte gilt für eine Waffe mit einer Patrone unter einem Satz von Bedingungen. Sie kann den Rechner nicht in allen Situationen ersetzen: Wenn Luft, Distanz oder Wind stark von dem abweichen, wofür sie erstellt wurde, sind ihre Zahlen nur ein Ausgangspunkt. Abschnitt 7 erklärt, wie weit man ihnen trauen kann.

---

## 2. Schnellstart

1. Öffnen Sie die **Flugbahn**. Wählen Sie im Reiter **Daten** die Waffe und die Patrone und geben Sie die Atmosphäre ein, die Sie dort erwarten, wo Sie schießen werden.
2. Wechseln Sie zum Reiter **Druckbare Karte**. Der Block **Auf der Karte** oben zeigt Waffe, Patrone und Referenzbedingungen so, wie die Karte sie druckt. Ist dort etwas falsch, korrigieren Sie es im Reiter Daten oder unter Waffen.
3. Wählen Sie unter **Karteneinstellungen** das Papier, die größte Distanz und den Distanzschritt.
4. Klicken Sie auf **PDF herunterladen** und drucken Sie die Datei in Originalgröße.

Alles, was Sie in diesem Reiter einstellen, bleibt gespeichert, auch nach einem Neustart. Die Einstellungen gelten für alle Waffen gleich: Sie werden nicht pro Waffe gespeichert.

---

## 3. Wofür die Karte gerechnet wird

- **Waffe, Patrone und Geschoss** — die im Reiter Daten gewählten, aus Waffen.
- **Nullpunkt** — die eigene Einschussdistanz der Waffe aus Waffen. Die **Abweichende Einschussdistanz** des Reiters Daten gilt für die Karte nicht. Wurde die Patrone in anderer Luft eingeschossen (eine Einschuss-Atmosphäre unter Waffen), bleibt der Nullpunkt in dieser Luft.
- **Referenzbedingungen** — die Atmosphäre des Reiters Daten: Höhe, Luftdruck, Temperatur und Luftfeuchtigkeit. Die Karte druckt sie in der Zeile über der Tabelle.
- **Schuss** — waagrecht. Der Hangwinkel wird in eigenen Spalten behandelt (Abschnitt 5.6), nicht über den Ziellinienwinkel des Reiters Daten.
- **Wind** — der eigene Referenz-Seitenwind der Karte (Abschnitt 4.4). Der Wind des Reiters Daten wird nicht verwendet.
- **Korrekturen** — in der Einheit des Feldrechners: Klicks, mrad oder MOA (Einstellungen → **Ausgabe im Feldrechner**), mit denselben Richtungsanzeigen, Pfeilen oder **+ / −** (Einstellungen → **Anzeigesymbole im Feldrechner**). Klicks richten sich nach den Klickwerten der Waffe unter Waffen.

---

## 4. Karteneinstellungen

### 4.1 Karte

- **Papier** — **A4** und **Letter** drucken die ganze Karte auf eine Seite. **A5** und **Half-Letter** verteilen sie auf zwei Seiten im Querformat: die Tabelle auf der ersten, Absehen und Standortfoto auf der zweiten. Drucken Sie die beiden auf Vorder- und Rückseite eines Blattes. Das Papier legt auch fest, wie viele Zeilen die Tabelle fasst (Abschnitt 5.1).
- **Titel** — bis 44 Zeichen, oben auf der Karte gedruckt. Leer gelassen heißt die Karte «Waffe · Patrone».
- **Datum** — in der Fußzeile gedruckt und im Dateinamen verwendet. Bis Sie ein anderes wählen, ist es das heutige.

### 4.2 Distanzen

- **Maximale Distanz** — wo die Tabelle endet. Wählen Sie **Distanz** und geben Sie sie ein (standardmäßig 1000 m oder 1000 Yards), oder **Mach 1,1** bzw. **Mach 1,0**, damit die Tabelle dort endet, wo das Geschoss auf diese Geschwindigkeit abbremst. Nähert sich ein Geschoss der Schallgeschwindigkeit, leidet die Genauigkeit; so bleibt die Karte im Bereich, in dem ihre Zahlen tragen. In einem Mach-Modus sagt ein Hinweis unter dem Feld, auf welcher Distanz das Geschoss diese Geschwindigkeit erreicht. Die Karte endet mit der letzten Zeile davor.
- **Distanzschritt** — 200, 100, 50 oder 25 in Ihrer Distanzeinheit. Die erste Zeile liegt einen Schritt vor der Mündung.
- **Schritte verfeinern ab** — verfeinert die Tabelle dort, wo die Flugbahn steil wird. Ändert sich die Höhenkorrektur bis zur nächsten Distanz um mehr als diesen Wert, wird der Schritt auf den nächstfeineren verkleinert (200 → 100 → 50 → 25). Einmal feiner, wird er nicht wieder gröber. Der Wert gilt in der Korrektureinheit (Klicks, mrad oder MOA). 0 schaltet das Verfeinern aus.

Eine typische Einstellung: Schritt 100 m, verfeinern ab etwa 16 Klicks (jeder Wert von 10 bis 20 passt). Der nahe Teil der Tabelle bleibt kurz, und der ferne Teil, wo ein kleiner Distanzfehler am meisten kostet, erhält Zeilen alle 50 oder 25 m.

### 4.3 Statuszeile

Unter den Einstellungen zählt eine Zeile die Tabellenzeilen: «24 von 37 Zeilen». Brauchen Distanzen und Ziele mehr Zeilen, als das Papier fasst, nennt eine Warnung die größte Distanz, die noch passt, und wie viele Zeilen weggelassen werden. Um sie zurückzuholen, nehmen Sie einen gröberen Schritt, eine höhere Verfeinerungsschwelle, eine kürzere maximale Distanz oder größeres Papier.

### 4.4 Wind

Der **Referenz-Seitenwind** ist der Wind, für den die Spalte **Wind** gerechnet wird: voll quer, von rechts. Die Karte druckt die Seitenkorrektur ohne Richtung: Halten oder drehen Sie gegen den Wind.

Wählen Sie einen Wind, den Sie im Kopf leicht umrechnen. Wie, zeigt Abschnitt 6.3.

### 4.5 Temperatur

**Temperaturkorrekturen** (standardmäßig eingeschaltet) fügt fünf Spalten hinzu. Jede gibt die Änderung der Höhenkorrektur gegenüber den Referenzbedingungen an, wenn Luft **und Pulver** diese Temperatur haben.

- Die Mündungsgeschwindigkeit ändert sich um die Geschwindigkeitsänderung pro Grad, die für die Patrone unter Waffen eingetragen ist. Fehlt sie, ändert sich nur die Luft.
- Der Nullpunkt bleibt, wo er eingeschossen wurde. Die Spalte zeigt, wie weit sich der Treffpunkt verschiebt, wenn es kälter oder wärmer ist als die Referenz der Karte. Sie nimmt nicht an, dass Sie an diesem Tag neu eingeschossen haben.
- Standardmäßig liegen die Spalten um die Referenztemperatur, im Abstand von 5 °C (10 °F). Die mittlere Spalte ist die Referenztemperatur selbst und enthält nur Nullen. Ändern Sie die **Erste Temperatur** oder den **Temperaturschritt**, um eine andere Skala zu wählen. Eine Zeile unter den Feldern listet die Spalten auf. **Standardwerte** kehrt zur Skala um die Referenztemperatur zurück.

### 4.6 Inhalt

- **Spalte Drallabweichung** — die Abweichung durch den Drall des Geschosses auf jeder Distanz, bei Windstille, mit Richtung. Sie wird nur angeboten, wenn die Drallabweichung in den Einstellungen eingeschaltet ist und die App genug weiß, um sie zu berechnen: die Dralllänge der Waffe sowie Länge und Durchmesser des Geschosses. Die Spalte Wind enthält die Drallabweichung nie.
- **Hangkorrekturen (10° bis 30°)** — fünf Spalten für Schüsse unter 10, 15, 20, 25 und 30° bergauf oder bergab. Siehe Abschnitt 5.6.

**Standort.** Die Karte kann den aktiven Standort des Feldrechners verwenden (siehe Standorte & Ziele im Haupthandbuch). Der Name des Standorts wird hier angezeigt. Gibt es keinen aktiven Standort, führt **Standorte öffnen** dorthin.

- **Zeilen für die Ziele** — eine Tabellenzeile für jedes Ziel des Standorts, gerechnet auf seine eigene Distanz und seinen eigenen Ziellinienwinkel (Abschnitt 5.5).
- **Standortfoto mit Zielen** — das Foto des Standorts, jedes Ziel darauf markiert. Hat der Standort kein Foto, sagt ein Hinweis das, und die Karte lässt es weg.

**Absehen.** Hat die Waffe im Arsenal ein Zielfernrohr mit Absehen, druckt **Absehen und BDC** dieses Absehen auf die Karte, mit seinen BDC-Marken (aus dem Englischen «Bullet Drop Compensation», also «Ausgleich des Geschossabfalls»; einfach gesagt Haltemarken), falls es welche hat. Unter dem Kontrollkästchen erscheint eine Zielfernrohransicht. Sie funktioniert wie die des Feldrechners, und was sie zeigt, druckt die Karte:

- Der **Vergrößerungsring** stellt die Vergrößerung ein, und **Auf Absehen zoomen** vergrößert die Ansicht eines Zielfernrohrs mit fester Vergrößerung.
- Die **BDC-Distanzen** beschriften jede BDC-Marke mit der Distanz, für die sie gilt, unter den Referenzbedingungen der Karte, bei Windstille und waagrecht.
- Die **Windhaltepunkte** markieren einen Haltepunkt für jedes Viertel des Seitenwinds der Karte, bis zum Anderthalbfachen, nach beiden Seiten. Der volle Seitenwind hat die größere Marke.

Einen Haltepunkt fürs Zielen gibt es auf der Karte nicht. Die Vergrößerung und die beiden Einblendungsknöpfe gehören der Karte: Sie hier zu ändern, ändert die Zielfernrohransicht des Feldrechners nicht, und umgekehrt. Das Absehen wird schwarz gedruckt, die Einblendungen grau.

Das Absehen auf dem Papier ist ein Bild des Absehens, keine maßstäbliche Zeichnung. Messen Sie darauf keinen Halt mit dem Lineal.

---

## 5. Die Karte lesen

### 5.1 Aufbau

- **Kopf** — der Name der App und der Titel der Karte.
- **Waffe** — der Name der Waffe, die Einschussdistanz, die Visierhöhe und der Klickwert des Zielfernrohrs, vertikal · horizontal.
- **Patrone** — der Name der Patrone, das Geschoss mit seiner Masse, die Mündungsgeschwindigkeit mit ihrer Änderung pro Grad und der ballistische Koeffizient mit seinem Widerstandsmodell (oder «eigene Cd-Kurve»).
- **Korrekturen** — die Überschrift nennt die Korrektureinheit. Die Referenzbedingungen stehen in derselben Zeile rechts: Höhe, Luftdruck, Temperatur, Luftfeuchtigkeit.
- **Die Tabelle** — Abschnitte 5.2 bis 5.6.
- **Absehen** und **Ziele** — das Absehen und das Standortfoto. Lassen Sie eines davon weg, setzt die Karte an seine Stelle ein liniertes Feld **Notizen**.
- **Fußzeile** — die Adresse der App, ihre Version und das Datum der Karte. Widersprechen sich zwei Karten, zeigen diese Angaben, welche neuer ist und mit welcher App-Version sie erstellt wurde.

A4 und Letter fassen bis zu 37 Zeilen, A5 und Half-Letter bis zu 26. Bei wenigen Zeilen ist jede Zeile hoch: oben die Distanz, darunter die Höhenkorrektur, in großer Schrift. Bei vielen Zeilen steht jede auf einer Linie. Ist ein Wert zu breit für seine Spalte, wird der ganze Tabellentext etwas kleiner, damit die Spalten bündig bleiben.

### 5.2 Distanz und Höhenkorrektur

Die fette Spalte **Distanz** listet die Referenzdistanzen auf, von einem Schritt bis zur maximalen Distanz. Unter jeder Distanz, auf einer dichten Karte daneben, steht die Höhenkorrektur ab dem Nullpunkt, mit Richtung.

### 5.3 Kürzer und weiter

Je zwei Spalten links und rechts der Referenzdistanz geben die Höhenkorrektur für benachbarte Distanzen an. Sie sind für ein Ziel, das zwischen zwei Zeilen liegt. Wie weit sie entfernt sind, hängt vom Schritt ab, der in dieser Zeile gilt:

| Schritt | Kürzer | Weiter |
| --- | --- | --- |
| 200 | −100, −50 | +50, +100 |
| 100 | −50, −25 | +25, +50 |
| 50 | −20, −10 | +10, +20 |
| 25 | −10, −5 | +5, +10 |

Eine Nachbardistanz an oder vor der Mündung bleibt leer. Jede Zelle zeigt ihre Distanz in kleinen grauen Ziffern und darunter oder daneben die Höhenkorrektur.

Beispiel, bei 100 m Schritt: Das Ziel steht auf 640 m. Suchen Sie die Zeile 600 m und lesen Sie die Zelle **+50**, also 650 m. Das liegt näher als 600 oder 700 m und ist genauer, als zwischen zwei Zeilen nach Augenmaß zu schätzen.

### 5.4 Wind und Drallabweichung

**Wind** ist die Seitenkorrektur für den Seitenwind der Karte (in der Spaltenüberschrift gedruckt), als Betrag ohne Richtung: Korrigieren Sie gegen den Wind. **Drall** ist die Drallabweichung bei Windstille, mit Richtung. Sie hängt nicht vom Wind ab, also rechnen Sie sie dazu.

### 5.5 Zeilen für die Ziele

Jedes Ziel des aktiven Standorts ist eine graue Zeile, nach Distanz zwischen die Referenzdistanzen einsortiert. Ein schwarzes Schild trägt seine Bezeichnung (T1, T2 … vom nächsten an), und daneben steht sein Ziellinienwinkel, + bergauf. Die Höhenkorrektur enthält diesen Winkel bereits: Stellen Sie sie so ein, wie sie ist, und rechnen Sie keine Hangkorrektur dazu. Wind und Drallabweichung wie in den anderen Zeilen. Eine Zielzeile hat keine Zellen für kürzer und weiter. Ein Ziel jenseits der maximalen Distanz wird weggelassen. Das Standortfoto, falls Sie es aufgenommen haben, zeigt, wo welche Bezeichnung steht.

### 5.6 Hangkorrekturen

Bei einem Schuss bergauf oder bergab fällt das Geschoss quer zur Ziellinie weniger als waagrecht, und der Schuss braucht weniger Höhenkorrektur. Jede Hangspalte gibt die Änderung an, die zur waagrechten Höhenkorrektur auf dieser Distanz für diesen Winkel zu addieren ist. Bergauf und bergab ist der Wert bis auf ein Haar gleich, deshalb deckt eine Spalte beides ab: Die Karte druckt den Mittelwert der beiden.

Beispiel: 500 m, 20° bergab. Nehmen Sie die Höhenkorrektur der Zeile 500 m und addieren Sie den Wert der Spalte **20** (meist eine kleine Korrektur nach unten).

Nehmen Sie die Spalte, die dem gemessenen Winkel am nächsten liegt, oder die Zielzeile, wenn das Ziel zum Standort gehört.

### 5.7 Temperaturkorrekturen

Über jeder Spalte steht ihre Temperatur. Addieren Sie zur Höhenkorrektur der Zeile den Wert der Spalte, die der Tagestemperatur am nächsten liegt. Die Spalte bei der Referenztemperatur der Karte enthält nur Nullen. Kältere Luft und kälteres Pulver bedeuten ein langsameres, stärker gebremstes Geschoss, daher gehen die Korrekturen auf der kalten Seite nach oben und die auf der warmen Seite nach unten.

---

## 6. Mit der Karte auf dem Schießplatz

### 6.1 Vor dem Drucken

- Geben Sie die Atmosphäre ein, die Sie an dem Ort und in der Jahreszeit erwarten, wo Sie schießen werden. Eine Karte für 400 m Höhe liegt auf 1800 m deutlich daneben. Schießen Sie an sehr unterschiedlichen Orten, drucken Sie für jeden eine Karte.
- Prüfen Sie den Block **Auf der Karte**: Name, Nullpunkt, Visierhöhe, Klickwert, Mündungsgeschwindigkeit und BC. Die Karte ist nicht besser als diese Angaben.
- Verwenden Sie die selbst gemessene Mündungsgeschwindigkeit mit ihrer Temperatur und die Geschwindigkeitsänderung pro Grad, falls Sie sie kennen. Die Temperaturspalten hängen davon ab.

### 6.2 Drucken

Drucken Sie in Originalgröße, nicht «an Seite anpassen». Nehmen Sie Papier, das dem Gelände standhält, oder stecken Sie die Karte in eine Klarsichthülle oder laminieren Sie sie. Bei A5 und Half-Letter drucken Sie die beiden Seiten auf Vorder- und Rückseite eines Blattes: auf der einen die Tabelle, auf der anderen Absehen und Foto.

### 6.3 Wind umrechnen

Die Seitenkorrektur wächst nahezu proportional zum Seitenwind. Ist die Karte für 4 m/s erstellt und weht der Wind mit 2 m/s, nehmen Sie den halben Wert. Bei 6 m/s das Anderthalbfache. Bei einem Wind, der nicht genau quer weht, zählt nur sein Queranteil: die halbe Geschwindigkeit bei 30° zur Schusslinie, etwa 0,7 davon bei 45° und etwa 0,9 bei 60°. Ein runder Referenz-Seitenwind macht diese Rechnung leicht. Mit eingeschalteten **Windhaltepunkten** zeigt das Absehen auf der Karte dieselben Viertel des Seitenwinds als Haltepunkte.

### 6.4 Alles zusammen

Für einen Schuss: die Höhenkorrektur der Zeile (oder einer Zelle kürzer/weiter), plus die Temperaturkorrektur, plus die Hangkorrektur, wenn das Ziel höher oder tiefer liegt als Sie. Dann die Seitenkorrektur, auf den Wind umgerechnet, plus die Drallabweichung.

---

## 7. Wie weit man der Karte trauen kann

- **Luftdruck und Höhe** — die Temperaturspalten ändern nur die Temperatur. Weicht der Luftdruck am Tag stark von der Referenz der Karte ab, liegen die Höhenkorrekturen auf weite Distanzen daneben. Nehmen Sie einen Rechner oder drucken Sie eine Karte für diese Bedingungen.
- **Korrekturen addieren sich nur näherungsweise** — jede Spalte wird für sich gerechnet, gegenüber den Referenzbedingungen. Eine Hang- und eine Temperaturkorrektur zu addieren, ist auf üblichen Distanzen und Winkeln eine sehr gute Näherung, aber nicht exakt.
- **Nahe der Schallgeschwindigkeit** — die Zahlen der Karte werden unsicherer, je mehr sich das Geschoss Mach 1 nähert. Die Tabelle bei **Mach 1,1** enden zu lassen, hält sie auf der sicheren Seite.
- **Die Eingaben** — die Karte gibt Ihre Einstellungen wieder. Eine falsche Mündungsgeschwindigkeit, ein falscher BC, eine falsche Visierhöhe oder ein falscher Klickwert ergeben eine saubere Karte mit falschen Zahlen. Prüfen Sie die Karte auf dem Schießplatz auf einigen Distanzen, bevor Sie sich darauf verlassen, und drucken Sie eine neue nach einem Wechsel von Patrone, Nullpunkt oder Zielfernrohr.

---

## 8. Datei und Datenschutz

Das PDF wird in Ihrem Browser erstellt und auf Ihrem Gerät gespeichert. Nichts wird hochgeladen. Die Datei ist nach der Karte und ihrem Datum benannt, zum Beispiel «Schusskarte - Tikka T3x - 6.5 Creedmoor 140 ELD-M - 2026-11-09.pdf».
