// Texts (English): app. and world. Same keys as the German file.
import type { app as de } from '../de/app';

export const app: Record<keyof typeof de, string> = {
  // ---- General ----
  'app.common.cancel': 'Cancel',
  'app.common.close': 'Close',
  'app.common.gotIt': 'Got it',
  'app.race.loading': 'Loading race track …',

  // ---- Start a new team (title screen) ----
  'app.newTeam.title': 'Start a new team?',
  'app.newTeam.warn': 'Your current save with {team} will be deleted.',
  'app.newTeam.confirm': 'Delete save and start over',

  // ---- Window tabs ----
  'app.tab.dashboard': 'Overview',
  'app.tab.race': 'Race Weekend',
  'app.tab.garage': 'Workshop',
  'app.tab.research': 'Research',
  'app.tab.drivers': 'Drivers',
  'app.tab.staff': 'Staff',
  'app.tab.sponsors': 'Sponsors',
  'app.tab.championship': 'Championship',
  'app.tab.calendar': 'Race Calendar',
  'app.tab.finance': 'Finances',
  'app.tab.stats': 'Stats & Achievements',
  'app.tab.settings': 'Settings',
  'app.tab.manager': 'Manager',

  // ---- What a screen needs ----
  'app.need.garage': 'Build the Workshop.',
  'app.need.research': 'Build the Research Lab.',
  'app.need.drivers': 'Build the Driver Lounge.',
  'app.need.staff': 'Build the Staff Office.',
  'app.need.sponsors': 'Build the Sponsor Lounge.',
  'app.need.finance': 'Build the Sponsor Lounge or complete five races.',

  // ---- Toasts ----
  'app.toast.locked': 'Not unlocked yet. {where}',
  'app.toast.built': '{name} built',
  'app.toast.needDriver': 'You need a driver.',
  'app.toast.managerNew': 'New: Your manager {name}. Use the chat bubble at the top to message her.',
  'app.toast.managerMsg': 'Message from {name}: {text}',

  // ---- Alerts at the stations ----
  'app.alert.repair': 'Repair recommended',
  'app.alert.devSlot': 'Development slot free',
  'app.alert.labFree': 'Lab is free',
  'app.alert.cockpit': 'A seat is open',
  'app.alert.contract': 'Contract expiring',
  'app.alert.noMain': 'No main sponsor',
  'app.alert.staffOpen': 'Key role unfilled',
  'app.alert.overdrawn': 'Account overdrawn',
  'app.alert.weekend': 'Race weekend awaits',
  'app.alert.gridSet': 'Starting grid set – head to the race',

  // ---- Tip window ----
  'app.tip.eyebrow': 'Tip',
  'app.tip.next': 'Next step:',
  'app.tip.after': 'Up next:',

  // ---- Top bar ----
  'app.hud.tierSeason': '{tier} · Season {season}',
  'app.hud.budget': 'Budget',
  'app.hud.reputation': 'Reputation',
  'app.hud.race': 'Race',
  'app.hud.incomeShow': 'Show income',
  'app.hud.help': 'Help and guides',
  'app.hud.manager': 'Manager',
  'app.hud.managerUnread.one': 'Manager, {n} new message',
  'app.hud.managerUnread.other': 'Manager, {n} new messages',
  'app.hud.soundOn': 'Turn sound on',
  'app.hud.soundOff': 'Turn sound off',
  'app.hud.settings': 'Settings',
  'app.manager.named': 'Manager {name}',
  'app.rate.int': '+€{v:num}/s',
  'app.rate.dec': '+€{v:dec1}/s',

  // ---- Income window ----
  'app.income.title': 'Income per second',
  'app.income.total': 'Total',
  'app.income.perMinute': "That's about {v:moneyC} per minute. Stand on glowing plots to build more facilities.",

  // ---- Objectives, next race ----
  'app.missions.title': 'Objectives',
  'app.next.eyebrow': 'Next race',
  'app.next.walk': 'Go to truck',
  'app.next.open': 'Open directly',

  // ---- Quick access ----
  'app.quick.title': 'Quick access',
  'app.quick.testTrack': 'Test Track (free drive)',
  'app.quick.saved': 'Saved automatically',
  'app.quick.savedCloud': 'Saved automatically · also backed up permanently',
  'app.quick.saveFail': "Can't save in the browser: please back up as a file under Settings",
  'app.quick.toTitle': 'To title screen',

  // ---- Station windows ----
  'app.panel.back': 'Back to the grounds',

  // ---- Event, manager ----
  'app.event.eyebrow': 'Event',
  'app.event.noBudget': 'not enough budget',
  'app.urgent.eyebrow': 'Message from manager {name}',
  'app.urgent.title': 'Contract expiring soon',
  'app.urgent.later': 'Later',

  // ---- Welcome back (offline income) ----
  'app.offline.eyebrow': 'Welcome back',
  'app.offline.title': 'Your facilities have been working',
  'app.offline.earned': 'While you were away, the Fan Kiosk, Fan Shop and the rest earned {amount}.',
  'app.offline.note': 'You keep earning for up to an hour, at half rate, while the game is closed.',
  'app.offline.collect': 'Collect',

  // ---- Test track ----
  'app.free.eyebrow': 'Test Track · {track}',
  'app.free.session': 'Test Track',
  'app.free.title': 'Nice drive!',
  'app.free.best': 'Best lap:',
  'app.free.continue': 'Continue',
  'app.free.again': 'Drive again',

  // ---- Help ----
  'app.help.eyebrow': 'Help',
  'app.help.title': 'Guides',
  'app.help.intro': 'Read everything again here. New guides appear as soon as you unlock something.',

  // ---- Season wrap-up ----
  'app.season.eyebrow': 'Season {season} · {tier}',
  'app.season.title': 'Season Wrap-Up',
  'app.season.teamPos': 'Team Standings',
  'app.season.bestDriver': 'Best Driver',
  'app.season.points': 'Points',
  'app.season.prize': 'Season Prize',
  'app.season.champion': 'Champion',
  'app.season.teamTitle': 'Team title',
  'app.season.promoTitle': 'Promotion offered!',
  'app.season.promoText': 'With a P{pos} finish, {team} can move up to {tier}. There is much more prize and sponsor money, and your facilities earn more, but the opposition is far stronger and everything costs more.',
  'app.season.needTop3': 'To be promoted, you need a top-three finish in the team standings.',
  'app.season.topClass': "You're racing in the top class – defend your spot!",
  'app.season.promote': 'Move up',
  'app.season.stay': 'Stay in this class',
  'app.season.next': 'Start next season',

  // ---- Team grounds (canvas and hints) ----
  'world.aria.grounds': 'Team grounds',
  'world.testTrack': 'Test Track',
  'world.windTunnel': 'Wind Tunnel',
  'world.enter': 'Enter {name}',
  'world.hint.touch': 'Tap the ground to walk there. Stand on a glowing plot to build.',
  'world.hint.keys': 'Walk with {keys}, or click a destination. Stand on a glowing plot to build. Enter buildings with {interact}.',
  'world.banner.free': 'Ad space available',
  'world.construction': 'Under construction',
  'world.fx.built': 'Built!',
  'world.fx.level': 'Level {n}',
  'world.pad.trackSub': 'Free drive · laps earn money',
  'world.pad.level': 'Level {lvl} · {cost:money}',
  'world.pad.levelGain': 'Level {lvl} · {cost:money} · +€{gain:num}/s',
  'world.pad.missing': 'Need {v:money} more',
  'world.sub.level': 'Level {lvl}/{max} · +€{gain:num}/s',
  'world.sub.truck': 'To the race weekend',
  'world.sub.round': 'Round {n}/{total}',
  'world.sub.workshop1': 'Rented Garage',
  'world.sub.workshop2': 'Own Workshop',
  'world.sub.workshop3': 'Tech Center',
  'world.sub.workshop4': 'Works Factory',
  'world.sub.setupLab': 'Practice and setup',
  'world.sub.pitwall': 'Race strategy',
  'world.sub.tireDepot': 'Tires and pit stops',
  'world.npc.driver2': '{name} · Driver 2',
  'world.npc.academy': '{name} · Academy',
  'app.season.reopen': 'Open season summary',
};
