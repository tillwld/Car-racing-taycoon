// Erklärungen, die beim Freischalten neuer Funktionen eingeblendet werden. Jede Erklärung erscheint einmal
// und lässt sich später über die Hilfe wieder öffnen.
export interface Tip {
  title: string;
  icon: string;
  lead: string;
  points: string[];
  /** Optionaler Hinweis, was als Nächstes zu tun ist */
  next?: string;
}

export const TIPS: Record<string, Tip> = {
  welcome: {
    title: 'Willkommen in deinem Rennstall',
    icon: 'flag',
    lead: 'Du führst ein junges Rennteam. Hier läufst du als Fahrer über dein Gelände und baust es Schritt für Schritt aus.',
    points: [
      'Laufen: WASD oder Pfeiltasten. Am Handy einfach auf den Boden tippen.',
      'Geld verdienst du von ganz allein: Anlagen bringen jede Sekunde Einnahmen, auch wenn du gerade etwas anderes machst.',
      'Ausgeben: Stell dich auf eine leuchtende Kauffläche. Kurz stehen bleiben, schon ist gebaut.',
      'Selbst fahren kannst du jederzeit: Die Teststrecke ganz unten ist immer offen.',
    ],
    next: 'Lauf nach unten zur Startlinie der Teststrecke und fahre deine erste Runde.',
  },
  freedrive: {
    title: 'Teststrecke: jederzeit selbst fahren',
    icon: 'race',
    lead: 'Hier fährst du ohne Rennwochenende, ganz frei und so lange du willst. Gute Runden bringen dir Geld.',
    points: [
      'W oder ↑ gibt Gas, S oder ↓ bremst, A D oder ← → lenken.',
      'Leertaste ist der Boost: Er hat begrenzte Energie, die sich beim Bremsen wieder auflädt.',
      'Jede saubere Runde bringt eine kleine Prämie. Eine neue Bestzeit bringt extra Geld.',
      'Mit Esc pausierst du oder beendest die Fahrt. Mit R setzt du das Auto auf die Strecke zurück.',
    ],
    next: 'Bremse vor den Kurven selbst: An der Strecke stehen Schilder mit 3 – 2 – 1 Strichen (150, 100, 50 Meter).',
  },
  income: {
    title: 'Passives Einkommen',
    icon: 'finance',
    lead: 'Deine Anlagen verdienen Geld, während du fährst oder durchs Gelände läufst.',
    points: [
      'Oben im Bildschirm siehst du, wie viel Geld pro Sekunde hereinkommt.',
      'Jede Anlage lässt sich aufwerten: Stell dich auf die Kauffläche davor. Höhere Stufen bringen deutlich mehr.',
      'Fanshop, Tribüne und Mediazentrum verdienen mehr, wenn dein Team einen besseren Ruf hat.',
      'Wenn du das Spiel schließt, verdienen die Anlagen bis zu einer Stunde lang zur Hälfte weiter.',
    ],
  },
  race_intro: {
    title: 'Dein erstes Rennen',
    icon: 'flag',
    lead: 'Du fährst als Fahrer 1 selbst. Dein zweiter Fahrer wird vom Computer gesteuert.',
    points: [
      'Das Startfeld wird automatisch ermittelt. Das Qualifying schaltest du nach dem ersten Rennen frei.',
      'Gas, Bremse und Lenken wie auf der Teststrecke. Die Leertaste ist der Boost.',
      'Am Ende bekommst du Preisgeld nach Platzierung. Davon gehen Gehälter und Reisekosten ab.',
      'Du kannst jederzeit mit Esc pausieren und das Rennen simulieren lassen.',
    ],
  },
  after_race: {
    title: 'Rennen geschafft',
    icon: 'medal',
    lead: 'Jedes Rennen bringt Preisgeld, Sponsorengeld und Ansehen. Dafür kosten Gehälter und Reisen Geld.',
    points: [
      'Je weiter vorn du ins Ziel kommst, desto mehr Preisgeld gibt es.',
      'Dein Ruf (Reputation) steigt mit guten Ergebnissen. Ein guter Ruf lockt Sponsoren an und steigert deine Einnahmen.',
      'Neue Bauflächen sind jetzt frei: Werkstatt und Sponsoren-Lounge warten auf dich.',
      'Ab jetzt kannst du das Qualifying selbst fahren und dir einen besseren Startplatz holen.',
    ],
  },
  quali: {
    title: 'Qualifying',
    icon: 'race',
    lead: 'Im Qualifying fährst du schnelle Runden für den Startplatz. Die beste Runde zählt.',
    points: [
      'Du hast zwei fliegende Runden. Die schnellste entscheidet über deine Startposition.',
      'Wer vorn startet, hat im Rennen freie Bahn und weniger Gedränge.',
      'Keine Lust? Dann simulierst du das Qualifying, dein Fahrer fährt es für dich.',
    ],
  },
  pit: {
    title: 'Boxenstopp im Rennen',
    icon: 'pit',
    lead: 'Frische Reifen, Sprit und Reparaturen holst du dir in der Boxengasse. Das geht in jedem Rennen.',
    points: [
      'Taste P (oder BOX am Handy) meldet dich an der Box an. Die Boxengasse liegt kurz vor Start und Ziel auf der Innenseite der Strecke.',
      'Oben im Bild siehst du, wie weit die Einfahrt noch ist. Halte dich zur Boxenseite und bremse. In der Gasse gilt Tempo 80, das erledigt das Auto für dich.',
      'Dein Team wartet an der Box. Nach dem Stopp zeigt die Ampel, wann die Ausfahrt frei ist. In der letzten Runde lohnt sich kein Stopp mehr.',
      'Mit dem Reifenlager wählst du selbst: Tasten 1 – 5 für die Reifen, F zum Nachtanken, E für Reparaturen. Bei Regen lohnen sich Intermediate oder Wet.',
    ],
  },

  plot_kiosk: {
    title: 'Fan-Kiosk gebaut',
    icon: 'finance',
    lead: 'Der Kiosk verkauft Getränke und Snacks an die Fans und bringt dein erstes Geld pro Sekunde.',
    points: ['Du siehst die Einnahmen oben im Bildschirm und als kleine Zahlen über dem Kiosk.', 'Stell dich wieder auf die Fläche davor, um ihn auszubauen.'],
    next: 'Fahre jetzt dein erstes Rennen am Team-Transporter.',
  },
  plot_fanshop: {
    title: 'Fanshop gebaut',
    icon: 'sponsors',
    lead: 'Trikots, Kappen und Modellautos: Der Fanshop verdient deutlich mehr als der Kiosk.',
    points: ['Mit besserem Ruf kaufen mehr Fans ein. Gute Rennergebnisse zahlen sich also doppelt aus.'],
  },
  plot_grandstand: {
    title: 'Tribüne gebaut',
    icon: 'flag',
    lead: 'Zuschauer an der Teststrecke bringen Eintrittsgelder und Werbeeinnahmen.',
    points: ['Die Tribüne ist die stärkste Einnahmequelle der ersten Ausbaustufen. Werte sie auf, wenn du Geld übrig hast.'],
  },
  plot_media: {
    title: 'Mediazentrum gebaut',
    icon: 'dashboard',
    lead: 'Übertragungsrechte und Werbepartner: Das Mediazentrum ist deine größte Einnahmequelle.',
    points: ['Die Einnahmen wachsen mit deinem Ruf und mit der Rennklasse, in der du fährst.'],
  },
  plot_workshop: {
    title: 'Werkstatt gebaut',
    icon: 'garage',
    lead: 'In der Werkstatt machst du dein Auto schneller und hältst es in Schuss.',
    points: [
      'Upgrades: Motor, Bremsen, Reifen, Fahrwerk, Aerodynamik, Getriebe und Kühlung. Jedes Upgrade kostet Geld und braucht Entwicklungszeit, gemessen in Rennen.',
      'Reparatur: Nach Rennen sind Teile verschlissen oder beschädigt. Schäden machen das Auto langsamer und unzuverlässiger.',
      'Chassis und Fabrik: Später kannst du ein besseres Chassis kaufen und die Werkstatt zur Fabrik ausbauen.',
    ],
    next: 'Starte dein erstes Upgrade, zum Beispiel beim Motor.',
  },
  plot_setupLab: {
    title: 'Prüfstand gebaut: Training und Abstimmung',
    icon: 'wrench',
    lead: 'Jetzt kannst du dein Auto auf jede Strecke einstellen. Das lohnt sich: Ein gut abgestimmtes Auto ist deutlich schneller.',
    points: [
      'Training: Jede Runde erhöht das Setup-Wissen. Dein Ingenieur findet dann die ideale Einstellung.',
      'Flügel: Viel Abtrieb hilft in Kurven, wenig Abtrieb bringt Höchstgeschwindigkeit auf Geraden.',
      'Übersetzung: Kurz beschleunigt besser, lang erreicht mehr Endgeschwindigkeit.',
      'Fahrwerk: Weich schont die Reifen, hart ist präziser.',
      'Keine Ahnung? Der Knopf „Empfehlung übernehmen“ setzt alle Regler auf den besten bekannten Wert.',
    ],
    next: 'Öffne im Team-Transporter den Bereich „Abstimmung“ und probiere die Regler aus.',
  },
  plot_tireDepot: {
    title: 'Reifenlager gebaut: Reifen, Sprit und Boxenstopps',
    icon: 'pit',
    lead: 'Reifen sind im Motorsport entscheidend. Jetzt kannst du Mischung, Tankmenge und Stopps selbst planen.',
    points: [
      'Soft: viel Grip, aber schneller verschlissen. Hard: hält lange, hat weniger Grip. Medium liegt dazwischen.',
      'Intermediate und Wet brauchst du, wenn die Strecke nass ist.',
      'Tankmenge: Mehr Sprit macht das Auto schwerer und langsamer, zu wenig zwingt dich zum Nachtanken.',
      'Boxenstopp: Im Rennen meldest du dich mit Taste P an der Box an und wählst dann Reifen (1 – 5), Nachtanken (F) und Reparatur (E).',
    ],
    next: 'Wähle im Team-Transporter bei „Strategie“ deine Startreifen.',
  },
  plot_pitwall: {
    title: 'Boxenmauer gebaut: Rennstrategie',
    icon: 'dashboard',
    lead: 'Von der Boxenmauer aus gibst du deinen Fahrern taktische Anweisungen. Das gilt immer dann, wenn der Computer fährt.',
    points: [
      'Fahrstil: Schonend spart Reifen und Sprit, Angriff ist schneller, aber riskanter.',
      'Aggressivität: Wie hart dein Fahrer in Zweikämpfen geht.',
      'Überholstrategie: Vorsichtig, normal oder riskant.',
      'Wetterautomatik: Das Team wechselt bei Regen selbstständig auf passende Reifen.',
    ],
  },
  plot_lab: {
    title: 'Forschungslabor gebaut',
    icon: 'research',
    lead: 'In der Forschung entwickelst du neue Technik, die dein Auto dauerhaft verbessert.',
    points: [
      'Der Forschungsbaum hat fünf Zweige: Motor, Aerodynamik, Fahrwerk, Reifen und Boxencrew.',
      'Manche Projekte setzen andere voraus. Gesperrte Projekte siehst du ausgegraut.',
      'Forschung kostet Geld und braucht Zeit, gemessen in Rennen. Es läuft immer nur ein Projekt gleichzeitig.',
    ],
  },
  plot_staffOffice: {
    title: 'Personalbüro gebaut',
    icon: 'staff',
    lead: 'Gute Mitarbeiter machen dein Team besser. Sie kosten aber Gehalt pro Rennen.',
    points: [
      'Mechaniker: schnellere Boxenstopps.',
      'Renningenieur: lernt die Abstimmung schneller.',
      'Chefmechaniker: günstigere Reparaturen und höhere Zuverlässigkeit.',
      'Ingenieure und Datenanalyst: schnellere Entwicklung und bessere Prognosen.',
      'Fang mit Mechaniker und Renningenieur an. Die bringen am meisten.',
    ],
  },
  plot_lounge: {
    title: 'Fahrerlounge gebaut',
    icon: 'drivers',
    lead: 'Hier verwaltest du deine Fahrer: Verträge, Transfermarkt und Nachwuchsakademie.',
    points: [
      'Fahrer 1 steuerst du selbst. Fahrer 2 fährt der Computer.',
      'Verträge laufen nach einer bestimmten Zahl von Rennen aus. Verlängere rechtzeitig.',
      'Bessere Fahrer verlangen mehr Gehalt und einen besseren Ruf deines Teams.',
      'In der Akademie reifen junge Talente heran, die später zu Stars werden können.',
    ],
  },
  plot_sponsorLounge: {
    title: 'Sponsoren-Lounge gebaut',
    icon: 'sponsors',
    lead: 'Sponsoren zahlen pro Rennen. Dafür erwarten sie ein bestimmtes Ergebnis.',
    points: [
      'Jeder Sponsor hat ein Ziel, zum Beispiel „Platz 10 oder besser“. Erreichst du es, gibt es einen Zielbonus.',
      'Wer das Ziel zu oft verfehlt, verliert den Sponsor und etwas Ruf.',
      'Mit höherem Ruf kommen größere Sponsoren mit mehr Geld und härteren Zielen.',
    ],
  },
};

export const GENERAL_TIPS = ['welcome', 'income', 'freedrive', 'race_intro', 'after_race', 'quali', 'pit'];
