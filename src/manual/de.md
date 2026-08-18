# geladen.ch ballistics — Benutzerhandbuch

*Friedlich. Präzise. Bewaffnet.*

geladen.ch ballistics ist eine rein clientseitige Suite für die äußere
Ballistik. Alles — Flugbahnintegration, Trefferwahrscheinlichkeits-Analyse,
Ihre gespeicherten Gewehre und Geschosse — läuft in Ihrem Browser. **Es
werden niemals Daten erfasst oder an einen Server übertragen.** Die App
funktioniert offline, sobald sie geladen wurde, und lässt sich auf Desktop
und Mobilgeräten als App installieren (PWA).

Dieses Handbuch behandelt die voll funktionsfähigen Werkzeuge — **Flugbahn**,
**Waffen**, **Cd-Mach-Kurve** und **Einstellungen** — sowie
**Trefferwahrscheinlichkeit**, den **Feldrechner** und die **BC-Werkzeuge**,
die alle für ihre aktuellen Szenarien nutzbar sind, aber noch aktiv
weiterentwickelt werden. Alles andere auf der Startseite ist am Ende unter
**Geplant / in Arbeit**
aufgeführt.

---

## Installation der App

### Android (Chrome)

Chrome kann diese App installieren, sodass sie sich wie jede andere App auf
Ihrem Telefon verhält — ein eigenes Symbol auf dem Startbildschirm, ein
eigenes Fenster ohne Browserleiste, und sie funktioniert weiterhin offline.

- Öffnen Sie die App in Chrome.
- Tippen Sie oben rechts auf das Menü **⋮** und wählen Sie **App
   installieren** (in älteren Chrome-Versionen heißt dies **Zum
   Startbildschirm hinzufügen**).
- Bestätigen Sie. Ein Symbol erscheint auf Ihrem Startbildschirm oder in
   der App-Übersicht, wie bei jeder anderen installierten App.

**Ein eigenes Symbol für den Feldrechner.** Da der Feldrechner Teil
derselben App ist, können Sie ihm ein eigenes Symbol geben, das direkt an
der Startseite vorbei öffnet:

- Öffnen Sie in Chrome die App und wechseln Sie zum **Feldrechner**.
- Öffnen Sie erneut das Menü **⋮** — während der Feldrechner geöffnet ist —
   und wählen Sie **Zum Startbildschirm hinzufügen**.
- Wenn Chrome nach einem Namen fragt, vergeben Sie z. B. „Feldrechner",
   damit Sie die beiden Symbole leicht unterscheiden können.

Tippen auf dieses zweite Symbol öffnet die App direkt im Feldrechner, ohne
über die Startseite zu gehen — praktisch, wenn das im Feld das einzige
Werkzeug ist, das Sie nutzen. Beide Symbole zeigen aktuell dasselbe Bild;
nur die Namen unterscheiden sich.

### iPhone / iPad (Safari)

Das funktioniert nur in **Safari** — andere Browser auf dem iPhone (auch
Chrome) dürfen keine Apps zum Startbildschirm hinzufügen.

- Öffnen Sie die App in Safari.
- Tippen Sie auf das Symbol **Teilen** (das Quadrat mit dem Pfeil nach
   oben, in der unteren Symbolleiste — auf dem iPad oben).
- Scrollen Sie in der erscheinenden Liste nach unten und tippen Sie auf
   **Zum Home-Bildschirm**.
- Bestätigen Sie den Namen (oder ändern Sie ihn) und tippen Sie oben
   rechts auf **Hinzufügen**.

Ein Symbol erscheint auf Ihrem Startbildschirm und öffnet die App in einem
eigenen Fenster ohne Safari-Adressleiste — genau wie bei Android.

**Ein eigenes Symbol für den Feldrechner** funktioniert genauso: Öffnen Sie
zuerst den **Feldrechner** in der App, wiederholen Sie dann **Teilen → Zum
Home-Bildschirm**, während diese Seite geöffnet ist, und vergeben Sie einen
unterscheidbaren Namen wie „Feldrechner". Wie bei Android zeigen beide
Symbole aktuell dasselbe Bild; nur die Namen unterscheiden sich.

## Flugbahn

Berechnet eine vollständige Tabelle und ein Diagramm für Fall, Windabtrieb,
Geschwindigkeit und Flugzeit für das aktive Gewehr, die aktive Patrone und
das aktive Geschoss (festgelegt unter **Waffen**, unten), mit einem
Punktmassen-RK4-Integrator.

