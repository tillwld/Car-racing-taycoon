// Texts (English): logic. Same keys as the German file.
import type { logic as de } from '../de/logic';

export const logic: Record<keyof typeof de, string> = {
  // ---------- state.ts: news (m) ----------
  'state.news.welcome': 'Welcome to the {tier}! {team} is kicking off its first season.',
  'state.news.achievement': 'Achievement unlocked: {name}',
  'state.news.newChassis': 'New chassis: {name}',
  'state.news.leaves': '{name} leaves the team.',
  'state.news.hired': '{name} joins the team.',
  'state.news.sponsorMain': '{name} becomes the main sponsor.',
  'state.news.sponsorPartner': '{name} becomes a partner.',
  'state.news.sponsorCancel': 'Contract with {name} terminated.',
  'state.news.signed': '{name} signs with {team}.',
  'state.news.academyJoin': '{name} joins the academy.',
  'state.news.academyPromote': '{name} moves up from the academy to a race seat!',
  'state.news.upgradeDone': 'Upgrade complete: {label}',
  'state.news.researchDone': 'Research complete: {label}',
  'state.news.facilityDone': 'Expansion complete: {name}',

  // ---------- state.ts: ledger (m) ----------
  'state.ledger.sellChassis': 'Sold {name}',
  'state.ledger.buyChassis': 'Bought {name}',
  'state.ledger.upgrade': 'Upgrade {part} level {level}',
  'state.ledger.research': 'Research {name}',
  'state.ledger.facility': 'Expansion: {name}',
  'state.ledger.repairAll': 'Full repair',
  'state.ledger.repair': 'Repair',
  'state.ledger.signing': 'Contract {name}',
  'state.ledger.severance': 'Severance {name}',
  'state.ledger.renewal': 'Extension {name}',
  'state.ledger.academy': 'Academy: {name}',
  'state.ledger.hire': 'Hiring {name}',
  'state.ledger.sponsorSign': 'Signing {name}',

  // ---------- state.ts: development projects (m, stored in the save) ----------
  'state.dev.partLabel': '{part} level {level}',

  // ---------- state.ts: error messages (t, shown right away) ----------
  'state.err.unknownChassis': 'Unknown chassis.',
  'state.err.chassisTier': 'This chassis becomes available in a higher racing class.',
  'state.err.chassisOwned': "You're already running this chassis.",
  'state.err.budget': 'Not enough budget.',
  'state.err.partCap': 'Max level reached for your {facility}. Expand the factory.',
  'state.err.partBusy': 'This part is already in development.',
  'state.err.slotsFull': 'All development slots are in use.',
  'state.err.unknownProject': 'Unknown project.',
  'state.err.alreadyResearched': 'Already researched.',
  'state.err.missingReqs': 'Requirements missing.',
  'state.err.researching': 'Already being researched.',
  'state.err.labBusy': 'The Research Lab is at capacity.',
  'state.err.factoryMax': 'The factory is fully built out.',
  'state.err.buildRunning': 'The expansion is already underway.',
  'state.err.budgetRepair': 'Not enough budget for the repair.',
  'state.err.driverNotFound': 'Driver not found.',
  'state.err.alreadySigned': 'Already under contract.',
  'state.err.cockpitsFull': 'Both seats are taken. Pick a driver to replace.',
  'state.err.driverRep': "{name} doesn't consider your team competitive yet (reputation too low).",
  'state.err.budgetSigning': 'Not enough budget for the signing bonus.',
  'state.err.budgetRenewal': 'Not enough budget for the extension bonus.',
  'state.err.academyFull': 'The academy is full (max. 3 prospects).',
  'state.err.notInAcademy': 'Not in the academy.',
  'state.err.pickReplace': 'Pick a driver to give up the seat.',
  'state.err.notFound': 'Not found.',
  'state.err.offerGone': 'Offer no longer available.',
  'state.err.needRep': 'Requires {rep} reputation.',
  'state.err.haveMain': 'You already have a main sponsor.',
  'state.err.slotsSecondary': 'All partner slots are taken.',

  // ---------- weekend.ts: practice feedback (m) ----------
  'weekend.practice.wingLow': 'The car slides in fast corners – more downforce would help.',
  'weekend.practice.wingHigh': "We're lacking top speed on the straights – try less wing.",
  'weekend.practice.gearingLow': 'The gearing is too long – no pull out of the corners.',
  'weekend.practice.gearingHigh': "We're hitting the limiter too early – go for longer gearing.",
  'weekend.practice.suspensionLow': 'The car is too soft and sluggish through the chicanes.',
  'weekend.practice.suspensionHigh': "The car is too stiff – we're losing grip over the curbs.",
  'weekend.practice.good': 'Driver: “The car feels really good!”',

  // ---------- weekend.ts: result ----------
  'weekend.dnf.notClassified': 'Not classified',

  // ---------- weekend.ts: ledger (m) ----------
  'weekend.ledger.prize': 'Prize money P{pos} ({name})',
  'weekend.ledger.sponsor': 'Sponsor {name}',
  'weekend.ledger.goalBonus': 'Goal bonus {name}',
  'weekend.ledger.specialBonus': 'Special bonus {name}',
  'weekend.ledger.salary': 'Salary {name}',
  'weekend.ledger.academy': 'Academy {name}',
  'weekend.ledger.travel': 'Travel costs {track}',
  'weekend.ledger.seasonPrize': 'Season prize: place {pos}',

  // ---------- weekend.ts: news (m) ----------
  'weekend.news.pole': 'Pole position for {team}!',
  'weekend.news.sponsorQuit': '{name} pulls out: goal “{goal}” missed too often.',
  'weekend.news.sponsorExpired': 'Contract with {name} has expired.',
  'weekend.news.bonusCollected': 'Special bonus from {name} collected!',
  'weekend.news.bonusMissed': 'Special goal from {name} missed.',
  'weekend.news.boldFail': 'After that bold claim, the press is laughing at the result.',
  'weekend.news.contractEnd': '{name} left the team when the contract ended!',
  'weekend.news.resultPos': '{name}: P{pos}',
  'weekend.news.resultDnf': '{name}: DNF',
  'weekend.news.result1': '{track}: {a}',
  'weekend.news.result2': '{track}: {a}, {b}',
  'weekend.news.seasonEnd': 'Season {season} is over: place {pos} in the team standings.',
  'weekend.news.promotion': 'Promoted! {team} now competes in the {tier}.',
  'weekend.news.seasonStart': 'Season {season} begins. First race: {track}.',

  // ---------- weekend.ts: manager messages (m) ----------
  'weekend.manager.sponsorExpired': "The contract with {name} has expired. You'll find new offers in the Sponsor Lounge.",
  'weekend.manager.toSponsors': 'Go to Sponsors',
  'weekend.manager.contractEnd': '{name} left the team when the contract ran out. You can find a replacement on the transfer market in the Driver Lounge.',
  'weekend.manager.toDrivers': 'Go to Driver Lounge',

  // ---------- generators.ts: driver traits (m) ----------
  'gen.trait.fast': 'Fast',
  'gen.trait.aggressive': 'Aggressive',
  'gen.trait.flawless': 'Flawless',
  'gen.trait.rainSpecialist': 'Rain Specialist',
  'gen.trait.tyreWhisperer': 'Tire Whisperer',
  'gen.trait.quickStarter': 'Quick Starter',
  'gen.trait.prospect': 'Prospect',

  // ---------- generators.ts: staff traits (m) ----------
  'gen.staffTrait.calmRadio': 'Calm Radio',
  'gen.staffTrait.strategyFox': 'Strategy Fox',
  'gen.staffTrait.dataLover': 'Data Geek',
  'gen.staffTrait.quickHands': 'Quick Hands',
  'gen.staffTrait.teamPlayer': 'Team Player',
  'gen.staffTrait.perfectionist': 'Perfectionist',
  'gen.staffTrait.oldHand': 'Old Hand',
  'gen.staffTrait.organizer': 'Born Organizer',
  'gen.staffTrait.thrifty': 'Penny Pincher',
  'gen.staffTrait.windTunnelGuru': 'Wind Tunnel Guru',
  'gen.staffTrait.cfdSpecialist': 'CFD Specialist',
  'gen.staffTrait.creativeMind': 'Creative Mind',
  'gen.staffTrait.powerHunter': 'Power Hunter',
  'gen.staffTrait.durabilityPro': 'Durability Pro',
  'gen.staffTrait.hybridExpert': 'Hybrid Expert',
  'gen.staffTrait.patternSpotter': 'Pattern Spotter',
  'gen.staffTrait.weatherWatcher': 'Weather Watcher',
  'gen.staffTrait.talentScout': 'Talent Scout',

  // ---------- generators.ts: sponsor goals (m) ----------
  'gen.goal.win': 'Race win',
  'gen.goal.podium': 'Podium',
  'gen.goal.finish': 'Finish P{n} or better',
  'gen.goal.pole': 'Pole position',
  'gen.goal.grid': 'Start P{n} or better',
  'gen.goal.bothPoints': 'Both drivers in the points',

  // ---------- season.ts (t, shown right away) ----------
  'season.formerDriver': 'Former driver',

  // ---------- events.ts: extension offer (m) ----------
  'events.extend.title': '{name} wants to extend',
  'events.extend.text': '{name} is happy with the deal and offers a 7-race extension on terms that are 10% better.',
  'events.extend.accept.label': 'Extend',
  'events.extend.accept.detail': '{amount:money} per race',
  'events.extend.decline.label': 'Let it expire',
  'events.extend.decline.detail': 'Room for new sponsors',

  // ---------- events.ts: short-notice sponsor offer ----------
  'events.sponsorBonus.title': 'Short-Notice Sponsor Offer',
  'events.sponsorBonus.text': '{name} offers a special bonus of {reward:money} if a driver finishes P{target} or better at the next race. Miss the goal and your reputation takes a hit.',
  'events.sponsorBonus.accept.label': 'Accept',
  'events.sponsorBonus.accept.detail': '+{reward:money} on success, −3 reputation on failure',
  'events.sponsorBonus.decline.label': 'Decline',
  'events.sponsorBonus.decline.detail': 'No effect',

  // ---------- events.ts: salary demand ----------
  'events.salaryDemand.title': '{name} wants a raise',
  'events.salaryDemand.text': 'After the latest performances, {name} is asking for a raise of {raise:money} per race.',
  'events.salaryDemand.accept.label': 'Grant the raise',
  'events.salaryDemand.accept.detail': '+{raise:money} salary per race, morale jumps',
  'events.salaryDemand.half.label': 'Offer a performance bonus',
  'events.salaryDemand.half.detail': 'Half the raise, morale rises a little',
  'events.salaryDemand.decline.label': 'Decline',
  'events.salaryDemand.decline.detail': 'Morale drops, consistency suffers',

  // ---------- events.ts: engine failure ----------
  'events.engineFailure.title': 'Engine Blowup in Testing',
  'events.engineFailure.text': 'The engine blew up during a test run before the next race. The mechanics can patch it up or fit a new unit.',
  'events.engineFailure.replace.label': 'Fit a new engine',
  'events.engineFailure.replace.detail': 'Costs {cost:money}, engine as good as new',
  'events.engineFailure.patch.label': 'Patch it and hope',
  'events.engineFailure.patch.detail': 'Free, engine condition −30%, higher failure risk',

  // ---------- events.ts: young talent ----------
  'events.talent.title': 'Young Talent Spotted',
  'events.talent.text': 'Your scout has spotted an exceptional talent at a kart race. Other teams are already interested.',
  'events.talent.academy.label': 'Bring into the academy',
  'events.talent.academy.detail': 'Costs {cost:money}, develops every race',
  'events.talent.watch.label': 'Add to watch list',
  'events.talent.watch.detail': 'Appears on the driver market',

  // ---------- events.ts: development idea ----------
  'events.tech.title': 'Idea from Development',
  'events.tech.text': "An engineer has a promising idea for the “{part}” component. With a bit of budget it could become an upgrade right away – but success isn't guaranteed.",
  'events.tech.invest.label': 'Invest',
  'events.tech.invest.detail': 'Costs {cost:money}, 70% chance of +1 level',
  'events.tech.decline.label': 'Decline',
  'events.tech.decline.detail': 'No cost',

  // ---------- events.ts: storm warning ----------
  'events.weather.title': 'Storm Warning',
  'events.weather.text': 'Rain is forecast for {track}. A wet-weather test in the simulator would help the team set up the car for wet conditions.',
  'events.weather.test.label': 'Run a rain test',
  'events.weather.test.detail': 'Costs {cost:money}, rain guaranteed, +20 setup knowledge',
  'events.weather.ignore.label': 'Ignore it',
  'events.weather.ignore.detail': "It's going to rain anyway",

  // ---------- events.ts: crash on promo run ----------
  'events.testCrash.title': 'Crash on Promo Run',
  'events.testCrash.text': 'During a sponsor demo run the car slid into the barrier. Front wing and suspension are damaged.',
  'events.testCrash.repair.label': 'Repair now',
  'events.testCrash.repair.detail': 'Costs {cost:money}',
  'events.testCrash.later.label': 'Repair later',
  'events.testCrash.later.detail': 'Front wing −40%, suspension −20% condition',

  // ---------- events.ts: press conference ----------
  'events.media.title': 'Press Conference',
  'events.media.text': 'The journalists want to know what you are aiming for at the next race.',
  'events.media.humble.label': 'Stay humble',
  'events.media.humble.detail': '+1 reputation',
  'events.media.bold.label': 'Bold claim',
  'events.media.bold.detail': '+4 reputation, −5 after a race without points',

  // ---------- events.ts: fan day ----------
  'events.fans.title': 'Fan Day at the Factory',
  'events.fans.text': 'The fan club is asking whether you would host an open house day.',
  'events.fans.host.label': 'Host the fan day',
  'events.fans.host.detail': 'Costs {cost:money}, +3 reputation',
  'events.fans.decline.label': 'Turn it down',
  'events.fans.decline.detail': '−1 reputation',

  // ---------- events.ts: poaching attempt ----------
  'events.poach.title': 'Poaching Attempt',
  'events.poach.text': 'A rival team wants to poach {name} ({role}).',
  'events.poach.keep.label': 'Raise salary',
  'events.poach.keep.detail': '+{raise:money} per race',
  'events.poach.release.label': 'Let them go',
  'events.poach.release.detail': '{role} leaves the team, transfer fee {fee:money}',

  // ---------- events.ts: ledger, news, error ----------
  'events.ledger.newEngine': 'New engine',
  'events.ledger.techIdea': 'Development idea',
  'events.ledger.rainTest': 'Rain test',
  'events.ledger.crashRepair': 'Repair after crash',
  'events.ledger.fanDay': 'Fan day',
  'events.ledger.transferFee': 'Transfer fee for {name}',
  'events.news.upset': '{name} is upset.',
  'events.news.onMarket': '{name} is now on the driver market.',
  'events.news.breakthrough': 'Breakthrough! {part} rises to level {level}.',
  'events.news.ideaFailed': "Sadly, the idea didn't work out.",
  'events.news.poached': '{name} is joining a rival team.',
  'events.news.extended': '{name} signs an extension.',
  'events.err.budget': 'Not enough budget.',
};
