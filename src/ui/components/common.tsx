import { useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Compound, LogoKind, WeatherKind } from '../../types';
import { COMPOUNDS, WEATHER_LABELS } from '../../data/catalog';
import { TRACK_BY_ID } from '../../data/tracks';
import { trackGeometry } from '../../game/weekend';
import { money } from '../../game/util';
import { sound } from '../../audio/sound';

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  race: 'M5 21V4M5 4h11l-2 4 2 4H5',
  garage: 'M3 10 12 4l9 6v10H3zM7 20v-6h10v6M7 17h10',
  research: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10',
  drivers: 'M12 3a7 7 0 0 0-7 7v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4a7 7 0 0 0-7-7zM5 11h14M8 21h8',
  staff: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
  sponsors: 'M3 12l4-4 5 3 5-3 4 4-9 8zM12 11v9',
  championship: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  finance: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  stats: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M7 4v16l13-8z',
  sim: 'M13 2 3 14h9l-1 8 10-12h-9z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  mute: 'M4 9v6h4l5 4V5L8 9zM22 9l-6 6M16 9l6 6',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
  check: 'M4 12l5 5L20 6',
  close: 'M6 6l12 12M18 6 6 18',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  pit: 'M4 4h16v6H4zM6 10v10M18 10v10M9 14h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  medal: 'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 14 7 22l5-3 5 3-1.5-8',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  chat: 'M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  flag: 'M4 22V4M4 4h14l-2 4 2 4H4',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
};

export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.info} />
    </svg>
  );
}

