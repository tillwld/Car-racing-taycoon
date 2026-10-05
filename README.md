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

Der Spielstand wird automatisch im `localStorage` des Browsers gespeichert. Unter *Einstellungen* lässt er sich als Text exportieren und wieder importieren.

## Spielprinzip

1. **Team gründen** in einem Schritt: Name und Farbe, fertig. Auto, zwei Fahrer und ein Sponsor sind schon dabei.
2. **Geld verdienen, ohne etwas zu tun:** Die Grundförderung und alle gebauten Anlagen bringen jede Sekunde Einnahmen. Oben im Bildschirm siehst du die Summe pro Sekunde; ein Klick darauf zeigt die Aufschlüsselung. Nach dem Schließen des Spiels verdienen die Anlagen bis zu einer Stunde lang zur Hälfte weiter.
3. **Ausgeben, indem du läufst:** Auf dem Teamgelände liegen leuchtende Kaufflächen. Stell dich darauf und bleib kurz stehen, schon wird gebaut oder ausgebaut. Wer nur darüber läuft, kauft nichts.
4. **Immer selbst fahren:** Die **Teststrecke** am unteren Rand des Geländes ist jederzeit offen. Saubere Runden und neue Bestzeiten bringen Geld. Die Rennen fährst du ebenfalls selbst (oder schaust zu oder simulierst sie).
5. **Aufträge** oben links führen durch das Spiel und zahlen Belohnungen. Ein Pfeil auf dem Gelände zeigt zum Ziel.

## Schrittweise Freischaltung mit Erklärungen

Am Anfang gibt es nur Teststrecke, Rennen und einen Kiosk. Alles andere wird durch Bauen freigeschaltet, und bei jeder neuen Funktion erscheint eine Erklärung (jederzeit wieder abrufbar über das Info-Symbol oben rechts).

| Feld | Schaltet frei | Voraussetzung |
| --- | --- | --- |
| Fan-Kiosk, Fanshop, Tribüne, Mediazentrum | Einnahmen pro Sekunde (je 5 Stufen) | Kiosk sofort, die anderen nach und nach |
| Werkstatt | Upgrades, Reparatur, Chassis | erstes Rennen |
| Sponsoren-Lounge | Sponsoren-Verträge | erstes Rennen |
| Prüfstand | Training und Fahrzeugabstimmung | Werkstatt |
| Reifenlager | Reifenwahl, Sprit, Boxenstopps (Taste P im Rennen) | Prüfstand, 2 Rennen |
| Personalbüro | Mitarbeiter | Werkstatt, 3 Rennen |
| Fahrerlounge | Fahrer, Verträge, Akademie | 3 Rennen |
| Forschungslabor | Forschungsbaum | Werkstatt, 3 Rennen |
| Boxenmauer | Fahrstil, Aggressivität, Überholstrategie | Reifenlager, 4 Rennen |

Das Qualifying schaltet sich nach dem ersten Rennen frei. Bis dahin wird der Startplatz automatisch ermittelt. Zufallsereignisse beginnen erst nach dem dritten Rennen.

## Steuerung im Rennen

| Taste | Funktion |
| --- | --- |
| W / ↑ | Gas |
| S / ↓ | Bremse (im Stand: rückwärts) |
| A D / ← → | Lenken |
| Leertaste | Boost (begrenzte Energie, lädt beim Bremsen auf) |
| P | Boxenstopp anfordern (ab Reifenlager) |
| R | Auto auf die Strecke zurücksetzen |
| C | Kamera wechseln: Verfolger · Weit · Cockpit |
| L · T | Ideallinie · Zeitenliste |
| Esc | Pause |

Auf Touch-Geräten erscheinen virtuelle Tasten.

**Fahrgefühl:** Die Kamera hängt tief hinter dem Auto und schaut weit voraus, das Sichtfeld wächst mit dem Tempo. Es gibt keine Bremsanweisungen: Du bremst nach den Schildern an der Strecke (3 – 2 – 1 Striche bei 150, 100 und 50 m) und nach Gefühl. Wer Hilfe möchte, schaltet unter *Einstellungen → Fahrhilfen* die Kurvenvorschau oder die Ideallinie ein. Ohne WebGL fällt das Spiel automatisch auf eine einfache Draufsicht zurück.

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
