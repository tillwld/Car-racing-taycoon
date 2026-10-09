// Texts (English): tycoon (key prefixes tycoon. and mgr.). Same keys as the German file.
import type { tycoon as de } from '../de/tycoon';

export const tycoon: Record<keyof typeof de, string> = {
  // ---------- Plots (name, short description, unlocks) ----------
  'tycoon.plot.kiosk.name': 'Fan Kiosk',
  'tycoon.plot.kiosk.blurb': 'Drinks and snacks for the fans.',
  'tycoon.plot.fanshop.name': 'Fan Shop',
  'tycoon.plot.fanshop.blurb': 'Jerseys, caps and model cars.',
  'tycoon.plot.workshop.name': 'Workshop',
  'tycoon.plot.workshop.blurb': 'Upgrades, repairs and chassis.',
  'tycoon.plot.workshop.unlocks': 'Upgrades, repairs, chassis market',
  'tycoon.plot.sponsorLounge.name': 'Sponsor Lounge',
  'tycoon.plot.sponsorLounge.blurb': 'Sponsors and their goals.',
  'tycoon.plot.sponsorLounge.unlocks': 'Sponsor contracts',
  'tycoon.plot.setupLab.name': 'Test Rig',
  'tycoon.plot.setupLab.blurb': 'Practice and car setup.',
  'tycoon.plot.setupLab.unlocks': 'Practice and setup',
  'tycoon.plot.tireDepot.name': 'Tire Depot',
  'tycoon.plot.tireDepot.blurb': 'Tire choice, fuel and pit stops.',
  'tycoon.plot.tireDepot.unlocks': 'Planning tires, fuel load and pit stops',
  'tycoon.plot.grandstand.name': 'Grandstand',
  'tycoon.plot.grandstand.blurb': 'Spectators at the test track.',
  'tycoon.plot.staffOffice.name': 'Staff Office',
  'tycoon.plot.staffOffice.blurb': 'Hire mechanics and engineers.',
  'tycoon.plot.staffOffice.unlocks': 'Staff',
  'tycoon.plot.lounge.name': 'Driver Lounge',
  'tycoon.plot.lounge.blurb': 'Drivers, contracts and academy.',
  'tycoon.plot.lounge.unlocks': 'Drivers and transfer market',
  'tycoon.plot.lab.name': 'Research Lab',
  'tycoon.plot.lab.blurb': 'Develop new technology.',
  'tycoon.plot.lab.unlocks': 'Research tree',
  'tycoon.plot.pitwall.name': 'Pit Wall',
  'tycoon.plot.pitwall.blurb': 'Tactics for your drivers.',
  'tycoon.plot.pitwall.unlocks': 'Driving style, aggression, overtaking strategy',
  'tycoon.plot.media.name': 'Media Center',
  'tycoon.plot.media.blurb': 'Broadcast rights and advertising partners.',

  // ---------- Build order ----------
  'tycoon.aufbau.kiosk.why': 'Your first income: the kiosk earns money on its own.',
  'tycoon.aufbau.fanshop.why': 'More income, so you can afford the tech.',
  'tycoon.aufbau.workshop.why': 'Make your car faster here and keep it in shape.',
  'tycoon.aufbau.sponsorLounge.why': 'Sponsors pay you money every race.',
  'tycoon.aufbau.setupLab.why': 'Practice and setup: dial your car in for the track.',
  'tycoon.aufbau.grandstand.why': 'Spectators at the test track bring in serious money.',
  'tycoon.aufbau.tireDepot.why': 'Plan tires, fuel load and pit stops before the race.',
  'tycoon.aufbau.lounge.why': 'Manage your drivers: contracts, transfers and juniors.',
  'tycoon.aufbau.staffOffice.why': 'Mechanics and engineers make your team better.',
  'tycoon.aufbau.lab.why': 'Develop new tech with a lasting effect.',
  'tycoon.aufbau.pitwall.why': 'Tactics for your computer-controlled driver.',
  'tycoon.aufbau.media.why': 'Your biggest source of income.',
  'tycoon.req.buildFirst': 'Build {name} first.',
  'tycoon.req.races.one': 'Complete 1 more race.',
  'tycoon.req.races.other': 'Complete {n} more races.',
  'tycoon.path.buildable': 'Ready to build: stand on the glowing plot.',
  'tycoon.join.nl': '{a}\n{b}',
  'tycoon.join.space': '{a} {b}',

  // ---------- Income, building ----------
  'tycoon.income.grant': 'Federation grant',
  'tycoon.income.plotLevel': '{name} (level {level})',
  'tycoon.buy.maxed': 'This facility is fully upgraded.',
  'tycoon.buy.noMoney': 'Not enough money yet.',
  'tycoon.buy.built': 'Built: {name}',
  'tycoon.buy.upgraded': 'Upgrade: {name} to level {level}',
  'tycoon.news.built': '{name} has been built.',
  'tycoon.news.upgraded': '{name} was upgraded to level {level}.',

  // ---------- Objectives ----------
  'tycoon.mission.drive.text': 'Drive a lap on the test track',
  'tycoon.mission.kiosk.text': 'Build the Fan Kiosk: stand on the glowing plot',
  'tycoon.mission.fanshop.text': 'Build the Fan Shop',
  'tycoon.mission.race1.text': 'Run your first race at the Team Truck',
  'tycoon.mission.workshop.text': 'Build the Workshop',
  'tycoon.mission.upgrade.text': 'Start an upgrade in the Workshop',
  'tycoon.mission.sponsors.text': 'Build the Sponsor Lounge',
  'tycoon.mission.setupLab.text': 'Build the Test Rig for practice and setup',
  'tycoon.mission.practice.text': 'Drive or simulate a practice session and set up your car at the Test Rig',
  'tycoon.mission.stand.text': 'Build the Grandstand',
  'tycoon.mission.tires.text': 'Build the Tire Depot',
  'tycoon.mission.points.text': 'Score your first championship points (top 10)',
  'tycoon.mission.lounge.text': 'Build the Driver Lounge',
  'tycoon.mission.staff.text': 'Build the Staff Office and hire a mechanic',
  'tycoon.mission.lab.text': 'Build the Research Lab',
  'tycoon.mission.research.text': 'Start a research project',
  'tycoon.mission.podium.text': 'Finish on the podium',
  'tycoon.mission.pitwall.text': 'Build the Pit Wall',
  'tycoon.mission.season.text': 'Finish your first season',
  'tycoon.mission.media.text': 'Build the Media Center',
  'tycoon.mission.win.text': 'Win a race',
  'tycoon.claim.booking': 'Objective complete: {text}',
  'tycoon.claim.toastReward': 'Objective complete: {amount:moneyS}',
  'tycoon.claim.toast': 'Objective complete',

  // ---------- Test track ----------
  'tycoon.free.laps.one': '1 lap driven',
  'tycoon.free.laps.other': '{n} laps driven',
  'tycoon.free.firstBest': 'First best time on this track',
  'tycoon.free.newBest': 'New best time ({diff:dec2} s faster)',
  'tycoon.free.booking': 'Test track: {label}',

  // ---------- Manager: framing ----------
  'mgr.bullet': '• {text}',
  'mgr.hint': ' ({text})',
  'mgr.welcome': "Hi, I'm {name}, your manager. If you have any questions about the game, just message me. I'll also give you a heads-up before driver or sponsor contracts run out.",
  'mgr.action.office': 'To the Team Office',
  'mgr.action.drivers': 'To the Driver Lounge',
  'mgr.action.sponsorLounge': 'To the Sponsor Lounge',
  'mgr.action.sponsors': 'To the sponsors',
  'mgr.action.settings': 'To Settings',
  'mgr.action.garage': 'To the Workshop',
  'mgr.action.staff': 'To the Staff Office',
  'mgr.action.research': 'To the Research Lab',
  'mgr.action.finance': 'To Finances',
  'mgr.action.championship': 'To the Trophy Cabinet',
  'mgr.action.race': 'To the Team Truck',

  // ---------- Manager: contract warning ----------
  'mgr.warn.intro': 'Quick contract warning:\n{lines}',
  'mgr.warn.leftExpired': 'has expired',
  'mgr.warn.leftNext': 'expires after the next race',
  'mgr.warn.leftIn.one': 'expires in 1 race',
  'mgr.warn.leftIn.other': 'expires in {n} races',
  'mgr.warn.driverLine': '• {name} (driver): The contract {left}. {extra}',
  'mgr.warn.driverExtraLounge': 'Extend it in the Driver Lounge under "My Team", or the driver will leave the team.',
  'mgr.warn.driverExtraNoLounge': 'You need the Driver Lounge for that, or the driver will leave the team.',
  'mgr.warn.sponsorLine': '• {name} (sponsor): The contract {left}. {extra}',
  'mgr.warn.sponsorExtraNew': "You'll find new offers in the Sponsor Lounge.",
  'mgr.warn.sponsorExtraOffer': "They're happy and have sent an extension offer.",
  'mgr.warn.sponsorExtraUnhappy': "They're not entirely happy: hit their goal and they might extend. Otherwise, find a replacement in time.",
  'mgr.warn.newsDriver': "{name}'s contract {left}.",
  'mgr.warn.newsSponsor': 'The sponsor contract with {name} {left}.',

  // ---------- Manager: answers outside the topics ----------
  'mgr.answer.short': 'Feel free to ask me a question, for example: "{example}"',
  'mgr.answer.fallback': "I'm not sure about that, sorry, I didn't understand. Try asking me, for example:\n{hints}\nOr pick one of the example questions below.",

  // ---------- Knowledge base: what should I do next? ----------
  'mgr.kb.next.ask': 'What should I do next?',
  'mgr.kb.next.keys': 'what next, what now, what should i do, what do i do, what can i do, what to do, next step, where do i start, where to start, getting started, get started, new here, how to begin, tip, advice',
  'mgr.kb.next.reply': "Here's what I'd do now:\n{lines}",
  'mgr.kb.next.race': '• Run the next race at the Team Truck. Prize money, sponsor money and points will get you ahead.',
  'mgr.kb.next.build': '• Build next: {name}. {why} ({hint})',
  'mgr.kb.next.allBuilt': '• Everything is built. Upgrade your income sources and become champion.',
  'mgr.kb.next.missions': '• The objectives at the top left always show you your next goal.',

  // ---------- Money ----------
  'mgr.kb.money.ask': 'How do I make money?',
  'mgr.kb.money.keys': 'money, make money, earn money, to earn, earning, income, revenue, cash, budget, broke, bankrupt, get rich, profit, funds, afford',
  'mgr.kb.money.reply': "Your money comes from several sources:\n• Facilities like the Fan Kiosk, Fan Shop, Grandstand and Media Center earn money on their own every second. Right now that's €{income:dec1} per second. Click the budget at the top to see the breakdown.\n• Sponsors pay you every race.\n• You get prize money for good finishes.\n• On the test track, clean laps and new best times earn money.\n• Objectives pay rewards.\nUpgrade your income sources, that pays off the most.",

  // ---------- Building ----------
  'mgr.kb.build.ask': 'How do I build new buildings?',
  'mgr.kb.build.keys': 'build, building, buildings, construct, new building, plot, plots, glowing, buy, purchase, expand, expansion, upgrade a building, enter a building, stand on',
  'mgr.kb.build.reply': "Here's how to build: walk to a glowing plot on the grounds and stand on it for a moment, and it gets built. Just walking across it won't buy anything. You enter finished buildings with {key}. You can also click a target and your character will walk there. You'll also find all stations in Quick Access at the top right.",

  // ---------- Unlocking ----------
  'mgr.kb.unlock.ask': 'Why is something still locked?',
  'mgr.kb.unlock.keys': 'unlock, unlocked, unlocking, locked, still locked, when can i, one after another, one at a time, order, not yet, why can t i, why can i not, not buildable, missing, requirement, requirements',
  'mgr.kb.unlock.reply': 'Only the next plot is unlocked at a time. For that you need the previous facility and a minimum number of races driven.\nUp next: {name}{hint}.\nAfter that:\n{list}\nYou can see everything in the Team Office under "Your Progress".',
  'mgr.kb.unlock.done': "You've already built everything. There's nothing left to unlock.",
  'mgr.kb.unlock.row': '• {name}: {req}',
  'mgr.kb.unlock.now': 'right away',
  'mgr.kb.unlock.races.one': 'after 1 race',
  'mgr.kb.unlock.races.other': 'after {n} races',

  // ---------- Controls ----------
  'mgr.kb.controls.ask': 'How do I control the car?',
  'mgr.kb.controls.keys': 'controls, control, keys, key, key bindings, keyboard, steer, steering, how do i drive, how to drive, drive the car, throttle, brake, braking, accelerate, wasd, arrow keys, gamepad, controller, touch, mobile, phone, tablet, buttons, boost, gas',
  'mgr.kb.controls.reply': 'In a race:\n• Throttle: {up}\n• Brake and reverse: {down}\n• Steering: {left} and {right}\n• Boost: {boost}\n• Request or cancel a pit stop: {pit}\n• Camera: {camera}, racing line: {line}, timing tower: {tower}, reset: {reset}\nOn mobile, buttons appear on screen. You can change all keys in Settings.',

  // ---------- Race start ----------
  'mgr.kb.start.ask': 'How does the race start work?',
  'mgr.kb.start.keys': 'race start, start lights, starting lights, lights out, lights, traffic light, reaction, reaction time, false start, jump start, start procedure, standing start, launch',
  'mgr.kb.start.reply': 'At the start, five lights come on one after another. When they are all lit and then suddenly go out, hit the throttle ({up}). Your reaction time is shown afterwards: under {limit:dec2} seconds is perfect.\nCareful: if you hit the throttle before "lights out", that is a false start and you sit still for a good second and a half afterwards. The opponents start at slightly different times.\nWhen you watch or simulate, your team handles the start.',

  // ---------- Pit stop ----------
  'mgr.kb.pit.ask': 'How does a pit stop work?',
  'mgr.kb.pit.keys': 'pit stop, pit stops, pitstop, pit lane, pit box, pit menu, pit entry, pit, pits, box, refuel, refueling, refuelling, tire change, tyre change, change tires, change tyres, swap tires',
  'mgr.kb.pit.reply': "Here's how a pit stop works:\n1. Press {pit} to call the stop. Press the same key again to cancel it.\n2. In the pit menu you choose the tires (1 to 5), refueling ({fuel}) and repairs ({repair}).\n3. Drive into the pit lane on the next lap. The entry is marked and signs show the way. There is a speed limit of {kmh} km/h in the pit lane.\n4. The crew gets to work, and the exit light releases you.\nOn the last lap a stop is no longer worth it.",

  // ---------- Tires ----------
  'mgr.kb.tyres.ask': 'Which tires should I use?',
  'mgr.kb.tyres.keys': 'tires, tire, tyres, tyre, compound, compounds, soft, medium, hard, intermediate, wet, wear, tire wear, grip, rubber, tire depot',
  'mgr.kb.tyres.reply': 'Tires:\n• Soft: lots of grip, but wears out faster.\n• Medium: the middle ground.\n• Hard: lasts long, has less grip.\n• You need Intermediate and Wet as soon as the track is wet.\nIn the Tire Depot{later} you plan starting tires, fuel load and stops before the race. It also shows how long each compound lasts on the track. During the race, the car panel at the bottom shows wear and temperature.',
  'mgr.kb.tyres.later': ' (unlocks later)',

  // ---------- Fuel ----------
  'mgr.kb.fuel.keys': 'fuel, tank, petrol, gasoline, consumption, fuel load, fuel tank, fuel usage',
  'mgr.kb.fuel.reply': 'Fuel: a fuller tank makes the car heavier and slower, too little forces you to refuel. During the race, the car panel at the bottom shows how many laps the fuel will still last. You set the fuel load beforehand in the Tire Depot.',

  // ---------- Damage ----------
  'mgr.kb.damage.ask': 'How do I repair my car?',
  'mgr.kb.damage.keys': 'damage, damaged, repair, repairs, broken, crash, crashed, accident, condition, fix, broke down',
  'mgr.kb.damage.reply': 'Damage makes the car slower and less reliable. You can fix it in two ways:\n• During the race at a pit stop: press {repair} in the pit menu.\n• After the race in the Workshop under "Car & Condition". It costs money, a Chief Mechanic makes it cheaper.\nDuring the race you can see the five components as boxes in the car panel: engine, gearbox, brakes, front wing, suspension.',

  // ---------- Qualifying ----------
  'mgr.kb.quali.keys': 'quali, qualif, qualifying, pole, pole position, grid, starting grid, grid position, starting position, start position, flying lap',
  'mgr.kb.quali.reply': 'In qualifying you drive two flying laps. The fastest one decides your grid spot. Whoever starts at the front has a clear track in the race and less traffic. You can drive yourself or simulate.',
  'mgr.kb.quali.locked': 'Qualifying unlocks after your second race. Until then, your grid spot is calculated automatically.',

  // ---------- Setup ----------
  'mgr.kb.setup.ask': 'What does car setup do?',
  'mgr.kb.setup.keys': 'setup, set up, car setup, tuning, tune, adjust, practice, training, test rig, wing, gearing, gear ratio, suspension, setup knowledge, knowledge, recommendation, slider, sliders',
  'mgr.kb.setup.reply': 'At the Test Rig{later} you collect data in practice. The more setup knowledge your engineer has, the more accurate the green recommendation on the sliders for wing, gearing and suspension gets. If you set the car up right, you are faster. "Apply recommendation" does that with one click.',
  'mgr.kb.setup.later': ' (you build that later)',

  // ---------- Tactics ----------
  'mgr.kb.tactics.keys': 'tactics, tactic, driving style, aggression, aggressive, overtake, overtaking, pit wall, strategy',
  'mgr.kb.tactics.reply': 'At the Pit Wall you set driving style, aggression and overtaking strategy. This mainly applies to the driver the computer controls. Conserving saves tires, fuel and parts, attacking is faster but riskier. You do the tire and stop planning in the Tire Depot.',

  // ---------- Contracts ----------
  'mgr.kb.contracts.ask': 'When do my contracts expire?',
  'mgr.kb.contracts.keys': 'contract, contracts, expire, expires, expiry, expiring, run out, runs out, extend, extension, renew, renewal, leave the team, leaves the team, driver leaves, driver leave, leaving the team',
  'mgr.kb.contracts.reply': "Your contracts:\n{lines}\nI'll get in touch when a contract has only 3 races or 1 race left. You extend drivers in the Driver Lounge; sponsors usually send an offer when they're happy.",
  'mgr.kb.contracts.none': "You have no active contracts right now. Sign drivers in the Driver Lounge and sponsors in the Sponsor Lounge.",
  'mgr.kb.contracts.row.one': '• {name} ({kind}): {n} race left',
  'mgr.kb.contracts.row.other': '• {name} ({kind}): {n} races left',
  'mgr.kb.contracts.kindDriver': 'driver',
  'mgr.kb.contracts.kindSponsor': 'sponsor',

  // ---------- Sponsors ----------
  'mgr.kb.sponsors.ask': 'How do sponsors work?',
  'mgr.kb.sponsors.keys': 'sponsor, sponsors, sponsorship, main sponsor, partner, partners, sponsor goal, goal bonus, sponsor lounge',
  'mgr.kb.sponsors.reply': 'Sponsors pay you money every race. In return they expect a goal, for example a finish in the top ten. If you hit it, you get a bonus and the sponsor is happy. If you miss it too often, they quit. A main sponsor brings in the most money, and several partners fit alongside. With a better reputation, bigger sponsors come knocking.',

  // ---------- Drivers ----------
  'mgr.kb.drivers.keys': 'driver, drivers, transfer, transfer market, academy, junior, juniors, cockpit, talent, talents, signing, driver lounge',
  'mgr.kb.drivers.reply': 'You drive Driver 1 yourself, the computer drives Driver 2. In the Driver Lounge you extend contracts, find new drivers on the transfer market and develop young talents in the academy. Stronger drivers demand a higher salary and a better reputation for your team. An empty seat costs points and prize money.',

  // ---------- Staff ----------
  'mgr.kb.staff.keys': 'staff, employee, employees, personnel, mechanic, mechanics, data analyst, analyst, chief mechanic, salary, salaries, hire, hiring, applicant, applicants, engineer, race engineer, aero engineer, staff office',
  'mgr.kb.staff.reply': 'In the Staff Office you fill six positions: Mechanic, Race Engineer, Chief Mechanic, Engine Engineer, Aero Engineer and Data Analyst. The Mechanic (faster pit stops) and Race Engineer (better setup) help the most at the start. The higher the skill, the stronger the effect, but also the salary per race.',

  // ---------- Workshop ----------
  'mgr.kb.garage.keys': 'upgrade, upgrades, parts, car parts, chassis, workshop, garage, improve car, improve my car, improve the car, faster car, make the car faster, make my car faster, car faster, factory, engine upgrade',
  'mgr.kb.garage.reply': 'In the Workshop you improve your car: upgrades for engine, brakes, tires, suspension, aerodynamics, gearbox and cooling cost money and need development time, measured in races. On top of that come repairs, expanding the factory and, later, a better chassis.',

  // ---------- Research ----------
  'mgr.kb.research.keys': 'research, lab, laboratory, research lab, technology, tech, tech tree, research tree, develop, developing, branch, branches',
  'mgr.kb.research.reply': 'In the Research Lab you develop permanent technology across five branches: engine, aerodynamics, suspension, tires and pit crew. Every project costs money and time, measured in races. Some projects require others. A Data Analyst makes research cheaper and faster.',

  // ---------- Finances ----------
  'mgr.kb.finance.keys': 'finance, finances, financial, balance, costs, expenses, expense, bookings, booking, ledger, accounting, spending, overdraft, in the red, fixed costs',
  'mgr.kb.finance.reply': "You'll find the finances in the Team Office. They show your account balance, the season's income and expenses, the balance per race weekend and every individual booking. Fixed costs per race are salaries and travel costs. If your account is in the red, save on staff or bring in better sponsors.",

  // ---------- Reputation ----------
  'mgr.kb.reputation.keys': 'reputation, rep, popularity, popular, prestige, fame, respected, image',
  'mgr.kb.reputation.reply': 'Your reputation shows how highly regarded your team is. It rises with good results and met sponsor goals and falls after weak races or missed goals. With a high reputation, better sponsors and drivers come to you, and you can move up to the next class.',

  // ---------- Championship ----------
  'mgr.kb.season.ask': 'How does the championship work?',
  'mgr.kb.season.keys': 'championship, season, points, promotion, promoted, class, classes, league, standings, trophy, title, champion, ranking, scoring, move up, next class, tier',
  'mgr.kb.season.reply': "Every race awards points to the top ten: {points}, plus 1 point for the fastest lap if you finish in the top 10. Both drivers' points count toward the team standings. A season has {races} races. If you finish among the top three teams at the end, you can move up to the next class. There are three classes: {tiers}. You'll find all standings in the Trophy Cabinet.",

  // ---------- Weather ----------
  'mgr.kb.weather.keys': 'weather, raining, rainy, rains, rainfall, it rain, the rain, forecast, storm, dry, drying, damp, wet track, weather change',
  'mgr.kb.weather.reply': 'The weather can change during a race: the track gradually gets wet and slowly dries out again. The weather forecast is in the Team Truck and the Tire Depot, and its accuracy is limited. When it is wet you need Intermediate or Wet tires. At the Pit Wall you can set your team to automatically pick suitable tires when the weather changes.',

  // ---------- Test track ----------
  'mgr.kb.testtrack.keys': 'test track, free drive, free driving, free roam, practice track, best lap, best time, personal best, lap record, lap time, try out, drive around',
  'mgr.kb.testtrack.reply': 'The test track at the bottom edge of the grounds is always open. You drive freely there and earn money for clean laps and new best times. Perfect for practicing and earning a little extra. Up to six laps per run are paid.',

  // ---------- Objectives ----------
  'mgr.kb.missions.keys': 'objective, objectives, mission, missions, task, tasks, quest, quests, rewards',
  'mgr.kb.missions.reply': 'The objectives at the top left guide you through the game and pay rewards. Click an objective and your character walks to the target.',

  // ---------- Race weekend ----------
  'mgr.kb.race.keys': 'simulate, simulation, simulating, spectate, watch, watch the race, auto drive, drive myself, drive it myself, race weekend, team truck, truck, transporter, start a race, enter a race, play a race, how do i race, begin a race',
  'mgr.kb.race.reply': 'You start qualifying and races at the Team Truck. You can drive yourself, watch, or have the whole thing simulated in seconds. Driving yourself usually gives the best result, simulating is the fastest. After the race you get prize money, sponsor money and points.',

  // ---------- Saving ----------
  'mgr.kb.save.ask': 'Is my progress saved?',
  'mgr.kb.save.keys': 'save, saved, saving, savegame, save game, progress, lose my, backup, cloud, storage, autosave, export, import, load game, loading',
  'mgr.kb.save.reply': 'Your progress is saved automatically in the browser as you play. If the game runs as an artifact in claude.ai, there is also a copy in permanent storage. In Settings you can also back it up as a file and load it again later.',

  // ---------- Offline ----------
  'mgr.kb.offline.keys': 'offline, away, while i am away, while i m away, while i was away, closed, close the game, idle, come back, coming back, welcome back, passive income, afk',
  'mgr.kb.offline.reply': 'When you close the game, your facilities keep earning at half rate for up to an hour. You collect the money the next time you start.',

  // ---------- View / settings ----------
  'mgr.kb.view.keys': 'camera, racing line, ideal line, driving line, timing tower, tower, settings, setting, graphics, sound, music, volume, mute, view, corner hints, brake assist',
  'mgr.kb.view.reply': 'You toggle the camera ({camera}), racing line ({line}) and timing tower ({tower}) during the race. You find the settings (sound, corner hints, brake assist, keys) at the top right in the gear icon.',

  // ---------- About the manager, small talk ----------
  'mgr.kb.who.keys': 'who are you, who is this, your name, what is your name, what s your name, manager, katrin, introduce, about you',
  'mgr.kb.who.reply': "I'm {name}, your manager. I answer questions about the game, for example about building, racing, pit stops, drivers, sponsors and finances. And I warn you before contracts run out.",
  'mgr.kb.thanks.keys': 'thanks, thank you, thank, cheers, great, awesome, nice, cool, perfect, well done, good job',
  'mgr.kb.thanks.reply': "You're welcome! If you want to know anything else, just message me.",
  'mgr.kb.hello.keys': 'hello, hi, hey, hiya, howdy, greetings, good morning, good afternoon, good evening, yo',
  'mgr.kb.hello.reply': 'Hi! Nice to hear from you. What would you like to know? Ask me, for example, what to do next or how a pit stop works.',
};