**Die Eingaben** beginnen mit dem aktiven Gewehr und der aktiven Ladung, als
kurze Zusammenfassung mit einer Schaltfläche **Ändern** zurück zu Waffen,
gefolgt von einem Atmosphäre-Abschnitt und einigen Einstellungen, die nur
diese Tabelle und dieses Diagramm betreffen:

- **Maximale Distanz** / **Distanzschritt** — wie weit, und in welchen
  Schritten, die Tabelle berechnet wird.
- **Ziellinienwinkel** — Steigung/Gefälle des Schusses, in Grad, positiv
  bergauf. Für einen ebenen Schuss auf 0 belassen.

**Die Tabelle** zeigt eine Zeile pro Distanzschritt, mit ein-/ausschaltbaren
Spalten (Fall, Windabtrieb, Höhen-/Windkorrekturen in Klicks/mrad/MOA,
Geschwindigkeit, Flugzeit, Mach, Energie). Die Höhenkorrektur ist so
vorzeichenbehaftet, wie Sie ein Zielfernrohr tatsächlich verstellen würden:
Ein Geschoss, das unter die Ziellinie gefallen ist, wird als *positive*
Anzahl an Klicks angezeigt, die nach **oben** gedreht werden müssen.

Sie können **die Tabelle als CSV-Datei herunterladen** oder **als CSV in die
Zwischenablage kopieren** — beides verwendet genau die aktuell aktivierten
Spalten sowie das unter Einstellungen → CSV-Export festgelegte
Feld-/Dezimaltrennzeichen (damit die Datei in der Tabellenkalkulations-Locale
Ihrer Wahl korrekt geöffnet wird).

**Das Diagramm** stellt eine beliebige Spalte über der Distanz dar, mit
eigenem unabhängigem Zoom/Verschieben (die beiden Distanz-Schieberegler
darunter ziehen — minimales Fenster 50 m). Es kann als **SVG heruntergeladen**
werden (das kleine Symbol über dem Diagramm) — ein Format, das für die
spätere Ansicht oder Bearbeitung nicht von dieser App abhängt.

## Trefferwahrscheinlichkeit

Schätzt die Wahrscheinlichkeit, ein Ziel bei einem gewählten Schussszenario
zu treffen, und verbindet dazu Ihr Gewehr und Ihre Ladung mit Ihrer eigenen
Schießpräzision und der Unsicherheit bei der Distanz-, Temperatur-, Druck-
und Windschätzung. **Noch in aktiver Entwicklung** — weitere Szenarien und
Ziele sind geplant; verstehen Sie die Ergebnisse als Anhaltspunkt, nicht als
verlässliche Vorhersage.

**Gewehr & Geschoss** zeigt dieselbe Zusammenfassung wie Flugbahn — die
aktive, unter **Waffen** festgelegte Konfiguration; mit **Ändern** wählen
oder bearbeiten Sie sie.

**Unsicherheit** legt die Größe jeder Fehlerquelle fest:

- **Eigene Fehler** — Mündungsgeschwindigkeits-Konsistenz (Streuung), sowie
  entweder detailliert Waffenpräzision + Schützenfertigkeit + Schießposition,
  oder eine einzelne vereinfachte Gesamtpräzisionsangabe (eine Streukreisgröße
  mit ihrer Konvention: ES-5, ES-10, R50 oder R99).
- **Bedingungsfehler** — Distanz-, Temperatur-, Druck- und Windschätzfehler;
  wenn **Bewegliches Ziel** aktiviert ist, zusätzlich die Querbewegung des
  Ziels und der Fehler bei deren Schätzung.

**Simulation** legt Distanz, Ziel, Atmosphäre (Temperatur, Druck, Höhe,
Luftfeuchtigkeit), einen optionalen Gefechtszero (Gewehr auf eine andere
Distanz als das Ziel eingeschossen) und einen Zielpunkt-Versatz fest.

**Szenarien:**

- **Einzelschuss** — ein einzelner Schuss; jede eigene Fehler- und
  Bedingungsfehlerquelle wirkt sich direkt aus.
- **Von Beobachter korrigierter Schuss** — ein Einschuss wird abgegeben und
  sein Treffer von einem Beobachter angesagt, wodurch der systematische
  Versatz im Erwartungswert aufgehoben wird; der Restfehler des korrigierten
  Schusses besteht aus seiner eigenen Streuung plus der Ungenauigkeit der
  Beobachterkorrektur. Bedingungsfehler treten beim korrigierten Schuss nicht
  erneut auf, da die Ansage des Beobachters ihre Wirkung auf den Einschuss
  bereits berücksichtigt.

