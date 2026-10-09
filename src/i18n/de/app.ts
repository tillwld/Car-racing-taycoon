// Texte (Deutsch): app. und world. Schlüssel siehe src/i18n/README.md
export const app = {
  // ---- Allgemein ----
  'app.common.cancel': 'Abbrechen',
  'app.common.close': 'Schließen',
  'app.common.gotIt': 'Verstanden',
  'app.race.loading': 'Rennstrecke wird geladen …',

  // ---- Neues Team gründen (Titelbildschirm) ----
  'app.newTeam.title': 'Neues Team gründen?',
  'app.newTeam.warn': 'Dein aktueller Spielstand mit {team} wird dabei gelöscht.',
  'app.newTeam.confirm': 'Spielstand löschen und neu starten',

  // ---- Reiter der Fenster ----
  'app.tab.dashboard': 'Übersicht',
  'app.tab.race': 'Rennwochenende',
  'app.tab.garage': 'Werkstatt',
  'app.tab.research': 'Forschung',
  'app.tab.drivers': 'Fahrer',
  'app.tab.staff': 'Mitarbeiter',
  'app.tab.sponsors': 'Sponsoren',
  'app.tab.championship': 'Meisterschaft',
  'app.tab.calendar': 'Rennkalender',
  'app.tab.finance': 'Finanzen',
  'app.tab.stats': 'Statistiken & Erfolge',
  'app.tab.settings': 'Einstellungen',
  'app.tab.manager': 'Managerin',

  // ---- Was ein Bildschirm braucht ----
  'app.need.garage': 'Baue die Werkstatt.',
  'app.need.research': 'Baue das Forschungslabor.',
  'app.need.drivers': 'Baue die Fahrerlounge.',
  'app.need.staff': 'Baue das Personalbüro.',
  'app.need.sponsors': 'Baue die Sponsoren-Lounge.',
  'app.need.finance': 'Baue die Sponsoren-Lounge oder fahre fünf Rennen.',

  // ---- Toasts ----
  'app.toast.locked': 'Noch nicht freigeschaltet. {where}',
  'app.toast.built': '{name} gebaut',
  'app.toast.needDriver': 'Du brauchst einen Fahrer.',
  'app.toast.managerNew': 'Neu: Deine Managerin {name}. Über die Sprechblase oben kannst du ihr schreiben.',
  'app.toast.managerMsg': 'Nachricht von {name}: {text}',

  // ---- Hinweise an den Stationen ----
  'app.alert.repair': 'Reparatur empfohlen',
  'app.alert.devSlot': 'Entwicklungsplatz frei',
  'app.alert.labFree': 'Labor ist frei',
  'app.alert.cockpit': 'Ein Cockpit ist frei',
  'app.alert.contract': 'Vertrag läuft aus',
  'app.alert.noMain': 'Kein Hauptsponsor',
  'app.alert.staffOpen': 'Wichtige Stelle unbesetzt',
  'app.alert.overdrawn': 'Konto im Minus',
  'app.alert.weekend': 'Rennwochenende wartet',
  'app.alert.gridSet': 'Startaufstellung steht – zum Rennen',

  // ---- Erklärungsfenster ----
  'app.tip.eyebrow': 'Erklärung',
  'app.tip.next': 'Als Nächstes:',
  'app.tip.after': 'Danach folgt:',

  // ---- Kopfleiste ----
  'app.hud.tierSeason': '{tier} · Saison {season}',
  'app.hud.budget': 'Budget',
  'app.hud.reputation': 'Reputation',
  'app.hud.race': 'Rennen',
  'app.hud.incomeShow': 'Einnahmen anzeigen',
  'app.hud.help': 'Hilfe und Erklärungen',
  'app.hud.manager': 'Managerin',
  'app.hud.managerUnread.one': 'Managerin, {n} neue Nachricht',
  'app.hud.managerUnread.other': 'Managerin, {n} neue Nachrichten',
  'app.hud.soundOn': 'Ton an',
  'app.hud.soundOff': 'Ton aus',
  'app.hud.settings': 'Einstellungen',
  'app.manager.named': 'Managerin {name}',
  'app.rate.int': '+{v:num} €/s',
  'app.rate.dec': '+{v:dec1} €/s',

  // ---- Einnahmen-Fenster ----
  'app.income.title': 'Einnahmen pro Sekunde',
  'app.income.total': 'Gesamt',
  'app.income.perMinute': 'Das sind ca. {v:moneyC} pro Minute. Stell dich auf leuchtende Flächen, um mehr Anlagen zu bauen.',

  // ---- Aufträge, nächstes Rennen ----
  'app.missions.title': 'Aufträge',
  'app.next.eyebrow': 'Nächstes Rennen',
  'app.next.walk': 'Zum Transporter',
  'app.next.open': 'Direkt öffnen',

  // ---- Schnellzugriff ----
  'app.quick.title': 'Schnellzugriff',
  'app.quick.testTrack': 'Teststrecke (freie Fahrt)',
  'app.quick.saved': 'Automatisch gespeichert',
  'app.quick.savedCloud': 'Automatisch gespeichert · auch dauerhaft gesichert',
  'app.quick.saveFail': 'Speichern im Browser nicht möglich: bitte unter Einstellungen als Datei sichern',
  'app.quick.toTitle': 'Zum Titelbildschirm',

  // ---- Fenster der Stationen ----
  'app.panel.back': 'Zurück aufs Gelände',

  // ---- Ereignis, Managerin ----
  'app.event.eyebrow': 'Ereignis',
  'app.event.noBudget': 'nicht genug Budget',
  'app.urgent.eyebrow': 'Nachricht von Managerin {name}',
  'app.urgent.title': 'Vertrag läuft bald aus',
  'app.urgent.later': 'Später',

  // ---- Willkommen zurück (Offline-Einnahmen) ----
  'app.offline.eyebrow': 'Willkommen zurück',
  'app.offline.title': 'Deine Anlagen haben gearbeitet',
  'app.offline.earned': 'Während du weg warst, haben Kiosk, Fanshop und Co. {amount} verdient.',
  'app.offline.note': 'Das Geld kommt bis zu einer Stunde lang und zur Hälfte, wenn das Spiel geschlossen ist.',
  'app.offline.collect': 'Einsammeln',

  // ---- Teststrecke ----
  'app.free.eyebrow': 'Teststrecke · {track}',
  'app.free.session': 'Teststrecke',
  'app.free.title': 'Gute Fahrt!',
  'app.free.best': 'Beste Runde:',
  'app.free.continue': 'Weiter',
  'app.free.again': 'Nochmal fahren',

  // ---- Hilfe ----
  'app.help.eyebrow': 'Hilfe',
  'app.help.title': 'Erklärungen',
  'app.help.intro': 'Hier kannst du alles noch einmal nachlesen. Neue Erklärungen erscheinen, sobald du etwas freischaltest.',

  // ---- Saisonabschluss ----
  'app.season.eyebrow': 'Saison {season} · {tier}',
  'app.season.title': 'Saisonabschluss',
  'app.season.teamPos': 'Teamwertung',
  'app.season.bestDriver': 'Bester Fahrer',
  'app.season.points': 'Punkte',
  'app.season.prize': 'Saisonprämie',
  'app.season.champion': 'Meister',
  'app.season.teamTitle': 'Teamtitel',
  'app.season.promoTitle': 'Aufstieg angeboten!',
  'app.season.promoText': 'Mit Platz {pos} darf {team} in die {tier} aufsteigen. Dort gibt es deutlich mehr Preis- und Sponsorengeld und deine Anlagen verdienen mehr, aber die Gegner sind viel stärker und alles wird teurer.',
  'app.season.needTop3': 'Für einen Aufstieg brauchst du einen Platz unter den ersten drei der Teamwertung.',
  'app.season.topClass': 'Ihr fahrt in der Königsklasse – verteidigt euren Platz!',
  'app.season.promote': 'Aufsteigen',
  'app.season.stay': 'In der Klasse bleiben',
  'app.season.next': 'Nächste Saison starten',

  // ---- Teamgelände (Canvas und Hinweise) ----
  'world.aria.grounds': 'Teamgelände',
  'world.testTrack': 'Teststrecke',
  'world.windTunnel': 'Windkanal',
  'world.enter': '{name} betreten',
  'world.hint.touch': 'Tippe auf den Boden, um hinzulaufen. Stell dich auf leuchtende Flächen, um zu bauen.',
  'world.hint.keys': 'Laufen mit {keys}, oder klicke auf ein Ziel. Stell dich auf leuchtende Flächen, um zu bauen. Gebäude betrittst du mit {interact}.',
  'world.banner.free': 'Werbefläche frei',
  'world.construction': 'Ausbau läuft',
  'world.fx.built': 'Gebaut!',
  'world.fx.level': 'Stufe {n}',
  'world.pad.trackSub': 'Freie Fahrt · Runden bringen Geld',
  'world.pad.level': 'Stufe {lvl} · {cost:money}',
  'world.pad.levelGain': 'Stufe {lvl} · {cost:money} · +{gain:num} €/s',
  'world.pad.missing': 'Es fehlen {v:money}',
  'world.sub.level': 'Stufe {lvl}/{max} · +{gain:num} €/s',
  'world.sub.truck': 'Zum Rennwochenende',
  'world.sub.round': 'Runde {n}/{total}',
  'world.sub.workshop1': 'Mietgarage',
  'world.sub.workshop2': 'Eigene Werkstatt',
  'world.sub.workshop3': 'Technikzentrum',
  'world.sub.workshop4': 'Werksfabrik',
  'world.sub.setupLab': 'Training und Abstimmung',
  'world.sub.pitwall': 'Rennstrategie',
  'world.sub.tireDepot': 'Reifen und Boxenstopps',
  'world.npc.driver2': '{name} · Fahrer 2',
  'world.npc.academy': '{name} · Akademie',
  'app.season.reopen': 'Saisonübersicht öffnen',
} as const;
