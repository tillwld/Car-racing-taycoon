import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameProvider, useGame } from './ui/store';
import { Btn, Icon, Logo, Modal, Money } from './ui/components/common';
import { Onboarding, TitleScreen } from './ui/screens/Onboarding';
import Dashboard from './ui/screens/Dashboard';
import RaceHub from './ui/screens/RaceHub';
import Garage from './ui/screens/Garage';
import Research from './ui/screens/Research';
import Drivers from './ui/screens/Drivers';
import StaffScreen from './ui/screens/Staff';
import Sponsors from './ui/screens/Sponsors';
import Championship from './ui/screens/Championship';
import Calendar from './ui/screens/Calendar';
import Finance from './ui/screens/Finance';
import StatsScreen from './ui/screens/Stats';
import SettingsScreen from './ui/screens/Settings';
import ManagerChat from './ui/screens/ManagerChat';
import type { RaceViewResult } from './ui/race/RaceView';

// Die 3D-Rennansicht (three.js) wird erst beim ersten Rennen geladen
const RaceView = lazy(() => import('./ui/race/RaceView'));
const RaceLoading = () => (
  <div className="race-root">
    <div className="center-msg" style={{ fontSize: 22 }}>{t('app.race.loading')}</div>
  </div>
);
import { setupComplete } from './game/state';
import { clearGame, deletedGame, forgetDeletedGame } from './game/save';
import { resolveEvent } from './game/events';
import { MANAGER, ackManager, ensureManager, managerBox } from './game/manager';
import { makeFreeDriveConfig, startNextSeason } from './game/weekend';
import { TIERS } from './data/catalog';
import { GENERAL_TIPS, TIPS } from './data/tips';
import type { GameState, PlotId } from './types';
import HubWorld from './ui/world/HubWorld';
import { STATION_LABELS, type StationId } from './ui/world/hubLayout';
import { devSlots } from './game/carModel';
import { TRACK_BY_ID } from './data/tracks';
import { aufbauPath, nextPlot, buyPlot, activeMissions, currentTip, dismissTip, features, freeDriveReward, incomeParts, incomePerSec, PLOTS, plotLevel, plotReqText, type MissionTarget } from './game/tycoon';
import { lapTime, money } from './game/util';
import { sound } from './audio/sound';
import { lazyRecord, t, tp, tx, useLang, type Params } from './i18n';
import { platform } from './platform/platform';
import { usePlatformPaused } from './platform/glue';
import { runQueuedInterstitial, scheduleInterstitial, setAdsBlocked } from './platform/ads';

export type Screen = 'dashboard' | 'race' | 'garage' | 'research' | 'drivers' | 'staff' | 'sponsors' | 'championship' | 'calendar' | 'finance' | 'stats' | 'settings' | 'manager';
export type RaceFocus = 'setup' | 'tyres' | 'tactics';

export default function App() {
  useLang(); // gesamte Oberfläche neu zeichnen, wenn die Sprache wechselt
  return (
    <GameProvider>
      <Root />
      <Toasts />
    </GameProvider>
  );
}