**Ziele** — eine 40 × 60 cm-Scheibe (eine einzelne Treffer-/Fehlzone) und die
ISSF-300m-Scheibe (zehn Wertungsringe). Weitere Ziele sind geplant.

**Ergebnisse** zeigen die Gesamttrefferwahrscheinlichkeit, die
Wahrscheinlichkeit pro Zone, den Score als Prozentsatz des Maximums, eine
Tabelle mit dem horizontalen/vertikalen/gesamten Beitrag jeder Fehlerquelle
sowie eine Darstellung des Ziels mit einer Beispiel-Streuwolke, mittlerem
Treffpunkt und 95-%-Ellipse — als SVG herunterladbar.

## Feldrechner

Eine schnelle Lösung für eine einzelne Distanz: Klickwerte für einen Schuss,
sofort, groß genug, um sie auf Armlänge oder in praller Sonne abzulesen —
keine Tabelle, keine Analyse. Das gesamte Gestaltungsziel ist es, im Moment
des Einstellens nur das zu zeigen, was gerade gebraucht wird: kein
Kopfbereich, kein Beiwerk über eine kleine Navigation hinaus, keine Zahl, die
gerade nicht benötigt wird.

Beim Öffnen ersetzt eine eigene Navigation die normale der App — **Ziel**,
**Wind**, **Atmosphäre**, **Waffen** (springt zu Eigene/Arsenal; „Fertig"
bringt Sie hierher zurück) und **Feldrechner verlassen** (führt immer zurück
zur Startseite). Auf einem Smartphone oder Tablet, das dies unterstützt,
wird der Bildschirm am Einschlafen gehindert, solange der Feldrechner
geöffnet ist, damit er nicht mitten in einer Schussserie dunkel wird.

- **Ziel** — Distanz und Ziellinienwinkel. Derzeit absichtlich nur diese
  beiden Felder; ein umfassenderer Ziel-/Standortmodus ist geplant, der
  diesen Tab ersetzt, ohne Wind oder Atmosphäre zu berühren.
- **Wind** — Geschwindigkeit (großer +/−-Regler) und Richtung (derselbe
  Regler wie anderswo, hier vergrößert).
- **Atmosphäre** — Temperatur, Druck, Höhe, Luftfeuchtigkeit und
  Voreinstellungen — dieselben Felder wie bei Flugbahn, nur ohne Wind, der
  hier einen eigenen Tab hat.

**Die Ausgabe** wird bei jeder Eingabeänderung sofort neu berechnet — ohne
Berechnen-Schaltfläche. Höhe und Seite werden in ganzen Klicks angezeigt
(nach den Klickeinstellungen des aktiven Gewehrs aus Waffen), jeweils mit
vorangestelltem Richtungssymbol: aufwärts/abwärts für die Höhe, links/rechts
für die Seite. Wählen Sie zwischen einem Pfeilsymbol oder einem
**+ / −**-Zeichen (Einstellungen → **Anzeigesymbole im Feldrechner**) — **+**
bedeutet immer nach oben oder nach rechts drehen. Eine kleine Fußzeile zeigt
zusätzlich Flugzeit, Restgeschwindigkeit und Restenergie. Wird ein Feld
gerade bearbeitet (z. B. kurzzeitig leer), zeigt die Anzeige ein einfaches
**—** statt eines fehlerhaften Ergebnisses.

Verwendet dasselbe aktive Gewehr, dieselbe Patrone und dasselbe Geschoss wie
Flugbahn und Trefferwahrscheinlichkeit (festgelegt unter **Waffen**) sowie
denselben Nullpunkt — hier gibt es keine separate Gefechtsnullpunkt-
Einstellung.

## Waffen

Das Gewehr, die Patrone und das Geschoss, die von jedem Werkzeug verwendet
werden, das sie benötigt — derzeit **Flugbahn** und
**Trefferwahrscheinlichkeit**. Überall dort, wo ein Werkzeug diese
Konfiguration braucht, zeigt es eine kurze Zusammenfassung (Name, Quelle,
Mündungsgeschwindigkeit) mit einer Schaltfläche **Ändern**, die hierher
führt; was Sie hier wählen oder bearbeiten, gilt überall und **bleibt über
einen Neustart hinweg erhalten**.

