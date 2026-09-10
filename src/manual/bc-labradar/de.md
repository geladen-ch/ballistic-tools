# geladen.ch ballistics Benutzerhandbuch — BC-Labradar

*Teil der* [Ballistik-Suite von geladen.ch](https://bc.geladen.ch)*. Einer der vier Reiter der Seite BC-Werkzeuge. Nachfolger des eigenständigen Werkzeugs Labrabaco.*

---

## 1. Wofür dieses Werkzeug da ist

Der ballistische Koeffizient ist die eine Zahl in der ganzen Flugbahnrechnung, die Sie üblicherweise glauben sollen. Die Mündungsgeschwindigkeit können Sie messen. Die Visierhöhe können Sie mit dem Messschieber abgreifen. Die Einschussentfernung legen Sie selbst fest. Der BC steht auf der Schachtel oder auf der Website des Herstellers, und er beschreibt ein Geschoss aus einem fremden Lauf, in fremder Luft, gemessen nach einem Verfahren, das Ihnen niemand zeigen wird.

Es ist zugleich die Zahl, auf die die Flugbahn auf Distanz am empfindlichsten reagiert, und die mit der größten Neigung zur Schmeichelei. Veröffentlichte BCs sind ebenso oft Marketingzahlen wie Messwerte.

**BC-Labradar misst Ihren.** Es liest die Track-Dateien, die ein Labradar-Chronograph auf seine eigene SD-Karte schreibt: eine vollständige Aufzeichnung von Geschwindigkeit über Zeit für jeden Schuss, etwa jede Millisekunde abgetastet, über die ersten rund hundert Meter des Fluges. Es passt für jeden Schuss einzeln einen ballistischen Koeffizienten an, mit derselben Widerstandsphysik, mit der der Rest der Suite Flugbahnen rechnet. Dann bereinigt es die verpatzten Tracks, wirft die Schüsse hinaus, die mit den übrigen nicht zusammenpassen, und mittelt, was übrig bleibt.

Heraus kommt ein BC für **Ihr** Geschoss, aus **Ihrem** Lauf, in **Ihrer** Luft. Tragen Sie ihn ins Arsenal ein, und jedes andere Werkzeug der Suite rechnet mit einer Messung statt mit einer Behauptung.

Nichts an dieser Bereinigung und Anpassung wurde am grünen Tisch entworfen und dann auf gut Glück eingebaut — sie wurde an einem Korpus von **1.297 echten Labradar-Tracks** kalibriert. Das Rauschen des Radars (wie es im Verlauf des Tracks anwächst und wie wild es zwischen Sitzungen schwankt) wurde gemessen statt angenommen. §12 nennt die Einzelheiten.

Das Bemerkenswerte an diesem Verfahren: Es braucht überhaupt keine Ausrüstung auf der Bahn. Keinen zweiten Chronographen auf 300 m, keine akustische Scheibe, kein Doppler-Radar von der Größe eines Autos. Das Gerät zeichnet die Daten ohnehin auf — es sagt Ihnen nur nicht, was sie wert sind.

### Was es nicht ist

**Es ist keine Chronographen-Anzeige.** Ihre Mündungsgeschwindigkeit, Ihre Streuung, Ihre Standardabweichung in fps interessieren es nicht. Die stehen im Berichtsfile des Geräts, und dieses Werkzeug ignoriert es. Was es will, ist die *Form* des Geschwindigkeitsabfalls — genau das, was der Zusammenfassungsbericht wegwirft.

**Es funktioniert nur mit dem Labradar v1** — der großen orangefarbenen Box, die `Shot0001 Track.csv`-Dateien schreibt. Spätere Geräte und alle anderen Chronographen-Marken zeichnen entweder gar keinen Track auf oder schreiben ihn nicht in diesem Format. Für sie gibt es keinen Importweg.

**Es ist kein Cd-Kurven-Löser.** Es passt eine Zahl gegen ein Standard-Widerstandsmodell an — den besten Einzel-BC für dieses Modell, nicht die Wahrheit über die tatsächliche Widerstandsform des Geschosses. Das Werkzeug **Cd–Mach-Kurve** ermittelt die eigene Widerstandskurve eines Geschosses, und es will eine andere Art von Messung.

**Es sagt Ihnen, wie sicher es sich bei den Schüssen ist — und nur bei den Schüssen.** Neben dem Mittelwert weist es ein 95-%-Konfidenzintervall auf diesen Mittelwert aus, als Prozentsatz davon, berechnet aus der Streuung der akzeptierten Einzelschuss-BCs. Dieses Intervall spiegelt die eingegebenen Zahlen und das Stichprobenrauschen obendrauf, sonst nichts — eine falsch eingetippte Atmosphäre verschiebt Mittelwert und Intervall gemeinsam, und keine aus den Tracks berechnete Kennzahl kann das sehen. §10.3.

---

## 2. Datenschutz, Speicherung und Voraussetzungen

**Nichts, was Sie in dieses Werkzeug geben, verlässt Ihr Gerät.** Die gewählte Zip-Datei wird nie hochgeladen. Sie wird in Ihrem Browser entpackt, in Ihrem Browser geparst und in Ihrem Browser angepasst, von JavaScript auf Ihrer eigenen Maschine. Kein Konto, kein Server, keine Telemetrie.

**Gespeichert wird ebenfalls nichts.** Anders als Arsenal oder der Gewehr-Präzisionsrechner führt dieses Werkzeug keine Bibliothek. Ihr geladener Stapel, Ihre Filterwahl, Ihr Widerstandsmodell und Ihre Atmosphäre überleben den Wechsel zu einem anderen Werkzeug und zurück (sie liegen für die Sitzung im Speicher), aber nicht ein Neuladen der Seite. Nach einem Reload wählen Sie das Zip erneut. Das ist Absicht: ein Track-Stapel ist ein Zwischenergebnis, kein Dokument. Aufhebenswert ist der resultierende BC, und der gehört ins Arsenal (§11.1).

**Voraussetzungen.** Ein halbwegs aktueller Browser. Die Anpassung ist rechenintensiv — pro Track läuft eine vollständige Widerstandsintegration einige hundert Mal —, deshalb verteilt sie sich auf einen Pool von Hintergrund-Workern (§6.7). Ein Stapel von dreißig Tracks ist auf einem Desktop in ein paar Sekunden durch und braucht auf einem Telefon merklich länger. Die App installiert sich als PWA, und dieses Werkzeug funktioniert nach dem ersten Laden vollständig offline. Das zählt: der Ort, an dem Sie es am ehesten laufen lassen wollen, ist ein Schießstand ohne Empfang.

---

## 3. Was ein Labradar-Export tatsächlich ist

Wer den Dateiaufbau versteht, wundert sich deutlich weniger darüber, warum manche Zeilen der Track-Liste *kein Track* melden.

Wenn Sie eine Sitzung von der SD-Karte des Geräts kopieren, erhalten Sie einen Ordner wie diesen:

```
SR0013/
  SR0013.lbr            die Projektdatei des Geräts
  SR0013 Report.csv     die Sitzungszusammenfassung — Geschwindigkeiten, ES, SD
  TRK/
    Shot0001 Track.csv  eine Datei je Schuss: der eigentliche Radar-Track
    Shot0002 Track.csv
    ...
```

Zippen Sie diesen Ordner — das Ganze, samt Unterordnern —, und dieses Zip ist es, was das Werkzeug will.

**Die Track-Datei** ist die interessante. Nach einem kurzen Gerätekopf enthält sie eine Zeile je Radarrückgabe:

```
Time (s);Vel (m/s);Dist (m);SNR
0.000000;767.75;0.00;-
0.007021;765.35;5.37;33.07
0.008021;765.05;6.14;40.15
0.009021;764.57;6.90;39.80
...
```

Vier Spalten: verstrichene Zeit in Sekunden, Geschwindigkeit, Entfernung vom Gerät und Signal-Rausch-Verhältnis (SNR) in Dezibel. Etwa eine Zeile je Millisekunde, von der Mündung bis dorthin, wo das Radar das Geschoss verloren hat — rund hundert Zeilen bei einem typischen Büchsenschuss.

Drei Dinge über diese Tabelle sind wissenswert, weil das Werkzeug sie alle unterschiedlich behandelt:

- **Die erste Zeile ist keine Messung.** Ihre Zeit ist exakt null, ihre Entfernung exakt null, und ihr SNR-Feld ist buchstäblich ein Gedankenstrich. Das Gerät rechnet sie zurück — es ist die vom Gerät extrapolierte Mündungsgeschwindigkeit, keine Radarrückgabe. Dieses Werkzeug schließt sie von jeder Anpassung und jeder Qualitätskennzahl aus. Sie wird im Diagramm gezeichnet und ansonsten ignoriert.
- **SNR ist eine Qualitätsangabe je Punkt**, und sie schwankt entlang des Tracks enorm. Im Beispiel oben beginnt sie bei etwa 40 dB und ist in den letzten Zeilen auf 8 gefallen. Dieses Werkzeug gewichtet jeden Punkt mit seinem SNR (§12.4), sodass die zuverlässigen frühen Rückgaben die Anpassung dominieren und die zweifelhaften späten sie kaum bewegen.
- **Die Geschwindigkeitsspalte ist nicht monoton.** Sehen Sie sich die letzten Zeilen eines echten Tracks an, und Sie werden häufig *steigende* Geschwindigkeit finden. Das ist nicht das beschleunigende Geschoss; das ist das Radar, das eine Reflexion von etwas anderem liest. Diese herauszuputzen ist das meiste, was dieses Werkzeug tut, bevor es überhaupt etwas anpasst (§12.3).

**Die Einheiten werden dem Dateikopf selbst entnommen.** Steht Ihr Gerät auf fps und Yards, sagt der Kopf das, und das Werkzeug rechnet beim Einlesen um. Sie müssen es ihm nicht mitteilen, und Sie müssen die Geräteeinstellung nicht an Ihre Anzeigevorliebe angleichen.

### 3.1 Anmerkung zu den Einheiten

Dies ist das eine Werkzeug der Suite, bei dem Einheiten kaum eine Rolle spielen, denn die Einheiten eines ballistischen Koeffizienten sind ziemlich undurchsichtig. Im Prinzip wird er in Pfund je Quadratzoll Querschnittsbelastung gemessen, aber in der Praxis schreibt das niemand so — einfach eine nackte Zahl, mit drei oder vier Nachkommastellen.

An drei Stellen tauchen Einheiten doch auf:

- **Die Atmosphärenfelder** — Temperatur, Stationsdruck, Feuchtigkeit — folgen Ihrer Einstellung wie jeder andere Atmosphärenblock der Suite, mit der Einheit als mitlaufendem Zusatz an der Feldbeschriftung.
- **Die Track-Dateien** führen ihre eigenen Einheiten in ihren eigenen Köpfen mit und werden beim Import umgerechnet, wie oben beschrieben. Ihre Vorliebe hat darauf keinen Einfluss.
- **Die Achsen des Track-Diagramms** sind die Ausnahme, und zwar eine ehrliche: die Waagerechte ist immer in Millisekunden, die Senkrechte immer in Metern pro Sekunde, unabhängig davon, welche Geschwindigkeitseinheit Sie anderswo eingestellt haben. Das ist ein Diagnosebild interner Werte, kein Bericht.

---

## 4. Schnellstart

Für Ungeduldige. Einzelheiten folgen in §5–§10.

1. Schießen Sie eine Sitzung mit dem Labradar, mit Sorgfalt bei Ausrichtung, Geschossversatz und dem Rest von §5.1–§5.5. Zwanzig Schuss oder mehr, alle mit demselben Geschoss.
2. Notieren Sie Temperatur, **Stations**druck und Feuchtigkeit **am Schützenstand** (§5.6). Nicht die Wettervorhersage.
3. Kopieren Sie den Sitzungsordner von der SD-Karte und zippen Sie ihn, samt Unterordnern.
4. **BC-Werkzeuge** aus dem Werkzeugmenü → Reiter **BC-Labradar**.
5. Stellen Sie das **Luftwiderstandsmodell** ein — G7 für ein modernes Boat-Tail, G1 für Flachboden oder Rundkopf (§6.1).
6. Tragen Sie die **Atmosphäre** aus Ihren Notizen ein.
7. **Labradar-.zip wählen…** und die Datei auswählen. Die Track-Liste erscheint sofort.
8. **Berechnen**. Die Zeilen füllen sich, sobald die Anpassung des jeweiligen Schusses fertig ist.
9. Lesen Sie den gemittelten BC von der Karte **Ergebnis** ab, mit dem 95-%-Konfidenzintervall daneben und der Standardabweichung darüber.
10. Klicken Sie eine beliebige Zeile an, um den Track dieses Schusses zu sehen, seine behaltenen und verworfenen Punkte und die daran angepasste Kurve.

Trauen Sie keinem Ergebnis aus weniger als zehn Schuss, und lesen Sie §10.3, bevor Sie einem aus weniger als zwanzig trauen.

---

## 5. Daten gewinnen, die eine Auswertung lohnen

Das Werkzeug kann nur Rauschen wegputzen. Es kann keine Messung erfinden, die nie stattgefunden hat, und es kann keinen systematischen Fehler in den von Ihnen eingetippten Bedingungen erkennen. Alles in diesem Abschnitt geschieht, bevor Sie die App öffnen, und jeder dieser Fehler ist hinterher unsichtbar.

**Beginnen Sie mit dem Handbuch des Geräts**, zumindest mit der Kurzanleitung. Da sind Bilder drin. Jede Empfehlung darin hat ihren Grund, und die Gründe unten sind größtenteils Ausführungen dazu. Was folgt, ist der Teil, der überproportional wichtig wird, wenn das Ziel ein ballistischer Koeffizient ist und nicht eine Mündungsgeschwindigkeit. Ein Aufbau, der einwandfreie V0-Werte liefert, kann trotzdem Tracks liefern, die jenseits von dreißig Metern wertlos sind — und das Gerät sagt Ihnen nicht, welche Art Sitzung Sie gerade hatten.

### 5.1 Das Radar ausrichten

**Richten Sie es auf das Ziel, auf das Sie tatsächlich schießen**, nicht auf das Gewehr und nicht ungefähr die Bahn hinunter. Das Gerät verfolgt das Geschoss entlang seiner eigenen Strahlachse, und je näher die Flugbahn an dieser Achse verläuft, desto stärker und sauberer ist jede Rückgabe.

Es geht hier nicht nur um ein, zwei Meter Trackverlängerung. Die Strahlausrichtung entscheidet darüber, wie weit hinaus das Gerät das Geschoss überhaupt hält. Und die Tracklänge ist der größte einzelne Hebel für die Qualität einer BC-Anpassung: ein längerer Track bedeutet mehr messbaren Abfall, mehr Punkte zum Anpassen und weniger relativen Einfluss des Rauschens am Ende.

### 5.2 Der Geschossversatz

Das Gerät hat eine Einstellung namens *proj. offset*, die ihm sagt, wie weit die Geschossbahn am Radar vorbeiläuft. Ist sie falsch, ist jede Geschwindigkeit in jedem Track falsch — konsistent und auf eine Weise, die völlig plausibel aussieht.

**Warum es sie gibt.** Das Radar misst nur die *radiale* Geschwindigkeit: die Rate, mit der sich das Geschoss vom Gerät entfernt. Das ist nicht dasselbe wie die tatsächliche Geschwindigkeit in Schussrichtung, weil Strahlachse und Flugbahn nicht dieselbe Gerade sind. Das eine ins andere umzurechnen ist schlichte Trigonometrie — genau das tut das Gerät, bevor es irgendetwas anzeigt —, aber sie muss wissen, wie weit die beiden Geraden auseinanderliegen. Das ist die Zahl, die Sie einstellen.

**Halten Sie sie ein.** Sagt die Einstellung 30 cm, dann bringen Sie den Lauf 25 bis 30 cm vom Radar entfernt in Stellung. Stellen Sie ihn einen Meter weg, zeichnet das Gerät zwar weiter auf, aber jeder Wert trägt einen erheblichen Fehler.

**Es ist der Abstand zur Laufachse, seitlich zum Radar gemessen.** Nicht der Abstand von der Mündung zum Gerät, der eine längere, schräge Strecke ist. Wenn Ihre Mündung ein Stück vor, oder hinter, dem Radargehäuse sitzt, ist das für sich genommen kein Problem. Solange der seitliche Abstand zum Lauf stimmt, ist der Fehler der angezeigten Mündungsgeschwindigkeit vernachlässigbar, und der Fehler des hier berechneten BC ist gleich null.

**Und hier zählt es mehr als auf der Anzeige des Geräts.** Ein Versatzfehler stört den V0-Wert mäßig. Einen BC, der aus der *Form* des Tracks gewonnen wird, stört er erheblich mehr. Wenn Sie einen ungefähren Versatz gewohnheitsmäßig durchgehen lassen, weil Ihre Chronographenzahlen weiterhin vernünftig aussehen: diese Nachsicht überträgt sich nicht auf dieses Werkzeug. §12.1 erklärt, warum.

### 5.3 Das Radar absolut ruhig halten

Bewegt sich das Gerät während einer Messung, sind die Ergebnisse nicht verschlechtert — sie sind zufällig.

- **Nehmen Sie ein wirklich solides, gut gestelltes Stativ.** Scheuen Sie sich nicht, die Montageplattform mit Gewicht zu beschweren. Dies ist einer der seltenen Fälle, in denen die schwerere und hässlichere Lösung schlicht die richtige ist.
- **Wenn Sie etwas mit einer ernstzunehmenden Mündungsbremse schießen, schirmen Sie das Gerät gegen den Knall ab.** Ein Brett, eine Munitionskiste, irgendetwas Massives zwischen Mündung und Radar. Das Gehäuse ist schlagfester Kunststoff und übersteht das; es geht nicht darum, den Kunststoff zu schützen, sondern darum, dass die Box von der Druckwelle nicht durchgeschüttelt wird. Ein Gerät, das bei jedem Schuss zuckt, produziert eine Sitzung, in der die Tracks im Lauf der Serie leise immer schlechter werden — genau die Fehlerart, die man hinterher am schwersten erkennt.

### 5.4 Die Schießbahn selbst

Doppler-Radar erfreut sich an allem Reflektierenden, und jede Störreflexion ist ein Kandidat für die Schwänze mit steigender Geschwindigkeit aus §3.

- **Freies Feld ist besser.** Keine hohen Bodenwellen innerhalb der Radarreichweite, und die Flugbahn etwa fünf Meter nach links, rechts und oben frei von Hindernissen.
- **Achten Sie auch auf das, was neben dem Schützenstand steht**: ein Kugelfang, ein Scheibenrahmen, ein Tisch, ein Fahrzeug, der Schütze auf der Nachbarbahn. Eine vollgestellte Bahn produziert Tracks, an denen die Bereinigung viel härter arbeiten muss, und mehr Tracks, die rundheraus verworfen werden.
- **Verwenden Sie innerhalb von etwa 200 m keine Stahlziele.** Nur Holz, Karton oder Papier. Ein kleines Metallgeschoss vor dem Hintergrund einer großen Metallplatte ist ein wirklich schwieriges Detektionsproblem, und das Gerät verliert das Geschoss früh oder verfolgt stattdessen die Platte.

### 5.5 Eine Geräteeinstellung, die speziell den BC betrifft

**Stellen Sie die maximale Anzeigedistanz auf 200 m bzw. 200 yd.**

Bis dorthin wird der Track aller Voraussicht nach ohnehin nicht reichen — in der Praxis kommt das höchstens bei sehr großen Kalibern mit flacher Flugbahn vor. Diese Einstellung sagt dem Gerät einfach, weiterzuversuchen, solange das Signal trägt, statt an einer kürzeren Grenze aufzuhören. Längerer Track, mehr Abfall, bessere Anpassung. Einen Nachteil gibt es nicht: das Gerät schaltet den Radarstrahl ohnehin ab, sobald es das Geschoss verliert.

### 5.6 Atmosphäre: die Eingabe, die Ihnen wirklich in die Hand beißt

Mist rein, Mist raus — und die Atmosphäre ist der häufigste Mist.

Die Widerstandskraft auf das Geschoss ist proportional zur Luftdichte, und der BC, den das Werkzeug sucht, ist derjenige, der den modellierten Widerstand mit der beobachteten Verzögerung zur Deckung bringt. Liegen Sie bei der Dichte um 3 % daneben, ist Ihr BC um etwa 3 % falsch — lautlos und ohne dass irgendwo ein Hinweis auftauchte, dass etwas nicht stimmt.

- **Messen Sie am Schützenstand.** Ein Kestrel oder Gleichwertiges genügt. „Was auch immer die Wetter-App für den nächsten Ort sagte" genügt nicht — diese Station kann vierzig Kilometer entfernt und dreihundert Meter tiefer liegen.
- **Nehmen Sie den Stationsdruck — den absoluten Druck auf Ihrer tatsächlichen Höhe.** Das ist der mit Abstand häufigste Fehler, und es lohnt sich, hier pedantisch zu sein, denn Kestrel verwendet unglücklicherweise den Begriff *barometrischer Druck* für den auf Meereshöhe umgerechneten Wert, und genau den wollen Sie **nicht**. Dieses Werkzeug nimmt Ihre Eingabe für bare Münze auf Ihrer eigenen Höhe und leitet daraus rückwärts eine Höhe ab (§12.10).

  Die Plausibilitätsprüfung: Wenn Sie auf 500 m Höhe oder darüber 1000 hPa oder mehr ablesen (29,5 inHg auf 1500 ft, für die metrisch Benachteiligten), lesen Sie mit ziemlicher Sicherheit einen auf Meereshöhe umgerechneten Wert ab — oder es geschieht gerade etwas in der Atmosphäre, das Sie demnächst mehr beschäftigen wird als Ihr ballistischer Koeffizient.
- **Wenn Sie die Feuchtigkeit wirklich nicht kennen, tragen Sie 50 % ein.** Sie ist die mit Abstand einflussloseste der drei, und mit 50 % liegt man nie weit daneben.

### 5.7 Wie viele Schuss

Ein Schuss ist ein Schuss. Er sagt so gut wie nichts, und das Werkzeug wird daraus bereitwillig einen BC auf vier Nachkommastellen berechnen.

- **Ordentliche Fabrikmunition: zwanzig Schuss** ist das praktische Minimum. Das genügt, damit sich die Streuung von Schuss zu Schuss auf etwas herausmittelt, das Sie vertreten können.
- **Billige Surplus-Ware, gemischte Lose, müde Hülsen: dreißig oder mehr.** Die Streuung ist größer und braucht mehr Schuss, um sich auszumitteln.
- **Wirklich gute Matchgeschosse: zehn können reichen.** Sie sind konsistent genug, dass die Tracks eng miteinander übereinstimmen, und die Standardabweichung auf der Ergebniskarte sagt Ihnen das.

Mehr ist immer besser, und die Grenzkosten betragen eine Patrone.

Schießen Sie alle unter denselben Bedingungen, aus demselben Gewehr, mit demselben Geschoss. Dieses Werkzeug mittelt über den Stapel. Zwei verschiedene Geschosse zu mitteln liefert den BC von keinem von beiden. Die Mündungsgeschwindigkeiten müssen nicht gleich oder auch nur ähnlich sein — einen BC an einer Ladeentwicklungsserie zu messen ist völlig in Ordnung.

### 5.8 Das Zip aus dem Gerät holen

Kopieren Sie den ganzen Sitzungsordner von der SD-Karte und packen Sie ihn. Sie müssen den Ordner `TRK` nicht herauskramen, nichts umbenennen, und es schadet nicht, Bericht und Projektdatei drin zu lassen — sie werden automatisch ignoriert (§7.2). Unterordner sind kein Problem.

Das Werkzeug nimmt genau ein Zip auf einmal. Wollen Sie mehrere Sitzungen zu einem BC zusammenführen, packen Sie sie entweder in ein Zip oder rechnen sie getrennt und mitteln von Hand.

---

## 6. Die Karte „Einrichtung"

Alles auf der linken Karte, von oben nach unten.

### 6.1 Luftwiderstandsmodell

Gegen welches Standard-Widerstandsmodell der BC ausgedrückt wird. Voreingestellt ist **G7**, und die Auswahl listet jedes von der Suite unterstützte Modell auf, gefiltert nach dem, was Sie in den Einstellungen anzeigen lassen.

Die Wahl wiegt hier schwerer als an den meisten Stellen, weil die Anpassung gegen die tatsächliche Kurvenform des Modells über das tatsächliche Geschwindigkeitsband Ihres Geschosses erfolgt und nicht über eine Umrechnung:

- **G7** für moderne Boat-Tail-Geschosse — lange Ogive, verjüngter Boden. Praktisch jedes Match- und Jagdgeschoss der letzten dreißig Jahre.
- **G1** für Flachboden, Rundkopf und die meisten älteren oder stumpfen Konstruktionen. Es ist außerdem das, was die meisten Hersteller angeben, also warum nicht.

Das gewählte Modell steckt fest in jeder Track-Anpassung; es nach dem Rechnen zu ändern verlangt ein erneutes **Berechnen** (§6.7). Auf den Bereinigungsschritt hat es überhaupt keinen Einfluss.

Sie können denselben Stapel zweimal laufen lassen, einmal je Modell, und beide Zahlen aufheben.

### 6.2 Atmosphäre

Temperatur, Stationsdruck, relative Feuchtigkeit. §5.6 erklärt, warum das zählt und wie Sie an die Werte kommen.

Anders als die Atmosphärenblöcke anderswo in der Suite hat **dieser keine Voreinstellungen** und kein eigenes Höhenfeld. Es gibt keine „Standardatmosphäre", keine Schweizer und keine sowjetische Referenzbedingung. Dieses Werkzeug wertet eine echte Messung in echter Luft aus, und eine Voreinstellung wäre nur eine Art, stillschweigend so zu tun, als wüsste man etwas, das man nicht weiß.

Die Vorgaben — 15 °C, 1013,25 hPa, 0 % Feuchtigkeit — sind ein neutraler Ausgangspunkt, keine Schätzung Ihres Wetters. Es sind die ICAO-Standardbedingungen auf Meereshöhe, und wenn Sie nicht auf Meereshöhe an einem Standardtag geschossen haben, sind sie falsch. Ersetzen Sie alle drei.

Nach der Höhe wird nicht gefragt, und das ist auch nicht nötig: Sie wird aus dem eingetippten Stationsdruck abgeleitet (§12.10).

Wie das Widerstandsmodell steckt auch die Atmosphäre zum Zeitpunkt der Anpassung fest. Sie hinterher zu ändern verlangt ein erneutes **Berechnen**.

### 6.3 Signalqualitätsschwelle

Der erste der beiden Ganz-Track-Filter. Er entscheidet, welche Tracks vertrauenswürdig genug zum Mitteln sind, und zwar danach, wie sauber die bereinigten Punkte des Schusses auf einer Geraden liegen.

Drei Einstellungen:

- **Normal (R² > 0,95)** — die Vorgabe, und für die meisten Sitzungen richtig.
- **Hohes Rauschen (R² > 0,90)** — für eine wirklich vollgestellte Bahn, auf der zu viele einwandfreie Schüsse verworfen werden. Nehmen Sie das, wenn Sie beim Durchklicken der Zeilen sehen, dass die verworfenen Tracks in Ordnung aussehen.
- **Keine** — überhaupt keine Qualitätsprüfung. Alles, was einen BC ergeben hat, geht in den Mittelwert ein.

Das in der Track-Liste gezeigte R² ist die Zahl, gegen die diese Schwelle prüft. §12.8 erklärt, was es tatsächlich misst und warum eine Gerade die richtige Referenz für eine *Qualitäts*prüfung ist, obwohl sie die falsche Referenz für eine *Anpassung* ist.

Diese Einstellung zu ändern entscheidet neu, welche Tracks einbezogen werden, und aktualisiert den Mittelwert **sofort** — neu gerechnet werden muss nichts, denn kein BC ändert sich, nur das Urteil über jeden einzelnen.

### 6.4 Ausreißer verwerfen

Der zweite Ganz-Track-Filter, und eine ganz andere Art von Prüfung: diese kümmert sich überhaupt nicht um Signalqualität, sondern nur darum, ob der BC eines Tracks zu den anderen passt.

Drei Einstellungen:

- **Konservativ (2,0σ)** — die Vorgabe. Ein Track wird verworfen, wenn sein BC weiter vom Stapelmittel entfernt liegt, als es alle bis auf ein paar Prozent ehrlicher Schüsse je tun sollten. Dieser Abstand wird in Standardabweichungen gemessen — dafür steht das σ im Namen der Option —, und diese Einstellung zieht die Grenze bei zweien davon.
- **Aggressiv (1,64σ)** — verwirft mehr. Nützlich auf einem belebten Stand mit ähnlichen Kalibern nebenan, oder wenn Sie zwischen den Zielen nicht neu ausgerichtet haben. Sie wirft auch echte, gültige Daten weg, was über die kleinere Stichprobe Genauigkeit kostet. Nehmen Sie sie, wenn Sie Schüsse übrig haben.
- **Keine** — keine Ausreißerverwerfung. Greifen Sie dazu, wenn Sie Ihren Daten trauen und die Stichprobe klein ist. Unter etwa zehn Schuss stimmt der Stapel noch nicht gut genug mit sich selbst überein, um zu beurteilen, welches Mitglied abweicht, sodass der Test häufiger gute als schlechte Schüsse wegwirft.

Der Klassiker, den das fängt, ist ein Track, der gar nicht Ihr Geschoss ist: Das Radar hat einen Schuss von der Nachbarbahn erwischt, ihn völlig sauber verfolgt und eine wunderschöne Anpassung für fremdes Blei produziert. Sein R² wird ausgezeichnet sein. Nur die Abweichung vom Rest Ihres Stapels verrät ihn.

Wie bei der Qualitätsschwelle wird auch hier bei jeder Änderung sofort neu entschieden und neu gemittelt.

### 6.5 Entrauschungsschwelle

Diese unterscheidet sich von den beiden obigen der Art nach, nicht bloß dem Grad nach. Die beiden Filter werfen ganze *Tracks* weg. Dieser Schieberegler steuert, wie aggressiv schlechte *Punkte* **innerhalb** jedes Tracks entfernt werden, bevor dieser Track überhaupt angepasst wird.

Er reicht von **Locker** (0,970) bis **Normal** (0,990) in Schritten von 0,005 und steht standardmäßig auf 0,990, am rechten Anschlag. Der Zahlenwert steht neben der Beschriftung.

**Lassen Sie ihn auf 0,990.** Dieser Wert ist weder geraten noch Geschmackssache; er ist das Ergebnis eines direkten Durchlaufs über echte Tracks mit bekannten eingespielten Ausreißern und halbiert den resultierenden BC-Fehler gegenüber dem älteren, sanfteren 0,970 in etwa (§12.7). Der einzige Grund, ihn zu verstellen, ist eine wirklich extreme Umgebung, in der Sie sehen, dass echte, gute Punkte verworfen werden — klicken Sie ein paar Zeilen durch und sehen Sie sich das Diagramm an, bevor Sie das entscheiden.

0,970 gibt es als Option, weil das Vorgängerwerkzeug es jahrelang benutzt hat. Wenn Sie ein altes Ergebnis nachstellen wollen, ist das die Einstellung, die es nachstellt.

Anders als die beiden obigen Filter verändert dieser die Anpassung selbst, deshalb verlangt eine Änderung ein erneutes **Berechnen**.

### 6.6 Labradar-.zip wählen…

Öffnet die Dateiauswahl Ihres Geräts. Sobald eine Datei gewählt ist, entpackt das Werkzeug sie sofort, findet die CSV-Einträge und ermittelt, welche davon echte Tracks sind — alles in Ihrem Browser, nichts hochgeladen. Der Dateiname erscheint neben der Schaltfläche, und die Track-Liste füllt sich augenblicklich.

Dieser Schritt berechnet **nichts**. Jeder Track landet mit dem Status *noch nicht berechnet* in der Liste, bis auf die Einträge, die gar keine Tracks sind und sofort als solche gekennzeichnet werden (§7.2).

Zwei Fehler können hier auftreten:

- ***Datei konnte nicht geöffnet werden***, mit dem zugrunde liegenden Grund — die Datei war kein gültiges Zip-Archiv.
- ***Keine Track-Dateien im Zip gefunden*** — es ließ sich öffnen, enthielt aber überhaupt nichts mit `.csv` im Namen. Meist bedeutet das, dass der falsche Ordner gepackt wurde oder das Archiv ein verschachteltes Zip statt der Dateien selbst enthält.

Ein neues Zip zu wählen löscht jeden vorhandenen Stapel, einschließlich jeder von Hand getroffenen Einschließen-/Ausschließen-Entscheidung.

### 6.7 Berechnen

Bewusst eine eigene Schaltfläche und nicht Teil der Dateiauswahl, damit Sie Widerstandsmodell und Atmosphäre setzen können, *nachdem* Sie gesehen haben, was im Zip steckt, und bevor Rechenzeit dafür draufgeht.

Ein Klick startet im Hintergrund einen Anpassungsvorgang für jeden geparsten Track. Die Zeilen aktualisieren sich einzeln, sobald ihr jeweiliger Auftrag fertig ist — Sie können dem Stapel beim Auflösen zusehen —, und der Mittelwert wird bei jedem neu gerechnet. Die Schaltfläche ist während des Laufs deaktiviert und wird wieder freigegeben, wenn der letzte Track steht.

**Was was neu rechnet**, sollte man im Blick behalten, damit man weiß, wann dieses Werkzeug Ihnen unauffällig eine veraltete Zahl zeigen kann:

| Änderung | Wirkung |
|---|---|
| Signalqualitätsschwelle | Urteile und Mittelwert sofort aktualisiert |
| Ausreißer verwerfen | Urteile und Mittelwert sofort aktualisiert |
| Ein Häkchen bei **Einschließen** | Urteile und Mittelwert sofort aktualisiert |
| Luftwiderstandsmodell | **Erfordert Berechnen** — nichts ändert sich, bis Sie klicken |
| Atmosphäre | **Erfordert Berechnen** |
| Entrauschungsschwelle | **Erfordert Berechnen** |

Ein erneuter Klick auf **Berechnen** verwirft jedes vorhandene Track-Ergebnis und passt den ganzen Stapel mit den aktuellen Einstellungen von Grund auf neu an. Während des Laufs werden auch Diagramm und Zusammenfassung geleert. Ihre von Hand getroffenen Einschließen-/Ausschließen-Entscheidungen überleben das.

---

## 7. Die Track-Liste

Eine Zeile je im Zip gefundenem CSV-Eintrag, in der Reihenfolge des Zips — die bei einem normalen Export die Schussreihenfolge ist.

### 7.1 Die Spalten

- **Datei** — der vollständige Pfad des Eintrags innerhalb des Zips, also `SR0013/TRK/Shot0007 Track.csv` statt nur der Schussnummer. Ausführlich, aber eindeutig, wenn ein Zip mehr als eine Sitzung enthält.
- **Status** — das Urteil als farbige Plakette. Siehe §7.2.
- **BC** — der für diesen Schuss angepasste ballistische Koeffizient, auf vier Nachkommastellen, oder ein Strich, wenn er noch nicht berechnet wurde.
- **R²** — wie gut die bereinigten Punkte dieses Schusses auf einer Geraden liegen, auf vier Nachkommastellen. Das ist es, was die Signalqualitätsschwelle (§6.3) prüft. Es ist eine Datenqualitätszahl, **kein** Maß dafür, wie gut die BC-Anpassung geklappt hat.
- **Einschließen** — ein Häkchen, das das automatische Urteil überstimmt.

Ein Klick irgendwo auf eine Zeile außer auf ihr Häkchen wählt diesen Track aus und zeichnet ihn in das Diagramm darüber (§8).

### 7.2 Die Status

| Status | Bedeutung |
|---|---|
| **noch nicht berechnet** | Erfolgreich geparst, wartet auf **Berechnen** |
| **wird berechnet…** | Der Auftrag ist eingereiht oder läuft |
| **kein Track** | Die Datei ist kein Labradar-Track. Vollständig ignoriert |
| **gültig** | Angepasst, beide Filter bestanden, im Mittelwert enthalten |
| **geringe Signalqualität** | Angepasst, aber R² unter der Schwelle (§6.3) |
| **Ausreißer** | Angepasst, gute Qualität, aber der BC passt nicht zum Stapel (§6.4) |
| **ausgeschlossen** | Sie haben das Häkchen von Hand entfernt |
| **Fehler** | Die Anpassung ist gescheitert. Siehe §10.4 |

***Kein Track*** ist der normale Zustand mehrerer Einträge in jedem echten Export und kein Problem. Die geräteeigene `Report.csv` bekommt diesen Status, weil sie eine Zusammenfassung ist und kein Track — ebenso alles andere, was zufällig auf `.csv` endet — einschließlich der unsichtbaren `._`-Begleitdateien, die macOS in angefasste Archive streut. Das Werkzeug entscheidet nach dem Inhalt, nicht nach dem Namen: eine Datei ist ein Track, wenn sie einen Labradar-Trackkopf mit deklarierter Geschwindigkeitseinheit enthält und mindestens vier brauchbare Datenzeilen liefert.

### 7.3 Das Häkchen „Einschließen"

Das Häkchen spiegelt das aktuelle Urteil — gesetzt bei *gültig*, nicht gesetzt bei den drei Verwerfungszuständen — und ein Klick überstimmt dieses Urteil von Hand.

- **Einen verworfenen Track anhaken** zwingt ihn in den Mittelwert, an der Qualitätsprüfung vorbei. Er ist danach außerdem **von der Ausreißerkappung ausgenommen**: eine manuelle Übersteuerung soll halten und nicht klammheimlich von genau der Kennzahl wieder verworfen werden, die sie überstimmt.
- **Bei einem gültigen Track das Häkchen entfernen** zwingt ihn hinaus, und er bleibt draußen, unabhängig von beiden Filtern.

Das Häkchen steht nur bei Zeilen zur Verfügung, die tatsächlich ein Urteil zum Überstimmen haben. Eine Zeile, die nicht berechnet wurde, kein Track ist oder einen Fehler hatte, hat nichts einzuschließen, und ihr Häkchen ist deaktiviert.

Übersteuerungen überleben ein **Berechnen** und werden gelöscht, wenn Sie ein neues Zip wählen.

Gehen Sie sparsam damit um und nur aus Gründen, die Sie aussprechen können. „Ich habe mir das Diagramm angesehen, das Radar hat sich auf halber Strecke sichtbar an etwas anderes gehängt, und der automatische Filter hat es nicht erwischt" ist ein Grund. „Es rauszunehmen hat den BC in die Richtung verschoben, die ich mir erhofft hatte" ist kein Grund — und genau so redet man sich eine Zahl schön.

---

## 8. Das Track-Diagramm

Klicken Sie eine Zeile an, und deren Geschwindigkeit-Zeit-Kurve wird über der Liste gezeichnet.

Drei Reihen:

- **Behalten** — die Punkte, die die Bereinigung überstanden haben und gegen die angepasst wurde.
- **Verworfen** — die von der Bereinigung entfernten Punkte, in eigener Farbe, damit Sie genau sehen, was verworfen wurde, und beurteilen können, ob Sie zustimmen.
- **BC = *n*** — eine durchgezogene Linie: die Geschwindigkeitskurve, die der angepasste BC tatsächlich vorhersagt, über denselben Zeitraum wie die Daten gezeichnet. Das ist eine Modellvorhersage und keine gemessenen Daten, weshalb sie eine Linie ist, während alles andere Streupunkte sind.

Die angepasste Kurve beginnt bei der ersten überlebenden echten Messung und nicht an der Mündung. Dort ist die Anpassung verankert, und von dort kann sie nur vorwärts gelaufen werden (§12.5). Der geräteeigene, errechnete Mündungspunkt wird trotzdem gezeichnet — er gehört zum Track —, aber durch ihn wird nichts angepasst.

Die Kurve reicht bis zur spätesten Zeit **irgendeines** gezeichneten Punktes, behalten oder verworfen, damit ein später Ausreißer sichtbar vergleichbar bleibt mit der Kurve, die ihn zu Recht ignoriert hat. Das ist das Nützlichste an diesem Diagramm: Bei einem guten Track schälen sich die verworfenen Punkte nach oben von einer Kurve ab, die an den behaltenen klebt.

**Diagramm als SVG herunterladen** exportiert es, wie bei den anderen Diagrammen der Suite.

Auch ein fehlerhafter Track wird beim Anklicken gezeichnet. Da es keine Anpassung und keine Trennung in behalten/verworfen gibt, wird jeder Rohpunkt außer dem geräteeigenen, errechneten Mündungspunkt als verworfen dargestellt — sodass Sie wenigstens sehen, was das Radar aufgezeichnet hat, und selbst beurteilen können, warum sich nichts daran anpassen ließ.

Die Waagerechte ist in Millisekunden, die Senkrechte in Metern pro Sekunde, immer. Siehe §3.1.

---

## 9. Die Karte „Ergebnis"

Drei Zeilen, über dem Diagramm.

- **Gültige Tracks** — wie viele der Gesamtzahl derzeit im Mittelwert stecken. `24 / 31` heißt, dass einunddreißig Schüsse einen ballistischen Koeffizienten ergeben haben und vierundzwanzig davon gemittelt werden. Der Nenner zählt nur Tracks, die tatsächlich angepasst wurden; Einträge, die nie Tracks waren, oder die gescheitert sind, fehlen in beiden Zahlen. Ist dieser Nenner kleiner als die Zahl Ihrer Schüsse, suchen Sie die Liste nach Fehlern ab.
- **BC-Standardabweichung** — die Streuung der einzelnen Schuss-BCs, die in den Mittelwert eingegangen sind, auf fünf Nachkommastellen. Das ist die Zahl, die Ihnen sagt, ob Sie der darunter glauben dürfen. Siehe §10.3.
- **Der BC selbst** — groß, in der Akzentfarbe, auf vier Nachkommastellen. Das schlichte ungewichtete arithmetische Mittel der BCs aller einbezogenen Tracks. Daneben, leiser, das 95-%-Konfidenzintervall auf diesen Mittelwert, als Prozentsatz davon geschrieben: `0.2812 (± 1.6%)`. Bei einem einzigen gültigen Track erscheint gar kein Intervall, denn ein Schuss hat keine Streuung, aus der man eines rechnen könnte. Siehe §10.3.

Alle drei aktualisieren sich in dem Augenblick, in dem Sie einen Filter ändern oder ein Häkchen setzen.

---

## 10. Das Ergebnis lesen

### 10.1 Was Sie tatsächlich gemessen haben

Die Zahl ist der beste Einzel-BC gegen das von Ihnen gewählte Widerstandsmodell. Sie reproduziert die Verzögerung, die Ihr Geschoss über die ersten rund hundert Meter seines Fluges tatsächlich gezeigt hat, in der Luft, die Sie dem Werkzeug genannt haben.

Drei Einschränkungen dazu, alle real:

**Es ist eine Messung des Geschosses, wie es aus Ihrem Lauf und durch Ihre Luft fliegt.** Nicht der Pulverladung. Die Mündungsgeschwindigkeit ist nicht Teil dessen, was gemessen wird. Die Anpassung liest die *Form* des Abfalls: ein Geschoss, das mit 780 m/s startet, verzögert nach derselben Widerstandskurve wie eines mit 700 m/s. Deshalb kann §5.7 sagen, dass ein Stapel nicht geschwindigkeitseinheitlich sein muss. Was der Lauf sehr wohl beiträgt, ist echt: Verschmutzung, Übergangskegelverschleiß und alles, was das Geschoss beim Verlassen stört, kann sein tatsächliches Flugverhalten ändern, und das schlägt hier durch.

**Sie ist über ein begrenztes Geschwindigkeitsband angepasst.** Das Geschoss ist nur für einen Bruchteil seines Fluges im Blick des Radars, und dabei die ganze Zeit schnell. Ein einzelner BC gegen ein Standardmodell ist ein Kompromiss über das Band, über das er angepasst wurde. Je enger die tatsächliche Widerstandskurve Ihres Geschosses der Form des Modells folgt, desto besser lässt sich dieser Kompromiss in den transsonischen Bereich extrapolieren — wo er am meisten zählt. Doch aus dem Nahbereich, den das Radar tatsächlich aufzeichnet, lässt sich nicht ablesen, welches Modell auf große Entfernung besser extrapoliert. Das ist eine Eigenschaft des Geschosses, nicht des Werkzeugs, und deshalb können beide Widerstandsmodelle gut passen und sich auf Distanz trotzdem widersprechen.

**Sie ist nur so gut wie Ihre Atmosphäre.** Nochmals. Siehe §5.6.

### 10.2 Der Vergleich mit der veröffentlichten Zahl

Erwarten Sie einen Unterschied. Es wäre überraschender, wenn es keinen gäbe.

Ein gemessener BC **unter** dem veröffentlichten Wert ist der Regelfall und meist der ehrliche. Veröffentlichte Zahlen werden häufig unter Idealbedingungen gemessen, über das Entfernungsband, das ihnen am meisten schmeichelt, an einem Los, das nicht Ihres sein muss.

Ein gemessener BC **weit** darunter — sagen wir dreißig Prozent — ist kein Geschossproblem. Es ist ein Eingabeproblem. Prüfen Sie zuerst den Druck (Stationsdruck gegen auf Meereshöhe umgerechnet, §5.6), dann das Widerstandsmodell, dann den Geschossversatz.

Ein gemessener BC **über** dem veröffentlichten Wert ist ein zweiter Blick auf Ihre Atmosphäre wert, bevor Sie feiern.

### 10.3 Konfidenzintervall und Standardabweichung lesen

Die beiden Zahlen beantworten verschiedene Fragen, und genau darin liegt der Sinn.

**Die Standardabweichung** ist die Streuung der einzelnen Schuss-BCs. Sie ist eine Eigenschaft Ihres Schießens, Ihrer Munition und des Tages, den Ihr Radar hatte, und mehr Schuss verkleinern sie nicht unbedingt.

**Das Konfidenzintervall** sagt, wie gut diese Schüsse den Mittelwert festgenagelt haben. Anders als die Streuung wird dieses mit mehr Schuss tatsächlich enger — aber langsam. Viermal so viele Schuss bringen das halbe Intervall. Es wird breiter, wenn Ihre Schüsse stärker voneinander abweichen. Und es ist bei kleinen Stapeln bewusst großzügig, weil eine Handvoll Schüsse schlicht nicht viel sagen kann. §12.9 nennt die Formel.

Ein Stapel von 25 gültigen Tracks mit einer BC-Standardabweichung von 0,010 ergibt also ein Intervall von etwa ±0,004 um den Mittelwert. Gegen einen BC von 0,250 liest sich das als ±1,6 %, was eine wirklich brauchbare Messung ist.

Dieselbe Standardabweichung über nur 4 gültige Tracks ergibt etwa ±0,016 oder ±6 %, was keine ist. Der größte Teil dieses Unterschieds ist schlicht die kleinere Stichprobe; der Rest ist das Werkzeug, das sich weigert, einem Vier-Schuss-Stapel zu schmeicheln.

**Was das Intervall abdeckt.** Die Streuung von Schuss zu Schuss, und sonst nichts. Nicht den Fehler in Ihrer Atmosphäre, nicht die Diskrepanz zwischen Ihrem Geschoss und dem Standard-Widerstandsmodell, nicht den geschätzten Geschossversatz. Die verschieben den Mittelwert selbst, und ein falscher Mittelwert bleibt falsch, egal wie eng das Intervall um ihn herum ist — lesen Sie §5.6 und §10.2, bevor Sie einem kleinen Prozentsatz glauben.

Daraus folgen unmittelbar zwei Faustregeln, und sie sind der Grund, warum §5.7 sagt, was es sagt:

- **Die Streuung ist eine Eigenschaft Ihrer Daten; die Genauigkeit ist eine Eigenschaft Ihres Stichprobenumfangs.** Verrauschte Tracks behebt man, indem man mehr davon schießt.
- **Breit ist eine Streuung immer relativ zu dem, was Patrone und Fenster normal machen.** Die Validierungsläufe hinter diesem Werkzeug (§12.6) verwendeten synthetische Tracks mit Rauschen, das echten Labradar-Aufzeichnungen entnommen wurde, bereinigt und angepasst genau so, wie es das ausgelieferte Werkzeug tut. Die Streuung je Track lag zwischen etwa 1,5 % und 5 % des Koeffizienten — am breitesten bei schweren, langsam verzögernden Patronen über ein kurzes Fenster, am engsten bei schnellen über ein langes. Ein Wert innerhalb dieses Bandes sagt nichts Besonderes. Deutlich darüber: klicken Sie die Zeilen durch und sehen Sie sich die Diagramme an, bevor Sie darüber hinwegmitteln — das Radar hatte zu kämpfen, die Bahn war vollgestellt, der Versatz stimmte nicht, oder Ihre Munition ist wirklich so uneinheitlich. Diese Läufe maßen Radarrauschen gegen eine bekannte Wahrheit, sodass ein echter Stapel die echte Streuung von Geschoss zu Geschoss noch obendrauf trägt, nicht darin.

### 10.4 Wenn ein Track einen Fehler meldet

Eine mit *Fehler* markierte Zeile bedeutet, dass die Anpassung selbst gescheitert ist und nicht etwa eine schlechte Antwort geliefert hat. In der Praxis heißt das, dass die Punkte dieses Tracks ein Geschoss implizierten, wie es keines gibt — einen Koeffizienten weit außerhalb dessen, was je verschossen wurde, oder eine Anfangsgeschwindigkeit weit ab von dem, was das Radar selbst aufgezeichnet hat —, sodass das Werkzeug sich geweigert hat, eine Zahl zu nennen. Die genauen Grenzen stehen in §12.11.

Das Werkzeug behandelt das als Scheitern, statt denjenigen Rand des Bereichs zu melden, zu dem es abgedriftet ist. Das ist das richtige Verhalten, bedeutet aber, dass die Zeile Ihnen nur sagt, dass es gescheitert ist, nicht warum. Wählen Sie sie aus und sehen Sie sich das Diagramm an: ein fehlerhafter Track entpuppt sich fast immer als sichtbar gar kein Geschoss-Track.

Ein oder zwei Fehler in einem großen Stapel sind unauffällig. Ein Stapel, in dem die meisten Tracks scheitern, deutet auf ein Aufbauproblem — meist eine schlechte Ausrichtung zwischen Radar und Geschossbahn, dann ein Widerstandsmodell, das zu den Daten überhaupt nicht passt, oder eine Atmosphäre, die so weit danebenliegt, dass der erforderliche BC außerhalb des Suchbereichs landet.

---

## 11. In die Praxis umgesetzt

### 11.1 Den Wert ins Arsenal übernehmen

Das ist der Sinn der Übung. Öffnen Sie **Waffen → Arsenal**, bearbeiten Sie das gerade gemessene Geschoss und ersetzen Sie den veröffentlichten BC durch Ihren, gegen das Widerstandsmodell, mit dem Sie ihn angepasst haben.

Es gibt keine automatische Übergabe — Sie tippen die Zahl ein. Es sind vier Ziffern, und genau darum geht es: Hier entscheiden Sie, dass Ihre Messung die Behauptung des Herstellers ablöst, und diese Entscheidung sollte bewusst fallen.

Von diesem Moment an rechnet jedes Werkzeug der Suite — Flugbahn, Trefferwahrscheinlichkeit, Geländerechner, das Vergleichsdiagramm — mit einem gemessenen Widerstandswert. Auf hundert Meter sieht man die Verbesserung nicht; jenseits von sechshundert sieht man sie sehr deutlich.

### 11.2 Lose und Ladungen vergleichen

Weil das Werkzeug neben dem Mittelwert auch eine Standardabweichung je Schuss ausweist, ist es ein recht gutes Instrument für Fragen, die mit Luftwiderstand gar nichts zu tun haben:

- **Zwei Lose desselben Geschosses.** Schießen Sie zwanzig von jedem und rechnen Sie sie als getrennte Stapel. Ein bedeutsam unterschiedlicher Mittel-BC heißt, dass sich die Lose tatsächlich unterscheiden, am ehesten in der Gleichmäßigkeit von Ogive oder Boden.
- **Die Wirkung einer Spitzenrichtmatrize oder des Sortierens nach Boden-Ogive-Maß.** Dieselbe Behandlung. Die interessante Zahl ist hier die *Standardabweichung*, nicht der Mittelwert: gleichmäßige Geschosse liefern gleichmäßige BCs.
- **Beschichtet gegen unbeschichtet, Moly, oder welche Begeisterung gerade umgeht.** Die Messung kümmert sich nicht um Marketing, und der Effekt ist meist kleiner, als das Marketing behauptet.

Halten Sie die Atmosphäre zwischen den Vergleichen ehrlich, sonst messen Sie das Wetter.

Einen Stapel bekommen Sie geschenkt: **eine Ladeentwicklungsserie ist bereits eine gültige BC-Sitzung.** Da die Anpassung sich nicht um die Mündungsgeschwindigkeit schert (§5.7), mitteln sich zwanzig oder dreißig Schuss über eine Spanne von Pulvergewichten, alle mit demselben Geschoss, zu einem völlig brauchbaren ballistischen Koeffizienten. Sie hätten die Serie ohnehin geschossen, und das Labradar hätte ohnehin jeden Track aufgezeichnet. Zippen Sie die Sitzung und lassen Sie sie laufen.

---

## 12. Freude des Nerds: was tatsächlich mit Ihren Tracks passiert

Alles Folgende ist das, was das Werkzeug tatsächlich rechnet, mit Begründung und Belegen. Es ist keine Pflichtlektüre für die Benutzung, und es ist der interessanteste Teil des Werkzeugs.

**Die Einheiten in diesem Abschnitt sind die der Engine.** Intern ist alles metrisch — Meter, Sekunden, Meter pro Sekunde, kelvinbezogene Temperaturen —, und umgerechnet wird nur an den beiden Rändern: die in der Track-Datei deklarierten Einheiten beim Hereinkommen und Ihre Anzeigevorliebe beim Hinausgehen.

### 12.1 Was das Gerät misst und was nicht

Ein Doppler-Chronograph misst nicht die Position und leitet sie ab. Er misst die Frequenzverschiebung seiner eigenen, am Geschoss reflektierten Aussendung, und die ist direkt proportional zur Geschwindigkeitskomponente des Geschosses *entlang des Strahls*. Die Geschwindigkeit ist die primäre Messgröße. Die Entfernung wird daraus integriert — deshalb ist die Entfernungsspalte glatt, auch wenn die Geschwindigkeitsspalte es nicht ist.

Zwei Folgerungen prägen alles Weitere:

**Der Geschossversatz ist eine echte geometrische Korrektur, keine Feinheit.** Was der Strahl sieht, ist die radiale Geschwindigkeitskomponente. Sie in die wahre Geschwindigkeit in Schussrichtung umzurechnen braucht den Winkel zwischen Strahl und Flugbahn, der aus dem eingestellten Versatz folgt. Ein Versatzfehler ist ein Kosinusfehler, und Kosinusfehler sind die schlimmste Sorte: klein, systematisch und in der Ausgabe vollkommen unsichtbar.

Das erklärt auch die in §5.2 behauptete Asymmetrie — warum ein schlampiger Versatz eine BC-Messung mehr kostet als eine Mündungsgeschwindigkeit. Der Winkel zwischen Strahl und Flugbahn ist nicht konstant: Er ist direkt an der Mündung am größten und geht gegen null, während das Geschoss die Bahn hinunterfliegt. Der Korrekturfaktor ist also eine *Funktion der Entfernung*. Ein falscher Versatz skaliert nicht den ganzen Track mit einer falschen Konstanten — er verbiegt ihn. Die frühen Punkte werden stärker korrigiert als die späten, oder schwächer, und heraus kommt eine Geschwindigkeitsabfallkurve der falschen Form.

Eine Mündungsgeschwindigkeit ist ein einzelner Punkt auf dieser Kurve und schluckt den Fehler als mäßigen Versatz. Ein ballistischer Koeffizient ist an die Form der Kurve angepasst und schluckt ihn als systematische Abweichung. Dieselbe Schlamperei, bei der Ihre Chronographenwerte völlig vernünftig aussehen, kann einen BC um mehrere Prozent verschieben.

**SNR ist ein direktes Maß dafür, wie viel von der Rückgabe echt ist.** Es wird je Punkt in Dezibel gemeldet und verschlechtert sich stetig, während sich das Geschoss entfernt — die zurückkommende Leistung fällt mit der vierten Potenz der Entfernung, ein doppelt so weit entferntes Geschoss liefert also ein Sechzehntel des Signals. Es ist das richtige Gewicht für eine Anpassung, und das Werkzeug benutzt es als solches (§12.4).

### 12.2 Wie das Rauschen tatsächlich aussieht

Bevor irgendetwas davon entworfen wurde, wurde das Rauschen gemessen statt angenommen: 1.297 eindeutige echte Tracks, aus einem Massenexport entdoppelt, mit Residuen gegen eine Referenzgerade, die nur an die **ersten 30 %** des jeweiligen Zeitfensters angepasst wurde — bewusst frei von Schwanzkontamination.

Gepooltes Geschwindigkeitsresiduum in m/s, nach Dezil der Position entlang des Tracks:

| Dezil | Mittel | Stdabw. | p5 | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 0 (Anfang) | -0,00 | 0,69 | -0,68 | 0,01 | 0,65 | 1,97 |
| 2 | -0,01 | 0,82 | -1,15 | -0,03 | 1,13 | 2,53 |
| 4 | 0,41 | 3,69 | -2,07 | 0,01 | 3,12 | 18,65 |
| 6 | 1,97 | 8,64 | -2,86 | 0,28 | 15,78 | 43,25 |
| 8 | 5,77 | 15,67 | -3,97 | 1,18 | 38,97 | 67,87 |
| 9 (Ende) | 10,41 | 19,46 | -3,62 | 3,44 | 52,06 | 81,03 |

Lesen Sie die beiden Enden gegeneinander, denn darin liegt die ganze Geschichte. Früh im Track ist das Rauschen eng und wirklich symmetrisch — eine wohlerzogene Doppler-Rückgabe mit hohem SNR. Spät im Track bewegt sich die **untere** Seite kaum: p5 bleibt die ganze Strecke bei etwa -3 bis -4 m/s. Die **obere** Seite wächst um fast zwei Größenordnungen, bis zu einem 99. Perzentil von 81 m/s.

Schlechte Labradar-Punkte überschätzen die Geschwindigkeit praktisch immer und unterschätzen sie nie. Genau so sieht eine Störrückgabe aus — eine Reflexion von etwas Näherem oder ein Mehrwegeempfang, beide lesen sich als geringerer Verlust an Entfernungsrate, als das Geschoss tatsächlich erlitten hat. Das ist kein symmetrisches Rauschen und darf nicht als solches behandelt werden.

Zwei weitere Tatsachen aus demselben Korpus, beide tragend für den Entwurf:

- **55 % der echten Tracks brauchen überhaupt kein Punktetrimmen.** Die Bereinigung ist kein routinemäßiger Glättungsdurchgang; sie ist eine Ausnahmebehandlung.
- **Die Schwere schwankt zwischen Sitzungen enorm und ist aus dem Track heraus nicht vorhersagbar.** Die Zahl der Verwerfungen reicht im Korpus von 0 bis 73. Kaliber (wie reflektiv der Geschossboden ist), Gerümpel nahe der Flugbahn, Strahlausrichtung und die Standfestigkeit der Box unter dem Mündungsknall tragen unabhängig voneinander bei.

Dieser letzte Punkt hat zwei Entwürfe für eine Schwelle erledigt, die sich pro Track anpasste, beide versuchten, die Schärfe der Bereinigung aus dem frühen Teil jedes Tracks zu kalibrieren. Das kann nicht funktionieren: die echte Schwere sitzt fast vollständig im Schwanz, und ein aus dem Kopf kalibriertes Signal kann sie nicht sehen. Einer der beiden scheiterte an einem *rauschfreien* synthetischen Track, auf dem er 18 bis 26 völlig einwandfreie Punkte verwarf. Der andere bestand diese Prüfung, konnte sich aber an echten Tracks mit echter Schwere kein einziges Mal gegen eine feste Schwelle durchsetzen. Beide sind im Bericht des Repositorys zum Bereinigungsexperiment dokumentiert; die feste Schwelle, die an ihre Stelle trat, übertraf beide.

### 12.3 Bereinigung: gieriges Entfernen des schlechtesten Punktes mit R²-Rückgabeschranke

Jeder Track wird bereinigt, bevor irgendetwas daran angepasst wird. Der Algorithmus stammt aus dem Vorgängerwerkzeug, wurde bewusst unverändert portiert und ist weder Sigma-Clipping noch RANSAC:

1. Passe eine SNR-gewichtete Ausgleichsgerade nach kleinsten Quadraten durch die Punkte an.
2. Finde den Punkt mit dem größten absoluten Residuum zu dieser Geraden. Entferne ihn. Notiere das R² der Anpassung *vor* dem Entfernen.
3. Wiederhole, bis zu einem Boden von 10 verbleibenden Punkten.
4. Gehe dann die notierte R²-Historie von vorn durch. Beim **ersten** Schritt, dessen R² bereits innerhalb einer relativen Schwelle zum besten je während des Trimmens gesehenen R² lag, stelle den Punkt dieses Schritts **und alles danach Verworfene** wieder her.

Schritt 4 ist der feine Teil und der Grund, warum der Algorithmus funktioniert. Die Trimmschleife läuft immer bis zum Boden durch und verwirft dabei gute Punkte zusammen mit schlechten; der Rückgabedurchlauf fragt dann: „Ab wann hat weiteres Trimmen nichts mehr gebracht?" und rollt alles bis dorthin zurück. Ein Track, der gar keine Bereinigung brauchte, hat bei Schritt null das bestmögliche R², sodass die allererste Rückgabeprüfung greift und jeder verworfene Punkt sofort zurückkommt. So gehen 55 % der echten Tracks korrekt unangetastet aus einer Schleife hervor, die bedingungslos Dutzende ihrer Punkte entfernt hat.

Drei Index-Asymmetrien in dieser Routine sehen wie Fehler aus und sind keine:

- **Der synthetische t = 0-Punkt des Geräts ist von der Anpassung, vom R² und von der Suche nach dem schlechtesten Punkt ausgeschlossen.** Er ist keine Messung (§3), und sein SNR-Feld ist buchstäblich ein Strich. Er darf keine Anpassung beeinflussen und kann sinnvollerweise auch nicht „entfernt" werden.
- **Der letzte Punkt ist von Anpassung und R² ausgeschlossen, bleibt aber zum Entfernen berechtigt.** Das Gerät rauscht genau am Schwanz am stärksten, also darf ein schlechter letzter Punkt die Qualitätskennzahl nicht verderben — und bleibt trotzdem ein legitimer Trimmkandidat. Die Folge ist ein bestimmtes, prüfbares Verhalten: Ein Track, dessen *einziges* Problem ein schlechter letzter Punkt ist, hat bei Schritt null bereits sein bestmögliches R², sodass die erste Rückgabeprüfung greift und dieser Punkt zurückkommt. Getrimmt bleibt er nur, wenn er mit einem echten Problem innerhalb des Anpassungsbereichs zusammenfällt.
- **Zwei verschiedene Anpassungsbereiche** werden für das benutzt, was mathematisch dieselbe gewichtete lineare Regression ist: einer ohne den letzten Punkt (für R² und die Suche nach dem schlechtesten Punkt) und einer mit ihm (zum Ablesen von Geschwindigkeiten im älteren Zweipunkt-Schätzer). Sie zu verwechseln ist ein leichter, teurer Fehler: die beiden Bereiche liefern Geschwindigkeiten, die nur auf etwa drei signifikante Stellen übereinstimmen — im R² unsichtbar, aber stillschweigend etwa ein halbes Prozent BC wert.

Es gibt einen ehrlichen Unfall, der aus dem Original erhalten blieb: Die Abbruchbedingung wird *nach* dem Herausschneiden geprüft, sodass die Schleife einen Punkt über den Boden hinaus entfernen kann und typischerweise auch tut und bei neun statt bei zehn landet. Eine fachliche Rechtfertigung dafür ließ sich im Altcode nicht finden. Sie bleibt, weil die Portierung als Ganzes an echten Tracks validiert wurde und eine Änderung diese Validierung ohne bekannten Gewinn entwerten würde.

### 12.4 SNR-Gewichtung

Die SNR-Spalte ist in Dezibel. Das Gewicht jedes Punktes ist dieser Wert, zurückgerechnet in ein lineares Leistungsverhältnis:

$$w_i = 10^{\,\text{SNR}_i/10}$$

was keine kosmetische Umformung ist. Ein 40-dB-Punkt wiegt 10.000; ein 10-dB-Punkt wiegt 10. Über einen echten Track hinweg ist das ein Faktor von tausend zwischen den zuverlässigen frühen und den zweifelhaften späten Rückgaben, was genau der Form entspricht, die die Rauschtabelle in §12.2 vorhersagt. Die Anpassung wird von dem Teil des Tracks beherrscht, bei dem das Radar sich tatsächlich sicher war; der verrauschte Schwanz trägt fast nichts bei — bleibt aber *anwesend*, sodass ein Schwanz, der dem Modell wirklich widerspricht, weiterhin in den Residuen auftaucht und von der Bereinigung erwischt wird.

Der synthetische t = 0-Punkt hat überhaupt kein SNR und bekommt das Gewicht null zugewiesen — wobei er in der Praxis nie zu einem Gewicht kommt, da jede Anpassung im Werkzeug ihn strukturell schon über den Index ausschließt, bevor überhaupt gewichtet wird.

### 12.5 Die Anpassung: Physik über das ganze Fenster

Das ist der Teil, der neu gebaut statt portiert wurde, und daher kommt die Genauigkeit.

Der naheliegende Weg, und der, den der Vorgänger jahrelang ging, lautet: Lege eine Gerade durch die bereinigten Punkte, lies an beiden Enden eine Geschwindigkeit ab und halbiere nach dem BC, der das Widerstandsmodell in der verstrichenen Zeit von der ersten zur zweiten Geschwindigkeit bringt. Zwei Punkte, eine unterstellte Kurvenform.

Was dieses Werkzeug stattdessen tut, ist, die **Physik selbst** gegen jeden behaltenen Punkt auf einmal anzupassen. Zwei Parameter werden gemeinsam gelöst:

- $v_1$, die wahre Geschwindigkeit am Ankerpunkt, und
- der ballistische Koeffizient.

Für ein Kandidatenpaar wird der eigene Flugbahn-Integrator der App vom Anker aus vorwärts gelaufen und seine vorhergesagte Geschwindigkeit zur jeweiligen Zeit jeder behaltenen Probe ausgewertet. Die Zielgröße ist die SNR-gewichtete Summe der quadrierten Residuen:

$$\text{SSE}(v_1, \text{BC}) = \sum_i w_i \left(v_{\text{Modell}}(t_i;\, v_1, \text{BC}) - v_i\right)^2$$

und sie wird durch eine **geschachtelte Goldene-Schnitt-Suche** minimiert — innen die Suche über BC für einen Kandidaten $v_1$, außen die Suche über $v_1$ — statt durch Halbierung, denn dies ist eine Minimierung einer Quadratsumme und keine Nullstellensuche an einer monotonen Größe. Je dreißig Iterationen, mit BC eingeklammert auf [0,05, 1,5] und $v_1$ auf 15 % um die rohe Ankergeschwindigkeit.

Drei Entwurfsentscheidungen sind es wert, ausgesprochen zu werden:

**Der Anker ist der erste *behaltene innere* Punkt**, nicht der t = 0-Punkt des Geräts und nicht die rohe erste Probe. Seine aufgezeichnete Geschwindigkeit ist nur der *Startwert*; das tatsächliche $v_1$ wird angepasst. Das zählt, weil dieser eine Messwert selbst verrauscht ist und ihn festzuhalten seinen Fehler direkt in den BC weiterreichen würde.

**$v_1$ mitanzupassen kostet fast nichts an Überanpassungsrisiko**, und das ist das Argument dafür. Zwei physikalisch bedeutsame Parameter sind ein weit engeres Modell als eine Parabel mit drei Koeffizienten, und es kann dem Rauschen nicht so hinterherlaufen wie ein zusätzlicher Polynomterm — die Form wird von echter Widerstandsphysik erzwungen und nicht von einem freien Krümmungsglied.

**Die Kurvenform wird nie unterstellt.** Sie ist das, was das Widerstandsmodell bei diesen Geschwindigkeiten in dieser Luft tatsächlich hergibt, und genau darum geht es.

Die Integration nutzt den gemeinsamen RK4-Schrittrechner der Suite, mit fester Schrittweite von 20 ms außerhalb des transsonischen Bandes und 3 ms darin, wobei die Atmosphäre bei jedem Schritt aus der aktuellen Höhe des Geschosses neu bestimmt wird. Das exakte Treffen einer Zielzeit nutzt dieselbe quadratische Dreipunkt-Interpolation, mit der der Rest der Engine eine Zielentfernung trifft. Einfach den Rohschritt abzulesen, der gerade darüber hinausschießt, wäre bei diesen Geschwindigkeiten ein echter Fehler — im Wert von Dutzenden Metern.

### 12.6 Warum keine Gerade und warum keine Parabel

Beide Alternativen wurden geprüft statt abgetan, an synthetischen Tracks mit **echtem** Rauschen — aus dem 1.297-Track-Korpus von §12.2 gebootstrappt statt aus einem parametrischen Modell gezogen, und zwar gerade weil das parametrische Modell den schweren Schwanz untertrieb. Vier Wahrheitskonfigurationen, drei Fensterlängen, 300 Versuche je Zelle.

Das sauberste Einzelergebnis liefert der Fall ganz ohne Rauschen — ein perfekt sauberer synthetischer Track zu einem bekannten BC von 0,202:

| Verfahren | Zurückgewonnener BC | Fehler |
|---|---|---|
| Linear | 0,1838 | -9,0 % |
| Quadratisch | 0,2028 | +0,4 % |
| Physik-Anpassung | 0,2020 | **+0,01 %** |

Das isoliert etwas, was die verrauschten Versuche für sich nicht können: **eine Gerade ist ein wirklich schlechtes Modell des tatsächlichen, physikalisch gekrümmten Geschwindigkeitsabfalls** über ein Fenster von 150–200 m. Neun Prozent Fehler, mit einem perfekten Chronographen, noch bevor Rauschen überhaupt ins Spiel kommt. Das ist eine strukturelle Verzerrung, kein Robustheitsproblem.

Mit echtem Rauschen, über jede geprüfte Konfiguration und Fensterlänge:

- **Quadratisch überschätzt den BC in jeder einzelnen Zelle**, um +4 % bis +9 %. Es passt sich dem verrauschten Schwanz zu gut an, und da Schwanzfehler einseitig nach oben gehen (§12.2), zieht ein guter Fit das Ergebnis ebenfalls nach oben. Das reproduziert genau den Fehlschlag, den der Autor des Vorgängerwerkzeugs schon von Hand gefunden hatte.
- **Die Verzerrung des linearen Verfahrens hängt von der Konfiguration ab und wächst mit der Fensterlänge.** Nahezu flach bei einer schweren, sanft verzögernden .338; eine starke und sich verschlimmernde negative Verzerrung bei einer schnellen 5,56 mit niedrigem BC — von -3,4 % auf 120 m bis -8,4 % auf 200 m. Das ist die obige Kurvenformverzerrung, die sich mit der Rauschempfindlichkeit überlagert.
- **Die Physik-Anpassung hatte in jeder einzelnen Zelle den kleinsten Fehler**, typischerweise drei- bis neunmal kleiner als jede Alternative, und dazu die engste Streuung.

Die Verbesserung übersteht den Kontakt mit dem tatsächlichen Anwendungsfall: Nimmt man den je Verfahren angepassten BC, um die Geschwindigkeit auf 300 m vorherzusagen — jenseits des gemessenen Fensters, wozu ein BC ja *da* ist —, ergibt sich dieselbe Rangfolge.

Der ehrliche Vorbehalt: All das ist synthetisch. Echte Tracks dienten dazu, das Rauschen zu charakterisieren, das die synthetischen tragen, nicht dazu, den BC eines echten Geschosses unabhängig von Anfang bis Ende neu abzuleiten.

### 12.7 Warum die Entrauschungsschwelle auf 0,990 steht

Die Bereinigungsschwelle wurde direkt durchgefahren, an 40 Tracks mit echtem Rauschen:

| Schwelle | Ø verworfene Punkte | Ø absoluter BC-Fehler |
|---|---|---|
| 0,95 | 0,70 | 1,09 % |
| 0,97 (die alte Vorgabe) | 2,42 | 1,08 % |
| **0,99** | **3,10** | **0,96 %** |
| 0,999 | 11,40 | 0,56 % |

Über den flachen Korpus wirkt der Effekt bescheiden. An den Tracks, die tatsächlich Bereinigung brauchten — jene mit mehr als fünfzehn echten Verwerfungen —, ist er dramatisch: Der mittlere BC-Fehler lag **flach bei etwa 21 % über den gesamten Bereich 0,80 bis 0,97** und fiel erst bei 0,99 auf 6–7 %. Die Trefferquote gegen bekannte eingespielte Ausreißer stieg von 14–54 % auf 74–98 %.

Der Fehler verbesserte sich über 0,99 hinaus weiter, aber die Verwerfungszahlen explodierten dabei — über sechzig Punkte aus Tracks, die mit 100 bis 140 begannen, weit jenseits dessen, was echte Tracks zeigen, und hinein in ein bodennahes Regime, in dem der Anpassung die Daten ausgehen. **0,99 ist der Wert, den die Belege stützen; alles darüber hinaus wurde auf dieser Beleglage nicht geglaubt.**

Zwei Befunde aus demselben Experiment sind festhaltenswert, weil sie negativ sind:

- **Bereinigung und Anpassung sind nicht unabhängig austauschbar.** Mit der *alten* linearen Anpassung gepaart, half die angehobene Schwelle nicht zuverlässig und machte eine Konfiguration messbar schlechter. Sie verdient sich ihren Platz nur zusammen mit der Physik-Anpassung. Bewerten Sie das Paar, nicht die Teile.
- **Die Residuen der Bereinigung gegen das Physikmodell statt gegen eine Gerade zu messen, wurde gebaut, als genau validiert, billig genug zum Ausliefern gemacht — und brachte keinen messbaren Gewinn**, sobald die Schwelle bereits angehoben war. Es blieb draußen. Das ist das eine bewusst nicht ausgelieferte, funktionierende Stück Infrastruktur dieses Werkzeugs, im Repository als Kontext für einen späteren Umbau aufbewahrt statt als Ballast im Bundle.

### 12.8 Die beiden Ganz-Track-Schranken

Beide arbeiten auf fertigen Track-Ergebnissen, und keine passt etwas neu an — deshalb reagieren sie augenblicklich.

**Die Signalqualitätsschranke** vergleicht das R² jedes Tracks — das Bestimmtheitsmaß der SNR-gewichteten Geraden durch seine *bereinigten* Punkte — gegen 0,95 (Normal) oder 0,90 (Hohes Rauschen), oder überspringt die Prüfung ganz (Keine).

Hier liegt ein scheinbarer Widerspruch: §12.6 hat gerade festgestellt, dass eine Gerade das falsche Modell zum Anpassen eines BC ist. Als Referenz für eine *Qualitäts*prüfung ist sie dennoch die richtige, aus zwei Gründen. Die Abweichung eines Tracks von der Linearität über ein 100-m-Fenster wird vom Rauschen beherrscht, nicht von der echten Krümmung — die Krümmung kostet ein paar Prozent, die schlechten Punkte kosten zig Meter pro Sekunde. Und dieselbe Referenz zu verwenden, die auch die Bereinigung nutzt, macht das ausgewiesene R² direkt als „wie gut ist die Bereinigung gelaufen" lesbar — genau das, worüber der Benutzer urteilen soll.

**Die Ausreißerkappung** berechnet Mittelwert und Populations-Standardabweichung über alles, was nach der Qualitätsschranke noch gültig ist, und verwirft dann jeden Track, der weiter als $k\sigma$ von diesem Mittel entfernt liegt, mit $k = 2,0$ (Konservativ) oder $k = 1,644854$ (Aggressiv). Diese zweite Konstante ist nicht willkürlich: Sie ist das 95. Perzentil der Standardnormalverteilung, sodass eine beidseitige Kappung dieser Breite die mittleren 90 % einer normalverteilten Grundgesamtheit behält. Es ist die übliche Schwelle „verwirf die schlechtesten 10 %", exakt geschrieben.

Die Schranken laufen in dieser Reihenfolge und nur in dieser: erst Qualität, dann die Kappung über die Überlebenden. Ein bereits wegen Qualität verworfener Track trägt nicht zu Mittelwert und Standardabweichung bei, aus denen die Kappung gerechnet wird — was richtig ist, denn sonst würde der BC eines schlechten Tracks genau den Maßstab verbreitern, mit dem schlechte Tracks gefangen werden.

**Manuelle Übersteuerungen umgehen beide**, und ein erzwungenes Einschließen ist zusätzlich vom Kappungsdurchgang selbst ausgenommen. Eine manuelle Übersteuerung soll halten und nicht stillschweigend von der Kennzahl wieder verworfen werden, die sie überstimmt hat.

### 12.9 Zusammenfassung der Tracks

Ein schlichtes ungewichtetes arithmetisches Mittel der überlebenden BCs und deren Populations-Standardabweichung — geteilt durch $n$, nicht durch $n-1$.

Das ausgewiesene Konfidenzintervall ist eine eigene Rechnung über dieselbe Überlebendenmenge, und sie verwendet sehr wohl $n-1$: Halbbreite $= t_{0,975,\,n-1} \cdot s / \sqrt{n}$, mit $s$ als Stichproben-Standardabweichung, geteilt durch den Mittelwert für den gezeigten Prozentsatz. Die beiden Nenner sind Absicht. Die Populationsform ist das, wogegen die alte Ausreißerkappung kalibriert wurde, und sie bleibt unangetastet; die Stichprobenform ist die richtige für ein Intervall auf einen Mittelwert. Der Multiplikator ist das zweiseitige 95-%-Quantil der Student-t-Verteilung, für $n$ bis 31 tabelliert und darüber hinaus aus einer Cornish-Fisher-Entwicklung genommen. Diese Wahl zählt mehr, als es scheinen mag: bei fünf Tracks sind es 2,776, bei vier 3,182, gegen die 1,96, die eine Normalapproximation in beiden Fällen ansetzen würde — ein um 42 % bzw. 62 % breiteres und deutlich glaubwürdigeres Intervall.

Es ist ausdrücklich *nicht* die Tabelle `TDIST_QUANTILE`, die der Gewehr-Präzisionsrechner mitführt. Das sind 0,9875-Quantile, Bonferroni-aufgeteilt für eine gemeinsame 95-%-Aussage über die beiden Treffpunktkoordinaten einer Schussgruppe zugleich. Ein BC-Mittelwert ist ein einzelner Skalar, und diese Tabelle zu borgen ergäbe ein Intervall, das bis zu doppelt so breit ist wie die 95 %, die es zu sein behauptet.

Bei weniger als zwei gültigen Tracks wird kein Intervall ausgewiesen statt eines mit Breite null.

Das ungewichtete Mittel ist eine bewusste Wahl, kein Versehen. Punkte innerhalb eines Tracks werden SNR-gewichtet, weil SNR ein echtes Qualitätsmaß je Punkt ist. Tracks innerhalb eines Stapels werden überhaupt nicht gewichtet. Jeder Schuss im Stapel ist eine Ziehung aus derselben Grundgesamtheit von Schüssen, und es gibt keinen vertretbaren Grund, einen saubereren Track lauter darüber reden zu lassen, was das *Geschoss* tut, als einen verrauschteren. Nach Trackqualität zu gewichten würde systematisch die Schüsse übergewichten, die dem Radar gefielen — nicht dieselbe Grundgesamtheit wie die Schüsse, die Sie abgegeben haben.

### 12.10 Was die Anpassung ignoriert und was nicht

**Wind wird ignoriert** — die Integration läuft mit null Wind. Über 100 m Flug in 0,15 s ist der Einfluss eines Seitenwinds auf den *Geschwindigkeitsbetrag* vernachlässigbar, und der Betrag ist alles, worauf diese Anpassung je schaut.

**Die Schwerkraft wird nicht ignoriert**, ist aber nahezu belanglos, und es lohnt sich zu sehen, warum. Das Geschoss wird vorwärts gelaufen, als wäre es waagerecht gestartet, hat also nach 0,15 s etwa 1,5 m/s Vertikalgeschwindigkeit aufgenommen. Gegen 760 m/s waagerecht ergibt das eine Geschwindigkeit von $\sqrt{760^2 + 1,5^2} \approx 760,0015$ m/s. Fünfzehn Zehntausendstel eines Meters pro Sekunde. Die Schwerkraft mitzunehmen kostet nichts und nimmt einen Streitpunkt weg.

**Die Höhe wird aus Ihrem Stationsdruck zurückgerechnet**, statt null angenommen zu werden. Das Vorgängerwerkzeug nahm immer Meereshöhe an, was eine Beschränkung der Engine war und keine Entscheidung. Eine Höhe aus dem Druck abzuleiten erlaubt es dem Integrator, sein eigenes Atmosphärenmodell im Flug konsistent anzuwenden — obwohl auch das über 100 m Flug und praktisch ohne Höhenänderung ein kleiner Effekt ist. Es kostet nichts und hält die Atmosphärenbehandlung dieses Werkzeugs identisch zu jedem anderen der Suite, was mehr wert ist als die Korrektur selbst.

**Die Luftdichte ist der Effekt, auf den es tatsächlich ankommt**, und sie ergibt sich aus allen drei Atmosphärenfeldern über das gemeinsame Feuchtluft-Dichtemodell der Suite. Deshalb besteht §5.6 so hartnäckig darauf.

### 12.11 Numerische und technische Anmerkungen

- **Zip-Einträge werden vor dem Entpacken nach Endung gefiltert**, nicht danach. Alles, was kein `.csv` ist — die `.lbr`-Projektdatei, Ordnereinträge, was sonst im Archiv liegt —, wird übersprungen, ohne je entpackt zu werden. Die Inhaltsprüfung sitzt eine Schicht darüber und weiß nichts von Zip-Dateien, weshalb die Modulgrenze genau dort verläuft.
- **Das Parsen ist synchron und sofort; die Anpassung nicht.** Eine CSV mit hundert Zeilen zu parsen dauert Mikrosekunden, das geschieht also im Moment der Dateiauswahl, und die Liste steht sofort. Die Anpassung sind Hunderte vollständiger Flugbahnintegrationen je Track und geht an den Worker-Pool.
- **Die Aufträge werden einzeln verteilt statt als ein Sammelversprechen**, gerade damit sich jede Zeile aktualisiert, sobald ihre eigene Anpassung steht. Auf alle zu warten, bevor irgendetwas erscheint, wäre einfacher und schlechter.
- **Der Löser meldet Sättigung am Rand als Fehlschlag.** Die beiden Suchklammern sind die aus §12.5: BC auf [0,05, 1,5] beschränkt und die Referenzgeschwindigkeit auf 15 % um den eigenen Ankerwert des Tracks. Eine Goldene-Schnitt-Suche liefert immer *irgendeinen* inneren Punkt zurück, auch wenn das wahre Minimum außerhalb ihrer Klammer liegt. Sie sättigt dann stillschweigend an demjenigen Rand, an dem es weiter besser wird — was genau wie Konvergenz aussieht, es aber nicht ist. Das war ein echter Fehler, mitten in der Validierung gefunden. Ein Ergebnis, das innerhalb von 0,1 % an einem der beiden Klammerränder landet, gilt jetzt als gescheiterte Anpassung — so, wie die anderen BC-Löser der Suite sich schon jetzt weigern, für ein unerreichbares Ziel einen Randwert zu melden. Das ist alles, was eine *Fehler*-Zeile in §10.4 bedeutet.
- **Widerstandsmodell und Atmosphäre werden beim Ergebnis jedes Tracks mit abgelegt**, statt beim Zeichnen des Diagramms live gelesen zu werden. Die eingeblendete Anpassungskurve spiegelt daher immer das, womit dieser bestimmte Track tatsächlich gerechnet wurde, auch wenn Sie die Einstellungen des Panels seither ohne Neuberechnung geändert haben.
- **Ein Track braucht mindestens vier parsbare Zeilen**, um überhaupt als Track zu gelten. Zeilen, denen Zeit, Geschwindigkeit oder Entfernung fehlt, werden stillschweigend verworfen; ebenso jede Zeile nach der ersten, der das SNR fehlt. Nur der ersten Zeile ist ein nichtnumerisches SNR erlaubt, weil nur die erste Zeile der geräteeigene synthetische Punkt ist.
- **Die Obergrenze von 20.000 Integrationsschritten** ist eine Sicherung des gemeinsamen Schrittrechners und hier keine Beschränkung — ein 0,15-s-Track braucht ein paar Dutzend Schritte.

### 12.12 Was bewusst nicht hier ist

**Kein Gesamtfehlerhaushalt.** Das Konfidenzintervall deckt die Stichprobe ab und sonst nichts (§10.3). Es rechnet die eingetippte Atmosphäre, das gewählte Widerstandsmodell und den geschätzten Versatz nicht ein, obwohl die in den meisten echten Sitzungen die Streuung von Schuss zu Schuss vollständig dominieren. Sie in eine einzige Schlagzeilenzahl zu rühren würde verlangen, so zu tun, als wüsste man, wie falsch die eigenen Eingaben waren, und eine auf diesem Als-ob gebaute Zahl wäre schlechter als gar keine.

**Keine automatische Übergabe ans Arsenal.** Jedes andere Messwerkzeug der Suite reicht sein Ergebnis direkt weiter. Dieses nicht, und das ist eine Entscheidung und kein Versäumnis: einen veröffentlichten BC durch einen gemessenen zu ersetzen ist ein Urteil darüber, welcher Zahl man traut, und es verdient, absichtlich gefällt zu werden.

**Keine Unsicherheit je Track.** Jeder Track meldet einen BC und ein R², nicht einen BC mit Intervall. Das R² misst, wie sauber der Track war, nicht wie gut der BC bestimmt ist, und die beiden hängen zusammen, sind aber nicht dasselbe. Sie zu vermengen wäre schlechter, als keines von beiden zu melden.

---

## 13. Herkunft

BC-Labradar ist der Nachfolger von **Labrabaco**, einem eigenständigen Werkzeug desselben Autors. Der Einleseweg (das Erkennen von Tracks, die Toleranzregeln je Zeile, der Punktbereinigungsalgorithmus und seine beiden Ganz-Track-Schranken) ist getreu von dort portiert, Aufrufstelle für Aufrufstelle nachverfolgt und an echten Beispiel-Tracks validiert. Das schließt die in §12.3 dokumentierten Index-Asymmetrien ein, die wie Fehler aussehen und keine sind.

Neu ist die Anpassung. Das Altwerkzeug legte eine Gerade durch die bereinigten Punkte und halbierte nach dem BC, der zu deren Endpunkten passte; dieses passt die eigene Widerstandsphysik der App gegen jeden behaltenen Punkt auf einmal an, gemeinsam mit einer Referenzgeschwindigkeit. Diese Änderung, und die damit gepaarte Änderung der Bereinigungsschwelle von 0,97 auf 0,99, wurden an synthetischen Tracks mit echtem Rauschen validiert, bevor eine von beiden ausgeliefert wurde. Die Validierungsberichte liegen im Repository neben dem Code, samt der negativen Ergebnisse, der beiden verworfenen Entwürfe und des einen funktionierenden Mechanismus, der gebaut und dann weggelassen wurde, weil er seinen Preis nicht wert war.

Ebenfalls neu: das Diagramm je Track mit seiner Trennung behalten/verworfen und der eingeblendeten Anpassungskurve (das Altwerkzeug hatte keine Entsprechung dafür), eine strukturierte Ergebniskarte statt eines zusammengeklebten Textblocks, parallele Anpassung über einen Worker-Pool, und eine vollständig einheitenbewusste Atmosphäre mit echter abgeleiteter Höhe statt angenommener Meereshöhe.

Die Suite steht unter **AGPL-3.0-or-later**.

---

*Friedlich. Präzise. Bewaffnet.*
