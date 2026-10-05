import { useEffect, useState } from 'react';
import { REGION_NAMES } from '../../data/names';
import type { LogoKind, Region } from '../../types';
import { createQuickGame } from '../../game/start';
import { loadSettings } from '../../game/save';
import { useGame } from '../store';
import { Btn, Logo } from '../components/common';

const COLORS = ['#ff6a1a', '#e8112d', '#1f6fff', '#13b57a', '#f5c400', '#9b4dff', '#00b7c7', '#ff3d8b', '#f2f2f2', '#1b1f23', '#8fd400', '#c49a5a'];
const LOGOS: LogoKind[] = ['shield', 'circle', 'chevron', 'wing', 'bolt', 'star', 'hex', 'flag'];

export function TitleScreen({ onStart, onContinue, hasSave }: { onStart: () => void; onContinue?: () => void; hasSave: boolean }) {
  return (
    <div className="title-screen">
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
        <div className="eyebrow">Rennspiel &amp; Rennstall-Tycoon</div>
        <h1 className="display">
          Apex<em>Rennstall</em>
        </h1>
        <p className="muted" style={{ fontSize: 17, maxWidth: 440 }}>
          Baue deinen Rennstall Stück für Stück auf, verdiene Geld mit deinen Anlagen und fahre die Rennen selbst, in 3D.
        </p>
        <div className="row">
          {hasSave && onContinue && (
            <Btn variant="primary big" onClick={onContinue} icon="play">
              Weiterspielen
            </Btn>
          )}
          <Btn variant={hasSave ? 'big' : 'primary big'} onClick={onStart} icon="flag">
            Neues Team gründen
          </Btn>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  const w = name.trim().split(/\s+/)[0] ?? '';
  return (w.replace(/[^A-Za-zÄÖÜäöüß]/g, '').slice(0, 3) || 'NEU').toUpperCase();
}

export function Onboarding({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
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
  }, [name, shortTouched]);

  const start = () => {
    const g = createQuickGame({ name: name.trim() || 'Mein Team', short: (short.trim() || initials(name)).toUpperCase().slice(0, 3), color, color2, logo, region }, loadSettings());
    setGame(g);
    onDone();
  };

  return (
    <div className="onb">
      <div className="onb-inner">
        <div className="grid g2">
          <div className="card stack" style={{ gap: 16 }}>
            <div>
              <div className="eyebrow">Los geht's</div>
              <h2>Gründe dein Team</h2>
              <p className="muted">Name und Farbe reichen. Auto, zwei Fahrer und ein Sponsor sind schon dabei. Alles andere baust du später auf deinem Gelände auf und lernst es dabei Schritt für Schritt kennen.</p>
            </div>
            <div className="field">
              <label htmlFor="tname">Teamname</label>
              <input id="tname" type="text" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">Teamfarbe</span>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Farbe ${c}`} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Weitere Anpassungen (optional)</summary>
              <div className="stack" style={{ gap: 14, marginTop: 12 }}>
                <div className="field">
                  <label htmlFor="tshort">Kürzel (3 Buchstaben)</label>
                  <input id="tshort" type="text" value={short} maxLength={3} onChange={(e) => { setShortTouched(true); setShort(e.target.value.toUpperCase()); }} />
                </div>
                <div className="field">
                  <span className="lbl">Zweite Farbe</span>
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <button key={c} type="button" aria-label={`Zweitfarbe ${c}`} className={`swatch ${color2 === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor2(c)} />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="lbl">Logo</span>
                  <div className="logo-pick">
                    {LOGOS.map((l) => (
                      <button key={l} type="button" className={logo === l ? 'on' : ''} onClick={() => setLogo(l)} aria-label={`Logo ${l}`}>
                        <Logo kind={l} color={color} color2={color2} short={short} size={42} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="region">Startregion (woher Fahrer und Sponsoren kommen)</label>
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
                  <h2 style={{ fontSize: 30 }}>{name || 'Mein Team'}</h2>
                  <span className="pill" style={{ color, borderColor: color }}>{short || 'NEU'}</span>
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
              <p className="muted">Du startest mit <b style={{ color: 'var(--text)' }}>20.000 €</b> und einer kleinen Förderung pro Sekunde. Dein erster Auftrag: Fahre eine Runde auf der Teststrecke.</p>
            </div>
            <div className="row">
              <Btn variant="ghost" onClick={onCancel}>Zurück</Btn>
              <Btn variant="primary big" icon="flag" onClick={start} disabled={!name.trim()}>
                Team gründen und losfahren
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