**Ändern** führt Sie zu dem der beiden untenstehenden Reiter, der zur
Quelle des aktiven Gewehrs passt — **Arsenal**, wenn es eines Ihrer eigenen
gespeicherten Gewehre ist, sonst **Eigene**. Auf Mobilgeräten ersetzt das
Öffnen von Waffen die untere Leiste durch **Eigene** / **Arsenal** /
**Fertig**; auf dem Desktop wechselt die Seitenleiste auf dieselbe Weise.
**Fertig** bringt Sie zurück zu dem Werkzeug, von dem aus Sie hierher
gekommen sind.

### Eigene

Wählen Sie ein integriertes Gewehr, eines Ihrer eigenen Arsenal-Gewehre,
oder geben Sie ein Gewehr und ein Geschoss vollständig von Hand ein — alle
drei Optionen befinden sich im selben Formular. Einige Felder verdienen eine
kurze Erklärung:

- **Einschussdistanz** — die Distanz, auf die das Gewehr eingeschossen ist.
  Die Berechnung ermittelt selbst den Abschusswinkel, bei dem das Geschoss
  auf dieser Distanz die Ziellinie trifft; Sie stellen den Winkel nicht
  selbst ein.
- **Mündungsgeschwindigkeit vs. Temperatur** — modelliert optional, wie sich
  die Mündungsgeschwindigkeit einer Patrone mit der Pulvertemperatur
  ändert, anstatt einen festen Wert zu verwenden.
- **Geschosswiderstand** — entweder ein ballistischer Koeffizient (BC) mit
  einem Standard-Luftwiderstandsmodell G1/G7, oder, bei Bibliotheksgeschossen,
  die eine solche besitzen, eine direkt gemessene Cd-Mach-Tabelle (genauer,
  ohne BC).

**Gewehr zum Arsenal hinzufügen** / **Geschoss zum Arsenal hinzufügen**,
neben den jeweiligen Feldern, speichern den aktuellen Eintrag in Ihrer
eigenen Arsenal-Bibliothek (unten) zur Wiederverwendung.

### Arsenal

Ihre eigene Bibliothek aus Gewehren und Geschossen, nur auf diesem Gerät
gespeichert (lokaler Speicher des Browsers) — nichts davon verlässt jemals
Ihren Browser.

**Integrierte Bibliotheken.** Die App wird mit einer integrierten Bibliothek
gängiger Gewehre und Geschosse ausgeliefert, die neben allem angezeigt wird,
was Sie selbst hinzufügen (Ihre eigenen Einträge sind mit einem
vorangestellten „*" gekennzeichnet). Wenn Sie nicht möchten, dass die
integrierten Einträge Ihre Auswahllisten überladen — etwa weil Sie
ausschließlich eigene, selbst geladene Daten verwenden — **schalten Sie sie
einzeln in Einstellungen → Allgemein ab** („Integrierte Gewehrbibliothek
anzeigen" / „Integrierte Geschossbibliothek anzeigen"). Ihre eigenen
gespeicherten Einträge sind davon in keinem Fall betroffen.

**Einträge hinzufügen und verwalten.** Fügen Sie ein Geschoss entweder
komplett von Hand hinzu (Name, Kaliber, Masse, BC/Luftwiderstandsmodell oder
eine eingefügte Cd-Mach-Tabelle) oder indem Sie ein integriertes Geschoss
kopieren und anpassen. Fügen Sie ein Gewehr mit eigener Visierhöhe,
Einschussdistanz und Klickwerten hinzu und hängen Sie ihm dann eine oder
mehrere Patronen an (jede mit eigenem Geschoss und eigener
Mündungsgeschwindigkeit). „Aktivieren" bei einem Gewehr macht es zur überall
aktiven Konfiguration und bringt Sie zurück zu dem Werkzeug, von dem aus Sie
Waffen geöffnet haben.

Kaliber- und Herstellerfilter verkürzen lange Listen. Ein Geschoss oder
Gewehr, das bearbeitet, aber noch nicht exportiert wurde, zeigt das
Abzeichen „Ungespeichert".

**Bibliothek speichern und laden.** Da nichts auf einem Server liegt, ist
Ihre Bibliothek nur so sicher wie der lokale Speicher Ihres Browsers. **In
Datei speichern** (pro Gewehr/Geschoss, oder „Bibliothek speichern…" für
einen Export mit Mehrfachauswahl) schreibt eine JSON-Datei, die Sie sichern
oder auf ein anderes Gerät übertragen können; **Bibliothek laden…**
importiert eine solche Datei zurück, mit einer Wahlmöglichkeit pro Element,
wie Namenskonflikte gelöst werden (überschreiben, nur überschreiben wenn
neuer, oder beide behalten).

**Vergleich.** Markieren Sie bis zu zwei Ihrer eigenen gespeicherten
Gewehr+Patrone-Konfigurationen „zum Vergleich" (aus der jeweiligen
Gewehrzeile). Sobald zwei markiert sind, erscheint ein Vergleichsabschnitt
mit einem gemeinsamen Diagramm, das die Flugbahnen beider Konfigurationen
für dieselbe Spalte und dasselbe Distanzfenster darstellt — nützlich, um
zwei Ladungen oder zwei Gewehre direkt gegeneinander zu beurteilen. Wie das
Flugbahn-Diagramm hat es sein eigenes Zoom/Verschieben und kann als **SVG
heruntergeladen** werden.

