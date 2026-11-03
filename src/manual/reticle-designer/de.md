# geladen.ch ballistics Benutzerhandbuch — Absehen-Designer

*Teil der* [Ballistik-Suite von geladen.ch](https://bc.geladen.ch)*. Unter Werkzeuge. Zeichnet die Absehen, die in Ihre Zielfernrohre im Arsenal eingebaut sind und die die Zielfernrohransicht des Feldrechners zeigt.*

---

## 1. Wozu dieses Werkzeug dient

Der Feldrechner kann Ihnen Ihren Haltepunkt auf dem Absehen zeigen, das Sie tatsächlich sehen — aber nur, wenn er dieses Absehen kennt: wo jeder Teilungsstrich, jeder Punkt, jeder Balken und jede Zahl sitzt. Im Absehen-Designer legen Sie das fest. Sie zeichnen das Absehen einmal nach dem Datenblatt des Herstellers, speichern es im Arsenal, führen es beim Zielfernrohr auf, mit dem es geliefert wird, und setzen dieses Zielfernrohr auf ein Gewehr. Von da an zeichnet die Zielfernrohransicht des Feldrechners Ihren Haltepunkt auf diesem Absehen, beschriftet seine BDC-Marken mit den Distanzen, für die sie heute mit Ihrer Patrone gelten, und setzt die Windhaltepunkte dorthin, wo Ihr Auge sie suchen wird.

Die App bringt eine Reihe mitgelieferter Absehen mit. Ist Ihres darunter, brauchen Sie dieses Werkzeug vielleicht nur, um eine Variante davon zu erstellen.

### Was es nicht ist

Es ist kein Zeichenprogramm. Jedes Element ist ein Merkmal des Absehens mit einer Position und Abmessungen im Winkelmaß, eingetippt oder gezogen, und jede Position wird von der Absehenmitte aus gemessen. Es gibt kein Freihandzeichnen, keine Farbe und keinen Text außer Ziffern. Eine Zeichnung, die Sie schon haben, kann als SVG-Form hinein (§12), ist dann aber ein einzelnes Element, das als Ganzes platziert und skaliert wird.

Es weiß nicht, wie sich Ihr bestimmtes Zielfernrohr verhält. Ein Absehen wird für ein *Referenz-Zielfernrohr* gezeichnet — nur dessen Art und Vergrößerung (§5). Das echte Zielfernrohr, in das es kommt und das im Arsenal angelegt ist, bringt sein eigenes Sehfeld mit, seinen Zoombereich und, bei einem Zielfernrohr mit zweiter Bildebene, die Vergrößerung, bei der seine Winkelwerte stimmen.

---

## 2. Wo Ihre Arbeit liegt

**Ein Absehen bleibt erhalten, indem Sie es im Arsenal speichern.** Bis dahin lebt es nur im Speicher der App: Es übersteht den Wechsel in ein anderes Werkzeug und zurück, samt Rückgängig-Verlauf, aber kein Neuladen, kein Schließen der App und keinen Neustart. Solange etwas ungespeichert ist, steht in der Dateileiste *„Nicht im Arsenal gespeichert"*, und der Browser fragt nach, bevor Sie die Seite mit ungespeicherten Änderungen neu laden oder schließen.

Gespeicherte Absehen liegen im Reiter **Zielfernrohre** des Arsenals unter **Ihre Absehen**, nur auf diesem Gerät gespeichert, und werden mit dem Rest des Arsenals gesichert und synchronisiert (siehe das [Arsenal-Handbuch](#/manual/arsenal), §5.9 und §8). Ein Absehen mit importierter SVG-Zeichnung kann groß werden — Megabytes —, und diese Größe geht in jede Sicherungsdatei und jede Synchronisierung ein; der Reiter Zielfernrohre zeigt, wie viel Platz jedes Absehen belegt.

Nichts, was Sie zeichnen, verlässt je Ihr Gerät, außer den Dateien, die Sie speichern, und dem Synchronisierungsordner, den Sie selbst einrichten.

---

## 3. Schnellstart

1. Öffnen Sie im Arsenal den Reiter **Zielfernrohre** und tippen Sie auf **+ Absehen hinzufügen**, oder öffnen Sie den **Absehen-Designer** unter Werkzeuge.
2. Stellen Sie unter **Zielfernrohr** die Art des Zielfernrohrs und die Vergrößerung ein, für die das Absehen gemacht ist, so wie das Datenblatt sie angibt.
3. Wählen Sie unter **Optionen** **mrad** oder **MOA** — die Einheit des Datenblatts.
4. Wählen Sie in der Elementpalette **Vertikale Linie** und ziehen Sie von der Mitte bis zum unteren Rand des Sehfelds; ebenso eine **Horizontale Linie** zu einer Seite, und haken Sie in ihren Einstellungen **Horizontal spiegeln** an.
5. Fügen Sie eine kurze vertikale Linie für einen Teilungsstrich unter der Mitte hinzu, haken Sie **Wiederholen** an und legen Sie Richtung, Anzahl und Abstand fest.
6. Geben Sie in der Dateileiste Hersteller und Modell ein und tippen Sie auf **Im Arsenal speichern**.
7. Führen Sie das Absehen im Arsenal bei seinem Zielfernrohr auf (das Zielfernrohr **Bearbeiten**, das Absehen anhaken), und wählen Sie dieses Zielfernrohr für Ihr Gewehr.

---

## 4. Der Bildschirm

Von oben nach unten:

- **Die Dateileiste** — **Hersteller** und **Modell** des Absehens (beide zum Speichern nötig; der Hersteller schlägt die Hersteller von Zielfernrohren und Absehen vor, die die App kennt), ein optionales Feld **Quelle / Anmerkungen** dafür, woher die Winkelwerte stammen, und die Schaltflächen **Neues Absehen**, **Im Arsenal speichern**, **Änderungen verwerfen** und **Ganzes Absehen einfügen…** (§14, §15).
- **Zielfernrohr** — das Referenz-Zielfernrohr, für das das Absehen gezeichnet wird, und seine Beleuchtung (§5).
- **Der Arbeitsbereich** mit fünf Bereichen: **Optionen** (§6), **Elemente** — die Palette und die Schaltflächen Gruppieren, Gruppierung aufheben, Duplizieren und Löschen (§8, §10) —, die **Absehen-Ansicht** (§7), die **Einstellungen** des Ausgewählten und **Elemente im Absehen**, die Liste von allem Gezeichneten.

Jede Änderung am Absehen — ein Element platziert, verschoben oder bearbeitet, das Zielfernrohr, die Beleuchtung, Hersteller, Modell und Anmerkungen — ist ein Schritt, den Sie rückgängig machen können. Ein ganzes Ziehen, eine Folge von Eingaben in einem Feld oder ein Druck auf eine Pfeiltaste ist ein Schritt. Die letzten 1000 Schritte werden behalten.

---

## 5. Das Referenz-Zielfernrohr

Der Abschnitt **Zielfernrohr** legt fest, wofür das Absehen gezeichnet wird:

- **Art des Zielfernrohrs** — **Feste Vergrößerung**, **Variabel, erste Bildebene** (FFP) oder **Variabel, zweite Bildebene** (SFP).
- **Vergrößerung** — ein Wert für ein Zielfernrohr mit fester Vergrößerung; **Vergrößerung von** und **bis** für ein variables.
- **Werte stimmen bei** — nur SFP: die Vergrößerung, bei der die Marken des Absehens das wert sind, was das Datenblatt sagt. Sie muss im Zoombereich liegen.

**Das Sehfeld wird nicht eingegeben.** Es wird aus der Vergrößerung angenommen — 12 m auf 100 m bei 3×, im Verhältnis enger werdend, wie die Vergrößerung steigt —, nur damit die Ansicht das Feld zeichnen kann, in dem das Absehen sitzt. Es muss nicht zum echten Zielfernrohr passen; die echten Werte kommen vom Zielfernrohr im Arsenal.

Soll das Absehen in Zielfernrohren mit erster Bildebene unterschiedlicher Vergrößerung verwendet werden, stellen Sie die niedrigste Vergrößerung des Referenz-Zielfernrohrs auf die niedrigste echte: So reichen „endlose" Elemente, die bis zum Rand laufen, etwa die seitlichen Balken, beim weitesten Sehfeld wirklich bis zum Rand.

Ein SFP-Absehen wird bei seiner Kalibrierungsvergrößerung gezeichnet; die Ansicht zeigt also das Sehfeld bei dieser Vergrößerung.

**Beleuchtung.** Haken Sie für ein beleuchtetes Absehen **Absehen ist beleuchtet** an und wählen Sie **Rot**, **Bernstein** oder **Grün**; jedes Element sagt dann, ob es leuchtet (§8). Der Feldrechner nutzt das, um seine eigene Einblendung lesbar zu halten: Auf einem rot oder bernsteinfarben beleuchteten Absehen zeichnet er blau.

---

## 6. Optionen

Der Bereich **Optionen** ändert, wie Sie arbeiten, nicht das Absehen; keine dieser Optionen ist ein Rückgängig-Schritt.

- **mrad / MOA** — die Einheit, in der jeder Winkel angezeigt und eingegeben wird. Sie gehört dem Werkzeug allein und ist unabhängig von den Einheiten, die Sie sonst in der App bevorzugen, denn ein Absehen wird in der Einheit seiner Winkelwerte angegeben, womit auch immer Sie am Turm drehen. Das Umschalten ändert nichts am Absehen: Jede Position und jede Abmessung wird als Winkel gehalten, nur ihre Anzeige ändert sich.
- **Raster (1 mrad)** / **Raster (1 MOA)** — ein Hilfsraster, jede fünfte Linie kräftiger. Weit herausgezoomt dünnt es sich selbst auf jede fünfte Linie aus, dann jede 25., und so weiter.
- **Auf 0,1 mrad einrasten** / **Auf 0,25 MOA einrasten** — Platzieren und Verschieben landen auf Vielfachen dieses Schritts, von der Mitte aus gezählt. Die Pfeiltasten verschieben um denselben Schritt (§16).
- **Nullpunkt anzeigen** — das rote Kreuz im Kreis, das die Absehenmitte markiert. Es gehört nicht zum Absehen.
- **BDC-Marken anzeigen** — die blauen Markierungen für BDC-Marken (§13). Das Platzieren einer Marke zeigt sie wieder an.
- **Beleuchtung anzeigen** und **Sichtfeld abdunkeln** — nur bei einem beleuchteten Absehen: die leuchtenden Elemente in ihrer Farbe zeichnen und das Sichtfeld abdunkeln wie bei schwachem Licht.

---

## 7. Die Absehen-Ansicht

Die Ansicht zeigt das Absehen so, wie Sie es sehen würden: schwarz auf hellem Feld, in einem Kreis für das Sehfeld, alles außerhalb dunkel. x ist nach rechts positiv und y *nach unten* positiv, beide von der Mitte aus gemessen; ein Teilungsstrich 2 mrad unter der Mitte hat also y = 2.

**Platzieren.** Wählen Sie ein Element in der Palette — es bleibt hervorgehoben, bis Sie eines platziert haben —, dann klicken Sie in die Ansicht, um es dort zu platzieren, oder ziehen Sie das Symbol direkt in die Ansicht. Linien und verjüngte Balken werden durch Drücken und Ziehen gezeichnet, von einem Ende zum anderen. Ein einfacher Klick ergibt eine Linie von 1 mrad (4 MOA) Länge, von der Mitte weg gerichtet, und einen verjüngten Balken bis zum Rand des Sehfelds. Nach dem Platzieren kehrt das Werkzeug zum Auswahlpfeil zurück, und das neue Element ist ausgewählt.

**Auswählen.** Klicken Sie mit dem Pfeil auf ein Element, um es auszuwählen; ein Klick auf eine gespiegelte oder wiederholte Kopie wählt das Element, zu dem sie gehört. Ein Klick mit Umschalt, Strg oder Cmd fügt ein Element der Auswahl hinzu oder nimmt es heraus. Ziehen mit Umschalt, Strg oder Cmd auf leerem Feld zieht ein Rechteck auf, das jedes Element hinzufügt, dessen eigene Form ganz darin liegt (seine Kopien zählen nicht; eine Gruppe nur, wenn sie ganz darin liegt). Ein Klick auf ein Element einer Gruppe wählt die Gruppe. Auch die Liste wählt aus, und dort die Zeile eines Mitglieds zu wählen wählt nur dieses Mitglied.

**Verschieben.** Ziehen Sie ein ausgewähltes Element, eine Gruppe oder eine Auswahl, um es zu verschieben. Eine einzelne ausgewählte Linie oder ein einzelner verjüngter Balken zeigt an jedem Ende einen Griff, um ein Ende allein zu ziehen. Beim Ziehen stehen die Koordinaten neben dem Zeiger — bei normaler Zoomstufe ist ein Rasterschritt kleiner als ein Pixel, und an dieser Anzeige sehen Sie das Einrasten wirken.

**Zoomen und Verschieben der Ansicht.** Mausrad, Aufziehen mit zwei Fingern oder die Schaltflächen **+** und **−** zoomen; Ziehen auf leerem Feld (oder mit der mittleren Maustaste) verschiebt die Ansicht. **Ansicht zurücksetzen** kehrt zum ganzen Sehfeld zurück, zentriert, bei der niedrigsten Vergrößerung.

**Vergrößerung.** Bei einem variablen Zielfernrohr zeigt der Regler **Vergrößerung** über der Ansicht vorab, was der Vergrößerungsring tut. Bei einem FFP-Zielfernrohr wird das Sehfeld beim Hineinzoomen enger, und das Absehen wächst mit dem Bild, wie im Zielfernrohr. Bei einem SFP-Zielfernrohr ändert sich das Bild nicht; ein Hinweis zeigt, was die Winkelwerte bei dieser Vergrößerung wert sind, z. B. *„Winkelwerte hier: ×0.5 des Nennwerts"*. Die Symbole **Rückgängig** und **Wiederholen** stehen links davon.

---

## 8. Elemente

| Element | Platziert über | Einstellungen | Ein neues (mrad / MOA) |
|---|---|---|---|
| Horizontale Linie, vertikale Linie | Seinen Anfang und sein Ende entlang der Linie | Breite | 0,05 / 0,15 breit |
| Punkt | Seine Mitte | Durchmesser | 0,05 / 0,15 |
| Horizontaler und vertikaler verjüngter Balken | Seinen Anfang (das dünne Ende) und sein Ende | Nennbreite, Endbreite, Verjüngungslänge | 0,5 / 1,5 breit, 0,25 / 0,75 am Ende, verjüngt über 2 / 7 |
| Kreis | Seine Mitte | Außendurchmesser, Innendurchmesser | außen 2 / 6, innen 1,8 / 5,4 |
| Hufeisen | Seine Mitte | Außen- und Innendurchmesser, Ausschnittwinkel unten | wie der Kreis, 60° ausgeschnitten |
| Chevron | Seine Spitze | Linienbreite, Gesamtbreite, Höhe | Linien 0,5 / 1,5 in einem Quadrat von 1 / 3,5 |
| Zahl | Ihren Ankerpunkt | Ziffern, Ziffernhöhe, Ankerpunkt, Schrift | 0,5 / 1,5 hoch |
| SVG-Form | Den eigenen Ursprung der Zeichnung | Maßstab, Breite, Höhe, Spiegeln | 5 / 15 an der längeren Seite |
| BDC-Marke | Ihre Höhe auf der senkrechten Achse | — | — |

Position und Abmessungen jedes Elements werden in seinen **Einstellungen** gesetzt; ein Wert, der es unmöglich machen würde (etwa ein Innendurchmesser größer als der äußere), wird mit einem Hinweis abgelehnt und nicht übernommen. Eine neue Linie oder ein neuer Punkt übernimmt die Breite oder den Durchmesser, den Sie zuletzt für eines von beiden eingegeben haben, eine neue Zahl die zuletzt gewählte Schrift, Höhe und den Ankerpunkt, und ein neues Element die zuletzt vergebene Beleuchtungseinstellung.

- **Linien** sind einfache Strecken gleichbleibender Breite; jedes Ende kann überallhin.
- **Verjüngte Balken** sind die dicken Balken am Rand vieler Absehen: dünn, wo sie anfangen, über die Verjüngungslänge auf ihre Nennbreite breiter werdend, dann in dieser Breite bis zu ihrem Ende. Das dünne Ende zeigt immer zur Mitte. Das Ende kann der Mitte nie näher sein als der Anfang, und ein entlang seiner eigenen Achse verschobener Balken bleibt stehen, wenn sein Anfang die Mitte erreicht. Ein verjüngter Balken muss sich nicht verjüngen: Mit einer Endbreite gleich der Nennbreite oder einer Verjüngungslänge von 0 ist er ein einfacher Balken gleichbleibender Breite. Verwenden Sie ihn für jeden dicken Balken eines Absehens, nicht nur für die verjüngten.
- **Ein Kreis** ist ein Ring zwischen seinen beiden Durchmessern; ein Innendurchmesser von 0 ergibt eine volle Scheibe.
- **Ein Hufeisen** ist ein Ring mit einer Lücke unten, so breit wie der Ausschnittwinkel.
- **Ein Chevron** zeigt nach oben, seine Spitze an seiner Position; seine beiden Schenkel laufen zu den unteren Ecken seiner Gesamtbreite und Höhe.
- **Zahlen** und **SVG-Formen** haben eigene Abschnitte (§11, §12).
- **BDC-Marken** werden gar nicht gezeichnet (§13).

**Leuchtende Elemente.** Auf einem beleuchteten Absehen hat jedes sichtbare Element ein Kästchen **Beleuchtet**: Leuchtende werden in der Beleuchtungsfarbe gezeichnet, solange **Beleuchtung anzeigen** an ist. Die Liste kennzeichnet sie als *beleuchtet*.

---

## 9. Spiegeln und Wiederholen

Die meisten Absehen sind symmetrisch und regelmäßig: Sie zeichnen ein Merkmal einmal und lassen das Werkzeug es kopieren.

**Horizontal spiegeln** fügt eine an der senkrechten Achse gespiegelte Kopie hinzu: Ein Teilungsstrich bei x = 2 bekommt seinen Zwilling bei x = −2. Die Ziffern einer Zahl werden nicht gespiegelt (sie lesen sich weiterhin richtig herum), ihr Ankerpunkt aber schon: Eine Zahl, die bei x = 2 endet, beginnt bei x = −2.

**Wiederholen** fügt Kopien in einer Reihe hinzu: eine **Richtung** (nach oben, unten, links oder rechts), eine **Anzahl** Kopien (zusätzlich zum Element selbst, bis 500) und einen **Abstand** dazwischen. Zehn Teilungsstriche den senkrechten Faden hinab, einer je 1 mrad, sind eine einzige kurze Linie mit Wiederholen auf *nach unten, 9, 1 mrad*.

Beides lässt sich kombinieren: Zuerst entstehen die Wiederholungen, dann wird jede davon gespiegelt. Kopien sind keine eigenen Elemente — sie folgen dem Element, und ein Klick auf eine wählt es aus. Die Liste kennzeichnet ein Element als *gespiegelt* oder *wiederholt ×n*. Das Einschalten von Wiederholen übernimmt die zuletzt eingegebene Richtung, Anzahl und den Abstand.

---

## 10. Gruppen, mehrere zugleich, duplizieren, löschen

**Mehrere Elemente zugleich.** Ist mehr als ein Element ausgewählt, zeigt der Bereich Einstellungen die Position der ganzen Auswahl (den Mittelwert ihrer Positionen) und jede Einstellung, die alle haben: eine Breite, wenn alle Linien sind, Spiegeln und Wiederholen, sofern keine BDC-Marke darunter ist, und so weiter. Eine davon zu ändern ändert sie bei allen, als ein Rückgängig-Schritt; ein Feld, in dem sie sich unterscheiden, zeigt *gemischt*, bis Sie es setzen.

**Gruppieren** fasst die ausgewählten Elemente (zwei oder mehr) zu einer Gruppe zusammen, die sich dann als Ganzes auswählen, verschieben und bearbeiten lässt. Gruppen verschachteln sich nicht: Elemente einer bestehenden Gruppe mit anderen zu gruppieren ergibt eine neue Gruppe aus allen. **Gruppierung aufheben** löst die ausgewählte Gruppe auf. Eine Gruppe, die nur noch ein Element hat, löst sich von selbst auf.

**Duplizieren** kopiert die Auswahl um 1 mrad (oder 1 MOA) nach rechts und unten und wählt die Kopie aus; die Kopie einer ganzen Gruppe ist eine eigene Gruppe. **Löschen** (oder die Taste Entf oder Rücktaste) entfernt sie.

---

## 11. Zahlen

Eine Zahl ist eine Reihe von Ziffern, nur 0–9, höchstens 12 — mit nichts anderem beschriften Absehen ihre Teilungsstriche. Ihre **Ziffernhöhe** ist die Höhe einer Ziffer; ihr **Ankerpunkt** ist der Punkt, auf den sich ihre Position bezieht: ihr **Linkes Ende**, ihre **Mitte** oder ihr **Rechtes Ende**, auf halber Ziffernhöhe. Eine Beschriftung rechts von einem Teilungsstrich verankert man am einfachsten am linken Ende: So hält sie ihren Abstand, wie viele Ziffern sie auch hat.

Fünf Schriften stehen zur Wahl: **B612** Regular (die Voreinstellung, für Cockpit-Anzeigen entworfen), **Barlow** Light und Regular sowie **Overpass** Light und Regular. Alle stehen unter der SIL Open Font License; die Ziffern sind als Umrisse in die App eingebaut, es wird also keine Schrift geladen.

---

## 12. SVG-Formen

Für alles, was die Elemente nicht zeichnen können — eine Zielmarke in Form eines Herstellerlogos, einen ungewöhnlichen Ring, eine Entfernungsmessskala —, importieren Sie eine SVG-Zeichnung. Tippen Sie in der Palette auf **SVG-Form**, wählen Sie dann eine Datei oder fügen Sie den Code ein und tippen Sie auf **Eingefügten Code lesen**. Eine Vorschau zeigt, was hineinkommt; **Ins Absehen einfügen** fügt es hinzu.

Nur die Formen werden übernommen. Jede sichtbare Füllung und Kontur wird zu Absehen-Tinte, gleich in welcher Farbe, mit den Konturbreiten der Datei. Beschneidungen und Masken werden ignoriert (die Formen werden ganz gezeichnet), gestrichelte Konturen werden durchgehend gezeichnet, und Linienmarker und eingebettete Bilder werden weggelassen; die Vorschau sagt es, wenn das geschieht. Text muss zuerst in Pfade umgewandelt werden (in Inkscape: Pfad → Objekt in Pfad umwandeln).

Die Zeichnung kommt mit dem eigenen Ursprung der SVG in der Absehenmitte hinein, so skaliert, dass ihre längere Seite 5 mrad (15 MOA) misst. Setzen Sie ihre echte Größe in ihren Einstellungen, auf drei Arten, die alle denselben Maßstab ändern: **1 SVG-Einheit =** ein Winkel, oder die **Breite** oder **Höhe** der Zeichnung. **Form beim Spiegeln spiegeln** entscheidet, ob eine gespiegelte Kopie ein Spiegelbild ist oder dieselbe Zeichnung, nur auf die andere Seite versetzt.

Beim Laden wird die Datei auf überkomplizierte oder bösartige Inhalte geprüft und abgelehnt, wenn sie größer als 2 MB ist, mehr als 5000 Elemente hat, tiefer als 32 Ebenen verschachtelt ist, mehr als 100 000 Pfadsegmente oder 1000 wiederverwendete Kopien hat, Längen in anderen Einheiten als einfachen Benutzereinheiten oder px verwendet, ein DOCTYPE enthält oder zu lange zum Lesen braucht. Eine große Zeichnung ergibt ein großes Absehen (§2): Vereinfachen Sie sie, wenn möglich, vor dem Import im Zeichenprogramm.

---

## 13. BDC-Marken

Eine BDC-Marke (aus dem Englischen „Bullet Drop Compensation", also „Ausgleich des Geschossabfalls"; einfach gesagt eine Haltepunktmarke) ist ein Haltepunkt für eine andere Distanz als die Einschussdistanz: der Teilungsstrich, Punkt oder Chevron unter der Mitte, mit dem man auf 300, 400, 500 m zielen soll. Im Designer wird das sichtbare Merkmal mit den Elementen oben gezeichnet; die BDC-Marke ist ein eigener, unsichtbarer Punkt, der den Winkel dieses Haltepunkts angibt. Sie sitzt auf der senkrechten Achse — nur ihre Höhe wird gesetzt — und wird nie gespiegelt, wiederholt oder beleuchtet. Die Ansicht zeigt sie als blaue Markierung, ausgeblendet mit **BDC-Marken anzeigen**.

Die Zielfernrohransicht des Feldrechners berechnet für die aktuellen Bedingungen, für welche Distanz jede BDC-Marke gilt, und beschriftet sie damit (siehe **Zielfernrohransicht** im [Haupthandbuch](#/manual)). Setzen Sie eine Marke auf jede Haltepunktstufe, die das Absehen vorsieht, in der Höhe, die das Datenblatt angibt.

---

## 14. Ein ganzes Absehen einfügen

**Ganzes Absehen einfügen…** in der Dateileiste kopiert ein anderes Absehen — eines Ihrer eigenen oder ein mitgeliefertes — in das, das Sie bearbeiten: jedes Element, an seiner Stelle im Original, mit seinen Gruppen und Beleuchtungseinstellungen. Nichts wird umgerechnet: Jeder Winkelwert kommt so hinein, wie er gezeichnet wurde, auch wenn das Original für eine andere Art von Zielfernrohr oder eine andere Kalibrierungsvergrößerung gezeichnet wurde (der Bereich weist darauf hin). Ist Ihr Absehen nicht beleuchtet und das Original schon, übernimmt es die Beleuchtung des Originals; hat Ihres noch keinen Hersteller und kein Modell, übernimmt es die des Originals.

Die eingefügten Elemente kommen ausgewählt an, als ein Rückgängig-Schritt, sodass Sie sie zusammen verschieben oder auf einmal wieder löschen können. In ein leeres Absehen einzufügen ist der schnelle Weg, eine Variante zu beginnen: Öffnen Sie ein neues Absehen, fügen Sie dasjenige ein, von dem es abweicht, ändern Sie, was abweicht, und speichern Sie es unter seinem eigenen Modellnamen.

---

## 15. Speichern, verwerfen, neu beginnen

- **Im Arsenal speichern** speichert das Absehen im Arsenal und lässt Sie im Designer, mit einem kurzen *„Im Arsenal gespeichert."* Ein aus dem Arsenal geöffnetes Absehen wird über sich selbst gespeichert; ein neues wird zu einem neuen Absehen im Arsenal. Hersteller und Modell zusammen sind sein Name: Trägt ein anderes Ihrer Absehen schon diesen Namen, werden Sie gefragt, ob es ersetzt werden soll. Solange nichts ungespeichert ist, heißt die Schaltfläche **Zurück zum Arsenal** und bringt Sie zum Reiter Zielfernrohre.
- **Änderungen verwerfen** kehrt nach Rückfrage zum zuletzt gespeicherten Absehen zurück (oder zu einem leeren, wenn es nie gespeichert wurde), und sein Rückgängig-Verlauf geht mit. Ein aus dem Arsenal geöffnetes Absehen bringt Sie danach dorthin zurück. Die Schaltfläche ist aus, solange es nichts zu verwerfen gibt.
- **Neues Absehen** beginnt ein leeres, mit Rückfrage, wenn das aktuelle ungespeicherte Änderungen hat. Ihre Optionen und die für neue Elemente gemerkten Werte bleiben, wie sie sind.

Ein Absehen lässt sich aus dem Arsenal in eine Datei speichern, allein oder mit allem anderen (siehe das [Arsenal-Handbuch](#/manual/arsenal), §8).

---

## 16. Tastatur

| Taste | Wirkung |
|---|---|
| Strg+Z / Cmd+Z | Rückgängig |
| Strg+Umschalt+Z, Strg+Y / Cmd+Umschalt+Z | Wiederholen |
| Pfeiltasten | Die Auswahl um einen Rasterschritt verschieben (0,1 mrad oder 0,25 MOA) |
| Umschalt + Pfeiltasten | Sie um zehn Schritte verschieben |
| Entf, Rücktaste | Die Auswahl löschen |
| Esc | Das in der Palette gewählte Element ablegen; ist keines gewählt, die Auswahl aufheben |
| Eingabe, Leertaste (in der Liste) | Die fokussierte Zeile auswählen |

Keine davon wirkt, während Sie in ein Feld tippen.

---

## 17. In der Praxis

### 17.1 Nach einem Datenblatt zeichnen

Datenblätter der Hersteller geben meist eine Zeichnung und eine Maßtabelle. Wo die beiden sich widersprechen, gilt die Tabelle: Die Zeichnung ist eine Illustration, die Tabelle ist die Spezifikation. Lesen Sie jedes Maß in der Einheit des Datenblatts ab, stellen Sie den Designer auf diese Einheit und tippen Sie die Werte ein, statt die Elemente an ihren Platz zu ziehen. Tragen Sie unter **Quelle / Anmerkungen** Namen und Datum des Datenblatts ein, damit Sie später wissen, woher die Zahlen stammen.

### 17.2 Ein typisches Absehen mit Teilungsstrichen

1. Eine **Vertikale Linie** vom oberen bis zum unteren Rand des Sehfelds und eine **Horizontale Linie** von Seite zu Seite, in der Fadenbreite.
2. Eine kurze **Horizontale Linie** für den ersten Teilungsstrich unter der Mitte, bei 1 mrad; haken Sie **Wiederholen** an, Richtung *nach unten*, die Anzahl der Teilungsstriche minus eins, Abstand 1 mrad.
3. Eine kürzere für den halben Teilungsstrich bei 0,5 mrad, ebenso wiederholt.
4. Dasselbe für den waagrechten Faden, mit einer kurzen **Vertikalen Linie**, **Wiederholen** nach rechts und **Horizontal spiegeln** für die linke Seite.
5. **Zahlen** neben jedem zweiten oder fünften Teilungsstrich, am linken Ende verankert, gespiegelt, wo das Datenblatt beide Seiten nummeriert.
6. **Horizontale** und **vertikale verjüngte Balken** bis zum Rand des Sehfelds, beginnend dort, wo laut Datenblatt die dicken Balken beginnen; den horizontalen spiegeln.

### 17.3 Ein BDC-Absehen

Zeichnen Sie zuerst die sichtbaren Merkmale — Teilungsstriche, Punkte oder Chevrons, mit ihren Zahlen, falls vorhanden. Setzen Sie dann eine **BDC-Marke** auf jede Kompensationsstufe, die das Datenblatt angibt, und tippen Sie ihre Höhe in **Marke y** ein. Speichern Sie, führen Sie das Absehen im Arsenal bei seinem Zielfernrohr auf, setzen Sie das Zielfernrohr auf Ihr Gewehr und sehen Sie es sich in der Zielfernrohransicht des Feldrechners mit eingeschalteten BDC-Distanzen an: Jede Marke zeigt die Distanz, die zum Geschossabfall Ihres Geschosses, in Ihrer Patrone, in der heutigen Luft passt.

---

## 18. Grenzen

- Höchstens 500 wiederholte Kopien pro Element und höchstens 12 Ziffern pro Zahl.
- Keine Position und keine Abmessung über eine halbe Drehung hinaus.
- SVG-Formen: die Grenzen in §12.
- Der Rückgängig-Verlauf behält die letzten 1000 Schritte und beginnt neu bei einem neuen Absehen, beim Öffnen eines anderen, bei Änderungen verwerfen und beim Neuladen.
- Das gezeichnete Sehfeld ist eine Annahme (§5), nicht das Ihres Zielfernrohrs.