export function Btn(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; icon?: string }) {
  const { variant = '', icon, className = '', onClick, children, ...rest } = props;
  return (
    <button
      type="button"
      className={`btn ${variant} ${className}`}
      onClick={(e) => {
        sound.click();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Money({ v, compact, sign }: { v: number; compact?: boolean; sign?: boolean }) {
  const cls = sign ? (v >= 0 ? 'good' : 'bad') : '';
  return <span className={`num ${cls}`}>{sign && v > 0 ? '+' : ''}{money(v, compact)}</span>;
}

export function Bar({ value, max = 100, tone, ghost }: { value: number; max?: number; tone?: string; ghost?: number }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  const g = ghost !== undefined ? Math.max(0, Math.min(100, (ghost / max) * 100)) : 0;
  return (
    <div className={`bar ${tone ?? ''}`}>
      {ghost !== undefined && g > w && <i className="ghost" style={{ width: `${g}%` }} />}
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

export function StatLine({ label, value, max = 100, ghost, fmt }: { label: string; value: number; max?: number; ghost?: number; fmt?: (v: number) => string }) {
  return (
    <div className="statline">
      <span className="muted">{label}</span>
      <Bar value={value} max={max} ghost={ghost} />
      <span className="v">{fmt ? fmt(value) : Math.round(value)}</span>
    </div>
  );
}

export function TyreBadge({ c, sm }: { c: Compound; sm?: boolean }) {
  const t = COMPOUNDS[c];
  return (
    <span className={`tyre ${sm ? 'sm' : ''}`} style={{ color: t.color }} title={t.label}>
      {t.short}
    </span>
  );
}

export function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const sun = (
    <g stroke="#f6c343" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" fill="#f6c343" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={12 + Math.cos((a * Math.PI) / 180) * 7.5} y1={12 + Math.sin((a * Math.PI) / 180) * 7.5} x2={12 + Math.cos((a * Math.PI) / 180) * 10} y2={12 + Math.sin((a * Math.PI) / 180) * 10} />
      ))}
    </g>
  );
  const cloud = <path d="M7 17h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.4A3.4 3.4 0 0 0 7 17z" fill="#9aa9b2" />;
  return (
    <svg viewBox="0 0 24 24" aria-label={WEATHER_LABELS[kind]} role="img">
      {kind === 'sunny' && sun}
      {kind !== 'sunny' && cloud}
      {(kind === 'lightRain' || kind === 'heavyRain') && (
        <g stroke="#5fb8ff" strokeWidth="1.8" strokeLinecap="round">
          <line x1="9" y1="19" x2="8" y2="22" />
          <line x1="14" y1="19" x2="13" y2="22" />
          {kind === 'heavyRain' && <line x1="11.5" y1="19" x2="10.5" y2="22.5" />}
          {kind === 'heavyRain' && <line x1="16.5" y1="19" x2="15.5" y2="22" />}
        </g>
      )}
    </svg>
  );
}

export function FlagStrip({ colors }: { colors: [string, string] }) {
  return (
    <span className="flag-strip" aria-hidden="true">
      <i style={{ background: colors[0] }} />
      <i style={{ background: colors[1] }} />
    </span>
  );
}

export function TrackShape({ trackId, className, showStart = true }: { trackId: string; className?: string; showStart?: boolean }) {
  const d = useMemo(() => {
    const g = trackGeometry(TRACK_BY_ID[trackId]);
    const pad = 30;
    const w = g.maxX - g.minX + pad * 2;
    const h = g.maxY - g.minY + pad * 2;
    let p = '';
    for (let i = 0; i < g.n; i += 6) p += `${i === 0 ? 'M' : 'L'}${(g.x[i] - g.minX + pad).toFixed(0)},${(g.y[i] - g.minY + pad).toFixed(0)}`;
    p += 'Z';
    return { p, w, h, sx: g.x[0] - g.minX + pad, sy: g.y[0] - g.minY + pad };
  }, [trackId]);
  return (
    <svg className={`track-svg ${className ?? ''}`} viewBox={`0 0 ${d.w} ${d.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="base" d={d.p} />
      <path className="line" d={d.p} />
      {showStart && <circle className="start" cx={d.sx} cy={d.sy} r={16} />}
    </svg>
  );
}

export function Logo({ kind, color, color2, short, size = 44 }: { kind: LogoKind; color: string; color2: string; short?: string; size?: number }) {
  const shape = (() => {
    switch (kind) {
      case 'shield':
        return <path d="M24 3 42 9v14c0 11-8 18-18 22C14 41 6 34 6 23V9z" fill={color} stroke={color2} strokeWidth="2.5" />;
      case 'circle':
        return (
          <>
            <circle cx="24" cy="24" r="20" fill={color} />
            <circle cx="24" cy="24" r="15" fill="none" stroke={color2} strokeWidth="2.5" />
          </>
        );
      case 'chevron':
        return (
          <>
            <rect x="4" y="4" width="40" height="40" rx="8" fill={color} />
            <path d="M10 30 24 16l14 14" fill="none" stroke={color2} strokeWidth="5" strokeLinejoin="round" />
          </>
        );
      case 'wing':
        return (
          <>
            <path d="M3 30c10-14 26-20 42-20-6 4-9 9-10 14 4 0 7 1 9 2-10 4-26 8-41 4z" fill={color} />
            <path d="M8 31c10-2 20-6 30-12" stroke={color2} strokeWidth="2.5" fill="none" />
          </>
        );
      case 'bolt':
        return (
          <>
            <circle cx="24" cy="24" r="21" fill={color2} />
            <path d="M27 5 12 27h11l-3 16 16-23H25z" fill={color} />
          </>
        );
      case 'star':
        return (
          <>
            <rect x="4" y="4" width="40" height="40" rx="20" fill={color} />
            <path d="m24 10 4 9 10 1-7.5 6.5L33 37l-9-5.5-9 5.5 2.5-10.5L10 20l10-1z" fill={color2} />
          </>
        );
      case 'hex':
        return (
          <>
            <path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill={color} />
            <path d="M24 11 35 17.5v13L24 37l-11-6.5v-13z" fill="none" stroke={color2} strokeWidth="2.5" />
          </>
        );
      case 'flag':
        return (
          <>
            <rect x="4" y="8" width="40" height="32" rx="4" fill={color} />
            <path d="M4 8h10v8H4zM24 8h10v8H24zM14 16h10v8H14zM34 16h10v8H34zM4 24h10v8H4zM24 24h10v8H24zM14 32h10v8H14zM34 32h10v8H34z" fill={color2} opacity="0.9" />
          </>
        );
    }
  })();
  const showText = short && !['flag', 'bolt', 'star'].includes(kind);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Teamlogo" style={{ flex: 'none' }}>
      {shape}
      {showText && (
        <text x="24" y={kind === 'chevron' ? 40 : kind === 'wing' ? 44 : 29} textAnchor="middle" fontFamily="Saira Condensed, Arial Narrow, sans-serif" fontWeight="800" fontSize={kind === 'chevron' || kind === 'wing' ? 9 : 12} fill={kind === 'wing' || kind === 'chevron' ? color2 : color2} letterSpacing="0.5">
          {short.slice(0, 3)}
        </text>
      )}
    </svg>
  );
}

export function Helmet({ color, color2, label }: { color: string; color2: string; label?: string }) {
  return (
    <div className="helmet" style={{ background: `linear-gradient(160deg, ${color} 55%, ${color2} 56%)`, color: color2 }}>
      {label && <span>{label}</span>}
    </div>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, id }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; id?: string }) {
  return (
    <div className="seg" role="radiogroup" id={id}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={value === o.v ? 'on' : ''}
          onClick={() => {
            sound.click();
            onChange(o.v);
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; id: string }) {
  return (
    <div className="toggle">
      <label htmlFor={id}>{label}</label>
      <button id={id} type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => {
        sound.click();
        onChange(!on);
      }} />
    </div>
  );
}

export function CountryTag({ code }: { code: string }) {
  return <span className="pill" style={{ padding: '0 6px', fontSize: 11 }}>{code}</span>;
}