## BC-Werkzeuge

Ermittelt einen ballistischen Koeffizienten aus bekannten Daten, oder
rechnet einen BC zwischen verschiedenen Modellen um — zusammengefasst in
einem Werkzeug mit den Reitern **BC-Berechnung**, **BC-Umrechnung** und
**BC-Labradar**. Die **BC-Berechnung** ist bereits voll nutzbar; **BC-
Umrechnung** und **BC-Labradar** (Import einer vollständigen,
radargemessenen Geschwindigkeitsspur) sind **noch geplant**.

Die **BC-Berechnung** ermittelt einen ballistischen Koeffizienten aus einem
nahen Geschwindigkeits-/Distanzpaar und entweder einer fernen Geschwindigkeit
oder einer gemessenen Flugzeit zwischen den beiden Distanzen, sowie einem
Luftwiderstandsmodell (G1/G7) und der Atmosphäre. Wechseln Sie zwischen den
Eingabemodi **Geschwindigkeit** und **Flugzeit**, je nachdem, was Sie
gemessen haben (z. B. zwei Chronografmessungen, oder eine einzelne
Flugzeitmessung über eine bekannte Distanz) — alles andere (nahe
Geschwindigkeit, beide Distanzen, Luftwiderstandsmodell, Atmosphäre) bleibt
in beiden Fällen gleich. Nützlich, wenn Sie den tatsächlichen
Geschwindigkeitsverlust oder die tatsächliche Flugzeit über eine bekannte
Distanz gemessen haben und den BC ermitteln möchten, der dies erklärt,
anstatt sich auf einen veröffentlichten Wert zu verlassen.

## Cd-Mach-Kurve

Ermittelt die eigene Widerstandskurve eines Geschosses (Cd über Mach) aus
einer gemessenen Distanz-/Geschwindigkeitstabelle — z. B. Doppler-Radar-
oder Mehrfach-Chronografmessungen —, indem der Luftwiderstandsbeiwert
abschnittsweise ermittelt wird, statt eine Standardform (G1/G7)
anzunehmen. Funktioniert am besten mit einer dünn besetzten Tabelle
(Chronografmessungen alle ~100 m); dicht besetzte Tabellen (10–20 m
Schrittweite) funktionieren ebenfalls, aber der Rundungsfehler jeder
einzelnen Zeile wirkt sich dann stärker auf das Ergebnis genau dieses
Abschnitts aus.

**Distanz-/Geschwindigkeitstabelle** — fügen Sie ein Distanz-/
Geschwindigkeitspaar pro Zeile ein (getrennt durch Tabulator, Leerzeichen
oder Semikolon; Dezimalpunkt oder -komma sind beide zulässig), mindestens
3 Zeilen. **Tabelleneinheiten** legt fest, ob die eingefügten Zahlen
**Modern (m, m/s)** oder **Archaisch (yd, fps)** sind — unabhängig von
Ihrer eigenen Einheiteneinstellung, da die Einheiten der Quelldaten nicht
mit denen übereinstimmen müssen, die Sie sonst in der App bevorzugen.

Unterhalb der Tabelle: dieselben Masse- und Kaliberfelder wie im Arsenal,
sowie ein eigenständiger Abschnitt **Atmosphäre** (Standard: Standard-
atmosphäre auf Meereshöhe) — der Löser braucht beides, um für jeden
Abschnitt eine synthetische Flugbahn zu berechnen und so den Cd-Wert zu
ermitteln, der den gemessenen Geschwindigkeitsverlust reproduziert.

