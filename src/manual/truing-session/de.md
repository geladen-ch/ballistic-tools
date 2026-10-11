# geladen.ch ballistics Benutzerhandbuch — Einschieß-Sitzung

*Teil der* [geladen.ch ballistics Suite](https://bc.geladen.ch)*. Experimentell.*

---

## 1. Vorab: Brauchen Sie dieses Werkzeug?

Gewehr und App sind sich nicht einig: Sie stellen ein, was die App vorhersagt, und das Geschoss landet woanders. Der Fehlschuss allein sagt nicht, warum. Eine falsche Mündungsgeschwindigkeit, ein falscher BC, ein verschobener Nullpunkt, ein Zielfernrohr, das weniger liefert als seinen angegebenen Klick-Wert, und eine falsch eingeschätzte Windstärke können alle denselben Fehlschuss erzeugen. Dieses Werkzeug plant eine kurze Sitzung, die diese Ursachen auseinanderhält, führt Sie durch das Schießen und berichtet, was es gefunden hat. Lassen sich zwei Ursachen nicht trennen, sagt es das.

Es ist der letzte Schritt beim Einrichten eines Gewehrs, nicht der erste. Ein Gewehr, über das Sie nichts wissen, kann es nicht entschlüsseln, und es bringt Sie nicht von allein auf extreme Distanzen. Jede Unbekannte, die Sie in die Sitzung mitbringen, kostet Genauigkeit bei allen anderen.

### 1.1 Zuerst die Grundlagen

1. **Mündungsgeschwindigkeit und ihre Temperaturdrift.** Messen Sie mindestens 10 Schuss desselben Loses mit dem Chronographen und tragen Sie den Mittelwert in Arsenal ein, mit der Temperatur, bei der Sie gemessen haben. Für die Drift wiederholen Sie die Messung an einem Tag, der mindestens 15 °C (27 °F) wärmer oder kälter ist, und tragen die Änderung pro Grad ein. Lassen Sie die Munition zuerst die Lufttemperatur annehmen, halten Sie sie aus der Sonne und lassen Sie keine Patrone vor dem Schuss in einem heißen Patronenlager liegen. Übliche Driften liegen bei 0,5–2 m/s pro °C. Eine falsche Drift bedeutet eine falsche Geschwindigkeit an jedem Tag außer dem Messtag: 10 m/s daneben, bei 1 m/s pro °C nur 10 °C, sehen auf 800 m aus wie ein BC-Fehler von 4,6 %.
2. **Visierhöhe auf 2–3 mm (0,1") genau.** Messen Sie sie von der Laufachse zur Zielfernrohrachse. Verwenden Sie keinen typischen Wert für die Montage. Ein Fehler hier wirkt nahe am Gewehr am stärksten und wird leicht für einen Nullpunktfehler gehalten.
3. **Ihr Nullpunkt.** Prüfen Sie ihn am Tag mit einer echten Gruppe, waagerecht und bei Windstille geschossen. Der Präzisionsrechner zeigt, wie genau eine Gruppe den Treffpunkt festlegt. Eine einzelne Drei-Schuss-Gruppe legt ihn oft ungenauer fest, als man denkt.
4. **Verstellung des Zielfernrohrs (Klick-Wert).** Machen Sie einen Tall-Target-Test oder die kurze Variante: Stellen Sie auf bekannter Distanz zwischen zwei Schüssen eine bekannte Zahl Klicks ein und messen Sie, wie weit der Treffpunkt wandert (1 mm pro Meter Distanz ist 1 mrad). Ein Zielfernrohr, das um 2 % abweicht, sieht auf Distanz aus wie ein falscher BC.
5. **Ein verlässlicher BC oder eine Widerstandskurve.** Verwenden Sie einen mit Doppler-Radar gemessenen G7-BC oder eine eigene Cd-Mach-Kurve statt einer Zahl von der Schachtel. Ein G1-BC für ein langes Boattail-Geschoss ist ein Kompromiss, der nur über einen Teil der Flugbahn gilt. Veröffentlicht der Hersteller mehrere BCs für Geschwindigkeitsbereiche, fasst sie der Reiter „Mehrere BC“ der BC-Werkzeuge zu einer Widerstandskurve zusammen.

Die Seite „Vorbereiten“ dieses Werkzeugs hat dieselbe Checkliste, dazu die Streuung Ihres Gewehrs und die Geschwindigkeitsstreuung. Ein abgehakter Punkt sagt dem Planer, dass diese Ursache bereits geklärt ist. Er setzt dann weniger Schüsse für sie ein und mehr für die noch offenen. Sorgfältig erledigt, beseitigt diese Vorbereitung die meisten Unstimmigkeiten zwischen Gewehr und App schon vor dem Einschießen. Danach sollte der BC die einzige echte Unbekannte sein.

### 1.2 Wenn möglich, den BC direkt messen

Es gibt zwei direkte Wege, einen BC zu messen, und jeder ist meist mindestens so genau wie eine Einschieß-Sitzung:

- **Ein originales Labradar**, das für jeden Schuss eine Track-Datei auf seine SD-Karte schreibt. [Labrabaco NG](#/manual/bc-labradar) (in den BC-Werkzeugen) passt jedem aufgezeichneten Track einen BC an.
- **Zwei Chronographen**, einer an der Mündung und einer weiter vorne, eingetragen im Reiter „BC-Berechnung“ der BC-Werkzeuge. Stellen Sie das vordere Gerät so auf, dass ein tiefer Schuss es nicht treffen kann, und schützen Sie es mit etwas Massivem.

### 1.3 Wann sich eine Einschieß-Sitzung lohnt

Verwenden Sie dieses Werkzeug, wenn die Grundlagen erledigt sind und Sie den BC nicht direkt messen können. Es eignet sich auch gut, um einen bereits gemessenen BC zu überprüfen.

---

## 2. Was eine Sitzung leisten kann

### 2.1 Warum eine geplante Sitzung und nicht Ihr DOPE-Protokoll

Ein paar DOPE-Einträge auf ein paar Distanzen sehen aus, als müssten sie genügen, um alles anzupassen. Das tun sie nicht. Mündungsgeschwindigkeit, Luftwiderstand und Verstellung des Zielfernrohrs verändern die Flugbahn über übliche Schussdistanzen fast gleich. Mehr Gruppen derselben Art trennen sie nicht. Die Anpassung kann sie nur auseinanderhalten, wenn etwas anderes eine von ihnen festlegt: ein Chronograph, ein Tall-Target-Test oder ein zweites Ziel auf einer Distanz, die gezielt zum Trennen gewählt wurde. Diese Distanzen wählt das Werkzeug für Sie.

### 2.2 Mit Chronograph und ohne

Ein Chronograph ist das Wertvollste, was Sie mitbringen können. Ein Geschwindigkeitsfehler und ein Luftwiderstandsfehler krümmen die Flugbahn fast gleich, deshalb können die Schüsse allein sie nicht unterscheiden. Der Chronograph misst die Geschwindigkeit direkt, in der Luft des Tages und bei der Pulvertemperatur des Tages, und damit bleibt der Luftwiderstand als einzige große Unbekannte übrig.

- **Mit einem Chronographen**, der jeden Schuss sofort meldet (ein Doppler-Radar oder ein Mündungsgerät), misst eine Sitzung auf einem Gelände bis etwa 800 m den Luftwiderstand einer .308 mit 20–30 Schuss auf ±1,5–2 %. Das ist Note A, und das Werkzeug bietet an, das Ergebnis in Ihrer Patrone zu speichern. Eine BC-Korrektur braucht mindestens fünf Chronographen-Messwerte aus der Sitzung.
- **Ohne Chronograph** bietet das Werkzeug nie eine BC-Korrektur an. Der Luftwiderstand hinge dann ganz vom Geschwindigkeitsmittelwert ab, den Sie an einem anderen Tag gemessen haben, und nichts in der Sitzung kann diesen Mittelwert prüfen. Auf 800 m verschiebt ein Fehler von 1 m/s darin das Ergebnis für den Luftwiderstand um etwa 0,5 %. Die Seite „Vorbereiten“ kann einen solchen Plan trotzdem mit A bewerten; §8.7 erklärt, warum diese Note für einen BC nicht genügt. Haben Sie auch den Mittelwert nicht geprüft, endet die Sitzung unabhängig von der Schusszahl bei Note C, kaum besser als der veröffentlichte BC. In beiden Fällen erhalten Sie trotzdem korrigierte Höhenkorrekturen für die geschossenen Distanzen und eine Nullpunktkontrolle. Sie gelten nur für diese Distanzen und ähnliche Luft.

Ohne Chronograph ist eine Sitzung **viel** weniger nützlich. Wenn Sie sich einen leihen können, tun Sie es. Das Gelände zählt fast genauso viel: Auf einem Gelände, das bei 600 m endet, kommt eine .308 selbst mit Chronograph und vollständiger Vorbereitung nicht über Note B hinaus (siehe §8.7).

### 2.3 Die Noten

Die Seite „Vorbereiten“ bewertet den Plan, bevor Sie einen Schuss abgeben, und die Seite „Abschluss“ bewertet das Ergebnis. Die Note ergibt sich aus der Unsicherheit des Luftwiderstands-Faktors (eine Standardabweichung):

| Note | Unsicherheit des Luftwiderstands | Was Sie erhalten |
|---|---|---|
| **A** | bis 2 % | Eine echte BC-Korrektur, gültig auf anderen Distanzen und bei anderem Wetter. |
| **B** | 2–3 % | Eine BC-Korrektur mit breitem Band. Das Werkzeug lässt Sie sie speichern, verlassen Sie sich aber nur nahe an den geschossenen Distanzen und Bedingungen darauf. |
| **C** | 3–4 % | Kaum mehr als der veröffentlichte BC. Keine BC-Korrektur. |
| **D** | über 4 % | Korrigierte Höhenkorrekturen für die geschossenen Distanzen, keine Aussage über den BC. |

Vor dem ersten Schuss nimmt das Werkzeug an, dass der BC um etwa 4 % danebenliegt. Eine Sitzung mit Note D hat über den Luftwiderstand also kaum etwas gelernt, was nicht schon angenommen war.

**Nur Note A liefert ein Ergebnis, das Sie auf andere Distanzen und anderes Wetter übertragen können.** Bei B und darunter hat die Sitzung die gemeinsame Wirkung aller Ursachen gemessen, auf diesen Distanzen und in dieser Luft. Das ist für diese Distanzen nützlich, sagt aber nicht, wie viel davon auf den BC entfällt.

### 2.4 Grenzen

- **Nur Überschall.** Jedes geplante Ziel liegt so nah, dass das Geschoss noch schneller als Mach 1,1 ist. Transsonischen und Unterschallflug behandelt diese Version nicht.
- **Das Werkzeug korrigiert die Mündungsgeschwindigkeit nicht aus den Treffern.** Die Geschwindigkeit ist ein Wert, den Sie gemessen haben. Ein Chronographen-Messwert während der Sitzung korrigiert sie, aber das Werkzeug leitet eine Geschwindigkeit nie allein aus den Höhenkorrekturen ab. Das würde den Fehler nur in eine andere Ursache verschieben.
- **Experimentell.** Die Statistik wurde an simulierten Sitzungen mit absichtlich eingebauten, bekannten Fehlern geprüft, aber das Werkzeug wurde in der Praxis bisher wenig eingesetzt. Behandeln Sie eine BC-Korrektur als starken Hinweis, den Sie überprüfen, nicht als endgültigen Wert.

---

## 3. Vorbereiten

### 3.1 Gewehr, Standort und Wetter

Das Werkzeug verwendet das aktive Gewehr und die aktive Patrone aus Arsenal sowie den aktiven Schießstandort. Eine eigene Gewehrauswahl hat es nicht.

Es führt eigene Wettereingaben, und nichts, was Sie in einem anderen Werkzeug eingeben, ändert sie. Geben Sie den **Stationsdruck** ein, also das, was ein Barometer am Schießplatz anzeigt. Ein Telefon oder eine Wetter-App liefert meist den auf Meereshöhe reduzierten Druck (QNH), und dieser Wert ist hier falsch. Hat der Standort eine Höhenangabe, warnt das Werkzeug, wenn der Druck nach QNH aussieht. Lesen Sie die Temperatur am Schießplatz auf etwa 3 °C genau ab. Die Luftfeuchtigkeit spielt kaum eine Rolle.

Vor dem Start bestätigen Sie die Bedingungen. Danach bleiben sie als Ausgangsluft der Sitzung fest, sodass eine spätere Wetteränderung an anderer Stelle bereits abgegebene Schüsse nicht verändern kann. Eine BC-Korrektur setzt voraus, dass diese Bedingungen stimmten, denn eine falsche Temperatur oder ein falscher Druck landet im Luftwiderstands-Term. Die Seite „Abschluss“ erinnert Sie daran.

Es wird angenommen, dass der Nullpunkt waagerecht, bei Windstille und in der Nullpunkt-Atmosphäre der Patrone eingeschossen wurde, falls Arsenal eine angibt. Sonst gilt die Ausgangsluft der Sitzung. Haben Sie an einem anderen Tag oder auf einer anderen Höhe eingeschossen, tragen Sie die Nullpunkt-Atmosphäre in Arsenal ein. Das zählt vor allem bei Nullpunkten ab 200 m und kaum bei Nullpunkten bis 100 m.

### 3.2 Vorbereitung

Die Checkliste umfasst die Punkte aus §1.1: Nullpunkt am Tag erneut geprüft, Klick-Wert getestet, Visierhöhe gemessen, Mittelwert der Mündungsgeschwindigkeit geprüft. Außerdem zeigt sie die Streuung des Gewehrs und die Geschwindigkeitsstreuung aus Arsenal, oder einen Vorgabewert, wenn Arsenal keinen hat. Keiner der Punkte ist Pflicht, aber jeder nicht abgehakte Punkt ist eine Ursache, die die Sitzung mit eigenen Schüssen messen muss.

Haken Sie einen Punkt nur ab, wenn Sie ihn wirklich erledigt haben. Unsicherheitsbänder und Note behandeln jeden abgehakten Punkt als erledigt. Beim Nullpunkt und beim Geschwindigkeitsmittelwert prüft die Anpassung Ihre Haken zusätzlich an den Schüssen, und die Seite „Abschluss“ sagt, wenn die Schüsse einem widersprechen. Der Klick-Wert lässt sich aus den Schüssen nicht prüfen. Ein falscher Haken dort lässt den wahren Fehler meist außerhalb des angegebenen Bandes.

### 3.3 Ziele und Plan

Das Werkzeug prüft, ob Ihre eingetragenen Ziele weit genug entfernt sind, um etwas über den Luftwiderstand zu sagen, und findet das beste Paar aus nahem und fernem Ziel für diese Patrone. Reichen sie nicht weit genug oder liegt nichts nahe der Nullpunktdistanz, fragt es einmal, ob Sie eine natürliche Marke haben, die Sie anmessen können, etwa einen Felsen oder eine Wallkante.

Sie geben außerdem an, wie windig es voraussichtlich sein wird: schwach bis mäßig oder stark (die Grenze liegt bei etwa 5 m/s, 11 mph, 18 km/h). Das beeinflusst nur den Plan und die Schusszahl. Auf dem Stand stellen Sie den tatsächlichen Wind für jede Gruppe ein.

Das Kästchen „Dieses Gelände ist flach“ wird nie für Sie angehakt. Ein Standort kann ein flaches Gelände nicht von einem unterscheiden, dessen Neigung niemand gemessen hat. Haken Sie es nur an, wenn Sie es wissen. Es schaltet die Neigungsprüfungen für diese Sitzung ab und schreibt nirgends einen Winkel. Ist das Gelände in Wahrheit nicht flach, kann eine ausgeschlossene Neigung für eine falsche Distanz oder einen falschen Luftwiderstand gehalten werden.

Korrigieren Sie hier die Distanz oder den Winkel eines Ziels, gilt die Korrektur nur für diese Sitzung, und der Standort bleibt unverändert. Die Sitzung braucht die Distanz zum Kugelfang, in dem Sie die Einschläge sehen, und die kann von der Distanz zum Ziel abweichen. Um den Standort selbst zu ändern, verwenden Sie die Standortverwaltung.

### 3.4 Schusszahl

Sie legen die Gesamtzahl der Schüsse fest, einschließlich der Sicherheitsstufen der Leiter. Nehmen Sie 20–25 % mehr mit, für Schüsse, die der Beobachter nicht sieht, und für offensichtliche Ausreißer. Der Plan setzt einen Schuss auf die nächste Distanz und verteilt den Rest auf eine mittlere Distanz und das ferne Ziel. Die Aufteilung ist so gewählt, dass sie die Ursachen so weit trennt, wie sie auf Ihrer weitesten Distanz zählen, und Note A für den Luftwiderstand erreicht. Der Plan zeigt, wie die Schüsse jeder Distanz in Serien von höchstens drei aufgeteilt werden.

Unter dem Feld schlägt das Werkzeug vier Schusszahlen für dieses Gelände und Ihre Vorbereitung vor, jede mit der Note, die sie ergibt:

- **Minimal**: die wenigsten Schüsse, die bis auf 10 % an die optimale Unsicherheit des Luftwiderstands herankommen;
- **Optimal**: der Punkt, ab dem weitere Schüsse deutlich weniger bringen;
- **Erweitert**: zehn mehr als optimal, für ein spürbar engeres Ergebnis;
- **Deluxe**: zwanzig mehr als optimal, für das engste Ergebnis.

Ein Druck darauf erstellt den Plan für diese Zahl. Es sind Mindestwerte, die nur Schüsse zählen, deren Einschlag Sie sehen; nehmen Sie also mehr mit. Jede Verbesserung, die das Werkzeug vorschlägt (ein Chronograph, mehr Schüsse, eine Nullpunktkontrolle, ein weiter entferntes Ziel), wird mit dem Ergebnis, das sie brächte, neben dem aktuellen gezeigt.

### 3.5 Das ferne Ziel neu anmessen

Vor dem Start bittet Sie das Werkzeug, das ferne Ziel noch einmal zu messen. Messen Sie es mehrmals mit dem Entfernungsmesser an und prüfen Sie, dass der Strahl nicht etwas vor dem Ziel erfasst. Ist das Gelände nicht als flach erklärt, messen Sie auch seinen Winkel mit einem Neigungsmesser.

Das ist die wichtigste Minute der Sitzung. Das Ergebnis hängt von der fernen Distanz mehr ab als von allem anderen, und die Schüsse können sie kaum prüfen, denn ein Ziel, das weiter entfernt ist als gedacht, sieht genau aus wie ein Geschoss mit niedrigerem BC. Eine um 20 m falsche ferne Distanz lässt das Ergebnis an diesem Ziel typischerweise um etwa 0,3 mrad danebenliegen, auf 1000 m etwa 30 cm, und das Werkzeug kann das nicht erkennen.

Verwenden Sie einen Kugelfang von mindestens 2 m Höhe (1 m über und unter dem Haltepunkt). Bei 1 m verliert etwa jede dritte Sitzung einen Einschlag daneben, bei 2 m nur einige von hundert.

---

## 4. Schießen

### 4.1 Die Leiter

Das Werkzeug beginnt nah und geht Schritt für Schritt weiter, jeweils erst, nachdem der vorherige Schritt im Kugelfang gelandet ist. Eine falsche Annahme in der App könnte einen ersten weiten Schuss weit an einem entfernten Kugelfang vorbeischicken, und die Leiter vermeidet dieses Risiko. Ein Schritt geht höchstens auf das Vierfache der weitesten Distanz, auf der schon eine Gruppe gelandet ist. Ein längerer Schritt ist nur erlaubt, wenn nichts Näheres übrig ist und die Vorhersage sagt, dass der Schuss noch im Kugelfang landet. Vor dem allerersten Schuss warnt das Werkzeug, wenn dieser Schuss den Kugelfang verfehlen könnte, und bietet stattdessen die Nullpunktdistanz an. Sie können trotzdem weitermachen.

Sehen Sie nicht, wo eine Serie eingeschlagen hat, drücken Sie die Taste dafür („Ich sehe nicht, wo es eingeschlagen ist“). Das ist ein normales Ergebnis und eine nützliche Information. Das Werkzeug geht etwa auf halbe Strecke zurück und versucht die verfehlte Distanz erneut mit der korrigierten Höhe, sobald dort eine Gruppe gelandet ist. Solange darunter noch unversuchte Distanzen übrig sind, bleibt eine erneut verfehlte Distanz im Spiel (bis zu fünf Fehlschüsse dort). Lässt sich nichts Näheres schießen, gibt eine zusätzliche Gruppe auf einer Distanz, die schon getroffen wurde, den neuen Versuch frei. Ein Fehlschuss so weit draußen, dass ihn nur ein grob falscher BC erklären kann, lässt die Leiter auf dem Weg zum fernen Ziel einen Fehler dieser Größe zu. Auf 800 m bei 2 m Kugelfang müsste der BC einer .308 dafür um etwa 20 % danebenliegen. Nähere Fehlschüsse werden anderen Ursachen zugeschrieben. Wiederholen sich Fehlschüsse, prüfen Sie zuerst, ob BC und Widerstandsmodell der Patrone mit der veröffentlichten Quelle übereinstimmen, dann den Nullpunkt, die Mündungsgeschwindigkeit und den eingegebenen Druck.

Liegt die nächste geplante Distanz mehr als viermal so weit wie die weiteste getroffene, oder ist der Kugelfang dafür zu klein, sagt das Werkzeug, was davon zutrifft. Nur dann fragt es nach einer Zwischendistanz; eine natürliche Marke zählt, und Sie können „Keines verfügbar“ antworten. Auf einem Standort ohne Zwischengelände kann die Leiter vor dem fernen Ziel stehen bleiben, und die Seite „Vorbereiten“ warnt Sie vorher davor.

### 4.2 Jede Serie

Sie schießen Serien von höchstens drei Schuss und erfassen nach jeder, denn niemand kann die Mitte eines Dutzends Einschläge auf 800 m zuverlässig ablesen. Der erste Durchgang besucht jede geplante Distanz einmal, die nächste zuerst. Danach geht jede Serie an die Distanz mit den meisten verbleibenden Schüssen (bei Gleichstand an die weitere), und jede wird nach der neuesten Anpassung eingestellt. Die Reihenfolge können Sie nicht wählen.

Vor jeder Serie zeigt das Werkzeug, was einzustellen ist, Höhe und Seite, in der Einheit und mit den Richtungsvorzeichen, die für den Feldrechner gewählt sind, mit einem 95-%-Band. Bevor etwas erfasst ist, ist das die Vorhersage der App selbst; danach stammt sie aus der Anpassung. Stellen Sie sie vollständig ein. Erfassen Sie dann die **Höhenkorrektur, die die Einschläge auf den Haltepunkt bringen würde**: was Sie eingestellt haben, korrigiert um die Lage der Einschläge im Absehen. Geben Sie die ganze Höhenkorrektur ein, nicht nur die Abweichung von der Zahl des Werkzeugs. Höhenkorrekturen werden in Klicks des Zielfernrohrs eingegeben (positiv ist hoch). Alle anderen Distanzen, Geschwindigkeiten und Winkel folgen Ihren Einheiten in den Einstellungen, und die Einstellanzeige zeigt zusätzlich Klicks, wenn der Feldrechner auf mrad oder MOA steht.

Sie können eine Serie als ihre Mitte (eine Höhenkorrektur) oder Schuss für Schuss erfassen (eine Höhenkorrektur pro Schuss und, mit Chronograph, seine Geschwindigkeit). Liefert der Chronograph weniger Geschwindigkeiten als Schüsse, fragt das Werkzeug, ob Sie sie ergänzen oder weitermachen wollen. Das Werkzeug sortiert keine Ausreißer aus: Ist ein Schuss ein offensichtlicher Ausreißer (ein klarer Verreißer, eine Böe, ein schlechter Abzug), erfassen Sie ihn nicht und schießen Sie einen Ersatz. Dafür sind die zusätzlichen 20–25 % da. Ein Wert, der vernünftigerweise nicht stimmen kann, bekommt eine Warnung neben dem Feld: mrad statt Klicks eingegeben, die Differenz statt der ganzen Höhenkorrektur, ein falsches Vorzeichen, eine fehlende Ziffer, eine Geschwindigkeit in der falschen Einheit. Die Warnung ist nur ein Hinweis, und der Wert wird wie eingegeben erfasst.

Für jede Serie geben Sie außerdem an, wie gut Sie die Einschläge im Absehen ablesen konnten:

- **Gut** (±0,1 mrad, Standard): klare Einschläge, am Absehen abgelesen.
- **Mittel** (±0,2 mrad): Luftflimmern, ein unruhiger Kugelfang oder nur halb gesehene Einschläge.
- **Schlecht** (±0,3 mrad): eine grobe Vorstellung, wo sie gelandet sind.

Seien Sie dabei ehrlich. Ein ehrliches „Schlecht“ hilft der Anpassung mehr als eine selbstsichere Schätzung.

### 4.3 Wind und Luft

Jede Gruppe hat ihren eigenen Wind, eingestellt am Windregler. Er beginnt mit dem Wind der vorherigen Gruppe (Windstille für die erste). Die Einstellanzeige für den nächsten Schuss folgt dem Regler, während Sie ihn drehen. **Stellen Sie vor dem Erfassen einer Gruppe den Wind (Stärke und Richtung) ein, der zur tatsächlich beobachteten Seitenabweichung passt.** Das Werkzeug sagt die Seitenkorrektur aus dem eingestellten Wind voraus, lernt aber nichts daraus, wo Einschläge seitlich liegen.

Zum Wind geben Sie an, wie gut Sie ihn lesen: Ausgezeichnet (±0,5 m/s), Gut (±1), Mäßig (±2) oder Schlecht (±3). Die Richtung behandelt das Werkzeug immer als auf 7,5° unsicher. Wind und Sicherheit gehen auf die nächste Gruppe über, bis Sie sie ändern.

Ändert sich die Luft während der Sitzung, haken Sie an, dass sie sich geändert hat, und geben Sie ein, was Ihr Taschen-Wettermesser anzeigt. Spätere Gruppen behalten die neuen Werte, bis Sie sie wieder ändern. Die Chronographen-Messwerte jeder Gruppe werden mit der Geschwindigkeit verglichen, die die Patrone in der Luft dieser Gruppe hat.

### 4.4 Neu anmessen während der Sitzung

Vermutet das Werkzeug, dass Distanz oder Winkel eines Ziels nicht stimmen, bittet es Sie, das Ziel neu anzumessen und, sofern das Gelände nicht flach ist, seinen Winkel zu messen. Eine falsche Distanz und eine nicht gemessene Neigung sehen in den Schüssen gleich aus; nur der Winkel trennt sie. Das Werkzeug fragt, sobald die Wahrscheinlichkeit, dass etwas nicht stimmt, bei etwa eins zu fünf liegt, denn Neu-Anmessen dauert Sekunden, und ein falsch angemessenes Ziel ist der Fehler, den die Schüsse am wenigsten von einem falschen Luftwiderstand unterscheiden können.

Vor Ihrer ersten Serie auf das geplante ferne Ziel fragt es immer nach dieser Kontrolle. Sie können sie auch jederzeit selbst auslösen, mit „Neu messen“ neben Distanz und Winkel des aktuellen Ziels. „Bestätigen“ korrigiert jede dort bereits geschossene Serie und die Einstellung für die nächste. „Abbrechen“ lässt alles unverändert.

### 4.5 Die Live-Anzeige

Nach jeder Gruppe zeigt das Werkzeug, was es bisher gelernt hat. Die Anzeige ist vorläufig, eine spätere Gruppe kann sie ändern, deshalb wird sie anders dargestellt als der Abschlussbericht. Solange kein Chronographen-Messwert oder gut platzierter Schuss die beiden trennt, zeigt sie „Mündungsgeschwindigkeit, Luftwiderstand — bisher noch nicht trennbar“, statt zu raten.

---

## 5. Abschluss

Das Ergebnis ist eine geordnete Liste von Befunden, kein einzelnes Urteil. Jeder Befund zeigt, wie wahrscheinlich er auf Ihrer längsten Einsatzdistanz zählt und wie groß er ist, mit seinem Spielraum. Lassen sich zwei Ursachen nicht trennen, werden sie gemeinsam gemeldet.

- **Luftwiderstand (BC).** Bei Note A oder B und mindestens fünf Chronographen-Messwerten aus der Sitzung bietet das Werkzeug an, die Korrektur in Ihrer Patrone zu speichern (§2.3 sagt, wie weit man einer B trauen kann). Vor dem Bestätigen sehen Sie die Werte vor und nach der Änderung. Ein Ergebnis, das mehr als etwa 12 % vom verwendeten BC abweicht, oder ein Verstärkungsfaktor außerhalb von 0,8–1,2 wird nie angeboten. Das Werkzeug bittet Sie dann, BC und Widerstandsmodell zu prüfen, und zeigt den angepassten BC zur Information.
- **Nullpunkt.** Eine Nullpunktkorrektur wird nur gemeldet, wenn sie sehr wahrscheinlich zählt. Zählt sie nur vielleicht, sehen Sie „möglich, aber noch nicht klar“; ändern Sie Ihren Nullpunkt nicht allein deshalb.
- **Höhenkorrekturen für die geschossenen Distanzen.** Wird keine BC-Korrektur angeboten, erhalten Sie für jede geschossene Distanz die Änderung der Einstellung, aber nur, wenn die Änderung größer ist als ihre eigene Unsicherheit. Eine kleinere Korrektur ist nur das Rauschen weniger Gruppen, und sie anzuwenden kann Sie schlechter stellen als vorher.
- **Mündungsgeschwindigkeit.** Sobald der Chronograph seinen ersten Messwert geliefert hat, haben die Messwerte der Sitzung Vorrang vor dem vorher geprüften Mittelwert. Dieser Mittelwert wurde an einem anderen Tag gemessen, vielleicht bei anderem Wetter oder mit einem anderen Los. Weicht die gemessene Geschwindigkeit von der der Patrone ab, sagt die Liste, wie viele Schuss Sie mit dem Chronographen messen sollten, um den Mittelwert auf etwa ±2 m/s festzulegen.
- **Nicht bestimmt.** Eine Ursache, die die Sitzung nicht messen konnte, wird als „von dieser Sitzung nicht bestimmt“ geführt, nie als unauffällig. Der Klick-Wert ist das übliche Beispiel: Nur ein Tall-Target- oder Lineal-Test klärt ihn.

Die Liste wiederholt auch die Vorbereitungspunkte, die Sie abgehakt haben, als Erinnerung daran, dass die Bänder voraussetzen, dass jeder davon wirklich erledigt wurde.

„Neue Sitzung beginnen“ löscht die Sitzung und behält Ihre Vorgabe-Auswahl.

### 5.1 Ein unplausibles Ergebnis

Eine Luftwiderstandskorrektur von mehreren zehn Prozent oder eine Geschwindigkeit, die um Hunderte Meter pro Sekunde danebenliegt, ist kein subtiler Befund. Sie bedeutet, dass etwas Grundlegenderes nicht stimmt, meist ein unplausibler BC beim Geschoss oder das falsche Widerstandsmodell (G1 eingetragen für einen gegen G7 gemessenen BC oder umgekehrt). Prüfen Sie BC und Modell der Patrone an der veröffentlichten Quelle, bevor Sie irgendetwas anderem aus der Sitzung trauen. Eine Sitzung, die den Kugelfang auf mehreren Distanzen immer wieder verfehlt hat, deutet auf dasselbe Problem.

---

## 6. Der BC-Verstärkungsfaktor

Eine eingeschossene Luftwiderstandskorrektur wird in der **Patrone** als „BC-Verstärkungsfaktor“ gespeichert, standardmäßig 1,00. Ein Faktor von 1,05 bedeutet, dass sich das Geschoss verhält, als wäre sein veröffentlichter BC 5 % höher (weniger Luftwiderstand, gestrecktere Flugbahn); 0,95 bedeutet das Gegenteil. Er gehört zur Patrone und nicht zum Geschoss, weil dasselbe Geschoss aus einem anderen Gewehr bei anderer Geschwindigkeit einen leicht anderen Luftwiderstand hat. Die veröffentlichten Daten des Geschosses bleiben unverändert.

Einmal gespeichert, verwendet jedes Werkzeug der App (Flugbahn, Feldrechner, Trefferwahrscheinlichkeit und dieses) den korrigierten Wert. Wird eine Patrone ein zweites Mal eingeschossen, wird die neue Korrektur mit der ersten multipliziert, statt sie zu ersetzen, und die zweite Sitzung beginnt mit derselben Annahme von 4 % wie die erste.

---

## 7. Datenschutz

Alles läuft und bleibt auf Ihrem Gerät, wie der Rest der App: kein Konto, kein Upload, keine Telemetrie. Die Sitzung wird im lokalen Speicher Ihres Browsers gehalten. Das Werkzeug schreibt nur dann anderswohin, wenn Sie es wählen: einen BC-Verstärkungsfaktor oder eine neue Geschwindigkeitsstreuung in Ihre eigene Patrone. Eine während einer Sitzung korrigierte Distanz oder ein korrigierter Winkel wird nie in den Standort geschrieben.

---

## 8. Freude des Nerds: Modell, Statistik und Schutzmechanismen

Dieser Abschnitt beschreibt, was das Werkzeug berechnet, warum es so rechnet und woher die Zahlen kommen. Für die Bedienung brauchen Sie ihn nicht. Die Einheiten sind die der Rechenmaschine: Meter, Meter pro Sekunde, Milliradiant. Die Beispielzahlen gelten für eine Referenz-.308: G7-BC 0,2623, 792 m/s, 50 mm Visierhöhe, 100 m Nullpunkt, ICAO-Luft auf Meereshöhe. Bei dieser Laborierung fällt das Geschoss bei etwa 870 m auf Mach 1,1.

### 8.1 Die Messgröße und das Modell

Das Einzige, was das Werkzeug am Ziel misst, ist die **Höhenkorrektur**: die Höhe in mrad, die die Mitte einer Serie auf den Haltepunkt bringt. Die Seitenkorrektur wird aus dem eingestellten Wind vorhergesagt und angezeigt, geht aber nicht in die Anpassung ein. Eine seitliche Abweichung trägt den ganzen Fehler der Windeinschätzung, und der ist weit größer als alles, was sie über die vier Ursachen unten verraten könnte.

Eine Höhenkorrektur auf der angenommenen Distanz $R$ am Ziel $t$ wird modelliert als

$$c(R) = c_\text{app}\big(R + \Delta R_t;\; v_0 + \delta v,\; G\,/\,(1 + \delta d/100),\; \alpha_t\big) \;+\; z \;+\; \tfrac{\tau}{100}\,c_\text{app}(R) \;+\; \varepsilon$$

wobei $c_\text{app}$ die eigene Flugbahnlösung der App ist (derselbe Integrator, den jedes andere Werkzeug verwendet), in Luft und Wind dieser Gruppe. Die Terme sind:

| Symbol | Name in der Rechenmaschine | Was es ist | Geht ein als |
|---|---|---|---|
| $z$ | `zeroMrad` | Nullpunktversatz | Konstante, auf jeder Distanz addiert |
| $\delta v$ | `v0Ms` | Fehler der Mündungsgeschwindigkeit, m/s | in der Physik zu $v_0$ addiert |
| $\delta d$ | `dragPct` | Luftwiderstands-Faktor, % | teilt in der Physik den BC-Verstärkungsfaktor $G$ |
| $\tau$ | `trackPct` | Fehler des Klick-Werts, % | proportional zur Höhenkorrektur |
| $\Delta R_t$ | `rangeErrM_t` | Distanzfehler von Ziel $t$, m | pro Ziel, nur in der Fehlerprüfung (§8.9) |
| $u_t$ | `losU_t` | nicht erfasste Neigung von Ziel $t$, $u = 1-\cos\alpha$ | pro Ziel, nur in der Fehlerprüfung |
| $\varepsilon$ | | Rauschen der Serie | normalverteilt, $\sigma$ aus §8.4 |

$\delta d > 0$ bedeutet mehr Luftwiderstand, als der verwendete BC vorhersagt. Beim Speichern wird der Verstärkungsfaktor der Patrone mit $1/(1+\delta d/100)$ multipliziert, sodass ein zweites Einschießen auf dem ersten aufbaut. Der Luftwiderstands-Faktor wirkt über den Verstärkungsfaktor und nicht über `bc` selbst, weil 247 der 385 Geschosse in der Bibliothek Cd-Mach-Tabellen sind und kein `bc` zum Skalieren haben.

$\delta v$ und $\delta d$ sind nichtlinear und wirken innerhalb der Flugbahn. $z$ und $\tau$ werden danach addiert. Visierhöhe, Luftdichte und Wind werden nicht angepasst. Sie sind Eingaben, und ein Fehler in einer davon landet in den vier Ursachen, wie §8.2 zeigt.

Der Nullpunkt ist ein einziger Laufwinkel für die ganze Sitzung. Er wird einmal berechnet, waagerecht und bei Windstille, in der Nullpunkt-Atmosphäre der Patrone, mit den angepassten $\delta v$ und $\delta d$, sodass eine Änderung an einem davon den Nullpunkt genau so verschiebt wie am Gewehr. Wind, Neigung und Luft einer Gruppe zeigen sich dann in ihrer Höhenkorrektur und verschieben den Nullpunkt nicht.

### 8.2 Warum die Ursachen so schwer zu trennen sind

Die Anpassung wird um die aktuelle Schätzung linearisiert. Der Einfluss jeder Ursache auf eine Höhenkorrektur ist eine Spalte der Jacobi-Matrix, die Änderung der Höhenkorrektur pro Einheit dieser Ursache auf jeder Distanz. Für die Referenz-.308:

| Distanz | Höhenkorrektur | pro m/s von $v_0$ | pro % Luftwiderstand | pro % Klick | pro m Distanz | pro m/s Wind (beliebige Richtung) |
|---|---|---|---|---|---|---|
| 200 m | 0,66 | −0,0024 | 0,0014 | 0,0066 | 0,0084 | 0,0003 |
| 300 m | 1,58 | −0,0050 | 0,0041 | 0,0158 | 0,0101 | 0,0007 |
| 400 m | 2,66 | −0,0081 | 0,0084 | 0,0266 | 0,0116 | 0,0015 |
| 500 m | 3,89 | −0,0116 | 0,0150 | 0,0389 | 0,0132 | 0,0028 |
| 600 m | 5,29 | −0,0157 | 0,0244 | 0,0529 | 0,0150 | 0,0048 |
| 700 m | 6,88 | −0,0205 | 0,0377 | 0,0687 | 0,0171 | 0,0076 |
| 800 m | 8,69 | −0,0262 | 0,0562 | 0,0869 | 0,0196 | 0,0116 |
| 900 m | 10,78 | −0,0331 | 0,0816 | 0,1078 | 0,0226 | 0,0174 |

(alles in mrad; die Spalte des Nullpunkts ist überall 1)

Zwei Spalten lassen sich nur so weit trennen, wie sich ihre **Form** über die geschossenen Distanzen unterscheidet. Ihre Größe spielt keine Rolle, da ein Parameter immer passend skalieren kann. Das misst der Kosinus zwischen zwei Spalten: ±1 bedeutet, dass sie bis auf einen Faktor gleich sind. Über 300, 600 und 800 m:

- Geschwindigkeit gegen Luftwiderstand: **−0,987**;
- Klick-Wert gegen Luftwiderstand: **0,987**;
- Klick-Wert gegen Geschwindigkeit: **−0,99993**;
- Nullpunkt gegen Luftwiderstand: 0,80.

Klick-Wert und Geschwindigkeit sind fast vollkommen kollinear. Ein Klickfehler von 1 % und ein Geschwindigkeitsfehler mit derselben Höhenkorrektur sind praktisch dieselbe Kurve. Deshalb meldet die Sitzung den Klick-Wert als „nicht bestimmt“ und überlässt ihn einem Tall-Target-Test. Die Vorannahme von 0,15 % nach einem solchen Test verhindert, dass er aufsaugt, was Geschwindigkeit und Luftwiderstand nicht erklären.

Geschwindigkeit und Luftwiderstand unterscheiden sich nur wenig, und zwar auf bekannte Weise: Die Spalte des Luftwiderstands wächst mit der Distanz schneller als die der Geschwindigkeit, weil der Luftwiderstand während der ganzen Flugzeit wirkt, ein Geschwindigkeitsfehler dagegen vor allem über den Anfang. Der Geschwindigkeitsfehler, der 1 % Luftwiderstand nachahmt, beträgt 0,6 m/s auf 200 m, 1,0 m/s auf 400 m, 1,6 m/s auf 600 m und 2,1 m/s auf 800 m. Nur dieses sich ändernde Verhältnis trennt die beiden, und es ist klein. Deshalb braucht ein Plan ein weit entferntes Ziel, deshalb helfen mehr Schüsse auf einer Distanz nicht, und deshalb ist ein Chronograph, der $\delta v$ direkt festlegt, der stärkste einzelne Hebel.

Der Nullpunkt ist eine Konstante, deshalb misst ihn ein nahes Ziel auf der Nullpunktdistanz, wo jede andere Spalte null ist, fast allein. Darum enthält der Plan immer einen Schuss nahe der Nullpunktdistanz.

Auch jede Eingabe, die Sie liefern, landet in diesen vier Ursachen. Ausgedrückt als die Änderung des Luftwiderstands, die auf dieser Distanz dieselbe Höhenkorrektur ergäbe:

| Eingabefehler | auf 300 m | auf 600 m | auf 800 m |
|---|---|---|---|
| Geschwindigkeit +10 m/s | −12,2 % | −6,3 % | −4,6 % |
| Klick-Wert 2 % | 7,7 % | 4,3 % | 3,1 % |
| Nullpunkt 0,1 mrad | 24,5 % | 4,1 % | 1,8 % |
| Visierhöhe +3 mm | −4,9 % | −1,0 % | −0,5 % |
| Distanz +20 m | 49,9 % | 12,4 % | 7,0 % |
| 10° Neigung nicht eingetragen | −9,8 % | −3,7 % | −2,4 % |
| Temperatur +3 °C | −0,9 % | −0,9 % | −0,9 % |
| Druck +10 hPa | 1,0 % | 1,0 % | 1,0 % |

Die letzten beiden Zeilen sind nicht zufällig konstant. Die Widerstandskraft ist proportional zur Luftdichte, deshalb ist ein Fehler von 1 % in der Dichte *genau* ein Fehler von 1 % im Luftwiderstand, auf jeder Distanz (bis auf eine kleine Wirkung über die Schallgeschwindigkeit). Die Sitzung kann eine falsche Temperatur oder einen falschen Druck überhaupt nicht erkennen und gibt sie direkt an den BC weiter. Deshalb besteht das Werkzeug auf dem Stationsdruck und warnt vor QNH (§8.12), und deshalb erinnert die Seite „Abschluss“ daran, dass die BC-Korrektur die eingegebene Luft voraussetzt.

Die Zeile zur Distanz erklärt §3.5. Auf 800 m entsprechen 20 m Distanzfehler 7 % Luftwiderstand, mehr als die ganze Vorannahme. Nur ein zweites Ziel in der Nähe könnte das bemerken, und selbst dann nicht zuverlässig.

### 8.3 Vorannahmen (Priors)

Die Anpassung ist bayessch: Jede Ursache beginnt mit einer normalverteilten Vorannahme mit Mittelwert null, und die Schüsse grenzen sie ein.

| Ursache | Ungeprüft | Nach der Vorbereitung |
|---|---|---|
| Nullpunkt | 0,25 mrad | 0,08 mrad (Nullpunkt erneut geprüft) |
| Geschwindigkeit | 20 m/s | $t_{N-1}\cdot \text{SD}/\sqrt{10}$ (Mittelwert geprüft) |
| Luftwiderstand | 4,1 % | 4,1 % |
| Klick-Wert | 1 % | 0,15 % (Tall-Target-Test) |

**Luftwiderstand.** Zwei unabhängige Anteile werden quadratisch addiert. Veröffentlichte G7-BCs weichen von dem BC, der die Referenz-Widerstandskurve des jeweiligen Geschosses am besten wiedergibt, um 3,6 % RMS ab (56 Geschosse von drei Herstellern). Dasselbe Geschoss, auf dieselbe Weise gemessen, schwankt von Lauf zu Lauf um etwa 1,9 %. $\sqrt{3.6^2+1.9^2}\approx 4.1\,\%$. Verwendet wird der RMS und nicht die Standardabweichung, sodass die mittlere Abweichung jedes Herstellers als Streuung zählt, statt als bekannte Verzerrung behauptet zu werden. Die Stichprobe ist zu klein, um etwas über die Form der Verteilung zu sagen. Eine daran angepasste Mischung aus „typischen“ und „ausreißenden“ BCs lieferte zu selbstsichere Bänder, wann immer die wahren Fehler normalverteilt waren, deshalb ist die Vorannahme eine einzige Normalverteilung, deren Breite aus den Daten stammt. Mit richtiger Varianz und einem nahezu linearen Modell hält eine normale Vorannahme die angegebenen Bänder ehrlich, wie auch immer die wahre Form aussieht. Eine bereits eingeschossene Patrone beginnt mit derselben Vorannahme, denn ein Verstärkungsfaktor ist eine Korrektur und keine Messung, die verlässlicher wäre als der veröffentlichte Wert.

**Geschwindigkeit.** Ein geprüfter Mittelwert gilt als zehn Schuss bei der erfassten Streuung der Patrone. Die erfasste Standardabweichung ist selbst eine Schätzung, deshalb wird der Standardfehler um den Student-t-Faktor $t_{0.975,N-1}/z_{0.975}$ erweitert, wobei $N$ die Zahl der Schüsse hinter der Standardabweichung ist: Sie geben sie ein, oder für eine in Arsenal gespeicherte Standardabweichung werden 10 angenommen. Der Faktor beträgt 1,15 bei $N=10$ und 1,42 bei $N=5$. Eine Vorgabe-Standardabweichung wird nicht erweitert, denn ihre Unsicherheit betrifft die Frage, ob sie überhaupt auf Ihr Gewehr zutrifft, und das deckt die Statistik kleiner Stichproben nicht ab. Bei einer Standardabweichung von 6 m/s und $N=10$ beträgt die Vorannahme 2,2 m/s.

**Klick-Wert.** Ein getesteter Klick-Wert wird mit seiner Vorannahme von 0,15 % trotzdem angepasst, aber nicht gemeldet. Ließe man ihn aus der Anpassung weg, landete jeder verbleibende Verstellfehler im Luftwiderstand: In einer Monte-Carlo-Simulation ganzer Sitzungen verfehlte das 95-%-Band des Luftwiderstands die Wahrheit dann um etwa ein Drittel Prozentpunkt häufiger. Mit angepasstem Klick-Wert verfehlte das Band sie in 5,0 % der Fälle.

### 8.4 Rauschen

Das vertikale $\sigma$ eines Schusses hat drei unabhängige Anteile:

$$\sigma_\text{round}^2 = \left(\frac{R_{50}}{1.1774}\right)^2 + \left(\frac{\partial c}{\partial v_0}\,\text{SD}_v\right)^2 + \sigma_\text{read}^2$$

die Streuung des Gewehrs (R50 umgerechnet in ein $\sigma$ pro Achse), die Geschwindigkeitsstreuung von Schuss zu Schuss mal der Empfindlichkeit der Höhenkorrektur gegenüber der Geschwindigkeit auf dieser Distanz, und das Ablesen. Der Geschwindigkeitsanteil ist auf der Nullpunktdistanz null und beträgt auf 800 m bei 6 m/s Streuung 0,16 mrad, nahe am σ pro Achse eines Gewehrs mit R50 = 0,25 mrad (0,21 mrad). Die Stufen der Ablese-Sicherheit sind halbe Breiten eines 95-%-Intervalls, deshalb ist $\sigma_\text{read}$ 0,05, 0,1 oder 0,15 mrad.

Eine Serie von $n$ Schuss liest ihren Mittelwert. Ihr Windfehler kommt hinzu:

$$\sigma_\text{string}^2 = \frac{\sigma_\text{round}^2}{n} + \sigma_\text{wind}^2, \qquad \sigma_\text{wind}^2 = \left(\frac{\partial c}{\partial w}\,\sigma_w\right)^2 + \left(\frac{\partial c}{\partial \phi}\,\sigma_\phi\right)^2$$

mit $\sigma_w$ der angegebenen Sicherheit beim Wind (0,5, 1, 2 oder 3 m/s), $\sigma_\phi = 7.5°$ und beiden Ableitungen als finite Differenzen um den eingestellten Wind. Unter 0,5 m/s bedeutet eine Richtung nichts, deshalb ist die Empfindlichkeit dann der RMS der Empfindlichkeiten für Gegen- und Seitenwind, angewandt auf den ganzen Fehler der Windstärke. Der Windfehler gehört zur Serie: Er schrumpft nicht mit ihren Schüssen, und die Fehler verschiedener Serien sind unabhängig. In der Anpassung gibt es keine gemeinsame Wind-Unbekannte. Wind ist eine Störgröße, keine Ursache.

Serien sind auf drei Schuss begrenzt, weil ein Beobachter die Mitte von mehr Einschlägen auf Distanz viel schlechter abliest, als $1/\sqrt n$ verspricht. Die Serien einer Distanz lesen sich zusammen wie eine Serie aller ihrer Schüsse, nur dass der Windterm mit der Zahl der Serien fällt. Der Planer verteilt deshalb Schüsse pro Distanz, und die Serien bestimmen nur, wie sie abgegeben werden.

Bevor ein Wind gelesen wurde, verwendet der Plan die erwartete Stärke: mäßig ist 3 ± 1 m/s, stark ist 7 ± 2 m/s, Richtung unbekannt. Dann gilt $\sigma_\text{wind} = W_\text{rms}\sqrt{\sigma_w^2 + (w\,\sigma_\phi)^2}$, mit $W_\text{rms}$ der richtungsunabhängigen Spalte aus §8.2.

**Die Geschwindigkeitsstreuung selbst.** Die Standardabweichung in diesen Gewichten ist nicht einfach die erfasste. Ab dem zweiten Chronographen-Messwert wird sie mit der heutigen Streuung nach Freiheitsgraden gepoolt:

$$\hat\sigma_v^2 = \frac{(N_0-1)\,\text{SD}_0^2 + (n-1)\,s^2}{N_0+n-2}$$

$N_0$ ist die angegebene Schusszahl, oder 5, wenn keine angegeben ist. Der gepoolte Wert zählt als $N_0+n-1$ Schuss. Jeder Messwert wird zuerst mit der Geschwindigkeit der Patrone in der Luft seiner Gruppe verglichen, und der mittlere Versatz wird abgezogen, sodass eine Wetteränderung oder ein falscher Mittelwert nicht als Streuung zählt. Bereits erfasste Serien werden mit jedem neuen Wert neu gewichtet. Bei mehr als zehn Messwerten entscheidet ein zweiseitiger F-Test auf 5 % ($s^2/\text{SD}_0^2$ gegen $F_{n-1,\,N_0-1}$), ob die heutige Streuung wirklich abweicht. Wenn ja, sagt das Werkzeug es und bietet an, die Patrone zu aktualisieren. Der F-Test steuert nur diesen Hinweis. Das Pooling läuft in jedem Fall und ändert nichts, wenn die erfasste Standardabweichung stimmt.

### 8.5 Der Chronograph

Die Messwerte jeder Gruppe bilden eine direkte Beobachtung von $\delta v$. Das Residuum ist (mittlerer Messwert − Geschwindigkeit der Patrone in der Luft dieser Gruppe), und sein $\sigma$ ist $t_{0.975,N-1}/z\cdot\hat\sigma_v/\sqrt n$, dieselbe Form wie bei der Vorannahme der Geschwindigkeit. Ein Schuss, den das Gerät verpasst hat, ist einfach ein Messwert weniger.

Ab dem ersten Messwert ersetzen die Messwerte der Sitzung den geprüften Mittelwert als Information über die Geschwindigkeit. Der Mittelwert wurde bei anderer Gelegenheit gemessen und kann bei einem temperaturempfindlichen Pulver oder einem anderen Los falsch sein. Die Messwerte tragen ihre eigene Unsicherheit, die bei einem oder zwei Messwerten groß ist. Schwellen von einem bis fünf Messwerten wurden verglichen, mit einem Chronographen, der die meisten Schüsse verpasste. Ein Messwert hinterließ den kleinsten Fehler, wann immer der geprüfte Mittelwert falsch war, und kostete höchstens ein Tausendstel mrad, wenn er stimmte. Dieselbe Information wird nie doppelt gezählt, als engere Vorannahme und zugleich als Beobachtung.

### 8.6 Die Anpassung

Die Schätzung ist der Maximum-a-posteriori-Punkt (MAP) von

$$-\log p(\theta\mid y) = \tfrac12\sum_k \frac{r_k(\theta)^2}{\sigma_k^2} + \tfrac12\sum_i\frac{\theta_i^2}{\sigma_{0,i}^2} + \text{const}$$

gefunden mit Gauß-Newton. Jede Iteration linearisiert die Physik am aktuellen $\theta$ neu, bildet $A = P_0 + J^\top W J$ und $b = J^\top W r - P_0\theta$ und geht um $A^{-1}b$ weiter. Sie endet, wenn jeder Schritt unter 1 % der Vorannahme-Standardabweichung der jeweiligen Ursache liegt, oder nach fünf Iterationen. Die Kovarianz $\Sigma = A^{-1}$ stammt aus einer letzten Linearisierung an der Lösung, die ohne Zusatzkosten auch einen weiteren Newton-Schritt liefert. Ihn anzuwenden macht das Ergebnis weit genauer als die Abbruchtoleranz, ob die Iteration kalt oder warm begann.

Nach jeder Gruppe ist die Lösung der vorherigen Analyse der Startpunkt (Warmstart). Er bekommt zwei Iterationen. Ist er bis dahin nicht konvergiert, beginnt die Anpassung neu bei null, sodass das Ergebnis nie vom Startwert abhängt.

Das Residuum einer Chronographen- oder Neu-Anmessungs-Zeile wird wie jedes andere neu linearisiert: $r = (\bar v - v_\text{expected}) - \delta v_\text{current}$. Mit dem rohen Residuum in jeder Iteration käme bei jedem Durchgang dieselbe Korrektur noch einmal hinzu. Weicht der Chronograph stark vom erfassten Wert ab, etwa bei zwei Sitzungen desselben Gewehrs mit rund 20 °C Unterschied, divergiert das auf ein Mehrfaches des richtigen Werts.

Die Spalte des Luftwiderstands ist eine zentrale Differenz über ±1 %. Die Höhenkorrektur ist im Luftwiderstands-Faktor gekrümmt, deshalb läse ein einseitiger Schritt von +5 % auf 800 m eine um 2,7 % steilere Steigung als die lokale, und die Anpassung würde den Luftwiderstand enger angeben, als sie ihn kennt: In einer Monte-Carlo-Simulation ganzer Sitzungen verfehlte ihr 95-%-Band die Wahrheit mit dem einseitigen Schritt in 5,7 % der Fälle, mit dem zentralen in 5,2 %.

### 8.7 Was eine Sitzung auflösen kann

Ergebnisse des Planers für die Referenz-.308 (R50 0,25 mrad, Geschwindigkeitsstreuung 6 m/s, mäßiger Wind). Die Zahlen sind die Posterior-Standardabweichung des Luftwiderstands-Faktors mit der Note:

| Gelände | Vorbereitung | Chronograph | 12 Schuss | 20 Schuss | 30 Schuss | 40 Schuss |
|---|---|---|---|---|---|---|
| 100/300/600 m | keine | nein | 3,88 C | 3,85 C | 3,83 C | 3,82 C |
| 100/300/600 m | keine | ja | 3,43 C | 3,22 C | 3,01 C | 2,85 B |
| 100/300/600 m | alle | ja | 3,01 C | 2,81 B | 2,62 B | 2,46 B |
| 100/300/500/800 m | keine | nein | 3,68 C | 3,66 C | 3,64 C | 3,63 C |
| 100/300/500/800 m | Nullpunkt + Klicks | nein | 3,65 C | 3,48 C | 3,37 C | 3,29 C |
| 100/300/500/800 m | keine | ja | 2,49 B | 2,18 B | 1,98 A | 1,86 A |
| 100/300/500/800 m | alle, Mittelwert geprüft | nein | 1,95 A | 1,77 A | 1,60 A | 1,49 A |
| 100/300/500/800 m | alle | ja | 1,93 A | 1,70 A | 1,49 A | 1,35 A |

Was die Tabelle zeigt:

- **Ohne Chronograph und ohne geprüften Mittelwert funktioniert nichts.** Mit einer Vorannahme von 20 m/s für die Geschwindigkeit bleibt die Korrelation zwischen Geschwindigkeit und Luftwiderstand bei 0,7–0,9, und 40 Schuss sind nicht besser als 12. Der Luftwiderstand bewegt sich kaum von seiner Vorannahme von 4,1 %.
- **Distanz schlägt Schusszahl.** Mit vollständiger Vorbereitung und Chronograph ergeben 40 Schuss bis 600 m 2,5 %. Zwölf Schuss bis 800 m ergeben 1,93 %. Bei dieser .308 auf 600 m ist die Spalte des Luftwiderstands der Spalte der Geschwindigkeit noch zu ähnlich.
- **Die Zeile „Mittelwert geprüft, ohne Chronograph“ ist auf dem Papier Note A**, und trotzdem bietet das Werkzeug dafür keine BC-Korrektur an. Der Plan nimmt den Mittelwert mit seiner angegebenen Unsicherheit, aber dieser Mittelwert stammt von einem anderen Tag. Eine falsche Temperaturdrift, ein anderes Los oder ein schwächelnder Chronograph verschieben ihn, und auf 800 m geht jeder m/s direkt als 0,5 % in den Luftwiderstand. Nichts in der Sitzung kann eine solche Verschiebung sehen. Die fünf Chronographen-Messwerte sind die einzige Information, die in derselben Luft und bei derselben Pulvertemperatur wie die Schüsse gemessen wurde.

Zwei weitere Zahlen der Seite „Vorbereiten“ stammen aus derselben Posterior-Verteilung. Die **erforderliche ferne Distanz** ist das nächstgelegene ferne Ziel, bei dem eine nahe und eine ferne Gruppe eine vorgegebene Standardabweichung des Luftwiderstands erreichen. Die **Unbrauchbarkeitsgrenze** ist die ferne Distanz, unterhalb derer selbst ein Ablesen so genau wie ein Klick (σ = 0,1/√12 mrad) mit beliebig vielen Schüssen den Luftwiderstand nicht unter 4 % bringt. Unterhalb dieser Grenze entkommt kein Plan der Note D, und die Seite sagt das.

### 8.8 Der Planer

Für einen Entwurf (eine Menge von Distanzen und die Schüsse auf jeder) ist die Posterior-Verteilung die des linearisierten Modells beim verwendeten BC:

$$\Sigma^{-1} = P_0 + \sum_g \frac{J_g J_g^\top}{\sigma_g^2}$$

Der Planer minimiert

$$\sum_i \min\!\left(\frac{\Sigma_{ii}}{s_i^2},\; 4.5\right)$$

wobei $s_i$ die Größe ist, ab der Ursache $i$ zählt. Für Nullpunkt, Geschwindigkeit und Klick-Wert ist das die Größe, die die Höhenkorrektur auf der weitesten nutzbaren Distanz um 0,1 mrad verschiebt. Für den Luftwiderstand sind es 2 %, die Grenze für Note A. Jeder Term ist die Posterior-Varianz einer Ursache, nachdem die anderen berücksichtigt sind, deshalb schneidet ein Entwurf, der zwei Ursachen vermischt lässt, bei beiden schlecht ab. Die Obergrenze von 4,5 (etwa das Doppelte der relevanten Größe) bedeutet, dass eine Ursache, die unbestimmt bleibt, für kleine Verbesserungen nichts gewinnt, sodass die Schüsse dorthin gehen, wo sie ein Urteil ändern können. Eine durch die Vorbereitung festgelegte Ursache hat eine enge Vorannahme und wenig zu gewinnen, was Schüsse für die anderen freimacht. Vorbereitung kann einen Plan nie verschlechtern.

Für bis zu drei Gruppen hat die Varianz jeder Ursache eine geschlossene Form. Mit $q_i$ den Vorannahme-Varianzen, $u_i$ der Spalte der Ursache $i$ über die Distanzen des Entwurfs, $G_{gh}=\sum_i q_i u_{g,i}u_{h,i}$ und $M = G + \operatorname{diag}(\sigma_g^2)$:

$$\Sigma_{ii} = q_i - q_i^2\, u_i^\top M^{-1} u_i$$

Das braucht nur eine 3×3-Inverse, deshalb wird jede Verteilung der Schüsse durchgezählt. Entwürfe mit mehr Gruppen (Leiterstufen) werden gierig verteilt und dann durch paarweise Vertauschungen verbessert. Nur der Gewinner bekommt die exakte Posterior-Verteilung. Die Leiterstufen, die ein Entwurf braucht, ergeben sich, indem die Leiter selbst abgeschritten wird, mit der Posterior-Verteilung nach jedem Schritt. Die Kandidaten sind auf zwölf begrenzt: die nächste, die weiteste und die zehn, die dem Punkt von Mach 1,1 am nächsten liegen. Hat der Standort etwas jenseits von 300 m, muss der Plan es erreichen. Ohne diese Regel könnte ohne Chronograph und ohne geprüften Nullpunkt ein Plan, der jeden Schuss auf die Nullpunktdistanz setzt, genauso gut abschneiden wie einer, der am fernen Ziel wenig lernt, und er würde nichts einschießen.

Leiterstufen bekommen je einen Schuss: Sie sind Sicherheitskontrollen, keine Messungen, und drei Schuss pro Stufe brachten in der Simulation nichts. Die vier vorgeschlagenen Schusszahlen stammen aus der geplanten Standardabweichung des Luftwiderstands über ein Raster von 6 bis 60 Schuss. Die Kurve wird zuerst monoton fallend gemacht, da ein größeres Budget immer wie ein kleineres eingesetzt werden kann und eine Delle ein Artefakt des Planers ist. Mit beiden Achsen auf 0–1 skaliert ist die optimale Zahl der Punkt, der am weitesten unter der Geraden vom ersten zum letzten Budget liegt: das Knie, typischerweise 16–32 Schuss (18–24 mit Chronograph auf einem Gelände mit vielen Zielen). Die minimale Zahl ist die kleinste, deren Standardabweichung des Luftwiderstands höchstens 10 % über der optimalen liegt. Erweitert und Deluxe legen 10 und 20 Schuss drauf. Verbessert der Schritt von 6 auf 60 Schuss die Standardabweichung des Luftwiderstands um weniger als 10 %, sagt die Seite, dass Vorbereitung und Distanzen die Grenze sind, nicht die Schusszahl.

Planungswind und geplante Chronographen-Messwerte gehen genau so ein wie später in die Anpassung, sodass Prognose auf der Seite „Vorbereiten“ und Endergebnis darin übereinstimmen, was jeder Punkt wert ist.

### 8.9 Falsch angemessene und geneigte Ziele

Ein Distanzfehler und eine übersehene Neigung sind die beiden Fehler im Gelände, die die Schüsse am wenigsten von einem falschen Luftwiderstand unterscheiden können. Jedes Ziel bekommt deshalb eine Auswahl aus drei Möglichkeiten, verglichen nach ihrer Evidenz:

| Möglichkeit | Zusätzliche Terme | Vorab-Gewicht |
|---|---|---|
| in Ordnung | $\Delta R_t \sim N(0,\;0.002R)$ | 0,9 |
| falsch angemessen | $\Delta R_t \sim N(0,\;20\text{ m})$ | 0,05 |
| geneigt | $\Delta R_t \sim N(0,\;0.002R)$, $u_t \sim N(0,\;u(20°))$ | 0,05 |

Steht „geneigt“ nicht zur Wahl (siehe unten), erhält „falsch angemessen“ die ganzen 0,1.

Das σ von 0,2 % für „in Ordnung“ ist die Genauigkeit einer einzelnen Laser-Messung, nachdem die Anzeige auf ganze Meter gerundet hat. Nachdem das Ziel neu angemessen wurde, lauten die Gewichte 0,98 / 0,01 / 0,01 (bzw. 0,98 / 0,02). Ein falsches Ziel ist dann viel unwahrscheinlicher, aber nicht ausgeschlossen: Mehrere Messungen am selben falsch erkannten Objekt stimmen trotzdem überein. Die zweite Messung geht als Beobachtung von $\Delta R_t$ mit dem σ von „in Ordnung“ ein. Die gleichmäßige Aufteilung zwischen den beiden Fehlerarten ist eine Konvention, keine Messung. Es gibt keine Grundlage, einen Laserfehler über eine nicht erfasste Neigung zu stellen.

**Die Neigung wird über u parametrisiert, nicht in Grad:** $u = 1-\cos\alpha$. Eine Neigung lässt Sie immer weniger einstellen als im Flachen, bergauf wie bergab, und die Wirkung wächst wie $1-\cos\alpha$, nahe null quadratisch. Eine Spalte in Grad ist bei $\alpha=0$ genau null, und eine linearisierte Anpassung kommt davon nicht los. Gemessen an der .308 auf 600 m ergab die numerische Steigung nahe null $+4.1\times10^{-4}$, $-2.8\times10^{-5}$ und $-9.0\times10^{-4}$ mrad/° für Schritte von 0,5, 1 und 2°: nicht einmal mit einheitlichem Vorzeichen, weil es Rauschen des Lösers an einem stationären Punkt ist. In $u$ ist die Wirkung nahezu linear: Wirkung/$u$ schwankt zwischen 10° und 30° um den Faktor 1,08, Wirkung/Grad dagegen um den Faktor 28. Das Vorannahme-σ ist $u(20°) = 0.060$, direkt in $u$ gewählt. Ein in $u$ umgerechnetes „σ = 8°“ machte eine Neigung von 20° zu einem 6σ-Ereignis, weil $u$ im Winkel konvex ist. Mit $u(20°)$ liegt eine Neigung von 15° bei 0,56σ und eine von 30° bei 2,2σ.

Zwei Regeln schließen unmögliche Hypothesen von vornherein aus. Ein angepasstes $u<0$ wäre eine Neigung, die Sie mehr einstellen lässt, und bekommt deshalb das Gewicht null. Und „geneigt“ steht nur zur Wahl, wenn das Residuum des Ziels negativ ist (Sie haben weniger eingestellt als vorhergesagt) und sein Winkel nicht gemessen wurde. Ein gemessener Winkel, auch flach, macht die Neigung zu einem bekannten Wert. Eine Standortkarte kann „bestätigt flach“ nicht von „nie gemessen“ unterscheiden, da beides als 0° gespeichert wird. Deshalb nimmt nur ein während der Sitzung gemessener Neigungswinkel oder die Erklärung „Dieses Gelände ist flach“ den Term heraus.

Für eine einzelne Gruppe sind Distanzfehler und Neigung **genau** entartet: Auf 700 m verschieben eine Neigung von 20° und ein Distanzfehler von −25,1 m die Höhenkorrektur beide um −0,418 mrad. Eine dritte Möglichkeit „beides zugleich“ würde Gewicht willkürlich auf zwei Erklärungen verteilen, die die Daten nicht trennen können, deshalb gibt es sie nicht. Nur eine Winkelmessung trennt die beiden, darum verlangt jede Neu-Anmessung auch den Neigungsmesser. Ein Ziel wird nach der Summe aus „falsch angemessen“ und „geneigt“ markiert, nie nach einem allein.

**Modellvergleich.** Jede Kombination von Möglichkeiten wird angepasst, und ihre Evidenz wird mit der Laplace-Methode an ihrem eigenen MAP-Punkt genähert:

$$\log p(y) \approx \log p(y\mid\theta^*) + \log p(\theta^*) + \tfrac p2\log 2\pi - \tfrac12\log|A|$$

Das Posterior-Gewicht einer Kombination ist proportional zu (Vorab-Gewicht) × (Evidenz). Die Kombinationen werden nach dem Satz der totalen Varianz zu einer Normalverteilung zusammengeführt:

$$\bar\theta = \sum_k w_k\theta_k,\qquad \Sigma = \sum_k w_k\big(\Sigma_k + (\theta_k-\bar\theta)(\theta_k-\bar\theta)^\top\big)$$

Eine Kombination, deren Anpassung zu einem nicht endlichen Wert davongelaufen ist, wird verworfen. Das passiert bei einer breiten Vorannahme für den Luftwiderstand, mehreren Zielen, die gleichzeitig falsch sein dürfen, und zu wenigen Gruppen, um sie festzulegen. Die gemeldeten Zahlen stammen immer aus dieser zusammengeführten Anpassung, nie aus einer einfachen Anpassung mit nachträglich gesetzter Markierung: Ein Ziel zu markieren korrigiert die Zahlen nicht von selbst.

Die geschlossene Evidenz eines linearen Modells, einmal bei $\theta = 0$ linearisiert, gilt hier nicht, weil das Modell in jeder Iteration neu linearisiert wird. Getestet an sauberen Sitzungen ohne jeden Fehler bevorzugte diese Abkürzung jedes Mal „Fehler“ mit etwa 90 %. Die Laplace-Form oben steht an genau einer Stelle und wird von jedem Vergleich im Werkzeug geteilt.

**Gemeinsam, nicht einzeln.** Zwei nahe beieinanderliegende Ziele haben fast dieselbe Empfindlichkeit gegenüber einer großen gemeinsamen Ursache, etwa einer nicht korrigierten Temperaturdrift. Einzeln geprüft lässt jedes das andere falsch aussehen. In einem eigens dafür gebauten Fall ergab die Einzelprüfung 99,5 % und 98,6 % „Fehler“ für den wahren Schuldigen und seinen unschuldigen Nachbarn 5 m daneben. Gemeinsam entschieden ergaben sich 99,5 % und 13,7 %, bei derselben Endschätzung.

Die exakte gemeinsame Aufzählung wächst exponentiell mit der Zahl der Ziele $k$ (bis zu $3^k$ Kombinationen). Gemessen mit zwei Möglichkeiten pro Ziel wuchsen die Kosten um etwa das 2,2-Fache pro Ziel: 0,24 s für 4 Ziele, 9,4 s für 8, und ein Gelände mit 12 Zielen musste nach zwei Minuten abgebrochen werden. Deshalb wird jedes Ziel zuerst einzeln vorgeprüft (etwa 7 ms pro Ziel). Die vier verdächtigsten werden dann gemeinsam aufgezählt, und Kombinationen mit mehr als zwei gleichzeitig falschen Zielen entfallen. Mit den Gewichten nach Neu-Anmessung hat „drei von vier falsch“ eine Vorab-Masse von etwa $3\times10^{-5}$. Bei 585 realen Analysen waren Abschlussliste, Note und die Menge „nichts Wesentliches“ mit und ohne diese Begrenzung identisch, bei 1,5-facher Geschwindigkeit. Die Vorprüfung kann nur irren, indem sie einen unschuldigen Nachbarn einschließt, nie, indem sie den Schuldigen verpasst, denn das gemeinsame Residuum muss auf irgendeinem Ziel landen, und das wahre behält seinen Anteil. Auf einer Leiter mit sieben Zielen und auf einer gezielt ungünstigen Anordnung mit Zielen auf 600/610, 750/760 und 860/870 m kam der Schuldige immer in die Auswahl, und die Zahlen der Auswahl stimmten auf ein Zehntel Prozentpunkt mit der vollständigen Aufzählung überein, bei etwa einem Achtel der Zeit.

Ein Ziel wird markiert und eine Neu-Anmessung verlangt, sobald sein Gewicht für „etwas stimmt nicht“ 20 % übersteigt. In der Simulation löste eine Schwelle von 50 % fast nie aus. Bei 20 % löst sie etwa in jeder zehnten Sitzung aus und verbessert sowohl die Einstellwerte als auch die Schätzung des Luftwiderstands. Neu anmessen dauert Sekunden.

### 8.10 Prüfung der Vorbereitungs-Haken

Ein abgehakter Nullpunkt oder Geschwindigkeitsmittelwert wird nicht einfach geglaubt. Jeder wird in derselben Aufzählung zu einer Auswahl aus zwei Möglichkeiten: die geprüfte Vorannahme mit Gewicht 0,9, die ungeprüfte (0,25 mrad, 20 m/s) mit 0,1. Widersprechen die Schüsse einem Haken, wird das zusammengeführte Ergebnis breiter, statt die Abweichung in eine andere Ursache zu drängen. Die Seite „Abschluss“ nennt einen Haken, sobald sein Gewicht für „hat nicht gehalten“ 50 % übersteigt. Der Haken für die Geschwindigkeit entfällt, sobald der eigene Chronograph der Sitzung übernimmt (§8.5). Der Klick-Wert wird so nicht geprüft. Die Schüsse sagen fast nichts über ihn (§8.2), und jede zusätzliche Achse verdoppelt den Rechenaufwand.

### 8.11 Die Leiter und Fehlschüsse

Jeder Schritt muss zwei Prüfungen bestehen.

1. **Die Prognose.** Der vorhergesagte Fehlschuss auf der nächsten Distanz, $z\,\sigma_c\,R/1000$ Meter mit $\sigma_c=\sqrt{J^\top\Sigma J}$ der Vorhersage-Standardabweichung der Höhenkorrektur in mrad, muss innerhalb der halben Höhe des Kugelfangs bleiben (1 m bei 2 m Kugelfang). $z$ ist 2, und 3 nach jedem Fehlschuss.
2. **Die Obergrenze.** Ein Schritt darf höchstens das Vierfache der weitesten Distanz betragen, auf der tatsächlich eine Gruppe gelandet ist. Bevor die erste Gruppe gelandet ist, wird kein Schritt aufgrund der Prognose gemacht: Die Leiter beginnt auf der nächsten verfügbaren Distanz.

Die Prognose allein genügt nicht, weil sie auf dem angenommenen Modell aufbaut: Sie misst die Unsicherheit *innerhalb* dieses Modells und kann nicht sehen, dass das Modell die falsche Form hat. Mit nur den Vorannahmen und ohne Schüsse gab sie einen ersten Schuss auf 800 m frei, für ein Geschoss, das als G1 angenommen, in Wahrheit aber G7 war, und sagte bei 2σ höchstens 1,59 m Abweichung voraus. Die tatsächliche Abweichung bei 2 m Kugelfang betrug 3,70 m. Die Obergrenze verdankt dem Modell nichts. Eine Grenze von 2× blieb auf den Anordnungen 100/300/600 m und 100/300/600/900 m nach der ersten Gruppe in jeder Sitzung stecken. 3× beseitigte diese Blockaden, und 4× lässt eine Lücke vom Vierfachen zu. Ist innerhalb der Grenze nichts mehr übrig, wird die nächste Distanz jenseits davon erlaubt, wenn sie die Prognose bei 3σ besteht. An den Schritten der Simulation gemessen lag das 99. Perzentil der tatsächlichen Abweichung bei etwa 3σ, selbst mit einem absichtlich falschen Widerstandsmodell.

Der allererste Schuss wird gesondert geprüft: die vorhergesagte Abweichung unter den Vorannahmen allein, bei 3σ. Kann er den Kugelfang verlassen, bietet das Werkzeug die Nullpunktdistanz an und lässt Sie bewusst weitermachen.

**Ein Fehlschuss** ist ein harter Beleg dafür, dass das Modell dort draußen falsch ist, und keine der beiden Prüfungen kann das sehen. Das Werkzeug:

1. geht auf die verfügbare Distanz zurück, die der Mitte zwischen der letzten getroffenen und der verfehlten am nächsten liegt;
2. setzt $z$ für den Rest der Sitzung auf 3;
3. sperrt die verfehlte Distanz und alles dahinter, bis irgendwo näher eine Gruppe landet, und gibt sie dann für einen neuen Versuch frei, eingestellt nach der korrigierten Anpassung. Wer wieder die Vorhersage der App einstellt, verfehlt erneut: In der Simulation erholte sich keine Sitzung mit Fehlschuss ohne die Höhe aus der Anpassung, und 82 % mit ihr;
4. lässt eine erneut verfehlte Distanz im Spiel, solange darunter unversuchtes Gelände bleibt, bis zu fünf Fehlschüsse. Bei einem um 25 % zu hohen BC und 2 m Kugelfang ging das ferne Ziel, wenn man es nach dem zweiten Fehlschuss aufgab, in 92 von 100 Sitzungen verloren, und das auf zwei Drittel der Wahrheit geschrumpfte Ergebnis wurde dann zum Speichern angeboten. Blieb es im Spiel, wurde es in jeder Sitzung mit höchstens drei Fehlschüssen erreicht;
5. verlangt, wenn sich nichts Näheres schießen lässt, eine zusätzliche Gruppe von drei Schuss auf einer bereits getroffenen Distanz, um die Anpassung so weit zu bewegen, dass der neue Versuch frei wird.

Ein Fehlschuss sagt auch, wie groß der Fehler im Luftwiderstand mindestens sein muss. Der Schuss hat den Kugelfang verlassen, also lag die Einstellung um mehr als dessen halbe Höhe $h$ daneben. Ein Luftwiderstandsfehler allein schafft das nur, wenn

$$|\delta d| \ge \frac{h/2}{R}\Big/\frac{\partial c}{\partial d}$$

Bei 2 m Kugelfang sind das für die .308 22 % auf 800 m, 38 % auf 700 m, 68 % auf 600 m und 815 % auf 300 m. Die Vorannahme für den Luftwiderstand, die Leiter und Einstellwerte verwenden, wird erweitert, bis diese Größe zwei Standardabweichungen entfernt liegt. Einem groben BC-Fehler wird dann gefolgt, statt ihn zum veröffentlichten Wert zurückzuziehen, was den neuen Versuch fast ebenso weit verfehlen ließe. Liegt der nötige Fehler über 50 %, ist kein BC so falsch: Der Fehlschuss war etwas anderes (eine Böe, ein Einstellfehler, ein einfach nicht gesehener Einschlag), und eine Erweiterung kostete nur Genauigkeit. Die lineare Abschätzung genügt hier; die exakte Lösung der Flugbahn änderte kein simuliertes Ergebnis. Die Anpassung für den Abschluss verwendet die normale Vorannahme. Sonst kostete ein Fehlschuss, der nur ein nicht gesehener Einschlag war, einer Sitzung ohne Chronograph eine Note, und die 3σ-Regel aus §8.12 fängt einen groben BC-Fehler ohnehin ab.

### 8.12 Schutzmechanismen bei den Eingaben

Keiner davon blockiert Sie. Jeder warnt, erklärt oder hält ein Ergebnis zurück.

- **Plausibilität der Höhenkorrektur.** Eine eingegebene Höhenkorrektur wird mit einem Bereich aus der eigenen Vorhersage der App ± 4σ verglichen. Das σ verbindet die Streuung der Vorhersage für einen Schützen, der nichts geprüft hat (ungeprüfte Vorannahmen, egal was abgehakt ist), das Rauschen der Serie und den Windfehler bei „Schlecht“. Der Bereich ignoriert absichtlich die Anpassung und frühere Eingaben: Ein früherer Tippfehler, der die Anpassung verbogen hat, darf eine richtige Eingabe nicht falsch aussehen lassen. Liegt die Zahl außerhalb, prüft das Werkzeug, ob sie als Differenz zur empfohlenen Höhenkorrektur passen würde, als mrad oder MOA statt Klicks, mit umgekehrtem Vorzeichen oder um den Faktor zehn verschoben, und nennt den wahrscheinlichen Fehler.
- **Plausibilität der Geschwindigkeit.** Die Geschwindigkeit der Patrone in der Luft dieser Gruppe ± $4\sqrt{20^2 + \text{SD}^2}$ m/s, begrenzt auf 150–1500 m/s. Die 20 m/s gelten auch, wenn der Mittelwert als geprüft abgehakt ist, denn der Haken kann falsch sein. Liegt der Wert außerhalb, prüft das Werkzeug die anderen Geschwindigkeitseinheiten und den Faktor zehn.
- **Stationsdruck.** Liegt der Wert mehr als 40 hPa über dem Druck der Standardatmosphäre auf der Höhe des Standorts, sieht er nach QNH aus. Liegt er mehr als 60 hPa darunter, sieht er zu niedrig aus. Der echte Stationsdruck schwankt mit dem Wetter um etwa 35 hPa in beide Richtungen. Auf 1500 m kostet QNH 0,39 mrad, und die Anpassung würde daraus eine BC-Korrektur machen (§8.2).
- **Luftveränderung.** Weicht die Luft einer Gruppe um 8 °C oder 15 hPa von der Ausgangsluft ab, sagt Ihnen das Werkzeug, dass der Plan veraltet (bei einer Laborierung mit 0,8 m/s Drift pro Grad sind 8 °C über 6 m/s). Der Plan wird nach dem Start nicht neu berechnet, aber die Anpassung folgt in jedem Fall der Luft jeder Gruppe.
- **BC-Korrektur.** Nur angeboten mit mindestens fünf in der Sitzung erfassten Chronographen-Messwerten, bei Note A oder B, wenn das Ergebnis für den Luftwiderstand innerhalb von 3σ der Vorannahme liegt (3 × 4,1 ≈ 12 %) und der neue Verstärkungsfaktor innerhalb von 0,8–1,2. Ein Ergebnis weiter draußen gilt als Eingabefehler: Die Vorannahme zieht eine solche Anpassung zum veröffentlichten BC zurück, deshalb ist ihre Zahl zu klein und ihr Band zu schmal. Simuliert mit einem um 25 % falschen BC wäre ein solches Ergebnis mit zwei Dritteln der wahren Korrektur zum Speichern angeboten worden. Es wird mit dem angepassten BC nur zur Information gezeigt.
- **Geschwindigkeitsbefund.** Als gemessene Korrektur nur gemeldet, wenn Chronographen-Messwerte dahinterstehen. Ohne sie ist eine aus Höhenkorrekturen abgeleitete Geschwindigkeit nur der Fehler einer anderen Ursache, in die Geschwindigkeit verschoben, und wird als nicht bestimmt geführt.
- **Geplantes fernes Ziel nicht erreicht.** Die Seite „Abschluss“ sagt das und bewertet nur, was geschossen wurde.

### 8.13 Was gemeldet wird

$R_\text{max}$ ist Ihre längste Einsatzdistanz: die weiteste Überschalldistanz am Standort oder die weiteste geschossene Distanz, falls diese größer ist. Jeder Befund wird auf $R_\text{max}$ beurteilt.

**Relevanz.** Eine Ursache zählt, wenn ihre Wirkung auf $R_\text{max}$ 0,1 mrad übersteigt. Für eine Ursache mit angepasstem Wert $\theta_i$, Standardabweichung $\sigma_i$ und Spalte $J_i$ auf $R_\text{max}$, also Mittelwert $m = J_i\theta_i$ und Standardabweichung $s=|J_i|\sigma_i$:

$$P(\text{material}) = \Phi\!\left(\frac{-0.1-m}{s}\right) + 1 - \Phi\!\left(\frac{0.1-m}{s}\right)$$

Die Befunde werden nach dieser Wahrscheinlichkeit geordnet.

**Auflösung.** $\tilde R = I - \Sigma P_0$, skaliert mit den Vorannahme-Standardabweichungen. Ihre Diagonale ist $1 - \Sigma_{ii}/\sigma_{0,i}^2$, der Anteil der Vorab-Varianz, den die Schüsse beseitigt haben. Unter 0,2 hat die Sitzung diese Ursache nicht gemessen. Sie ist dann „nicht bestimmt“, oder wird als ungeklärt geführt, wenn ihre angepasste Wirkung wahrscheinlich trotzdem zählt, aber nie als „unauffällig“, denn ein Wert, der zu seiner Vorannahme zurückgezogen wurde, ist keine Messung.

**Entartung.** Ursachen, die durch eine Posterior-Korrelation über 0,8 verbunden sind, werden als Zusammenhangskomponenten gruppiert, sodass sich Verbindungen verketten können. Jede Gruppe wird als ein gemeinsamer Beitrag $m=\sum_{k} J_k\theta_k$ mit Varianz $J^\top\Sigma J$ über ihre Mitglieder gemeldet. Besteht die Gruppe aus Geschwindigkeit und Luftwiderstand, lautet der Rat, einen Chronographen mitzubringen. Korrelationen zwischen 0,5 und 0,8 zwischen gemeldeten Ursachen bekommen einen Hinweis.

**Nullpunkt.** Als Korrektur gemeldet bei $P \ge 0.8$, als „möglich, aber noch nicht klar“ zwischen 0,5 und 0,8.

**Einstelltabelle.** Wird keine BC-Korrektur angeboten, ist die Änderung der Höhenkorrektur auf jeder geschossenen Distanz $\Delta c(R) = c_\text{fit}(R) - c_\text{app}(R)$ in der Luft der letzten Gruppe, mit Standardabweichung $\sqrt{J(R)^\top\Sigma J(R)}$. Ein Eintrag zählt, wenn $|\Delta c| \ge 0.05$ mrad und $|\Delta c| \ge$ seiner eigenen Standardabweichung ist. Die Tabelle wird gezeigt, wenn mindestens ein Eintrag zählt. Das Ablesen einer Gruppe ist nur auf etwa 0,07–0,15 mrad genau, deshalb ließe eine Untergrenze von 0,05 mrad allein Rauschen durch.

Die Schwellen für Nullpunkt und Einstelltabelle wurden gewählt, indem Kandidatenregeln über Tausende simulierter Sitzungen durchgespielt wurden. Zusammen halbieren sie etwa die Sitzungen, in denen das Befolgen des Ergebnisses die Höhenkorrekturen schlechter macht als gar nichts zu tun, zu geringen Kosten, wenn der Nullpunkt wirklich leicht danebenliegt.

### 8.14 Was das Modell auslässt

- **Die Form der Widerstandskurve.** $\delta d$ skaliert die angenommene Widerstandskurve und formt sie nie um. Ein G1-BC für ein Geschoss, dessen Luftwiderstand G7 folgt, ist ein Formfehler. Über Mach 1,1 nimmt ein einzelner Faktor den größten Teil davon über die geschossenen Distanzen auf, aber nicht alles, und er lässt sich nicht in den transsonischen Bereich übertragen. Das ist der Hauptgrund, warum das Werkzeug im Überschall bleibt, und warum die Obergrenze der Leiter existiert.
- **Die Visierhöhe** wird nicht angepasst. Jenseits einiger hundert Meter ist ihre Wirkung fast konstant (−0,020, −0,025 und −0,026 mrad auf 300, 600 und 800 m für 3 mm), sodass sie wie ein kleiner Nullpunktversatz aussieht und die Schüsse die beiden nicht trennen können. Messen Sie sie.
- **Die Luftdichte** wird nicht angepasst und kann es nicht (§8.2).
- **Der Wind** ist Rauschen, keine Ursache, und die Seitenkorrektur wird nie verwendet.
- **Der Drall-Abtrieb** wirkt nur seitlich, und die Seite wird nicht angepasst. Die Erdrotation wird nicht modelliert.
- **Validierung.** Jede Schwelle oben wurde durch Simulation festgelegt: Sitzungen mit eingebauten bekannten Fehlern (BC, Geschwindigkeit, Nullpunkt, Klicks, Distanz, Neigung, Wind), geschossen durch dieselbe Leiter, Anpassung und Berichterstattung. Das 95-%-Band des Luftwiderstands enthält in diesen Läufen die Wahrheit in etwa 95 % der Fälle. Reale Sitzungen gibt es noch wenige, deshalb ist das Werkzeug als experimentell markiert.
