import { useEffect, useState } from 'react';
import { REGION_NAMES } from '../../data/names';
import type { LogoKind, Region } from '../../types';
import { createQuickGame } from '../../game/start';
import { loadSettings } from '../../game/save';
import { useGame } from '../store';
import { START_MONEY } from '../../game/tycoon';
import { GAME_NAME } from '../../config';
import { fmtMoney, t, useLang } from '../../i18n';
import { Btn, Logo } from '../components/common';
import { LanguageSwitch } from '../components/LanguageSwitch';

const COLORS = ['#ff6a1a', '#e8112d', '#1f6fff', '#13b57a', '#f5c400', '#9b4dff', '#00b7c7', '#ff3d8b', '#f2f2f2', '#1b1f23', '#8fd400', '#c49a5a'];
const LOGOS: LogoKind[] = ['shield', 'circle', 'chevron', 'wing', 'bolt', 'star', 'hex', 'flag'];

export function TitleScreen({ onStart, onContinue, hasSave, checking = false, restoreName, onRestore }: { onStart: () => void; onContinue?: () => void; hasSave: boolean; checking?: boolean; restoreName?: string | null; onRestore?: () => void }) {
  useLang();
  // Spielname für die Titelzeile: erstes Wort groß, der Rest in Teamfarbe darunter (z. B. „Apex“ / „Rennstall“)
  const [nameHead, ...nameRest] = GAME_NAME.split(' ');
  return (
    <div className="title-screen">
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
        <LanguageSwitch id="title-lang" />
      </div>
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} aria-hidden="true">
        <path id="tpath" d="M120,300 C120,120 360,90 520,140 S900,90 890,260 S760,520 560,470 S300,560 200,480 S120,420 120,300 Z" fill="none" stroke="#2f414b" strokeWidth="46" strokeLinejoin="round" />
        <path d="M120,300 C120,120 360,90 520,140 S900,90 890,260 S760,520 560,470 S300,560 200,480 S120,420 120,300 Z" fill="none" stroke="#e6edf0" strokeWidth="3" strokeDasharray="18 22" />
        {[0, 1.3, 2.1, 3.4, 4.6].map((d, i) => (
          <circle key={i} r={i === 0 ? 11 : 8} fill={i === 0 ? 'var(--team)' : ['#1f6fff', '#13b57a', '#f5c400', '#e8112d'][i - 1]}>
            <animateMotion dur={`${9 + i * 0.4}s`} begin={`-${d}s`} repeatCount="indefinite">
              <mpath href="#tpath" />
            </animateMotion>
          </circle>
        ))}
      </svg>
      <div className="title-card">
        <div className="eyebrow">{t('onb.title.eyebrow')}</div>
        <h1 className="display">
          {nameHead}
          {nameRest.length > 0 && <em>{nameRest.join(' ')}</em>}
        </h1>
        <p className="muted" style={{ fontSize: 17, maxWidth: 440 }}>
          {t('onb.title.tagline')}
        </p>
        <div className="row">
          {hasSave && onContinue && (
            <Btn variant="primary big" onClick={onContinue} icon="play">
              {t('onb.title.continue')}
            </Btn>
          )}
          <Btn variant={hasSave ? 'big' : 'primary big'} onClick={onStart} icon="flag" disabled={checking}>
            {t('onb.title.newTeam')}
          </Btn>
        </div>
        {checking && <p className="muted" style={{ fontSize: 13 }}>{t('onb.title.checking')}</p>}
        {!hasSave && restoreName && onRestore && (
          <div className="tip" style={{ alignItems: 'center' }}>
            <span>{t('onb.title.restore', { name: restoreName })}</span>
            <Btn variant="sm" onClick={onRestore}>{t('onb.title.restoreBtn')}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  const w = name.trim().split(/\s+/)[0] ?? '';
  return (w.replace(/[^A-Za-zÄÖÜäöüß]/g, '').slice(0, 3) || t('onb.defaultShort')).toUpperCase();
}

export function Onboarding({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const lang = useLang();
  const { setGame } = useGame();
  const [name, setName] = useState('Falkenberg Racing');
  const [short, setShort] = useState('FAL');
  const [shortTouched, setShortTouched] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [color2, setColor2] = useState('#f2f2f2');
  const [logo, setLogo] = useState<LogoKind>('shield');
  const [region, setRegion] = useState<Region>('europe');

  useEffect(() => {
    if (!shortTouched) setShort(initials(name));
  }, [name, shortTouched, lang]);

  const start = () => {
    const g = createQuickGame({ name: name.trim() || t('onb.defaultTeam'), short: (short.trim() || initials(name)).toUpperCase().slice(0, 3), color, color2, logo, region }, loadSettings());
    setGame(g);
    onDone();
  };

  // Startkapital im Satz fett hervorheben
  const amount = fmtMoney(START_MONEY);
  const funds = t('onb.funds', { money: START_MONEY });
  const at = funds.indexOf(amount);
  const fundsText = at < 0 ? funds : (
    <>
      {funds.slice(0, at)}
      <b style={{ color: 'var(--text)' }}>{amount}</b>
      {funds.slice(at + amount.length)}
    </>
  );

  return (
    <div className="onb">
      <div className="onb-inner">
        <div className="grid g2">
          <div className="card stack" style={{ gap: 16 }}>
            <div>
              <div className="eyebrow">{t('onb.eyebrow')}</div>
              <h2>{t('onb.heading')}</h2>
              <p className="muted">{t('onb.intro')}</p>
            </div>
            <div className="field">
              <label htmlFor="tname">{t('onb.teamName')}</label>
              <input id="tname" type="text" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">{t('onb.teamColor')}</span>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={t('onb.colorAria', { color: c })} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('onb.more')}</summary>
              <div className="stack" style={{ gap: 14, marginTop: 12 }}>
                <div className="field">
                  <label htmlFor="tshort">{t('onb.short')}</label>
                  <input id="tshort" type="text" value={short} maxLength={3} onChange={(e) => { setShortTouched(true); setShort(e.target.value.toUpperCase()); }} />
                </div>
                <div className="field">
                  <span className="lbl">{t('onb.color2')}</span>
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <button key={c} type="button" aria-label={t('onb.color2Aria', { color: c })} className={`swatch ${color2 === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor2(c)} />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="lbl">{t('onb.logo')}</span>
                  <div className="logo-pick">
                    {LOGOS.map((l) => (
                      <button key={l} type="button" className={logo === l ? 'on' : ''} onClick={() => setLogo(l)} aria-label={t('onb.logoAria', { kind: l })}>
                        <Logo kind={l} color={color} color2={color2} short={short} size={42} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="region">{t('onb.region')}</label>
                  <select id="region" value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                    {(Object.keys(REGION_NAMES) as Region[]).map((r) => (
                      <option key={r} value={r}>
                        {REGION_NAMES[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          </div>
          <div className="stack" style={{ gap: 14, alignContent: 'start' }}>
            <div className="card" style={{ background: `linear-gradient(140deg, ${color}33, var(--panel) 60%)` }}>
              <div className="row" style={{ gap: 16 }}>
                <Logo kind={logo} color={color} color2={color2} short={short} size={84} />
                <div>
                  <div className="eyebrow">{REGION_NAMES[region]}</div>
                  <h2 style={{ fontSize: 30 }}>{name || t('onb.defaultTeam')}</h2>
                  <span className="pill" style={{ color, borderColor: color }}>{short || t('onb.defaultShort')}</span>
                </div>
              </div>
              <svg viewBox="0 0 200 70" style={{ width: '100%', marginTop: 16 }} aria-hidden="true">
                <rect x="10" y="25" width="160" height="22" rx="10" fill={color} />
                <rect x="168" y="14" width="10" height="44" rx="2" fill={color2} />
                <rect x="4" y="18" width="10" height="36" rx="2" fill={color2} />
                <rect x="20" y="33" width="140" height="6" fill={color2} />
                <ellipse cx="88" cy="36" rx="16" ry="7" fill="#111" />
                <rect x="130" y="8" width="26" height="12" rx="3" fill="#111" />
                <rect x="130" y="52" width="26" height="12" rx="3" fill="#111" />
                <rect x="30" y="6" width="30" height="14" rx="3" fill="#111" />
                <rect x="30" y="52" width="30" height="14" rx="3" fill="#111" />
              </svg>
            </div>
            <div className="card">
              <p className="muted">{fundsText}</p>
            </div>
            <div className="row">
              <Btn variant="ghost" onClick={onCancel}>{t('onb.back')}</Btn>
              <Btn variant="primary big" icon="flag" onClick={start} disabled={!name.trim()}>
                {t('onb.start')}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