**Berechnen** erzeugt zwei Tabellen:

- **Interpoliert** — die ermittelte Kurve, zurückgelesen an einem festen,
  dichten Satz von Referenz-Mach-Zahlen; dies ist die Tabelle für die
  Weiterverwendung (z. B. Speichern ins Arsenal).
- **Berechnet (roh, pro Abschnitt)** — die zugrundeliegenden Werte pro
  Abschnitt vor der Interpolation, standardmäßig ausgeblendet (**Tabelle
  pro Abschnitt (berechnet) anzeigen**).

Beide Tabellen können **als CSV heruntergeladen** oder **als CSV kopiert**
werden (das Feld-/Dezimaltrennzeichen aus Einstellungen → CSV-Export gilt
auch hier). Ein Abschnitt, den der Löser nicht verwerten konnte — die
Geschwindigkeit nahm nicht ab, die Distanz nahm nicht zu, oder die Lösung
konvergierte nicht — wird übersprungen und aufgelistet, ohne den Rest der
Tabelle zu beeinträchtigen.

**Das Diagramm** zeigt die berechneten Punkte und die interpolierte Kurve,
zusammen mit den Referenzkurven G1 und G7, skaliert auf Übereinstimmung
mit der eigenen Kurve bei Mach 2.0 — ein schneller visueller Eindruck,
wie standardmäßig (oder nicht) die Widerstandsform dieses Geschosses ist.
Herunterladbar als SVG, ebenso wie das Diagramm der Flugbahn.

**Ins Arsenal speichern** führt zum Formular „Geschoss hinzufügen" im
Arsenal, mit vorausgefüllter Masse, Kaliber und Cd-Mach-Tabelle — wählen
Sie **Berechnet (roh, pro Abschnitt)** oder **Interpoliert (geglättet)**
als Quelle neben der Schaltfläche. Erst aktiviert, sobald ein Ergebnis
vorliegt.

## Einstellungen

- **Sprache** — English, Français, Русский, Deutsch, Italiano.
- **Einheiten** — eine bevorzugte Einheit pro Messgröße (Geschwindigkeit,
  Distanz, kleine Längen, Höhe, Temperatur, Druck, Winkelstreuung, Energie),
  metrisch und imperial frei mischbar; gilt überall dort, wo die Messgröße
  vorkommt.
- **Integrierte Bibliotheken** — integrierte Gewehr- und
  Geschossbibliotheken ein-/ausblenden (siehe **Waffen** oben).
- **Ballistische Modelle** — einzelne Standard-Luftwiderstandsmodelle (G1,
  G7, ...) in jeder Modellauswahl der App ein-/ausblenden, um sie auf die
  tatsächlich genutzten zu reduzieren. Ein ausgeblendetes Modell bleibt
  dort verfügbar, wo es bereits ausgewählt ist (ein manuell eingegebenes
  Geschoss, das eigene Modell eines Bibliotheksgeschosses) — das
  Ausblenden betrifft nur künftige Auswahlen, nie eine bestehende. Mindestens
  ein Modell muss immer sichtbar bleiben.
- **Design** — Auswahl aus drei bebilderten Miniaturansichten, sofort überall
  angewendet: **Dunkel** (Standard), **Kontrastreich hell** (weißer
  Hintergrund, schwarzer Text — für maximale Sichtbarkeit bei praller
  Sonne) und **Kontrastreich dunkel** (schwarzer Hintergrund mit maximal
  kontrastreichem Text und Farben — für wenn die Bildschirmhelligkeit hoch
  gestellt werden muss, um draußen etwas zu erkennen, und dabei Akku
  gespart werden soll).
- **Anzeigesymbole im Feldrechner** — ob die Höhe-/Seite-Anzeige des
  Feldrechners einen Richtungspfeil oder ein **+ / −**-Zeichen zeigt (siehe
  **Feldrechner** oben).
- **CSV-Export** — das Feldtrennzeichen (Komma/Semikolon/Tabulator) und das
  Dezimaltrennzeichen (Punkt/Komma) für den CSV-Download und das Kopieren in
  der Flugbahn. Wählen Sie das Paar, das Ihre Tabellenkalkulation erwartet.

---

## Geplant / in Arbeit

Auf der Startseite aufgeführt, aber noch nicht nutzbar:

- **Präzisionsrechner für Gewehre** — Gewehrpräzision anhand von Bildern von
  Zielscheiben mit Treffern messen.

Schauen Sie später wieder vorbei.
