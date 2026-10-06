// Gemeinsame Bausteine für die Stationen (Werkstatt, Sponsoren-Lounge …): eine verständliche Einleitung
// („Das kannst du hier tun“) und Reiter, damit nie alles auf einmal zu sehen ist.
import { useEffect, useState, type ReactNode } from 'react';
import { useLoadedGame } from '../store';
import { Btn, Icon, Seg } from './common';

export interface IntroItem {
  title: string;
  text: string;
}

/**
 * Einleitung einer Station. Beim ersten Besuch ausgeklappt, danach lässt sie sich ausblenden
 * und bleibt als schmale Zeile mit „Erklärung anzeigen“ erhalten.
 */
export function StationIntro({ id, icon, lead, items, tip }: { id: string; icon: string; lead: string; items: IntroItem[]; tip?: string }) {
  const { game: g, update } = useLoadedGame();
  // Die ersten beiden Besuche ist die Erklärung offen, danach nur noch als schmale Zeile (ausdrücklich Gewähltes gilt immer)
  const [visits] = useState(() => ((g.flags.introVisits as Record<string, number> | undefined) ?? {})[id] ?? 0);
  useEffect(() => {
    update((s) => {
      const m = ((s.flags.introVisits as Record<string, number> | undefined) ?? {}) as Record<string, number>;
      m[id] = (m[id] ?? 0) + 1;
      s.flags.introVisits = m;
    });
  }, [id]);
  const chosen = (g.flags.introHidden as Record<string, boolean> | undefined)?.[id];
  const hidden = chosen ?? visits >= 2;
  const set = (v: boolean) =>
    update((s) => {
      const m = ((s.flags.introHidden as Record<string, boolean> | undefined) ?? {}) as Record<string, boolean>;
      m[id] = v;
      s.flags.introHidden = m;
    });
  if (hidden) {
    return (
      <div className="intro-collapsed">
        <span className="muted"><Icon name={icon} size={16} /> Was kann ich hier tun?</span>
        <Btn variant="sm ghost" onClick={() => set(false)}>Erklärung anzeigen</Btn>
      </div>
    );
  }
  return (
    <section className="station-intro" aria-label="Erklärung">
      <div className="intro-head">
        <span className="intro-ico"><Icon name={icon} size={26} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Das kannst du hier tun</div>
          <p className="intro-lead">{lead}</p>
        </div>
        <Btn variant="sm ghost" onClick={() => set(true)}>Ausblenden</Btn>
      </div>
      <ol className="intro-list">
        {items.map((it, i) => (
          <li key={it.title}>
            <span className="n">{i + 1}</span>
            <div>
              <b>{it.title}</b>
              <span>{it.text}</span>
            </div>
          </li>
        ))}
      </ol>
      {tip && (
        <p className="intro-tip">
          <Icon name="info" size={15} /> {tip}
        </p>
      )}
    </section>
  );
}

/** Reiter innerhalb einer Station, jeweils mit einem Satz dazu, was man dort findet */
export function SubTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { v: T; l: string; hint: string; badge?: number | string }[] }) {
  const cur = tabs.find((t) => t.v === value);
  return (
    <div className="subtabs">
      <Seg value={value} onChange={onChange} options={tabs.map((t) => ({ v: t.v, l: t.badge !== undefined ? `${t.l} (${t.badge})` : t.l }))} />
      {cur && <p className="muted subtab-hint">{cur.hint}</p>}
    </div>
  );
}

/** Kleiner Abschnitt mit Überschrift und einem erklärenden Satz */
export function Block({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>
          {hint && <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
