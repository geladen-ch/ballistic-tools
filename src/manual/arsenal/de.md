# geladen.ch ballistics Benutzerhandbuch — Waffen/Arsenal

*Teil der* [Ballistik-Suite von geladen.ch](https://bc.geladen.ch)*. Die Bibliothek für Gewehre und Geschosse, die von jedem anderen Werkzeug gemeinsam genutzt wird.*

---

## 1. Wozu dieses Werkzeug dient

Jedes andere Werkzeug dieser Suite stellt Ihnen irgendwann dieselben drei Fragen: welches Gewehr, welches Geschoss, welche Laborierung. Flugbahn fragt danach. Trefferwahrscheinlichkeit fragt danach. Feldrechner fragt danach. Das jedes Mal von Hand zu beantworten — eine Visierhöhe, einen ballistischen Koeffizienten, eine Mündungsgeschwindigkeit erneut einzutippen, die Sie schon hundertmal aus dem Gedächtnis zitiert haben — ist mühsam und ein bisschen unter Ihrer Würde, und Computer wurden genau dafür erfunden: damit das niemand von Hand machen muss.

Im Arsenal beantworten Sie diese Fragen **einmal**, für jedes Gewehr und jedes Geschoss, das Sie tatsächlich besitzen, und danach nie wieder. Ein gespeichertes Gewehr trägt seine Visierhöhe, seine Einschussdistanz, seinen Drall, die Klickwerte seines Zielfernrohrs. Ein gespeichertes Geschoss trägt sein Kaliber, seine Masse, seine Luftwiderstandsdaten. Eine Patrone — eine bestimmte Laborierung, verschossen aus einem bestimmten Gewehr — verknüpft ein Geschoss mit einer Mündungsgeschwindigkeit, und optional mit den beiden am schwersten zu ermittelnden Zahlen der Außenballistik überhaupt: wie gleichmäßig die Geschwindigkeit dieser Laborierung tatsächlich ist, und wie präzise dieses Gewehr sie tatsächlich schießt — beides Dinge, die Sie sonst zu raten versucht wären.

Einmal gespeichert, tauchen Ihre Gewehre und Geschosse **überall** dort auf, wo in dieser App ein Gewehr oder Geschoss ausgewählt werden kann, neben der integrierten Bibliothek und mit einem vorangestellten `*` gekennzeichnet, damit Sie immer wissen, welches Ihres ist. Wählen Sie Ihr Gewehr einmal unter Waffen, und Flugbahn, Trefferwahrscheinlichkeit und Feldrechner wissen bereits, womit Sie schießen.

### Was es nicht ist

Es ist selbst kein Ballistikrechner. Das Arsenal speichert die *Eingaben* — BC, Drall, Mündungsgeschwindigkeit und so weiter —, die die Flugbahn-Engine und Trefferwahrscheinlichkeit konsumieren; es berechnet selbst kein Falllinien-Diagramm, abgesehen von der kleinen Vergleichsfunktion aus §7, die eigens dafür da ist, zwei gespeicherte Konfigurationen gegeneinander zu vergleichen.

Es ist nicht der **Gewehr-Präzisionsrechner**, der die tatsächliche mechanische Streuung eines Gewehrs anhand von Fotos beschossener Scheiben misst. Das Arsenal konsumiert die Ausgabe dieses Werkzeugs — siehe §5.6 —, es erzeugt sie nicht.

---

## 2. Datenschutz, Speicherung und Voraussetzungen

**Nichts, was Sie in dieses Werkzeug eingeben, verlässt Ihr Gerät.** Kein Konto, kein Hochladen, keine Telemetrie. Ihre Gewehre und Geschosse werden im eigenen `localStorage` Ihres Browsers gespeichert, auf Ihrer eigenen Maschine, und von dort wieder gelesen. Die gesamte Berechnung läuft als JavaScript in Ihrem Browser.

Die Konsequenz ist die erwartbare: **wenn Sie die Website-Daten Ihres Browsers löschen, ist Ihr Arsenal weg.** Es gibt keine serverseitige Kopie, aus der wiederhergestellt werden könnte. Nutzen Sie die Sicherungsfunktionen (§8), wenn Ihnen an den Daten liegt — und das Arsenal zeigt Ihnen, Eintrag für Eintrag, wenn etwas noch nie gesichert wurde (§9).

Anders als der Gewehr-Präzisionsrechner speichert das Arsenal keine Fotos und keine großen Binärdaten, sodass sein Platzbedarf im `localStorage` klein bleibt, unabhängig davon, wie viele Gewehre und Geschosse Sie führen. Es gibt keine eingebaute Obergrenze für die Anzahl von beidem, die Sie speichern dürfen.

**Voraussetzungen.** Jeder halbwegs aktuelle Browser. Die App installiert sich als PWA und funktioniert nach dem Laden vollständig offline.

---

## 3. Das Datenmodell: Geschosse, Gewehre, Patronen

Drei Arten von Datensätzen, und eine Beziehung zwischen ihnen, die es sich zu verstehen lohnt, bevor Sie zu klicken beginnen:

```
Geschoss      ein bestimmtes Projektil: Kaliber, Masse, Luftwiderstandsdaten
Gewehr        ein bestimmtes Gewehr: Visierhöhe, Einschussdistanz, Drall, Klickwerte
  └─ Patrone    eine aus diesem Gewehr verschossene Laborierung: ein Geschoss + eine Mündungsgeschwindigkeit
```

**Ein Geschoss** steht für sich. Es beschreibt ein Projektil — sein Kaliber, seine Masse und entweder einen ballistischen Koeffizienten gegen ein Standardmodell oder eine selbst gemessene Luftwiderstandskurve — und nichts darüber, woraus es verschossen wird. Derselbe Geschoss-Datensatz kann von Patronen auf mehreren unterschiedlichen Gewehren referenziert werden.

**Ein Gewehr** steht ebenso für sich: es beschreibt die Plattform — Visierhöhe über der Seelenachse, die Distanz, auf die Sie es normalerweise einschießen, seinen Drall (Rate und Richtung) und den Klickwert der Zielfernrohrtürme — und nichts darüber, was es verschießt. Ein Gewehr hat **kein eigenes Kaliber**; sein Kaliber ist das, was die Geschosse seiner Patronen vorgeben (§5.5).

**Eine Patrone** ist das, was die beiden tatsächlich verbindet. Sie existiert eingebettet in ein Gewehr, nie für sich allein, und benennt ein Geschoss plus die Mündungsgeschwindigkeit, die dieses Gewehr damit erreicht. Hier liegen auch, optional, die zwei folgenreichsten und am häufigsten geschätzten Zahlen der Außenballistik: die Geschwindigkeitskonstanz der Laborierung (§5.4) und die selbst gemessene Präzision des Gewehrs (§5.6) — beide fließen direkt in die Trefferwahrscheinlichkeit ein.

**Ein Gewehr kammert ein Kaliber.** Sobald irgendeine Patrone eines Gewehrs auf ein reales Geschoss verweist, wird die Geschossauswahl jeder weiteren Patrone, die Sie diesem Gewehr hinzufügen, auf Geschosse desselben Kalibers eingeschränkt (§5.5). Das wird erzwungen, nicht nur nahegelegt — es spiegelt eine Tatsache über Gewehre wider, keine Einschränkung des Werkzeugs. (Und wer einen Drilling oder eine andere Mehrkaliber-Kombinationswaffe besitzt, muss sich deswegen nicht besonders schlau vorkommen — einfach für jedes Kaliber einen eigenen Eintrag anlegen.)

### 3.1 Ein Hinweis zu Einheiten

**Jede Zahl, die dieses Werkzeug Ihnen zeigt, und jede Zahl, die Sie eintippen dürfen, ist in den Einheiten, die Sie in den Einstellungen gewählt haben** — mit zwei bewussten Ausnahmen, beide unten genannt.

Die betroffenen Einheitengruppen:

- **Geschwindigkeit** (`m/s`, `ft/s`, `mph`, `km/h`) — Mündungsgeschwindigkeit und ihre Standardabweichung.
- **Distanz** (`m`, `yd`, `ft`) — die Einschussdistanz eines Gewehrs und die maximale Distanz des Vergleichsdiagramms.
- **Kleine Länge** (`mm`, `cm`, `in`) — Visierhöhe, Kaliber und Geschosslänge. Kaliber und Länge werden mit einer feineren geschossmaßstäblichen Genauigkeit angezeigt (2 Nachkommastellen in mm, 3 in cm und Zoll), derselben Genauigkeit, die der Gewehr-Präzisionsrechner aus demselben Grund verwendet.
- **Drall** (`mm`, `in`) — eine eigene Einheitengruppe, bewusst **unabhängig** von der kleinen Länge. Ein Schütze, der bei der Visierhöhe in Millimetern denkt, gibt den Drall sehr oft trotzdem auf die traditionelle Weise an, als Zoll pro Umdrehung, und ein Wechsel Ihrer allgemeinen Einstellung für kleine Länge wandelt einen als „1:8 in" eingetippten Drall nicht stillschweigend in eine Zahl in Millimetern um, die Sie nicht mehr wiedererkennen.
- **Temperatur** (`°C`, `°F`) — die Referenztemperatur einer Patrone für die Geschwindigkeits-Temperatur-Empfindlichkeit.
- **Masse** — das Geschossgewicht ist das einzige Feld, das nie hinter einer einzigen Einheiteneinstellung steckt. Es wird als **live verknüpftes Feldpaar** angezeigt, Gramm und Grain nebeneinander; tippen Sie in eines, aktualisiert sich das andere sofort. Das spiegelt wider, wie Geschossgewicht in der Praxis tatsächlich angegeben wird — Grain in Wiederladekreisen, Gramm fast überall sonst im metrischen Raum — statt eine Wahl zu erzwingen.

**Die zwei Ausnahmen**, beide bewusst gestaltet:

- **Klickwerte des Zielfernrohrs** (horizontaler und vertikaler Klickwert eines Gewehrs) tragen ihre **eigene** Einheitenwahl, mrad oder MOA, einmal pro Gewehr festgelegt und unabhängig von Ihrer globalen Winkel-Streuungs-Einstellung. Das Feld sagt es direkt: *„Immer in der hier gewählten Einheit, unabhängig von den Einheiteneinstellungen."* Ein Zielfernrohrturm ist für sein ganzes Dienstleben in einer Einheit graviert — und wer ein in MOA graduiertes Zielfernrohr besitzt, leidet ohnehin schon genug, ohne dass dieses Werkzeug ihm auch noch eine manuelle Umrechnung in vernünftige Einheiten aufzwingt.
- **Der Gewehrpräzisionswert einer Patrone** (§5.6) trägt aus demselben Grund ebenfalls eine eigene Einheitenwahl, mrad oder MOA, unabhängig von derselben globalen Einstellung: die selbst gemessene Gruppengröße eines Gewehrs soll sich nicht stillschweigend neu interpretieren, sobald Sie das nächste Mal einen mit diesem Gewehr unzusammenhängenden Schalter in den Einstellungen umlegen.

Intern arbeitet die Engine ausschließlich in Metern, Metern pro Sekunde und Kilogramm; die Umrechnung geschieht nur an der Anzeigegrenze. Ein Wechsel Ihrer Einheiteneinstellung verändert nie gespeicherte Daten — eine als 45 mm eingetippte Visierhöhe liest sich nach dem Wechsel weiterhin als 1,772 in und beschreibt genau dasselbe Gewehr.

---

## 4. Schnelleinstieg

Für die Ungeduldigen. Details folgen in §5–§9.

1. **Waffen** aus dem Werkzeugmenü, oder der Link **Ändern** neben der aktuellen Gewehr-/Geschoss-Zusammenfassung in Flugbahn, Trefferwahrscheinlichkeit oder Feldrechner → Reiter **Arsenal**.
2. **+ Geschoss hinzufügen**, falls Sie noch keines gespeichert haben. Benennen Sie es, geben Sie ihm ein Kaliber und eine Masse sowie entweder einen ballistischen Koeffizienten mit einem Standardmodell oder eine eingefügte Cd-Mach-Tabelle. **Geschoss speichern**.
3. **+ Gewehr hinzufügen**. Benennen Sie es, setzen Sie mindestens Visierhöhe und Einschussdistanz; Drall und Klickwerte, falls bekannt. **Gewehr speichern**.
4. Beim frisch aktiven Gewehr: **+ Patrone hinzufügen**. Benennen Sie die Laborierung, wählen Sie das eben gespeicherte Geschoss (oder fügen Sie eines inline hinzu) und geben Sie die Mündungsgeschwindigkeit ein. **Patrone speichern**.
5. Ihr Gewehr ist nun überall in der App auswählbar. Drücken Sie **Fertig**, um es zum aktiven Gewehr der App zu machen, oder fügen Sie zunächst weitere Gewehre und Patronen hinzu.

Ein Gewehr mit null Patronen wird gespeichert, aber als **Unbrauchbar** markiert (§6.4) — es kann erst dann zum aktiven Gewehr der App werden, wenn es mindestens eine hat.

---

## 5. Geschosse und Patronen

### 5.1 Ein Geschoss hinzufügen

**+ Geschoss hinzufügen** öffnet ein Formular:

- **Name** — erforderlich. Eine Live-Warnung erscheint, falls der Name bereits in Ihrer Bibliothek existiert; das Speichern überschreibt den vorhandenen Eintrag. Es ist eine Warnung, keine Sperre.
- **Hersteller** — Freitext, mit Autovervollständigung sowohl aus den integrierten Geschossbibliotheken als auch aus Ihren eigenen gespeicherten Geschossen. Bleibt es leer, wird es als *„Custom"* gespeichert.
- **Kaliber** — **erforderlich**. Ein Doppelfeld: eine Dropdown-Liste mit Standard-Kaliberbezeichnungen (*„Kaliber wählen…"*) plus eine frei eingetippte Zahl in Ihrer eingestellten Einheit für kleine Länge. Wählen Sie eine Bezeichnung, wird der genaue Laufdurchmesser eingetragen; tippen Sie stattdessen eine Zahl und liegt sie innerhalb von 0,03 mm einer bekannten Bezeichnung, wird diese automatisch ausgewählt — andernfalls zeigt die Dropdown-Liste **Andere**, ohne das Eingetippte zu verwerfen. Dies ist dieselbe Bezeichnungsliste und Zuordnungslogik, die der Gewehr-Präzisionsrechner für sein eigenes Kaliberfeld verwendet.
- **Länge** — optional, leer lassen, falls unbekannt. Sie fließt in genau zwei Dinge und sonst nichts: Geschossstabilität (Millers Formel) und drallbedingte Seitenabweichung, beschrieben in §5.5 und §9.3 — beide in dieser Suite verfügbaren Methoden zur Berechnung der Seitenabweichung, die einfache Litz-Formel und das ausführlichere McCoy-4-DOF-Modell, benötigen sie gleichermaßen.
- **Masse** — erforderlich, eingegeben als das verknüpfte Gramm-/Grain-Paar aus §3.1.
- **Luftwiderstandsdaten** — erforderlich, und gegenseitig ausschließend:
  - **Ballistischer Koeffizient + Standardmodell** — ein BC-Wert (0,05–1,5), gepaart mit einem Standardmodell (G1, G7 und die übrigen Standardmodelle der Suite).
  - **Eigene Cd-Mach-Tabelle** — für ein Geschoss, dessen eigene gemessene Luftwiderstandskurve Sie besitzen (z. B. aus veröffentlichten Radar-Daten), eingefügt als Klartext: eine Zeile pro Mach-Cd-Paar, mindestens zwei Zeilen, Mach streng aufsteigend über die Liste hinweg, jedes Cd zwischen 0,05 und 3,0. Das Formular parst es live und meldet, wie viele Zeilen gefunden wurden, oder genau, welche Zeile falsch ist — zum Beispiel „Zeile 3: Mach-Werte müssen von Zeile zu Zeile streng ansteigen." — statt eines allgemeinen Parsfehlers.
- **Quelle / Anmerkungen** — Freitext, optional. Woher die Zahl stammt, oder was und wie Sie tatsächlich gemessen haben.

### 5.2 Die Geschossliste

**Ihre Geschosse** listet jedes gespeicherte Geschoss: Name, ein Abzeichen **Nicht gesichert**, falls es seit der letzten Änderung nie in eine Datei exportiert wurde, dann Hersteller, Kaliber und Gewicht, sowie ein Datum der letzten Änderung. Jede Zeile bietet **In Datei sichern**, **Bearbeiten** und **Löschen**.

**Das Löschen eines Geschosses zieht Folgen nach sich.** Verweist irgendeine Patrone, auf irgendeinem Gewehr, derzeit auf das zu löschende Geschoss, nennt die Bestätigung genau, wie viele Patronenkonfigurationen mit ihm gelöscht werden. Es gibt keine Möglichkeit, ein Geschoss zu löschen und dabei einen verwaisten Verweis zurückzulassen.

### 5.3 Ein Gewehr hinzufügen

**+ Gewehr hinzufügen** öffnet ein Formular:

- **Name** — erforderlich, mit derselben Überschreibwarnung wie bei Geschossen.
- **Visierhöhe** — erforderlich, Höhe der optischen Achse des Zielfernrohrs über der Seelenachse, in Ihrer Einheit für kleine Länge (Bereich 0–500 mm). Fließt in Flugbahns Falllinienberechnung für jede Konfiguration ein, die dieses Gewehr verwendet.
- **Einschussdistanz** — erforderlich, die Distanz, auf die Sie dieses Gewehr normalerweise einschießen, in Ihrer Distanzeinheit (Bereich 0–5000 m).
- **Drall (Länge pro Umdrehung)** und **Drallrichtung** (rechts oder links) — optional, leer lassen, falls unbekannt, in der unabhängigen Dralleinheit aus §3.1 (Bereich 1–1000 mm/in). Nur für Stabilität und Seitenabweichung nötig, sonst nichts.
- **Klick-Einheit**, **Horizontaler Klickwert**, **Vertikaler Klickwert** — die eigenen Turmwerte des Zielfernrohrs, in mrad oder MOA wie hier gewählt (0,01–5, unabhängig von Ihrer globalen Einstellung, gemäß §3.1).
- **Quelle / Anmerkungen** — Freitext, optional.

Ein neu angelegtes Gewehr wird mit einer leeren Patronenliste gespeichert; Sie fügen seine Patronen als Nächstes hinzu, aus der eigenen Zeile des Gewehrs (§5.4).

### 5.4 Eine Patrone hinzufügen

Patronen werden aus der Karte des **aktiven Gewehrs** heraus verwaltet, nie über ein eigenständiges Formular — eine Patrone ist ohne das Gewehr, zu dem sie gehört, bedeutungslos. **+ Patrone hinzufügen** öffnet ein Formular:

- **Name** — erforderlich, z. B. *„175 SMK, 41,5 gr N550"*. Eine Live-Warnung erscheint, falls eine andere Patrone *desselben* Gewehrs bereits diesen Namen trägt; Namen dürfen sich über verschiedene Gewehre hinweg frei wiederholen.
- **Geschoss** — **erforderlich**. Eine Dropdown-Liste bietet jedes Geschoss in Ihrem Arsenal, mit `*` vorangestellt, neben den sichtbaren integrierten Bibliotheken, jede mit ihrem eigenen Bibliotheksnamen geklammert. Eine neue Patrone startet auf **„+ Neues Geschoss hinzufügen…"** statt auf einem beliebigen ersten Eintrag, damit ein unachtsamer Klick auf Speichern nicht das falsche Projektil anhängt.

  **Die Wahl eines integrierten Geschosses kopiert es in Ihre Bibliothek.** Da eine Patrone auf einen *eigenen* Geschoss-Datensatz verweisen muss (damit spätere Änderungen am integrierten Katalog eine bereits charakterisierte Laborierung nicht rückwirkend verändern können), erzeugt das Speichern einer Patrone gegen ein integriertes Geschoss stillschweigend eine einmalige Kopie davon in **Ihre Geschosse** und lässt die Patrone von da an auf diese Kopie verweisen. Ein Hinweis sagt dies vor dem Speichern; existiert bereits ein gleichnamiges Geschoss in Ihrer Bibliothek, warnt eine zweite Meldung, dass die Kopie es überschreibt.

  Hat das Gewehr bereits eine andere Patrone mit aufgelöstem Geschoss, ist die Auswahl **auf das Kaliber dieses Geschosses gesperrt** — siehe §5.5.
- **Mündungsgeschwindigkeit** — erforderlich, in Ihrer Geschwindigkeitseinheit (50–1500 m/s).
- **Mündungsgeschwindigkeit ändert sich mit der Temperatur** — ein optionales Kontrollkästchenpaar: **Referenztemperatur** (die Temperatur, bei der die obige Mündungsgeschwindigkeit gemessen wurde) und **Geschwindigkeitsänderung pro Grad** (Bereich 0–20 m/s pro °C für den Empfindlichkeitswert selbst). Bleibt das Kästchen abgewählt, entfallen beide; der Hinweis über dem Paar — *„Geht davon aus, dass die Patrone dieselbe Temperatur wie die Luft hat (oben eingegebene Temperatur)."* — lohnt sich zu lesen, wenn Sie dieselbe Laborierung über einen weiten saisonalen Temperaturbereich hinweg schießen.
- **Mündungsgeschwindigkeitsstreuung (SD)** — optional; laut Feldhinweis wird sie nur vom Werkzeug Trefferwahrscheinlichkeit verwendet. Haben Sie die vom Chronographen gemeldete Standardabweichung für diese Laborierung, tragen Sie sie hier ein (0–20 m/s), und Trefferwahrscheinlichkeit bietet sie als fertige Option *„Dieses Gewehr"* für ihre Geschwindigkeitsunsicherheits-Eingabe an, statt dass Sie sie sich dort merken oder erneut eintippen müssen.
- **Gewehrpräzision für diese Patrone angeben** — optional, ausführlich beschrieben in §5.6; laut Feldhinweis ebenfalls nur vom Werkzeug Trefferwahrscheinlichkeit verwendet.

### 5.5 Kalibersperre und Stabilität

Ein Gewehr trägt kein eigenes Kaliberfeld (§3). Stattdessen legt **die erste Patrone, die Sie einem Gewehr hinzufügen, implizit dessen Kaliber fest** — für jede danach hinzugefügte Patrone bietet die Geschossauswahl nur noch Geschosse des passenden Laufdurchmessers an. Die Sperre löst sich nur, wenn Sie die letzte verbliebene Patrone des Gewehrs bearbeiten — an diesem Punkt gibt es nichts mehr, womit konsistent zu bleiben wäre, und Sie dürfen wieder ein beliebiges Kaliber wählen.

Jede Patronenzeile, ebenso wie das Patronenformular selbst, zeigt zusätzlich einen live berechneten **Stabilitätschip** — `Stabil`, `Grenzwertig` oder `Instabil`, mit dem berechneten gyroskopischen Stabilitätsfaktor Sg daneben — sobald alle fünf dafür nötigen Eingaben bekannt sind: Geschossmasse, Kaliber, Länge, die Mündungsgeschwindigkeit dieser Patrone und der Drall des Gewehrs. Fehlt eine der fünf, zeigt der Chip stattdessen **„Stabilität unbekannt"**, mit einem einklappbaren Hinweis *„Was fehlt?"*, der genau auflistet, welche der fünf fehlt. Siehe §9.3 für die Formel.

### 5.6 Gewehrpräzision an einer Patrone

Dies ist die direkte Brücke zwischen Arsenal, dem Gewehr-Präzisionsrechner und Trefferwahrscheinlichkeit.

Das Ankreuzen von **„Gewehrpräzision für diese Patrone angeben"** öffnet:

- **Präzision ausgedrückt als** — eine Wahl zwischen **„Eigene (Schießstand-)Gewehrpräzision"** und **„Vereinfachte (kombinierte) Gewehr- + Schützenpräzision"**. Die erste ist das, was das Gewehr selbst mechanisch gruppiert, von einer Auflage aus. Die zweite ist das, was Sie, dieses Gewehr und Ihre gewohnte Schießposition gemeinsam erzeugen — eine gröbere, ehrlichere Zahl für jeden, der kein Benchrester ist. Trefferwahrscheinlichkeit behandelt die beiden völlig unterschiedlich: die erste wird dort *mit* einer separaten Schützenkönnen-Schätzung kombiniert; die zweite *ersetzt* diese Kombination vollständig und schaltet den eigenen Schalter „Vereinfachte Eingabe der kombinierten Präzision verwenden" von Trefferwahrscheinlichkeit passend dazu ein.
- **Präzisionswert**, ausgedrückt in einer von fünf Konventionen, je nachdem, für welche Sie eine Zahl haben — **R50**, **R95**, **R99**, **ES über 5 Schüsse** oder **ES über 10 Schüsse** — und in mrad oder MOA, unabhängig von Ihrer globalen Winkeleinstellung (§3.1). Was auch immer Sie wählen, der Wert wird intern zu **R50 in mrad** umgerechnet und so gespeichert, sodass dieselbe physische Gruppengröße, egal unter welcher Konvention oder Einheit eingegeben, immer dieselbe gespeicherte Präzision ergibt — es gibt genau eine interne Darstellung, und das Formular existiert einzig, damit Sie die Zahl in der Form eintragen können, in der Sie sie tatsächlich gemessen haben. Ein Wechsel der Einheitenwahl rechnet die angezeigte Zahl an Ort und Stelle um, sodass die von Ihnen eingegebene physische Gruppengröße erhalten bleibt, statt neu interpretiert zu werden.
- Der begleitende Hinweis nimmt kein Blatt vor den Mund: *„Seien Sie ehrlich. Verwenden Sie den Durchschnitt, nicht das beste Ergebnis. Nutzen Sie den „Gewehr-Präzisionsrechner" für aussagekräftige und vertrauenswürdige Werte."*
- **„Aus einem Gewehr-Präzisionsrechner-Projekt übernehmen…"** — öffnet eine Auswahl, die jedes Gewehr-Präzisionsrechner-Projekt mit genug gepoolten Treffern für eine brauchbare Zahl auflistet, jede Zeile mit ihrem R50 in mrad und MOA sowie dem eigenen Vertrauens-Kennzeichen (demselben Kennzeichen, das der Bericht des Gewehr-Präzisionsrechners verwendet, §8.6 des dortigen Handbuchs) — Sie wählen also eine Zahl, deren Vertrauenswürdigkeit Sie ebenfalls sehen können, keine nackte Ziffer. Die Wahl eines Projekts trägt automatisch R50/mrad/„Eigene" ein; Sie müssen trotzdem noch **Patrone speichern** drücken, damit es haften bleibt. Qualifiziert sich noch kein Projekt, sagt die Auswahl das unumwunden: *„Sie haben noch keine Arsenal-Patrone — legen Sie zuerst ein Gewehr und eine Patrone an"* erscheint auf der Seite des Gewehr-Präzisionsrechners, wenn umgekehrt kein passendes Gewehr/keine passende Patrone zum Empfangen einer Messung existiert; die entsprechende Meldung hier lautet *„Kein Gewehr-Präzisionsrechner-Projekt hat bisher genug Daten für einen brauchbaren Präzisionswert."*

**Der umgekehrte Weg — vom Gewehr-Präzisionsrechner ins Arsenal — ist vollständig in §10.1 beschrieben.**

### 5.7 Eine Patrone mit einer anderen Patrone einschießen

Ein Gewehr einzuschießen bedeutet im Kern, das Visier auf genau den Winkel einzustellen, der die Kugel auf eine bestimmte Distanz — die Nullentfernung — zum Zielpunkt schickt. Jede andere Visierkorrektur, auf jeder anderen Entfernung, wird dann relativ zu diesem selben Nullpunkt-Winkel berechnet. Dieser Winkel hängt naturgemäß von der jeweiligen Patrone und dem jeweiligen Geschoss ab: je schneller ein Geschoss die Nullentfernung erreicht, desto kleiner muss der Winkel sein. Schießen Sie danach eine andere Patrone, ohne am Nullpunkt etwas zu ändern, fallen deren eigene Flugbahnberechnungen falsch aus — genau in dem Maß, in dem sich die Ballistik der beiden Patronen auf der Nullentfernung tatsächlich unterscheidet. Der klassische Fall: Sie schießen das Gewehr mit billiger Übungs- oder Surplus-Munition ein, laden dann aber eine hochwertige Jagd- oder Dienstpatrone, deren tatsächlicher Treffpunkt auf jeder Entfernung gegenüber dem verschoben ist, den ihr eigener unabhängiger Nullpunkt ergeben hätte.

Die extreme Version desselben Problems ist ein Gewehr, das sowohl eine überschallschnelle Laborierung als auch eine unterschallschnelle, unterdrückte schießt, ohne je dazwischen neu eingeschossen zu werden — ein üblicher Aufbau für leises Arbeiten auf kurze Distanz. Die Flugbahnen der beiden Laborierungen weichen jenseits einer kurzen Distanz enorm voneinander ab (ein Unterschallgeschoss fällt um ein Vielfaches schneller), sodass es hier keine bloße Ordnungsfrage ist, die Unterschall-Patrone mit der Überschall-Patrone einzuschießen — es ist der einzige Weg, auf dem die eigene Falltabelle beider Laborierungen tatsächlich wiedergibt, was das physisch unveränderte Gewehr wirklich tut.

**Eingeschossen mit**, ein Feld im Patronenformular, teilt Arsenal mit, welche Patrone tatsächlich den physischen Nullpunkt hergestellt hat, sodass jedes Werkzeug, das die Erhöhung für diese Patrone berechnet, den Unterschied berücksichtigen kann, statt stillschweigend anzunehmen, dass diese Patrone sich selbst eingeschossen hat.

- Das Feld erscheint erst, wenn das Gewehr **mindestens eine weitere Patrone** hat, auf die verwiesen werden kann, und nur bei einer Patrone, die nicht **selbst** bereits als Geber für eine andere Patrone dient (siehe unten).
- Die Wahl einer Patrone aus der Auswahlliste macht diese zum **Geber**; diese Patrone wird deren **Empfänger**. Die Erhöhung für den Empfänger wird dann berechnet, indem gefragt wird: „Welcher Abschusswinkel würde die Ballistik des *Gebers* an dieser Nullentfernung des Gewehrs durch die Ziellinie schicken", und dann fliegt die *eigene* Mündungsgeschwindigkeit und das Geschoss des Empfängers von diesem geliehenen Winkel aus — nicht durch unabhängiges Einschießen des Empfängers.
- **Keine Verkettung.** Eine Patrone, die bereits als Geber für eine andere dient, bietet selbst nie das Feld „Eingeschossen mit" an — sie kann nicht ihrerseits einen Nullpunkt von einer dritten Patrone entlehnen. Die Beziehung bleibt ein einfaches Paar, niemals eine beliebig tiefe Kette.
- **Mehrfachnutzung ist erlaubt.** Mehrere Patronen können alle mit demselben Geber eingeschossen sein — der übliche Fall, wenn Sie eine Übungslaborierung vor mehreren verschiedenen hochwertigen Laborierungen durch dasselbe Gewehr schießen.
- Nur die **Erhöhung** wird entlehnt. Seitenverschiebung/Drall-Nullpunktbestimmung (§9.3, separat in den Einstellungen aktiviert) wird immer aus der eigenen Ballistik des Empfängers berechnet.
- **Welche Werkzeuge dies berücksichtigen:** Flugbahn, Feldrechner und der Vergleichs-Chart (§7) berechnen die Erhöhung des Empfängers alle von seinem Geber, sobald einer festgelegt ist. **Trefferwahrscheinlichkeit tut dies nicht** — sie berechnet die Erhöhung immer aus der eigenen Ballistik der Patrone, unabhängig von einem an ihr festgelegten Geber. Siehe §9.5 für den Grund.

Die Patronenliste des Arsenals kennzeichnet beide Seiten dieser Beziehung — siehe §6.4. Das Löschen eines Gebers löscht sofort den Verweis bei jeder Patrone, die auf ihn zeigte, statt ihn ins Leere zeigen zu lassen; solche Empfänger berechnen dann einfach wieder ihren eigenen Nullpunkt.

---

## 6. Die Arsenal-Seite: Listen, Filter, Aktivierung

### 6.1 Seitenaufbau, von oben nach unten

1. Eine kurze Einleitung, die daran erinnert, dass alles hier auf diesem Gerät lebt und überall mit `*` gekennzeichnet auftaucht, wo ein Gewehr oder Geschoss gewählt werden kann.
2. Die Zusammenfassung **Zum Vergleich** und der Abschnitt Vergleich, nur eingeblendet, sobald 1–2 Konfigurationen dafür vorgemerkt sind (§7).
3. **Bibliothek in Datei sichern…** / **Sicherung aus Datei laden…** (§8).
4. **Aktives Gewehr** — das Gewehr, das gerade unter Ihrer Hand ist.
5. Eine **Filterkarte** — Kaliber- und Herstellerfilter, vollständig ausgeblendet, wenn Ihre Bibliothek leer ist.
6. **Weitere Gewehre**.
7. **Ihre Geschosse**.

### 6.2 Das aktive Gewehr und die Aktivierung

Genau eine Gewehr-Patrone-Kombination ist zu jedem Zeitpunkt in der gesamten App „aktiv" — dieselbe Konfiguration, aus der Flugbahn, Trefferwahrscheinlichkeit und Feldrechner alle lesen. Auf der Arsenal-Seite wird sie in der eigenen Karte **Aktives Gewehr** angezeigt, vorbelegt mit der bereits laufenden Konfiguration, falls es sich um ein Arsenal-Gewehr handelt; ist die aktuelle Konfiguration der App stattdessen von Hand eingegeben, sagt die Karte das: *„Das aktuell ausgewählte Gewehr ist manuell definiert und nicht in Ihrem Arsenal aufgeführt."*

**Das Anklicken einer Zeile unter „Weitere Gewehre" aktiviert sie** — verschiebt sie in die Karte Aktives Gewehr — statt sie direkt zur Bearbeitung zu öffnen; **Bearbeiten** wird nur für das jeweils aktive Gewehr angeboten. Das ist Absicht: ein Gewehr auszuwählen und ein Gewehr zu bearbeiten sind unterschiedliche Absichten, und die häufigere davon (ich möchte mit diesem hier schießen) bekommt den einfachen Klick.

Die Aktivierung auf der Arsenal-Seite ist vorläufig. **Nichts wird in die gemeinsame Konfiguration der App übernommen, bevor Sie Fertig drücken.** Sie können frei zwischen Gewehren wechseln, mehrere hintereinander bearbeiten, und nur das beim Verlassen in der Karte Aktives Gewehr angezeigte wirkt sich aus. Hat dieses Gewehr derzeit null Patronen, lässt Fertig die zuvor laufende Konfiguration unangetastet, statt sie auf nichts zurückzusetzen.

Die Patronenauswahl des aktiven Gewehrs merkt sich, welche Patrone Sie zuletzt dafür gewählt hatten, und stellt sie beim nächsten Besuch wieder her.

### 6.3 Patronen unter dem aktiven Gewehr

Jede Patrone des aktiven Gewehrs ist ihre eigene Zeile: Name, ein Abzeichen **Aktiv** bei der jeweils gewählten, ihre Mündungsgeschwindigkeit und der live berechnete Stabilitätschip aus §5.5. Ein Klick auf eine Zeile macht sie zur aktiven Patrone. **+ Patrone hinzufügen** sitzt unterhalb der Liste.

Ein Gewehr ohne Patronen zeigt anstelle der Liste eine Warnung: *„Für dieses Gewehr sind keine Patronen definiert. Diese Konfiguration ist unbrauchbar und wird nicht aktiviert."*

### 6.4 Abzeichen

- **Nicht gesichert** — dieses Geschoss oder Gewehr wurde erstellt, bearbeitet oder importiert, seit es zuletzt in eine Sicherungsdatei geschrieben wurde. Wird nie bei einem integrierten Eintrag angezeigt, da diese keine Sicherung benötigen.
- **Unbrauchbar** — ein Gewehr mit null Patronen. Titeltext beim Überfahren mit der Maus: *„Keine Patronen definiert — dieses Gewehr kann nicht aktiviert werden."* Ein solches Gewehr bleibt anklickbar, damit Sie es erreichen können, um seine erste Patrone hinzuzufügen.
- **Aktiv** — die derzeit am aktiven Gewehr gewählte Patrone.
- **Nullpunkt-Geber** — die eigene Nullpunkt-Erhöhung dieser Patrone wird derzeit von einer oder mehreren anderen Patronen des Gewehrs entliehen (§5.7).
- **Nullpunkt-Empfänger** — diese Patrone ist mit einer anderen Patrone eingeschossen; das Überfahren mit der Maus nennt welche.

### 6.5 Filter

Zwei Dropdown-Listen, **Nach Kaliber filtern** und **Nach Hersteller filtern**, standardmäßig auf **Alle Kaliber** / **Alle Hersteller**. Sie schränken sich gegenseitig ein: die Wahl eines Herstellers verengt die Kaliberliste auf Kaliber, die dieser Hersteller tatsächlich anbietet, und umgekehrt. Kaliberoptionen sind nach tatsächlichem Laufdurchmesser sortiert statt alphabetisch, sodass `.223`, `6.5mm` und `.308` so sortieren, wie ein Munitionsregal es tut, nicht wie ein Wörterbuch. Ein Gewehr erfüllt einen Filter nur über die Geschosse seiner Patronen — Gewehre tragen kein eigenes Kaliber, wie in §3 erwähnt.

**Filter zurücksetzen** löscht beide. Die ganze Karte verschwindet, wenn Ihre Bibliothek — Geschosse und Gewehre zusammen — leer ist, da es dann nichts zu filtern gibt.

Es gibt keine Freitextsuche; gefiltert wird ausschließlich nach Kaliber und Hersteller.

---

## 7. Zwei Konfigurationen vergleichen

Jede Gewehr-Patrone-Zeile trägt einen Schalter **Zum Vergleich hinzufügen**, gedeckelt auf **zwei** Plätze — sind zwei vorgemerkt, deaktiviert sich der Schalter jeder weiteren Zeile mit *„Entfernen Sie zuerst eine Konfiguration aus dem Vergleich"*. Eine Zusammenfassungskarte **Zum Vergleich** listet, was gerade vorgemerkt ist, jeweils mit eigenem Entfernen.

Sind genau zwei Konfigurationen vorgemerkt, erscheint ein vollständiger Abschnitt **Vergleich**: eine gemeinsame Atmosphäre-und-Wind-Steuerung, ein gemeinsames Feld für die maximale Distanz, sowie ein Flugbahndiagramm — dieselben Spaltenoptionen, Zoom- und Verschiebungssteuerung sowie SVG-Export wie das eigene Diagramm des Flugbahn-Werkzeugs —, das beide Konfigurationen als zwei Reihen mit gemeinsamer Legende zeichnet.

Der Vergleich wird bei jedem Rendern **live gegen Ihr Arsenal neu aufgelöst**, verankert an Gewehr- und Patronen-Identität statt an einer eingefrorenen Momentaufnahme: bearbeiten Sie eines der beiden vorgemerkten Gewehre, aktualisiert sich das Diagramm sofort.

Diese Auswahl ist **nur für die Sitzung** — sie ist keine gespeicherten Daten und setzt sich beim nächsten Neuladen der App zurück. Ihr Zweck ist ein schneller Seit-an-Seit-Vergleich („lohnt sich die flachere Flugbahn des schwereren Geschosses trotz seines langsameren Starts, auf den Distanzen, die ich tatsächlich schieße") und kein dauerhafter Datensatz.

---

## 8. Sicherung, Wiederherstellung und Datenverwaltung

Die Speicherung des Arsenals lebt in Ihrem Browser. Sichern Sie sie — siehe §2, was geschieht, wenn Sie es nicht tun.

### 8.1 Exportieren

- **In Datei sichern**, an jeder einzelnen Geschoss- oder Gewehrzeile, exportiert nur diesen einen Eintrag. Bei einem Gewehr bündelt die Datei es zusammen mit jedem Geschoss, das seine Patronen tatsächlich referenzieren, sodass die Sicherung eines einzelnen Gewehrs stets für sich genügt und für sich wieder importierbar ist.
- **Bibliothek in Datei sichern…** öffnet den Dialog **Bibliothek speichern**: ein Kontrollkästchen für jedes Geschoss und jedes Gewehr, das Sie besitzen, standardmäßig alle angekreuzt. Das Ankreuzen eines Gewehrs kreuzt automatisch die von seinen Patronen benötigten Geschosse an; das Abwählen eines Geschosses hebt automatisch die Auswahl jedes Gewehrs auf, das es benötigt — der Dialog lässt Sie kein Gewehr mit einem verwaisten Geschossverweis exportieren. **Exportieren** schreibt eine JSON-Datei mit allem Angekreuzten.

Jeder erfolgreiche Export löscht das Abzeichen **Nicht gesichert** bei allem, was er enthielt.

### 8.2 Importieren

**Sicherung aus Datei laden…** öffnet eine Dateiauswahl (nur JSON). Eine Datei, die kein gültiges JSON ist, oder gültiges JSON, das kein Arsenal-Export ist, wird mit einer konkreten Meldung abgelehnt statt lautlos zu nichts zu führen. Eine wohlgeformte Datei öffnet den Dialog **Bibliothek laden**:

- Alles, dessen Name mit einem vorhandenen Eintrag Ihrer Bibliothek übereinstimmt — verglichen ohne Rücksicht auf Groß-/Kleinschreibung und Leerraum — trägt ein **Konflikt-Kennzeichen**, das angibt, ob die eingehende Kopie neuer, älter, gleich alt oder von unbekanntem Alter im Vergleich zu Ihrer vorhandenen ist, basierend auf dem Zeitstempel der letzten Änderung jedes Eintrags.
- **Wenn ein Name bereits in Ihrer Bibliothek existiert** — eine Auswahl mit drei Strategien, angewendet auf jeden im Konflikt stehenden Eintrag dieses Imports:
  - **Vorhandenes überschreiben** — die importierte Version ersetzt Ihre vollständig.
  - **Nur überschreiben, wenn neuer** — ersetzt nur, wenn der Zeitstempel des eingehenden Eintrags strikt später liegt als der Ihres vorhandenen; andernfalls wird dieser Eintrag übersprungen. Die sichere Standardwahl beim Zusammenführen von Sicherungen zweier Geräte.
  - **Beide behalten (importierte Kopie umbenennen)** — importiert als neuen Eintrag namens *„\<Name\> - Kopie (1)"*, hochzählend, bis der Name frei ist, sodass nichts bereits in Ihrer Bibliothek Befindliches je angerührt wird.
- **Importieren** wendet Ihre Wahl an und meldet das Ergebnis: *„{{n}} Eintrag/Einträge importiert, {{n}} übersprungen."*

Gewehre werden nach den Geschossen importiert, und der Geschossverweis jeder Patrone wird auf die id umgemappt, mit der ihr Geschoss tatsächlich in *Ihrer* Bibliothek gelandet ist — sodass ein importiertes, zur Kollisionsvermeidung umbenanntes Geschoss die Patronen des importierten Gewehrs nicht ins Leere zeigen lässt.

---

## 9. Ballistische Daten und wer sie konsumiert

Dieser Abschnitt ist das Nerd-Vergnügen zu §5 — wofür jedes Feld mathematisch tatsächlich gut ist, sobald es das Arsenal verlässt.

### 9.1 Luftwiderstandsdaten → Flugbahn und Vergleich

Die Luftwiderstandsdaten eines Geschosses — BC-und-Modell oder eine eigene Cd-Mach-Tabelle — sind zusammen mit seiner Masse genau die Eingabe, die die Flugbahn-Engine benötigt, um eine widerstandsgebremste Flugbahn zu integrieren. Das eigene Vergleichsdiagramm des Arsenals (§7) läuft mit derselben Flugbahn-Engine, die auch Flugbahn selbst verwendet, gespeist aus dem Gewehr jeder vorgemerkten Konfiguration (Visierhöhe, Einschussdistanz) und der Patrone (Mündungsgeschwindigkeit und ihre optionale Temperaturempfindlichkeit, ausgewertet gegen die von Ihnen angegebene Referenztemperatur).

### 9.2 Mündungsgeschwindigkeitsstreuung → Trefferwahrscheinlichkeit

Die **Mündungsgeschwindigkeitsstreuung (SD)** einer Patrone bewirkt, sofern Sie sie angeben, innerhalb des Arsenals selbst nichts. Sie existiert einzig, damit die Geschwindigkeitsunsicherheits-Eingabe von Trefferwahrscheinlichkeit, sobald diese Gewehr-Patrone-Kombination die aktive ist, eine fertige Option **„Dieses Gewehr"** anbieten kann, statt Sie zu zwingen, den eigenen Chronographenwert zu erinnern oder erneut zu messen — mit einem ausdrücklichen Hinweis, dass diese Patrone einen bereithält.

### 9.3 Stabilität und drallbedingte Seitenabweichung

Der live berechnete Stabilitätschip (§5.5) berechnet den gyroskopischen Stabilitätsfaktor Sg über **Millers Drallregel**, direkt in den eigenen metrischen Engine-Einheiten dieser App neu hergeleitet, statt bei jedem Aufruf über die traditionellen imperialen Eingaben der Formel umzurechnen. Millers eigene veröffentlichte Formel ist eine Schätzung für Standardatmosphäre ohne jeden Höhen- oder Luftdichte-Term; diese Engine wendet darauf die übliche Dichteskalierung an, sodass ein auf Meereshöhe als grenzwertig berechnetes Geschoss in der Höhe oder an einem heißen Tag stabil erscheinen kann, und umgekehrt. Die drei veröffentlichten Bänder sind:

| Sg | Bewertung |
|---|---|
| < 1,0 | Instabil |
| 1,0 – 1,3 | Grenzwertig |
| ≥ 1,3 | Stabil |

Dieselben fünf Eingaben — Masse, Kaliber, Länge, Mündungsgeschwindigkeit, Drall — treiben in der Flugbahn-Engine auch die **drallbedingte Seitenabweichung** für jede aus einem Arsenal-Gewehr und -Geschoss aufgebaute Konfiguration an. Die Suite bietet zwei in den Einstellungen wählbare Methoden zur Berechnung der Seitenabweichung: die einfache, empirische Litz-Formel und ein ausführlicheres physikalisches McCoy-4-DOF-Modell. Trotz des Unterschieds in der Komplexität benötigen beide Methoden derzeit genau dieselben fünf Eingaben — weshalb es sich lohnt, Geschosslänge und Gewehrdrall auszufüllen, sobald Sie sie kennen, auch wenn sie in diesem gesamten Handbuch als optional gekennzeichnet sind: lässt man eines von beiden leer, kostet das überall dort, wo dieses Gewehr benutzt wird, stillschweigend die Seitenabweichung und eine Stabilitätsschätzung, unabhängig von der gewählten Methode.

### 9.4 Gewehrpräzision → Trefferwahrscheinlichkeit

Ausführlich behandelt in §5.6 und, aus der umgekehrten Richtung, in §10.1. Kurz gefasst: die gespeicherte `precision` einer Patrone — Modus (`own` oder `combined`) plus ein R50 in mrad — wird von Trefferwahrscheinlichkeit genau in dem Moment gelesen, in dem diese Gewehr-Patrone-Kombination dort zur aktiven Konfiguration wird. Ein Wert vom Typ **„own"** befüllt Trefferwahrscheinlichkeits Eingabe für die Bank-Präzision und lässt das Schützenkönnen als separate, unabhängige Eingabe stehen, die damit kombiniert wird. Ein Wert vom Typ **„combined"** befüllt stattdessen die vereinfachte, bereits kombinierte Eingabe und schaltet den vereinfachten Modus dieses Werkzeugs ein, da eine kombinierte Zahl das Schützenkönnen bereits eingebacken hat und nicht ein zweites Mal damit kombiniert werden sollte.

### 9.5 Nullpunkt-Geber → Flugbahn, Feldrechner, Vergleich

Der Geber einer Patrone (§5.7) ändert, sobald festgelegt, genau einen Schritt der Flugbahnberechnung: statt den Abschusswinkel zu finden, der die *eigene* Ballistik dieser Patrone an der Nullentfernung des Gewehrs durch die Ziellinie schickt, findet die Engine den Winkel, der dasselbe für die Mündungsgeschwindigkeit, Temperaturempfindlichkeit und das Geschossprofil des **Gebers** täte — alles andere (Nullentfernung, Visierhöhe, Ziellinienwinkel, Atmosphäre, Wind) bleibt auf den eigenen Werten des Empfängers fixiert —, und lässt dann die **eigene** Ballistik des Empfängers von diesem geliehenen Winkel aus fliegen. Das Ergebnis ist genau das, was tatsächlich auf der Strecke passiert, wenn aus einem mit einer Laborierung eingeschossenen Gewehr mit einer anderen geschossen wird.

Diese Substitution geschieht genau an dem Punkt, an dem in dieser Engine bereits jede andere Nullpunkt-Winkelberechnung geschieht, sodass sie sich kostenlos mit allem verbindet, was die Flugbahn-Engine für eine normale Patrone ohnehin tut — Atmosphäre, Wind, Seitenabweichung, der 4-DOF-Integrator —, keines davon muss wissen, dass ein Geber beteiligt ist.

Seitenverschiebungs-/Drall-Nullpunktbestimmung (§9.3) bleibt von einem Geber unberührt: sie wird immer aus der eigenen Ballistik des Empfängers berechnet, da es sich um ein eigenständiges, separat aktiviertes Feature handelt.

**Trefferwahrscheinlichkeit ist absichtlich ausgenommen.** Ihr eigenes Streuungsmodell berechnet die Erhöhung unabhängig, auf der *Zielentfernung selbst* (oder einem separat festgelegten Gefechtsnullpunkt) statt auf der eingestellten Nullentfernung des Gewehrs, und liest den Geber einer Patrone überhaupt nie — eine bewusste Designentscheidung, kein Versehen: Trefferwahrscheinlichkeit schätzt, wie ein Schuss tatsächlich um einen Zielpunkt streut, den Sie für diesen Schuss einstellen — eine andere Frage als die, wohin ein fester, bereits hergestellter physischer Nullpunkt eine Ersatzlaborierung setzt.

---

## 10. Anwendung in der Praxis

### 10.1 Eine gemessene Gewehrpräzision zurück ins Arsenal einspeisen

Der Gewehr-Präzisionsrechner misst die tatsächliche, vertrauensbegrenzte Streuung Ihres Gewehrs anhand echter beschossener Gruppen (siehe das eigene Handbuch dieses Werkzeugs). Sobald ein dortiges Projekt genug gepoolte Treffer für eine brauchbare Zahl hat, wächst an seiner Zeile eine Schaltfläche **„Als Patronenpräzision übernehmen…"**.

Sie zu drücken öffnet eine Auswahl, die jedes Arsenal-Gewehr mit mindestens einer Patrone auflistet, jeweils mit einer Patronen-Dropdown-Liste. Wählen Sie das Gewehr und die Laborierung, mit der Sie dieses Projekt tatsächlich geschossen haben, und Sie landen direkt im Arsenal, mit genau diesem Gewehr und dieser Patrone bereits aktiviert und dem bereits geöffneten Formular **Patrone bearbeiten** — vorbelegt mit angekreuztem **„Eigene (Schießstand-)Gewehrpräzision"** und dem aggregierten R50 des Projekts, umgerechnet in mrad, im Wertfeld sitzend. Nichts wird geschrieben, bevor Sie **Patrone speichern** drücken — dies ist eine Übergabe in ein Formular, das Sie prüfen, kein stiller Hintergrundschreibvorgang.

Dies ist der wichtigste Arbeitsablauf, den dieses Werkzeug unterstützt, weil er derjenige ist, der den Rest der Suite ehrlich macht: eine Trefferwahrscheinlichkeits-Zahl, berechnet aus einem tatsächlich gemessenen Bank-Präzisionswert mit eigenem bekannten Vertrauensintervall, ist kategorisch mehr wert als eine, berechnet aus einer von einer Fünf-Schuss-Gruppe erinnerten Zahl. Tun Sie dies jedes Mal, wenn Sie ein Laborierungsprojekt im Gewehr-Präzisionsrechner abschließen, nicht nur einmal, wenn Sie ein Gewehr zuerst einrichten — Ihre Präzisionsschätzung wird nur besser, je mehr Treffer dieses Projekt ansammelt, und der Patronendatensatz aktualisiert sich nicht von selbst.

### 10.2 Ein neues Gewehr von Grund auf einrichten

1. **Legen Sie zuerst die Geschosse an.** Schießen Sie mehr als eine Laborierung durch ein Gewehr, speichern Sie jedes Geschoss, bevor Sie mit den Patronen beginnen — die Inline-Option „+ Neues Geschoss hinzufügen…" im Patronenformular ist praktisch für eine einzelne Laborierung, aber eine vorab gefüllte Geschossbibliothek macht ein Mehrladungsgewehr schneller einzurichten und hält Ihre Geschossliste einen echten Katalog, statt ein Nebenprodukt der Patrone, die Sie zufällig zuerst hinzugefügt haben.
2. **Messen Sie Visierhöhe und Einschussdistanz genau.** Diese beiden fließen direkt in Flugbahns Falllinienberechnung ein und sind die beiden Zahlen, die am ehesten schon in Ihrem Gewehr-Datenbuch stehen, falls Sie eines führen — übertragen Sie sie, statt zu schätzen.
3. **Tragen Sie den Drall ein, selbst wenn Sie glauben, er spiele keine Rolle.** Es ist eine kostenlose Information, die schon auf Ihrem Lauf oder in seinem Datenblatt steht, und es ist das eine Feld, das zwischen „Stabilität unbekannt" und einem live nützlichen Chip an jeder Patrone dieses Gewehrs steht — ohne Zusatzkosten pro Patrone, da es nur einmal am Gewehr hinterlegt wird.
4. **Legen Sie eine Patrone pro Laborierung an, nicht pro Schießtag.** Ein Patronendatensatz beschreibt eine Laborierung, nicht einen Ausflug; sie so zu benennen wie *„175 ELD-M, 2650 fps, N550"* hält sie noch Monate später wiedererkennbar, wenn Sie mehrere ähnliche Einträge über mehrere Gewehre hinweg haben.
5. **Lassen Sie die Gewehrpräzision leer, bis Sie sie tatsächlich gemessen haben.** Eine selbstbewusst klingende, aus dem Gedächtnis eingetippte Zahl ist schlimmer als gar keine, weil Trefferwahrscheinlichkeit den Unterschied nicht erkennen kann — es wird eine Vermutung mit exakt demselben Gewicht behandeln wie eine hundert Schuss umfassende, vertrauensbegrenzte Messung. Nutzen Sie stattdessen die Übergabe aus §10.1, sobald Sie echte Daten haben.

### 10.3 Zwei Laborierungen vergleichen, bevor Sie sich festlegen

Angenommen, Sie entscheiden zwischen zwei Geschossen für dasselbe Gewehr, oder demselben Geschoss bei zwei unterschiedlichen Setztiefen mit entsprechend unterschiedlichen Geschwindigkeiten. Speichern Sie beide als separate Patronen am Gewehr (oder an zwei Gewehreinträgen, falls die Setztiefenänderung für Sie zwei unterschiedlich benannte Konfigurationen bedeutet), merken Sie beide für den Vergleich vor (§7), und setzen Sie die gemeinsame maximale Distanz auf das, was Sie tatsächlich interessiert. Das Diagramm beantwortet die praktische Frage — welches ist flacher, welches behält mehr Geschwindigkeit, wo kreuzen sich die beiden Flugbahnen — ohne dass Sie Flugbahn zweimal ausführen und zwei Zahlensätze gleichzeitig im Kopf behalten müssen.

### 10.4 Eine Sammlung mehrerer Gewehre übersichtlich halten

Besitzen Sie mehr als zwei oder drei Gewehre derselben allgemeinen Kaliberfamilie, ist die Filterkarte (§6.5) das, was die Seite navigierbar hält — filtern Sie nach Kaliber, um nur die Gewehre zu sehen, die für das passen, woran Sie gerade arbeiten, oder nach Hersteller, wenn Sie mehrere Gewehre anhand der Geschosse desselben Herstellers vergleichen. Das Abzeichen **Nicht gesichert** (§6.4) dient zugleich als laufende Aufgabenliste: sehen Sie am Ende einer Sitzung, in der Sie mehrere Einträge hinzugefügt oder bearbeitet haben, die Seite nach diesem Abzeichen durch, statt sich zu merken, was Sie angefasst haben, und führen Sie **Bibliothek in Datei sichern…** aus, um sie alle auf einmal zu löschen.

### 10.5 Mit einer Ersatzpatrone einschießen

Angenommen, Sie schießen ein Gewehr mit günstiger Surplus- oder Stahlhülsenmunition ein — billiger, um sie bei einer Einschießsitzung zu verbrauchen und den Nullpunkt regelmäßig zu prüfen —, tragen aber tatsächlich eine hochwertige Fabrik- oder Wiederladelaborierung. Speichern Sie beide als separate Patronen am selben Gewehr, öffnen Sie das eigene Formular **Patrone bearbeiten** der hochwertigen Laborierung, und setzen Sie **Eingeschossen mit** auf die Übungslaborierung. Von da an zeigen Flugbahn, Feldrechner und der Vergleichs-Chart alle die Flugbahn der hochwertigen Laborierung genau so, wie sie tatsächlich auftreffen wird, statt der (falschen, falls Sie tatsächlich mit der billigen Munition eingeschossen haben) Annahme, sie sei mit sich selbst eingeschossen.

Schießen Sie das Gewehr später direkt mit der hochwertigen Laborierung neu ein, gehen Sie zurück und löschen Sie **Eingeschossen mit** bei dieser Patrone — sie ist jetzt wieder ihr eigener Nullpunkt, und nichts sonst im Arsenal erledigt das automatisch für Sie.

---

## 11. Herkunft

Das Arsenal ist seit dem ersten Commit Teil der Suite und ist schrittweise gewachsen: mehrere integrierte Geschossbibliotheken und Hersteller-Autovervollständigung; Korrekturen der Einheitenpräferenz über die Patronenliste und die Geschosslänge hinweg; die aktuelle 4-DOF-Flugbahn-Engine mit den von ihr verwendeten Feldern für Seitenabweichung und Drallrichtung; und, zuletzt, Mündungsgeschwindigkeitsstreuung und Gewehrpräzision an Patronen, zusammen mit der direkten Übergabe aus dem Gewehr-Präzisionsrechner aus §10.1 — der Integration, die aus zwei vormals getrennten Werkzeugen eine gemessene Pipeline macht; und, noch jüngeren Datums, dass eine Patrone den physischen Nullpunkt einer anderen entleihen kann (§5.7), für den üblichen Fall, mit einer Laborierung einzuschießen und eine andere zu tragen.

Die Suite steht unter der Lizenz **AGPL-3.0-or-later**.

---

*Friedlich. Präzise. Bewaffnet.*