function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`}>
          {tx(item.text)}
        </div>
      ))}
    </div>
  );
}

function Root() {
  const { game, setGame, cloudChecked } = useGame();
  const [mode, setMode] = useState<'title' | 'onboarding' | 'game'>('title');
  const [trash, setTrash] = useState(() => deletedGame());
  useEffect(() => {
    if (mode === 'title') setTrash(deletedGame());
  }, [mode]);
  const [confirmNew, setConfirmNew] = useState(false);
  const hasSave = !!game && setupComplete(game);
  // Das Portal erfährt, dass das Spiel spielbar ist, sobald der Titelbildschirm steht (einmal)
  const readySent = useRef(false);
  useEffect(() => {
    if (mode === 'title' && cloudChecked && !readySent.current) {
      readySent.current = true;
      platform.gameReady();
    }
  }, [mode, cloudChecked]);

  if (mode === 'title') {
    return (
      <>
        <TitleScreen
          hasSave={hasSave}
          checking={!cloudChecked}
          restoreName={trash?.team.name}
          onRestore={() => {
            if (!trash) return;
            setGame(trash);
            forgetDeletedGame();
            setTrash(null);
            setMode('game');
          }}
          onContinue={() => setMode(hasSave ? 'game' : 'onboarding')}
          onStart={() => (hasSave ? setConfirmNew(true) : setMode('onboarding'))}
        />
        {confirmNew && (
          <Modal onClose={() => setConfirmNew(false)}>
            <h2>{t('app.newTeam.title')}</h2>
            <p className="muted">{t('app.newTeam.warn', { team: game?.team.name })}</p>
            <div className="row">
              <Btn variant="danger" onClick={() => {
                clearGame();
                setTrash(deletedGame());
                setGame(null);
                setConfirmNew(false);
                setMode('onboarding');
              }}>
                {t('app.newTeam.confirm')}
              </Btn>
              <Btn variant="ghost" onClick={() => setConfirmNew(false)}>{t('app.common.cancel')}</Btn>
            </div>
          </Modal>
        )}
      </>
    );
  }
  if (mode === 'onboarding' || !game || !setupComplete(game)) {
    return <Onboarding onDone={() => setMode('game')} onCancel={() => setMode('title')} />;
  }
  return <Shell onQuit={() => setMode('title')} />;
}

// Stationen auf dem Gelände und welche Bildschirme sie öffnen
const STATION_TABS: Record<StationId, Screen[]> = {
  garage: ['garage'],
  lab: ['research'],
  staff: ['staff'],
  lounge: ['drivers'],
  sponsors: ['sponsors'],
  office: ['dashboard', 'finance'],
  trophy: ['championship', 'stats'],
  truck: ['race'],
  calendar: ['calendar'],
  setup: ['race'],
  tyres: ['race'],
  pitwall: ['race'],
};
const STATION_FOCUS: Partial<Record<StationId, RaceFocus>> = { setup: 'setup', tyres: 'tyres', pitwall: 'tactics' };
const SCREEN_STATION: Record<Screen, StationId | 'settings' | 'manager'> = {
  dashboard: 'office',
  finance: 'office',
  race: 'truck',
  garage: 'garage',
  research: 'lab',
  drivers: 'lounge',
  staff: 'staff',
  sponsors: 'sponsors',
  championship: 'trophy',
  stats: 'trophy',
  calendar: 'calendar',
  settings: 'settings',
  manager: 'manager',
};
const TAB_LABEL: Record<Screen, string> = lazyRecord('app.tab', ['dashboard', 'race', 'garage', 'research', 'drivers', 'staff', 'sponsors', 'championship', 'calendar', 'finance', 'stats', 'settings', 'manager'] as const);
const SCREEN_NEEDS: Partial<Record<Screen, { feature: keyof ReturnType<typeof features>; where: () => string }>> = {
  garage: { feature: 'garage', where: () => t('app.need.garage') },
  research: { feature: 'research', where: () => t('app.need.research') },
  drivers: { feature: 'drivers', where: () => t('app.need.drivers') },
  staff: { feature: 'staff', where: () => t('app.need.staff') },
  sponsors: { feature: 'sponsors', where: () => t('app.need.sponsors') },
  finance: { feature: 'finance', where: () => t('app.need.finance') },
};
const QUICK: { s: StationId; icon: string }[] = [
  { s: 'truck', icon: 'flag' },
  { s: 'garage', icon: 'garage' },
  { s: 'setup', icon: 'wrench' },
  { s: 'tyres', icon: 'pit' },
  { s: 'pitwall', icon: 'dashboard' },
  { s: 'lab', icon: 'research' },
  { s: 'lounge', icon: 'drivers' },
  { s: 'staff', icon: 'staff' },
  { s: 'sponsors', icon: 'sponsors' },
  { s: 'office', icon: 'dashboard' },
  { s: 'trophy', icon: 'championship' },
  { s: 'calendar', icon: 'calendar' },
];
const STATION_PLOT: Partial<Record<StationId, PlotId>> = { garage: 'workshop', lab: 'lab', staff: 'staffOffice', lounge: 'lounge', sponsors: 'sponsorLounge', setup: 'setupLab', tyres: 'tireDepot', pitwall: 'pitwall' };

function stationBuilt(g: GameState, s: StationId) {
  const p = STATION_PLOT[s];
  if (p) return plotLevel(g, p) >= 1;
  if (s === 'trophy') return g.stats.races >= 1;
  return true;
}

function stationAlerts(g: GameState): Partial<Record<StationId, string>> {
  const a: Partial<Record<StationId, string>> = {};
  const f = features(g);
  const slots = devSlots(g);
  const parts = g.developments.filter((d) => d.kind === 'part').length;
  const res = g.developments.filter((d) => d.kind === 'research').length;
  if (f.garage) {
    if (Object.values(g.car.condition).some((v) => v < 0.7)) a.garage = t('app.alert.repair');
    else if (parts < slots.parts && g.money > 150000) a.garage = t('app.alert.devSlot');
  }
  if (f.research && res < slots.research && g.money > 150000) a.lab = t('app.alert.labFree');
  if (f.drivers) {
    if (g.team.driverIds.length < 2) a.lounge = t('app.alert.cockpit');
    else if (g.team.driverIds.some((id) => (g.drivers[id]?.contract ?? 9) <= 3)) a.lounge = t('app.alert.contract');
  }
  if (f.sponsors) {
    if (!g.sponsors.some((s) => s.slot === 'main')) a.sponsors = t('app.alert.noMain');
    else if (g.sponsors.some((s) => s.races <= 3)) a.sponsors = t('app.alert.contract');
  }
  if (f.staff && (!g.staff.mechanic || !g.staff.raceEngineer)) a.staff = t('app.alert.staffOpen');
  if (g.money < 0) a.office = t('app.alert.overdrawn');
  if (g.round < g.calendar.length && !g.seasonEnd) {
    const w = g.weekend;
    a.truck = !w || !w.qualiDone ? t('app.alert.weekend') : t('app.alert.gridSet');
  }
  return a;
}

const SPOT_FOR: Record<MissionTarget, string> = {
  track: 'track', truck: 'truck', garage: 'workshop', office: 'office',
  kiosk: 'kiosk', fanshop: 'fanshop', grandstand: 'grandstand', media: 'media', workshop: 'workshop', setupLab: 'setupLab',
  tireDepot: 'tireDepot', pitwall: 'pitwall', lab: 'lab', staffOffice: 'staffOffice', lounge: 'lounge', sponsorLounge: 'sponsorLounge',
};

/** Geldanzeige, die sanft zum neuen Wert zählt */
function MoneyTicker({ value, frozen = false }: { value: number; frozen?: boolean }) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  const target = useRef(value);
  target.current = value;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const diff = target.current - cur.current;
      // Während einer Fahrt nicht animieren: jedes Bild würde die Oberfläche neu zeichnen
      if (frozenRef.current) {
        last = now;
        return;
      }
      if (Math.abs(diff) < 0.5) {
        if (cur.current !== target.current) {
          cur.current = target.current;
          setShown(cur.current);
        }
        return;
      }
      cur.current += diff * Math.min(1, dt * 7);
      setShown(cur.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const v = Math.round(shown);
  return <span className="num">{money(v, Math.abs(v) >= 10_000_000)}</span>;
}

/** Text mit einem Platzhalter {slot}, an dessen Stelle ein Element (z. B. fetter Betrag) erscheint */
function withSlot(key: string, slot: string, node: ReactNode, params?: Params) {
  const parts = t(key, { ...params, [slot]: '[[slot]]' }).split('[[slot]]');
  return (
    <>
      {parts[0]}
      {node}
      {parts[1] ?? ''}
    </>
  );
}

function TipModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { game } = useGame();
  const tip = TIPS[id];
  if (!tip) return null;
  // Nach einer neuen Anlage: kurz sagen, was als Nächstes freigeschaltet wird
  const nxt = id.startsWith('plot_') && game ? nextPlot(game) : null;
  const nxtInfo = nxt && game ? aufbauPath(game).find((x) => x.id === nxt) : null;
  const nxtReq = nxt && game ? tx(plotReqText(game, nxt)) : '';
  return (
    <Modal onClose={onClose}>
      <div className="eyebrow">{t('app.tip.eyebrow')}</div>
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
        <span className="tip-icon"><Icon name={tip.icon} size={28} /></span>
        <h2>{tip.title}</h2>
      </div>
      <p>{tip.lead}</p>
      <ul className="tip-list">
        {tip.points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      {tip.next && (
        <div className="tip" style={{ alignItems: 'center' }}>
          <Icon name="right" size={20} />
          <p><b>{t('app.tip.next')}</b> {tip.next}</p>
        </div>
      )}
      {nxtInfo && (
        <p className="muted" style={{ fontSize: 13 }}>
          {t('app.tip.after')} <b>{tx(nxtInfo.name)}</b>. {tx(nxtInfo.why)} {nxtReq ? `(${nxtReq})` : ''}
        </p>
      )}
      <div className="row">
        <Btn variant="primary big" onClick={onClose}>{t('app.common.gotIt')}</Btn>
      </div>
    </Modal>
  );
}

type FreeSession = { config: ReturnType<typeof makeFreeDriveConfig>['config']; trackId: string; driverId: string; intro: boolean };

function Shell({ onQuit }: { onQuit: () => void }) {
  useLang(); // gesamte Oberfläche neu zeichnen, wenn die Sprache wechselt
  const { game, update, saveOk, saveInfo, toast, get, setIncomePaused } = useGame();
  const g = game as GameState;
  const [panel, setPanel] = useState<{ key: StationId | 'settings' | 'manager'; tab: Screen; focus?: RaceFocus } | null>(null);
  const [racing, setRacing] = useState(false);
  const [snoozedEv, setSnoozedEv] = useState<string | null>(null);
  const [seasonHidden, setSeasonHidden] = useState(false);
  const seasonOver = !!game?.seasonEnd;
  useEffect(() => {
    if (!seasonOver) setSeasonHidden(false);
  }, [seasonOver]);
  const [quick, setQuick] = useState(false);
  const [help, setHelp] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [reopenTip, setReopenTip] = useState<string | null>(null);
  const [walkTo, setWalkTo] = useState<{ target: string; n: number } | null>(null);
  const [free, setFree] = useState<FreeSession | null>(null);
  const [freeResult, setFreeResult] = useState<{ track: string; best: number; lines: { label: string; amount: number }[] } | null>(null);
  const feats = features(g);
  const box = managerBox(g);

  // Die Managerin stellt sich beim ersten Besuch vor
  useEffect(() => {
    if (!managerBox(get() as GameState).messages.length) update((st) => ensureManager(st));
  }, []);
  // Neue Nachricht der Managerin: kurzer Hinweis, außer das Postfach ist gerade offen
  const lastMsgId = useRef<string | null>(box.messages.length ? box.messages[box.messages.length - 1].id : null);

  const open = useCallback((st: StationId) => {
    sound.click();
    setQuick(false);
    setPanel({ key: st, tab: STATION_TABS[st][0], focus: STATION_FOCUS[st] });
  }, []);
  const go = useCallback((s: Screen) => {
    const need = SCREEN_NEEDS[s];
    if (need && !features(get() as GameState)[need.feature]) {
      toast(t('app.toast.locked', { where: need.where() }), 'bad');
      return;
    }
    const key = SCREEN_STATION[s];
    setPanel({ key, tab: s });
    document.querySelector('.panel-body')?.scrollTo({ top: 0 });
  }, [get, toast]);
  const close = useCallback(() => setPanel(null), []);

  const buy = useCallback((id: PlotId) => {
    const err = update((s) => buyPlot(s, id));
    if (!err) {
      sound.build();
      toast(t('app.toast.built', { name: PLOTS[id].name }), 'good');
    }
  }, [update, toast]);

  const startFree = useCallback(() => {
    const cur = get() as GameState;
    if (!cur.team.driverIds.length) {
      toast(t('app.toast.needDriver'), 'bad');
      return;
    }
    const sess = makeFreeDriveConfig(cur);
    setFree({ ...sess, intro: !cur.tipsSeen.freedrive });
    sound.confirm();
    update((s) => {
      s.tipsSeen.freedrive = true;
    });
  }, [get, toast, update]);

  const onFreeExit = useCallback((r: RaceViewResult) => {
    const sess = free;
    setFree(null);
    if (!sess || r.kind !== 'practice' || !r.laps.length) return;
    let lines: { label: string; amount: number }[] = [];
    update((s) => {
      lines = freeDriveReward(s, sess.trackId, r.laps);
    });
    sound.coin();
    setFreeResult({ track: TRACK_BY_ID[sess.trackId].name, best: Math.min(...r.laps), lines });
  }, [free, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && panel && !racing) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, racing, close]);

  const alerts = stationAlerts(g);
  const ev = g.pendingEvents[0];
  const tipId = currentTip(g);
  const offline = g.flags.offline as { amount: number; seconds: number } | undefined;
  const missions = activeMissions(g, 3);
  const objective = missions[0] ? SPOT_FOR[missions[0].target] : null;
  const urgent = box.messages.find((msg) => msg.urgent && !msg.ack) ?? null;
  const showTip = !!tipId && !racing && !panel && !free && !freeResult && !ev && !g.seasonEnd && !offline;
  const showUrgent = !!urgent && !showTip && !racing && !panel && !free && !freeResult && !g.seasonEnd && !offline && !reopenTip && !help;
  const blocking = !!panel || (!!ev && !racing) || !!g.seasonEnd || quick || help || !!free || !!freeResult || showTip || !!offline || !!reopenTip || showUrgent;
  const lastMsg = box.messages[box.messages.length - 1];
  useEffect(() => {
    if (!lastMsg || lastMsg.id === lastMsgId.current) return;
    lastMsgId.current = lastMsg.id;
    if (lastMsg.from !== 'manager' || panel?.key === 'manager') return;
    if (box.messages.length === 1) toast(t('app.toast.managerNew', { name: MANAGER.name }), 'good');
    else toast(t('app.toast.managerMsg', { name: MANAGER.first, text: tx(lastMsg.text).split('\n')[0].slice(0, 90) }), 'good');
  }, [lastMsg?.id]);
  // Während einer Fahrt läuft das Einkommen im Hintergrund weiter, ohne jede Sekunde die Oberfläche neu zu zeichnen
  // Pause durch das Portal (Tab im Hintergrund, Werbung läuft, Portal-Pause): Gelände und Einkommen halten an, der Ton wird angehalten (siehe platform/glue.ts)
  const platformPaused = usePlatformPaused();
  useEffect(() => {
    setIncomePaused(!!free || racing || platformPaused);
    return () => setIncomePaused(false);
  }, [free, racing, platformPaused, setIncomePaused]);
  // Werbung nie mitten in einer Fahrt; vorgemerkte Zwischenwerbung (nach dem Ergebnis) kommt, sobald die Fahrt vorbei ist
  const driving = racing || !!free;
  useEffect(() => {
    setAdsBlocked(driving);
    platform.gameplay(driving);
    if (!driving) runQueuedInterstitial();
  }, [driving]);
  const tabs = panel ? (panel.key === 'settings' ? (['settings'] as Screen[]) : panel.key === 'manager' ? (['manager'] as Screen[]) : STATION_TABS[panel.key].filter((tb) => tb !== 'finance' || feats.finance)) : [];
  const panelTitle = panel ? (panel.key === 'settings' ? TAB_LABEL.settings : panel.key === 'manager' ? t('app.manager.named', { name: MANAGER.name }) : STATION_LABELS[panel.key]) : '';
  const nextTrack = g.calendar[g.round] ? TRACK_BY_ID[g.calendar[g.round]] : null;
  const rate = incomePerSec(g);

  return (
    <div className="hub-root">
      <HubWorld game={g} paused={blocking || platformPaused} hidden={!!free || racing} alerts={alerts} objective={objective} onOpen={open} onBuy={buy} onFreeDrive={startFree} walkTo={walkTo} />

      <header className="hub-top">
        <div className="hub-team">
          <Logo kind={g.team.logo} color={g.team.color} color2={g.team.color2} short={g.team.short} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className="t">{g.team.name}</div>
            <div className="s">{t('app.hud.tierSeason', { tier: TIERS[g.tier].name, season: g.season })}</div>
          </div>
        </div>
        <div className="hub-kpis">
          <button type="button" className="kpi money-kpi" onClick={() => setIncomeOpen((v) => !v)} aria-expanded={incomeOpen} aria-label={t('app.hud.incomeShow')}>
            <span className="l">{t('app.hud.budget')}</span>
            <span className="v" style={{ color: g.money < 0 ? 'var(--bad)' : undefined }}><MoneyTicker value={g.money} frozen={!!free || racing} /></span>
            <span className="rate">{t('app.rate.int', { v: Math.round(rate) })}</span>
          </button>
          <div className="kpi hide-xs">
            <span className="l">{t('app.hud.reputation')}</span>
            <span className="v">{Math.round(g.reputation)}</span>
          </div>
          <div className="kpi">
            <span className="l">{t('app.hud.race')}</span>
            <span className="v">{Math.min(g.round + 1, g.calendar.length)}/{g.calendar.length}</span>
          </div>
        </div>
        <div className="hub-actions">
          <button type="button" className="hud-btn" aria-label={t('app.hud.help')} onClick={() => setHelp(true)}>
            <Icon name="info" />
          </button>
          <button type="button" className="hud-btn" aria-label={box.unread ? tp('app.hud.managerUnread', box.unread) : t('app.hud.manager')} onClick={() => setPanel({ key: 'manager', tab: 'manager' })}>
            <Icon name="chat" />
            {box.unread > 0 && <span className="hud-badge">{box.unread}</span>}
          </button>
          <button type="button" className="hud-btn" aria-label={g.settings.muted ? t('app.hud.soundOn') : t('app.hud.soundOff')} onClick={() => update((s) => { s.settings.muted = !s.settings.muted; })}>
            <Icon name={g.settings.muted ? 'mute' : 'sound'} />
          </button>
          <button type="button" className="hud-btn" aria-label={t('app.hud.settings')} onClick={() => setPanel({ key: 'settings', tab: 'settings' })}>
            <Icon name="settings" />
          </button>
          <button type="button" className="hud-btn" aria-label={t('app.quick.title')} onClick={() => setQuick((v) => !v)}>
            <Icon name="list" />
          </button>
        </div>
      </header>

      {incomeOpen && (
        <div className="income-pop" role="dialog" aria-label={t('app.income.title')}>
          <div className="row between">
            <b className="display" style={{ fontSize: 18 }}>{t('app.income.title')}</b>
            <button type="button" className="hud-btn" style={{ width: 30, height: 30 }} aria-label={t('app.common.close')} onClick={() => setIncomeOpen(false)}><Icon name="close" /></button>
          </div>
          {incomeParts(g).map((p) => (
            <div key={p.label} className="row between" style={{ fontSize: 14, flexWrap: 'nowrap' }}>
              <span>{tx(p.label)}</span>
              <span className="num good">{p.perSec < 100 ? t('app.rate.dec', { v: p.perSec }) : t('app.rate.int', { v: p.perSec })}</span>
            </div>
          ))}
          <div className="sep" />
          <div className="row between" style={{ fontSize: 14 }}>
            <b>{t('app.income.total')}</b>
            <b className="num good">{t('app.rate.dec', { v: rate })}</b>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>{t('app.income.perMinute', { v: rate * 60 })}</span>
        </div>
      )}

      {missions.length > 0 && !blocking && (
        <div className="hub-missions" aria-label={t('app.missions.title')}>
          <div className="eyebrow">{t('app.missions.title')}</div>
          {missions.map((mi, i) => (
            <button key={mi.id} type="button" className={`mission ${i === 0 ? 'first' : ''}`} onClick={() => setWalkTo({ target: SPOT_FOR[mi.target], n: Date.now() })}>
              <span className="mdot" />
              <span className="txt">{tx(mi.text)}</span>
              {mi.reward > 0 && <span className="rw">+{money(mi.reward, true)}</span>}
            </button>
          ))}
        </div>
      )}

      {g.seasonEnd && seasonHidden && !racing && !free && (
        <div className="hub-next">
          <span className="eyebrow">{t('app.season.title')}</span>
          <Btn variant="primary sm" onClick={() => setSeasonHidden(false)}>{t('app.season.reopen')}</Btn>
        </div>
      )}

      {nextTrack && !g.seasonEnd && (
        <div className="hub-next">
          <span className="eyebrow">{t('app.next.eyebrow')}</span>
          <b>{nextTrack.name}</b>
          <div className="row" style={{ gap: 6 }}>
            <Btn variant="primary sm" icon="flag" onClick={() => setWalkTo({ target: 'truck', n: Date.now() })}>{t('app.next.walk')}</Btn>
            <Btn variant="sm ghost" onClick={() => open('truck')}>{t('app.next.open')}</Btn>
          </div>
        </div>
      )}

      {quick && (
        <div className="hub-quick" role="menu">
          <div className="row between" style={{ marginBottom: 6 }}>
            <b className="display" style={{ fontSize: 18 }}>{t('app.quick.title')}</b>
            <button type="button" className="hud-btn" style={{ width: 32, height: 32 }} aria-label={t('app.common.close')} onClick={() => setQuick(false)}><Icon name="close" /></button>
          </div>
          <button type="button" className="hub-quick-item" onClick={() => { setQuick(false); setPanel({ key: 'manager', tab: 'manager' }); }}>
            <Icon name="chat" />
            <span>{t('app.manager.named', { name: MANAGER.first })}</span>
            {box.unread > 0 && <span className="dot" />}
          </button>
          <button type="button" className="hub-quick-item" onClick={() => { setQuick(false); startFree(); }}>
            <Icon name="race" />
            <span>{t('app.quick.testTrack')}</span>
          </button>
          {QUICK.filter((q) => stationBuilt(g, q.s)).map((q) => (
            <button key={q.s} type="button" className="hub-quick-item" onClick={() => open(q.s)}>
              <Icon name={q.icon} />
              <span>{STATION_LABELS[q.s]}</span>
              {alerts[q.s] && <span className="dot" />}
            </button>
          ))}
          <div className="sep" />
          <span className="muted" style={{ fontSize: 12 }}>{saveOk ? (saveInfo.cloud === 'ok' ? t('app.quick.savedCloud') : t('app.quick.saved')) : t('app.quick.saveFail')}</span>
          <Btn variant="ghost sm" onClick={onQuit}>{t('app.quick.toTitle')}</Btn>
        </div>
      )}

      {panel && (
        <div className="panel-bg" onPointerDown={(e) => e.target === e.currentTarget && !racing && close()}>
          <section className="panel" role="dialog" aria-label={panelTitle}>
            <header className="panel-head">
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow">{g.team.name}</div>
                <h2>{panelTitle}</h2>
              </div>
              {tabs.length > 1 && (
                <div className="seg">
                  {tabs.map((tb) => (
                    <button key={tb} type="button" className={panel.tab === tb ? 'on' : ''} onClick={() => setPanel({ ...panel, tab: tb })}>
                      {TAB_LABEL[tb]}
                    </button>
                  ))}
                </div>
              )}
              <Btn variant="sm" icon="close" onClick={close}>{t('app.panel.back')}</Btn>
            </header>
            <div className="panel-body">
              <div className="content">
                {panel.tab === 'dashboard' && <Dashboard go={go} />}
                {panel.tab === 'race' && <RaceHub go={(s) => (s === 'dashboard' ? close() : go(s))} onRacing={setRacing} focus={panel.focus} />}
                {panel.tab === 'garage' && <Garage />}
                {panel.tab === 'research' && <Research />}
                {panel.tab === 'drivers' && <Drivers />}
                {panel.tab === 'staff' && <StaffScreen />}
                {panel.tab === 'sponsors' && <Sponsors />}
                {panel.tab === 'championship' && <Championship />}
                {panel.tab === 'calendar' && <Calendar go={go} />}
                {panel.tab === 'finance' && <Finance />}
                {panel.tab === 'stats' && <StatsScreen />}
                {panel.tab === 'settings' && <SettingsScreen onQuit={onQuit} />}
                {panel.tab === 'manager' && <ManagerChat go={go} />}
              </div>
            </div>
          </section>
        </div>
      )}

      {ev && ev.id !== snoozedEv && !racing && !g.seasonEnd && !free && !showUrgent && (
        <Modal onClose={() => setSnoozedEv(ev.id)}>
          <div className="eyebrow">{t('app.event.eyebrow')}</div>
          <h2>{tx(ev.title)}</h2>
          <p>{tx(ev.text)}</p>
          <div className="stack">
            {ev.choices.map((c) => (
              <button key={c.effect} type="button" className="choice" disabled={!!c.cost && g.money < c.cost} style={{ opacity: c.cost && g.money < c.cost ? 0.5 : 1 }} onClick={() => update((s) => resolveEvent(s, ev.id, c.effect))}>
                <b>{tx(c.label)}</b>
                <span>{tx(c.detail)}{c.cost && g.money < c.cost ? ` · ${t('app.event.noBudget')}` : ''}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {g.seasonEnd && !seasonHidden && !racing && !free && <SeasonEndModal onClose={() => setSeasonHidden(true)} />}

      {showUrgent && urgent && (
        <Modal onClose={() => update((st) => ackManager(st, urgent.id))}>
          <div className="eyebrow">{t('app.urgent.eyebrow', { name: MANAGER.name })}</div>
          <h2>{t('app.urgent.title')}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{tx(urgent.text)}</p>
          <div className="row">
            {(urgent.actions ?? []).map((a) => (
              <Btn key={a.screen} variant="primary" onClick={() => { update((st) => ackManager(st, urgent.id)); go(a.screen as Screen); }}>{tx(a.label)}</Btn>
            ))}
            <Btn variant={urgent.actions?.length ? 'ghost' : 'primary'} onClick={() => update((st) => ackManager(st, urgent.id))}>{urgent.actions?.length ? t('app.urgent.later') : t('app.common.gotIt')}</Btn>
          </div>
        </Modal>
      )}
      {showTip && tipId && <TipModal id={tipId} onClose={() => update((s) => dismissTip(s, tipId))} />}
      {reopenTip && <TipModal id={reopenTip} onClose={() => setReopenTip(null)} />}

      {offline && !racing && !free && (
        <Modal onClose={() => update((s) => { delete s.flags.offline; })}>
          <div className="eyebrow">{t('app.offline.eyebrow')}</div>
          <h2>{t('app.offline.title')}</h2>
          <p>{withSlot('app.offline.earned', 'amount', <b className="good"><Money v={offline.amount} /></b>)}</p>
          <p className="muted" style={{ fontSize: 13 }}>{t('app.offline.note')}</p>
          <div className="row">
            <Btn variant="primary big" onClick={() => { sound.coin(); update((s) => { delete s.flags.offline; }); }}>{t('app.offline.collect')}</Btn>
          </div>
        </Modal>
      )}

      {freeResult && (
        <Modal onClose={() => setFreeResult(null)}>
          <div className="eyebrow">{t('app.free.eyebrow', { track: freeResult.track })}</div>
          <h2>{t('app.free.title')}</h2>
          <p>{t('app.free.best')} <b className="num">{lapTime(freeResult.best)}</b></p>
          <div className="stack" style={{ gap: 0 }}>
            {freeResult.lines.map((l, i) => (
              <div key={i} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 14, flexWrap: 'nowrap' }}>
                <span>{tx(l.label)}</span>
                <Money v={l.amount} sign />
              </div>
            ))}
          </div>
          <div className="row">
            <Btn variant="primary big" onClick={() => setFreeResult(null)}>{t('app.free.continue')}</Btn>
            <Btn onClick={() => { setFreeResult(null); startFree(); }}>{t('app.free.again')}</Btn>
          </div>
        </Modal>
      )}

      {help && (
        <Modal onClose={() => setHelp(false)}>
          <div className="eyebrow">{t('app.help.eyebrow')}</div>
          <h2>{t('app.help.title')}</h2>
          <p className="muted" style={{ fontSize: 14 }}>{t('app.help.intro')}</p>
          <div className="stack" style={{ gap: 6 }}>
            {Object.keys(TIPS)
              .filter((id) => GENERAL_TIPS.includes(id) || (id.startsWith('plot_') && plotLevel(g, id.slice(5) as PlotId) >= 1))
              .map((id) => (
                <button key={id} type="button" className="hub-quick-item" style={{ border: '1px solid var(--line)' }} onClick={() => { setHelp(false); setReopenTip(id); }}>
                  <Icon name={TIPS[id].icon} />
                  <span>{TIPS[id].title}</span>
                </button>
              ))}
          </div>
          <div className="row">
            <Btn variant="primary" onClick={() => setHelp(false)}>{t('app.common.close')}</Btn>
          </div>
        </Modal>
      )}

      {free && (
        <Suspense fallback={<RaceLoading />}>
        <RaceView
          config={free.config}
          humanId={free.driverId}
          focusId={free.driverId}
          title={t('app.free.eyebrow', { track: TRACK_BY_ID[free.trackId].name })}
          sessionLabel={t('app.free.session')}
          settings={g.settings}
          intro={free.intro}
          features={{ pit: false, fuel: false, damage: false }}
          onSettings={(p) => update((s) => void Object.assign(s.settings, p))}
          onExit={onFreeExit}
        />
        </Suspense>
      )}
    </div>
  );
}

function SeasonEndModal({ onClose }: { onClose: () => void }) {
  const { game, update } = useGame();
  const g = game as GameState;
  const se = g.seasonEnd!;
  const sm = se.summary;
  return (
    <Modal wide onClose={onClose}>
      <div className="eyebrow">{t('app.season.eyebrow', { season: sm.season, tier: TIERS[sm.tier].name })}</div>
      <h1>{t('app.season.title')}</h1>
      <div className="grid g4 keep">
        <div className="stat-tile"><span className="eyebrow">{t('app.season.teamPos')}</span><span className="big-num">P{sm.teamPos}</span></div>
        <div className="stat-tile"><span className="eyebrow">{t('app.season.bestDriver')}</span><span className="big-num">P{sm.driverPos}</span></div>
        <div className="stat-tile"><span className="eyebrow">{t('app.season.points')}</span><span className="big-num">{sm.points}</span></div>
        <div className="stat-tile"><span className="eyebrow">{t('app.season.prize')}</span><span className="big-num" style={{ fontSize: 26 }}><Money v={se.prize} compact /></span></div>
      </div>
      <p>
        {t('app.season.champion')}: <b>{sm.championDriver}</b> · {t('app.season.teamTitle')}: <b>{sm.championTeam}</b>
      </p>
      {se.promotionOffered ? (
        <div className="tip">
          <Icon name="championship" size={28} />
          <div className="stack">
            <b>{t('app.season.promoTitle')}</b>
            <p>{t('app.season.promoText', { pos: sm.teamPos, team: g.team.name, tier: TIERS[sm.tier + 1].name })}</p>
          </div>
        </div>
      ) : (
        <p className="muted">{g.tier < 2 ? t('app.season.needTop3') : t('app.season.topClass')}</p>
      )}
      <div className="row">
        {se.promotionOffered && (
          <Btn variant="primary big" onClick={() => { update((s) => startNextSeason(s, true)); scheduleInterstitial('season_change'); }}>
            {t('app.season.promote')}
          </Btn>
        )}
        <Btn variant={se.promotionOffered ? 'big' : 'primary big'} onClick={() => { update((s) => startNextSeason(s, false)); scheduleInterstitial('season_change'); }}>
          {se.promotionOffered ? t('app.season.stay') : t('app.season.next')}
        </Btn>
      </div>
    </Modal>
  );
}
