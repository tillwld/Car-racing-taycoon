// Texte (Deutsch): logic. Schlüssel siehe src/i18n/README.md
// Spiellogik: state.ts (state.), weekend.ts (weekend.), events.ts (events.), generators.ts (gen.), season.ts (season.)
// Fast alles hier wird über m() im Spielstand abgelegt (News, Buchungen, Ereignisse) und erst beim Anzeigen mit tx() übersetzt.
export const logic = {
  // ---------- state.ts: News (m) ----------
  'state.news.welcome': 'Willkommen in der {tier}! {team} startet in die erste Saison.',
  'state.news.achievement': 'Erfolg freigeschaltet: {name}',
  'state.news.newChassis': 'Neues Chassis: {name}',
  'state.news.leaves': '{name} verlässt das Team.',
  'state.news.hired': '{name} verstärkt das Team.',
  'state.news.sponsorMain': '{name} wird Hauptsponsor.',
  'state.news.sponsorPartner': '{name} wird Partner.',
  'state.news.sponsorCancel': 'Vertrag mit {name} aufgelöst.',
  'state.news.signed': '{name} unterschreibt bei {team}.',
  'state.news.academyJoin': '{name} kommt in die Nachwuchsakademie.',
  'state.news.academyPromote': '{name} steigt aus der Akademie ins Renncockpit auf!',
  'state.news.upgradeDone': 'Upgrade fertig: {label}',
  'state.news.researchDone': 'Forschung abgeschlossen: {label}',
  'state.news.facilityDone': 'Ausbau abgeschlossen: {name}',

  // ---------- state.ts: Buchungen (m) ----------
  'state.ledger.sellChassis': 'Verkauf {name}',
  'state.ledger.buyChassis': 'Kauf {name}',
  'state.ledger.upgrade': 'Upgrade {part} Stufe {level}',
  'state.ledger.research': 'Forschung {name}',
  'state.ledger.facility': 'Ausbau: {name}',
  'state.ledger.repairAll': 'Reparatur komplett',
  'state.ledger.repair': 'Reparatur',
  'state.ledger.signing': 'Vertrag {name}',
  'state.ledger.severance': 'Abfindung {name}',
  'state.ledger.renewal': 'Verlängerung {name}',
  'state.ledger.academy': 'Akademie: {name}',
  'state.ledger.hire': 'Einstellung {name}',
  'state.ledger.sponsorSign': 'Unterschrift {name}',

  // ---------- state.ts: Entwicklungsvorhaben (m, im Spielstand) ----------
  'state.dev.partLabel': '{part} Stufe {level}',

  // ---------- state.ts: Fehlertexte (t, sofort als Hinweis angezeigt) ----------
  'state.err.unknownChassis': 'Unbekanntes Chassis.',
  'state.err.chassisTier': 'Dieses Chassis ist erst in einer höheren Rennklasse verfügbar.',
  'state.err.chassisOwned': 'Dieses Chassis fährst du bereits.',
  'state.err.budget': 'Nicht genug Budget.',
  'state.err.partCap': 'Maximale Stufe für deine {facility} erreicht. Baue die Fabrik aus.',
  'state.err.partBusy': 'Dieses Bauteil wird bereits entwickelt.',
  'state.err.slotsFull': 'Alle Entwicklungsplätze sind belegt.',
  'state.err.unknownProject': 'Unbekanntes Projekt.',
  'state.err.alreadyResearched': 'Bereits erforscht.',
  'state.err.missingReqs': 'Voraussetzungen fehlen.',
  'state.err.researching': 'Wird bereits erforscht.',
  'state.err.labBusy': 'Das Forschungslabor ist ausgelastet.',
  'state.err.factoryMax': 'Die Fabrik ist voll ausgebaut.',
  'state.err.buildRunning': 'Der Ausbau läuft bereits.',
  'state.err.budgetRepair': 'Nicht genug Budget für die Reparatur.',
  'state.err.driverNotFound': 'Fahrer nicht gefunden.',
  'state.err.alreadySigned': 'Steht bereits unter Vertrag.',
  'state.err.cockpitsFull': 'Beide Cockpits sind besetzt. Wähle einen Fahrer, der ersetzt wird.',
  'state.err.driverRep': '{name} hält dein Team noch nicht für konkurrenzfähig (Reputation zu niedrig).',
  'state.err.budgetSigning': 'Nicht genug Budget für die Unterschriftsprämie.',
  'state.err.budgetRenewal': 'Nicht genug Budget für die Verlängerungsprämie.',
  'state.err.academyFull': 'Die Akademie ist voll (max. 3 Talente).',
  'state.err.notInAcademy': 'Nicht in der Akademie.',
  'state.err.pickReplace': 'Wähle einen Fahrer, der das Cockpit räumt.',
  'state.err.notFound': 'Nicht gefunden.',
  'state.err.offerGone': 'Angebot nicht mehr verfügbar.',
  'state.err.needRep': 'Benötigt {rep} Reputation.',
  'state.err.haveMain': 'Du hast bereits einen Hauptsponsor.',
  'state.err.slotsSecondary': 'Alle Nebensponsor-Plätze sind belegt.',

  // ---------- weekend.ts: Trainings-Rückmeldung (m) ----------
  'weekend.practice.wingLow': 'Das Auto rutscht in schnellen Kurven – mehr Abtrieb würde helfen.',
  'weekend.practice.wingHigh': 'Auf den Geraden fehlt Topspeed – weniger Flügel probieren.',
  'weekend.practice.gearingLow': 'Die Übersetzung ist zu lang, beim Herausbeschleunigen fehlt Zug.',
  'weekend.practice.gearingHigh': 'Wir hängen zu früh im Begrenzer – längere Übersetzung.',
  'weekend.practice.suspensionLow': 'Das Auto ist zu weich und träge in den Wechselkurven.',
  'weekend.practice.suspensionHigh': 'Das Auto ist zu hart, wir verlieren Grip über die Randsteine.',
  'weekend.practice.good': 'Fahrer: „Das Auto fühlt sich richtig gut an!“',

  // ---------- weekend.ts: Ergebnis ----------
  'weekend.dnf.notClassified': 'Nicht gewertet',

  // ---------- weekend.ts: Buchungen (m) ----------
  'weekend.ledger.prize': 'Preisgeld P{pos} ({name})',
  'weekend.ledger.sponsor': 'Sponsor {name}',
  'weekend.ledger.goalBonus': 'Zielbonus {name}',
  'weekend.ledger.specialBonus': 'Sonderbonus {name}',
  'weekend.ledger.salary': 'Gehalt {name}',
  'weekend.ledger.academy': 'Akademie {name}',
  'weekend.ledger.travel': 'Reisekosten {track}',
  'weekend.ledger.seasonPrize': 'Saisonprämie Platz {pos}',

  // ---------- weekend.ts: News (m) ----------
  'weekend.news.pole': 'Pole Position für {team}!',
  'weekend.news.sponsorQuit': '{name} steigt aus: Ziel „{goal}“ zu oft verfehlt.',
  'weekend.news.sponsorExpired': 'Vertrag mit {name} ist ausgelaufen.',
  'weekend.news.bonusCollected': 'Sonderbonus von {name} kassiert!',
  'weekend.news.bonusMissed': 'Sonderziel von {name} verfehlt.',
  'weekend.news.boldFail': 'Nach der Kampfansage lacht die Presse über das Ergebnis.',
  'weekend.news.contractEnd': '{name} hat das Team nach Vertragsende verlassen!',
  'weekend.news.resultPos': '{name}: P{pos}',
  'weekend.news.resultDnf': '{name}: Ausfall',
  'weekend.news.result1': '{track}: {a}',
  'weekend.news.result2': '{track}: {a}, {b}',
  'weekend.news.seasonEnd': 'Saison {season} beendet: Platz {pos} in der Teamwertung.',
  'weekend.news.promotion': 'Aufstieg! {team} startet jetzt in der {tier}.',
  'weekend.news.seasonStart': 'Saison {season} beginnt. Erstes Rennen: {track}.',

  // ---------- weekend.ts: Nachrichten der Managerin (m) ----------
  'weekend.manager.sponsorExpired': 'Der Vertrag mit {name} ist ausgelaufen. Neue Angebote findest du in der Sponsoren-Lounge.',
  'weekend.manager.toSponsors': 'Zu den Sponsoren',
  'weekend.manager.contractEnd': '{name} hat das Team nach Vertragsende verlassen. Auf dem Transfermarkt in der Fahrerlounge findest du Ersatz.',
  'weekend.manager.toDrivers': 'Zur Fahrerlounge',

  // ---------- generators.ts: Fahrer-Eigenschaften (m) ----------
  'gen.trait.fast': 'Schnell',
  'gen.trait.aggressive': 'Aggressiv',
  'gen.trait.flawless': 'Fehlerfrei',
  'gen.trait.rainSpecialist': 'Regenspezialist',
  'gen.trait.tyreWhisperer': 'Reifenflüsterer',
  'gen.trait.quickStarter': 'Blitzstarter',
  'gen.trait.prospect': 'Nachwuchs',

  // ---------- generators.ts: Mitarbeiter-Eigenschaften (m) ----------
  'gen.staffTrait.calmRadio': 'Ruhiger Funk',
  'gen.staffTrait.strategyFox': 'Strategiefuchs',
  'gen.staffTrait.dataLover': 'Datenverliebt',
  'gen.staffTrait.quickHands': 'Flinke Hände',
  'gen.staffTrait.teamPlayer': 'Teamplayer',
  'gen.staffTrait.perfectionist': 'Perfektionist',
  'gen.staffTrait.oldHand': 'Alter Hase',
  'gen.staffTrait.organizer': 'Organisationstalent',
  'gen.staffTrait.thrifty': 'Sparfuchs',
  'gen.staffTrait.windTunnelGuru': 'Windkanal-Guru',
  'gen.staffTrait.cfdSpecialist': 'CFD-Spezialist',
  'gen.staffTrait.creativeMind': 'Kreativer Kopf',
  'gen.staffTrait.powerHunter': 'Leistungsjäger',
  'gen.staffTrait.durabilityPro': 'Haltbarkeitsprofi',
  'gen.staffTrait.hybridExpert': 'Hybrid-Experte',
  'gen.staffTrait.patternSpotter': 'Mustererkenner',
  'gen.staffTrait.weatherWatcher': 'Wetterfrosch',
  'gen.staffTrait.talentScout': 'Talentscout',

  // ---------- generators.ts: Sponsorziele (m) ----------
  'gen.goal.win': 'Rennsieg',
  'gen.goal.podium': 'Podium',
  'gen.goal.finish': 'Mindestens Platz {n} im Rennen',
  'gen.goal.pole': 'Pole Position',
  'gen.goal.grid': 'Startplatz {n} oder besser',
  'gen.goal.bothPoints': 'Beide Fahrer in den Punkten',

  // ---------- season.ts (t, wird sofort angezeigt) ----------
  'season.formerDriver': 'Ehemaliger Fahrer',

  // ---------- events.ts: Verlängerungsangebot (m) ----------
  'events.extend.title': '{name} möchte verlängern',
  'events.extend.text': '{name} ist zufrieden und bietet eine Verlängerung um 7 Rennen zu 10 % besseren Konditionen an.',
  'events.extend.accept.label': 'Verlängern',
  'events.extend.accept.detail': '{amount:money} pro Rennen',
  'events.extend.decline.label': 'Auslaufen lassen',
  'events.extend.decline.detail': 'Platz für neue Sponsoren',

  // ---------- events.ts: Kurzfristiges Sponsorangebot ----------
  'events.sponsorBonus.title': 'Kurzfristiges Sponsorangebot',
  'events.sponsorBonus.text': '{name} bietet einen Sonderbonus von {reward:money}, wenn ein Fahrer beim nächsten Rennen mindestens Platz {target} erreicht. Verfehlt ihr das Ziel, leidet euer Ruf.',
  'events.sponsorBonus.accept.label': 'Annehmen',
  'events.sponsorBonus.accept.detail': '+{reward:money} bei Erfolg, −3 Reputation bei Misserfolg',
  'events.sponsorBonus.decline.label': 'Ablehnen',
  'events.sponsorBonus.decline.detail': 'Keine Auswirkungen',

  // ---------- events.ts: Gehaltsforderung ----------
  'events.salaryDemand.title': '{name} fordert mehr Gehalt',
  'events.salaryDemand.text': 'Nach den letzten Leistungen verlangt {name} eine Gehaltserhöhung um {raise:money} pro Rennen.',
  'events.salaryDemand.accept.label': 'Erhöhung gewähren',
  'events.salaryDemand.accept.detail': '+{raise:money} Gehalt pro Rennen, Moral steigt deutlich',
  'events.salaryDemand.half.label': 'Leistungsbonus anbieten',
  'events.salaryDemand.half.detail': 'Halbe Erhöhung, Moral steigt leicht',
  'events.salaryDemand.decline.label': 'Ablehnen',
  'events.salaryDemand.decline.detail': 'Moral sinkt, Konstanz leidet',

  // ---------- events.ts: Motorschaden ----------
  'events.engineFailure.title': 'Motorschaden bei Testfahrt',
  'events.engineFailure.text': 'Bei einer Testfahrt vor dem nächsten Rennen ist der Motor hochgegangen. Die Mechaniker können ihn notdürftig flicken oder ein neues Aggregat einbauen.',
  'events.engineFailure.replace.label': 'Neuen Motor einbauen',
  'events.engineFailure.replace.detail': 'Kosten {cost:money}, Motor wie neu',
  'events.engineFailure.patch.label': 'Flicken und hoffen',
  'events.engineFailure.patch.detail': 'Kostenlos, Motorzustand −30 %, höheres Ausfallrisiko',

  // ---------- events.ts: Nachwuchstalent ----------
  'events.talent.title': 'Nachwuchstalent entdeckt',
  'events.talent.text': 'Dein Scout hat bei einem Kartrennen ein außergewöhnliches Talent entdeckt. Andere Teams sind bereits interessiert.',
  'events.talent.academy.label': 'In die Akademie holen',
  'events.talent.academy.detail': 'Kosten {cost:money}, entwickelt sich jedes Rennen',
  'events.talent.watch.label': 'Auf die Beobachtungsliste',
  'events.talent.watch.detail': 'Erscheint auf dem Fahrermarkt',

  // ---------- events.ts: Entwicklungsidee ----------
  'events.tech.title': 'Idee aus der Entwicklungsabteilung',
  'events.tech.text': 'Ein Ingenieur hat eine vielversprechende Idee für das Bauteil „{part}“. Mit etwas Budget könnte daraus sofort ein Upgrade werden – Erfolg ist aber nicht garantiert.',
  'events.tech.invest.label': 'Investieren',
  'events.tech.invest.detail': 'Kosten {cost:money}, 70 % Chance auf +1 Stufe',
  'events.tech.decline.label': 'Ablehnen',
  'events.tech.decline.detail': 'Keine Kosten',

  // ---------- events.ts: Unwetterwarnung ----------
  'events.weather.title': 'Unwetterwarnung',
  'events.weather.text': 'Für {track} ist Regen angesagt. Ein Regentest im Simulator würde dem Team helfen, das Auto für nasse Bedingungen abzustimmen.',
  'events.weather.test.label': 'Regentest durchführen',
  'events.weather.test.detail': 'Kosten {cost:money}, Regen sicher, +20 Setup-Wissen',
  'events.weather.ignore.label': 'Ignorieren',
  'events.weather.ignore.detail': 'Es wird trotzdem regnen',

  // ---------- events.ts: Unfall bei Werbefahrt ----------
  'events.testCrash.title': 'Unfall bei Werbefahrt',
  'events.testCrash.text': 'Bei einer Demofahrt für Sponsoren ist das Auto in die Streckenbegrenzung gerutscht. Frontflügel und Aufhängung sind beschädigt.',
  'events.testCrash.repair.label': 'Sofort reparieren',
  'events.testCrash.repair.detail': 'Kosten {cost:money}',
  'events.testCrash.later.label': 'Später reparieren',
  'events.testCrash.later.detail': 'Frontflügel −40 %, Fahrwerk −20 % Zustand',

  // ---------- events.ts: Pressekonferenz ----------
  'events.media.title': 'Pressekonferenz',
  'events.media.text': 'Die Journalisten wollen wissen, was ihr euch für das nächste Rennen vornehmt.',
  'events.media.humble.label': 'Bescheiden bleiben',
  'events.media.humble.detail': '+1 Reputation',
  'events.media.bold.label': 'Kampfansage',
  'events.media.bold.detail': '+4 Reputation, −5 bei einem Rennen ohne Punkte',

  // ---------- events.ts: Fan-Tag ----------
  'events.fans.title': 'Fan-Tag in der Fabrik',
  'events.fans.text': 'Der Fanclub fragt, ob ihr einen Tag der offenen Tür organisiert.',
  'events.fans.host.label': 'Fan-Tag ausrichten',
  'events.fans.host.detail': 'Kosten {cost:money}, +3 Reputation',
  'events.fans.decline.label': 'Absagen',
  'events.fans.decline.detail': '−1 Reputation',

  // ---------- events.ts: Abwerbeversuch ----------
  'events.poach.title': 'Abwerbeversuch',
  'events.poach.text': 'Ein Konkurrenzteam will {name} ({role}) abwerben.',
  'events.poach.keep.label': 'Gehalt erhöhen',
  'events.poach.keep.detail': '+{raise:money} pro Rennen',
  'events.poach.release.label': 'Gehen lassen',
  'events.poach.release.detail': '{role} verlässt das Team, Ablöse {fee:money}',

  // ---------- events.ts: Buchungen, News, Fehlertext ----------
  'events.ledger.newEngine': 'Neuer Motor',
  'events.ledger.techIdea': 'Entwicklungsidee',
  'events.ledger.rainTest': 'Regentest',
  'events.ledger.crashRepair': 'Reparatur nach Unfall',
  'events.ledger.fanDay': 'Fan-Tag',
  'events.ledger.transferFee': 'Ablöse für {name}',
  'events.news.upset': '{name} ist verärgert.',
  'events.news.onMarket': '{name} steht jetzt auf dem Fahrermarkt.',
  'events.news.breakthrough': 'Durchbruch! {part} steigt auf Stufe {level}.',
  'events.news.ideaFailed': 'Die Idee hat leider nicht funktioniert.',
  'events.news.poached': '{name} wechselt zur Konkurrenz.',
  'events.news.extended': '{name} verlängert.',
  'events.err.budget': 'Nicht genug Budget.',
} as const;
