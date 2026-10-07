# Apex Rennstall

Browserspiel, das ein selbst fahrbares **3D-Rennspiel** mit einem **Rennstall-Tycoon** verbindet. Gebaut mit React, TypeScript, Vite, three.js und HTML5-Canvas, ohne Backend und ohne Bild- oder Audiodateien.

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver (auch im LAN erreichbar, z. B. für das Smartphone)
npm run build      # Typprüfung + Produktionsbuild nach dist/
npm run preview    # Produktionsbuild lokal ansehen
npm run build:artifact   # Alles in eine einzelne HTML-Seite bündeln (artifact/apex-rennstall.html)
```

Der Spielstand wird automatisch im `localStorage` des Browsers gespeichert (mit Sicherheitskopie des vorherigen Stands). Läuft das Spiel als Artifact in claude.ai, liegt zusätzlich eine komprimierte Kopie im privaten Bereich der Artifact-Datenbank: Sie übersteht neue Versionen und gelöschte Browserdaten, und beim Start gewinnt der neuere Stand. Unter *Einstellungen → Spielstand* lässt er sich außerdem als Datei sichern und laden (oder als Text kopieren). Ein bewusst gelöschtes Team bleibt auf dem Titelbildschirm wiederherstellbar.

Das Team gilt ab der Gründung als fertig: Wenn Sponsorverträge auslaufen oder ein Fahrer geht, bleibt der Spielstand bestehen und die Stellen lassen sich neu besetzen.

## Spielprinzip

1. **Team gründen** in einem Schritt: Name und Farbe, fertig. Auto, zwei Fahrer und ein Sponsor sind schon dabei.
2. **Geld verdienen, ohne etwas zu tun:** Die Grundförderung und alle gebauten Anlagen bringen jede Sekunde Einnahmen. Oben im Bildschirm siehst du die Summe pro Sekunde; ein Klick darauf zeigt die Aufschlüsselung. Nach dem Schließen des Spiels verdienen die Anlagen bis zu einer Stunde lang zur Hälfte weiter.
3. **Ausgeben, indem du läufst:** Auf dem Teamgelände liegen leuchtende Kaufflächen. Stell dich darauf und bleib kurz stehen, schon wird gebaut oder ausgebaut. Wer nur darüber läuft, kauft nichts.
4. **Immer selbst fahren:** Die **Teststrecke** am unteren Rand des Geländes ist jederzeit offen. Saubere Runden und neue Bestzeiten bringen Geld. Die Rennen fährst du ebenfalls selbst (oder schaust zu oder simulierst sie).
5. **Aufträge** oben links führen durch das Spiel und zahlen Belohnungen. Ein Pfeil auf dem Gelände zeigt zum Ziel.

## Schrittweise Freischaltung mit Erklärungen

Am Anfang gibt es nur Teststrecke, Rennen und einen Kiosk. Alles andere kommt **strikt nacheinander**: Auf dem Gelände ist immer nur die **nächste** Fläche sichtbar und kaufbar. Sie braucht die vorherige Anlage und eine Mindestzahl gefahrener Rennen. Was noch fehlt, steht an der Fläche und im Büro unter „Dein Aufbau“. Bei jeder neuen Funktion erscheint eine Erklärung (jederzeit wieder abrufbar über das Info-Symbol oben rechts).

| Schritt | Feld | Schaltet frei | Mindestens gefahrene Rennen |
| --- | --- | --- | --- |
| 1 | Fan-Kiosk | Einnahmen pro Sekunde | 0 |
| 2 | Fanshop | mehr Einnahmen | 0 |
| 3 | Werkstatt | Upgrades, Reparatur, Chassis | 1 |
| 4 | Sponsoren-Lounge | Sponsoren-Verträge (und die Finanzübersicht) | 2 |
| 5 | Prüfstand | Training und Fahrzeugabstimmung | 3 |
| 6 | Tribüne | Einnahmen an der Teststrecke | 3 |
| 7 | Reifenlager | Planung vor dem Rennen: Startreifen, Tankmenge, Boxenstopps | 4 |
| 8 | Fahrerlounge | Fahrer, Verträge, Akademie | 5 |
| 9 | Personalbüro | Mitarbeiter | 6 |
| 10 | Forschungslabor | Forschungsbaum | 7 |
| 11 | Boxenmauer | Fahrstil, Aggressivität, Überholstrategie | 8 |
| 12 | Mediazentrum | größte Einnahmequelle | 9 |

Ab dem dritten Rennen kommt pro Rennen genau eine neue Funktion dazu. Die Anzeigen im Rennen (Reifen, Sprit, Schaden) und das Boxenmenü mit Reifenwahl, Nachtanken und Reparatur gibt es von Anfang an. Das Qualifying schaltet sich nach dem zweiten Rennen frei. Bis dahin wird der Startplatz automatisch ermittelt. Zufallsereignisse beginnen erst nach dem dritten Rennen.

## Die Stationen

Jede Station beginnt mit einer Erklärung „Das kannst du hier tun“ (ausblendbar) und teilt ihre Inhalte in Reiter auf, damit nie alles auf einmal zu sehen ist:

- **Büro:** Heute (nächstes Rennen, Aufbau, To-do), Team, Neuigkeiten. Dazu die **Finanzen** mit Überblick, Bereichen und Buchungen.
- **Transporter:** Rennwochenende mit Qualifying und Rennen sowie eine Zusammenfassung deiner Vorbereitung.
- **Prüfstand:** Training und Abstimmung. **Reifenlager:** Plan und Mischungen. **Boxenmauer:** Fahrstil, Zweikämpfe, Wetter.
- **Werkstatt, Sponsoren-Lounge, Fahrerlounge, Labor, Personalbüro, Pokalraum, Kalender:** jeweils mit eigenen Reitern bzw. Karten pro Aufgabe.

## Steuerung im Rennen

| Taste | Funktion |
| --- | --- |
| W / ↑ | Gas |
| S / ↓ | Bremse (im Stand: rückwärts) |
| A D / ← → | Lenken |
| Leertaste | Boost (begrenzte Energie, lädt beim Bremsen auf) |
| P / B | Boxenstopp anfordern oder absagen (immer verfügbar) |
| 1 – 5 · F · E | im Boxenmenü: Reifenmischung · Nachtanken · Reparatur |
| R | Auto auf die Strecke zurücksetzen |
| C | Kamera wechseln: Verfolger · Weit · Cockpit |
| L · T | Ideallinie · Zeitenliste |
| Esc | Pause |

Auf Touch-Geräten erscheinen virtuelle Tasten.

**Rennstart:** Fünf Lichter gehen nacheinander an und nach einer zufälligen Pause alle zugleich aus. Erst dann gibst du Gas: Deine Reaktionszeit wird eingeblendet (unter 0,25 s perfekt, bis 0,4 s gut, bis 0,7 s spät, darüber verschlafen). Wer beim Ausgehen der Lichter schon auf dem Gas steht, begeht einen **Fehlstart** und bleibt gut anderthalb Sekunden stehen. Beim Zuschauen und Simulieren übernimmt das Team den Start, die Gegner starten mit leicht verschiedenen Reaktionen.

**Boxengasse:** Mit P meldest du dich an die Box. Eine Anzeige oben zählt die Meter bis zur Einfahrt herunter und sagt, auf welcher Seite die Boxengasse liegt. Sie zweigt kurz vor Start und Ziel von der Strecke ab, hat eine Boxenmauer, eine Fahrspur mit Tempo 90 und eine Arbeitsspur vor den Garagen. Das Auto fährt dort geführt: Ein Mechanikerteam wechselt die Reifen, danach gibt die Ausfahrtsampel die Strecke frei. Du kannst auch ohne P einfach auf die breite Zufahrt abbiegen: Dann meldet dich das Team automatisch an und schlägt Reifen vor. In der Gasse sagt P den Stopp noch ab (dann fährst du nur durch). Verpasst du die Einfahrt, gilt der Wunsch für die nächste Runde; in der letzten Runde wird kein Stopp mehr gemacht. Auf der Teststrecke lässt sich die Gasse nur durchfahren. Die KI macht ihre Stopps nach demselben Prinzip.

**Fahrgefühl:** Die Kamera hängt tief hinter dem Auto und schaut weit voraus, das Sichtfeld wächst mit dem Tempo. Es gibt keine Bremsanweisungen: Du bremst nach den Schildern an der Strecke (3 – 2 – 1 Striche bei 150, 100 und 50 m) und nach Gefühl. Wer Hilfe möchte, schaltet unter *Einstellungen → Fahrhilfen* die Kurvenvorschau oder die Ideallinie ein. Ohne WebGL fällt das Spiel automatisch auf eine einfache Draufsicht zurück.

**Tastenbelegung:** Alle Tasten lassen sich unter *Einstellungen → Fahren → Tastenbelegung* ändern (pro Aktion zwei Tasten, Konflikte werden gemeldet, „Standardtasten wiederherstellen“ setzt alles zurück). Die Richtungstasten gelten auch zum Laufen auf dem Gelände. Fest sind nur Esc (Pause) und 1 bis 5 im Boxenmenü.

**Gegner:** Jeder KI-Fahrer hat pro Rennen eine Tagesform (Team und Fahrer), pro Runde eine Stimmung (Glanzrunde oder unsaubere Runde), fährt je Runde eine leicht andere Spur und pendelt auf Geraden neben der Ideallinie. Dazu kommen Fehler: Verbremser, Ausrutscher ins Gras und unsichere Phasen. Die Ideallinie läuft auf Geraden mittig und geht erst vor Kurven nach außen (außen – innen – außen).

## Die Managerin

Über die Sprechblase oben rechts erreichst du **Katrin Vogel**, deine Managerin. Sie hat zwei Aufgaben:

- **Vertragswarnungen:** Läuft ein Vertrag von Fahrern oder Sponsoren nur noch 3 Rennen und noch einmal 1 Rennen, schickt sie nach dem Rennen eine Nachricht. Sie erscheint als Hinweisfenster mit Knöpfen zur Fahrerlounge bzw. Sponsoren-Lounge, bleibt danach im Postfach stehen und färbt den Hinweispunkt an der Station. Zufriedene Sponsoren machen dabei gleich ein Verlängerungsangebot. Auch wenn ein Vertrag endet, meldet sie sich.
- **Fragen zum Spiel:** Du schreibst ihr frei oder wählst eine Beispielfrage (Bauen, Freischaltung, Steuerung, Rennstart, Boxenstopp, Reifen, Reparatur, Verträge, Sponsoren, Meisterschaft, Speichern und mehr). Die Antworten kommen aus einer eingebauten Wissensbasis, ohne Online-Dienst, und passen sich dem Spielstand an (nächster Schritt, deine Tasten, deine Verträge).

## Wie die Systeme zusammenhängen

- Fahrzeugwerte (Chassis + Bauteilstufen + Forschung + Personal) werden in physikalische Größen umgerechnet: Höchstgeschwindigkeit, Beschleunigung, Bremsverzögerung, mechanischer und aerodynamischer Grip, Reifenverschleiß, Zuverlässigkeit
- Die Abstimmung (Flügel, Übersetzung, Fahrwerk) verschiebt diese Werte; je näher am streckenspezifischen Optimum, desto schneller
- Fahrerwerte steuern die KI: Kurvenspeed, Bremspunkte, Fehlerquote, Zweikampfverhalten, Regen, Reifenschonung, Startreaktion
- Reifen: fünf Mischungen mit Grip, Temperaturfenster, Verschleiß und Leistungsabfall; Nässe verändert den Grip jeder Mischung
- Wetter wechselt während des Rennens; die Strecke wird schrittweise nass und trocknet langsam ab
- Schäden an Motor, Getriebe, Bremsen, Frontflügel und Fahrwerk kosten Leistung und müssen nach dem Rennen bezahlt repariert werden
- Ergebnisse bringen Punkte, Preisgeld, Sponsorboni und Reputation. Ein guter Ruf steigert die Einnahmen von Fanshop, Tribüne und Mediazentrum
- **Progression:** Formel Nachwuchs → Continental Series → Weltmeisterschaft (Aufstieg mit Platz 1–3 der Teamwertung). In höheren Klassen verdienen die Anlagen mehr, Ausbau und Entwicklung kosten aber ebenfalls mehr

## Projektstruktur

```
src/
  types.ts                 Gemeinsame Typen (Spielstand, Fahrer, Fahrzeug, Strategie …)
  data/                    Strecken, Katalog (Chassis, Bauteile, Forschung, Erfolge), Namen, Erklärungen (tips.ts)
  race/
    trackGeometry.ts       Streckengeometrie, Ideallinie (elastisches Band), Nachbarschaftssuche
    params.ts              Umrechnung Spielwerte → Physik, Reifen- und Wettermodell
    engine.ts              Rennengine: Physik, Runden/Sektoren, Reifen, Sprit, Schäden, Boxengasse, Wertung
    ai.ts                  KI-Fahrer
    renderer3d.ts          3D-Darstellung (three.js): Strecke, Bande, Boxengasse, Kulisse, Autos, Wetter, Kameras
    three/                 Prozedurale Texturen und das Low-Poly-Fahrzeugmodell
    renderer.ts            Einfache 2D-Draufsicht als Rückfall ohne WebGL
    input.ts               Tastatur- und Touch-Eingaben
  game/
    tycoon.ts              Felder, passives Einkommen, Freischaltungen, Aufträge, Teststrecken-Prämien
    manager.ts             Managerin: Postfach, Vertragswarnungen, Wissensbasis für Fragen
    start.ts               Schnellstart (Auto, Fahrer, Sponsor)
    state.ts               Spielstand anlegen, Wirtschaft, Fahrer/Personal/Sponsoren, Entwicklung
    carModel.ts            Fahrzeugwerte, Kosten, Boxenstoppzeiten
    weekend.ts             Rennwochenende, Wetter, Quali-Simulation, Ergebnisauswertung, Teststrecken-Konfiguration
    season.ts, events.ts, generators.ts, save.ts
  audio/sound.ts           Synthetische Sounds über WebAudio
  ui/                      React-Oberfläche (Teamgelände, Bildschirme, Rennansicht, Komponenten)
    world/                 Begehbares Teamgelände (Layout, Wegfindung, Darstellung)
```

## Erweitern

- **Neues Feld:** Eintrag in `PLOTS` (`src/game/tycoon.ts`), Position in `src/ui/world/hubLayout.ts`, Erklärung `plot_<id>` in `src/data/tips.ts`, Darstellung in `drawBuilding` (`HubWorld.tsx`)
- **Neuer Auftrag:** Eintrag in `MISSIONS` (`src/game/tycoon.ts`)
- **Neue Strecke:** Polygon mit Eckradien in `src/data/trackLayouts.ts` anlegen und Eintrag in `src/data/tracks.ts` ergänzen
- **Neues Chassis / Bauteil / Forschungsprojekt / Erfolg:** Einträge in `src/data/catalog.ts`
- **Neues Ereignis:** Generator und Auflösung in `src/game/events.ts`
