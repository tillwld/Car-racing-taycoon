// Tastenbelegung ändern: Pro Aktion zwei Tasten, ein Klick auf das Feld, dann die neue Taste drücken.
import { useEffect, useState } from 'react';
import { DEFAULT_KEYS, KEY_ACTIONS, KEY_GROUPS, keyGroupLabel, keyLabel, reservedKey, resolveKeys, type KeyAction } from '../../race/keys';
import { Btn } from '../components/common';
import { t, useLang } from '../../i18n';

/** Wo eine Aktion benutzt wird: Tasten dürfen nur innerhalb eines Bereichs nicht doppelt vergeben sein */
const MOVE: KeyAction[] = ['up', 'down', 'left', 'right'];
function sameContext(a: KeyAction, b: KeyAction) {
  if (a === 'interact') return MOVE.includes(b) || b === 'interact';
  if (b === 'interact') return MOVE.includes(a);
  return true;
}

export function KeyBindings({ custom, onChange, toast }: { custom: Partial<Record<string, string[]>> | undefined; onChange: (next: Partial<Record<string, string[]>> | undefined) => void; toast: (text: string, tone?: 'info' | 'good' | 'bad') => void }) {
  useLang();
  const keys = resolveKeys(custom);
  const [listening, setListening] = useState<{ a: KeyAction; slot: number } | null>(null);

  const commit = (next: typeof keys) => {
    // nur Abweichungen vom Standard speichern
    const diff: Partial<Record<string, string[]>> = {};
    for (const a of Object.keys(next) as KeyAction[]) if (next[a].join('|') !== DEFAULT_KEYS[a].join('|')) diff[a] = next[a];
    onChange(Object.keys(diff).length ? diff : undefined);
  };

  useEffect(() => {
    if (!listening) return;
    const { a, slot } = listening;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code) && !['ShiftLeft'].includes(e.code)) return;
      if (e.code === 'Escape') {
        setListening(null);
        return;
      }
      const next = resolveKeys(custom);
      if (e.code === 'Backspace' || e.code === 'Delete') {
        if (next[a].length <= 1) toast(t('keybind.needOne'), 'bad');
        else {
          next[a] = next[a].filter((_, i) => i !== slot);
          commit(next);
        }
        setListening(null);
        return;
      }
      const reserved = reservedKey(e.code);
      if (reserved) {
        toast(t('keybind.reserved', { reason: reserved }), 'bad');
        setListening(null);
        return;
      }
      // Taste war schon in diesem Bereich belegt: dort entfernen, aber nie die letzte Taste einer Aktion nehmen
      for (const other of Object.keys(next) as KeyAction[]) {
        if (other === a || !sameContext(a, other) || !next[other].includes(e.code)) continue;
        if (next[other].length <= 1) {
          toast(t('keybind.needsKey', { action: KEY_ACTIONS.find((x) => x.id === other)?.label }), 'bad');
          setListening(null);
          return;
        }
        next[other] = next[other].filter((c) => c !== e.code);
        toast(t('keybind.removed', { key: keyLabel(e.code), action: KEY_ACTIONS.find((x) => x.id === other)?.label }), 'info');
      }
      const list = [...next[a]].filter((c) => c !== e.code);
      list.splice(Math.min(slot, list.length), 0, e.code);
      next[a] = list.slice(0, 3);
      commit(next);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, custom]);

  return (
    <div className="stack" style={{ gap: 10, marginTop: 10 }}>
      <p className="muted" style={{ fontSize: 12.5 }}>{t('keybind.hint')}</p>
      {KEY_GROUPS.map((grp) => (
        <div key={grp} className="stack" style={{ gap: 4 }}>
          <span className="lbl">{keyGroupLabel(grp)}</span>
          {KEY_ACTIONS.filter((x) => x.group === grp).map((act) => (
            <div key={act.id} className="row between" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <span style={{ fontSize: 13.5 }}>{act.label}</span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {[0, 1].map((slot) => {
                  const code = keys[act.id][slot];
                  const on = listening?.a === act.id && listening.slot === slot;
                  if (code === undefined && slot > keys[act.id].length) return null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`key-slot ${on ? 'on' : ''}`}
                      onClick={() => setListening(on ? null : { a: act.id, slot })}
                      aria-label={t('keybind.slotAria', { action: act.label, slot: slot + 1 })}
                    >
                      {on ? t('keybind.pressKey') : code ? keyLabel(code) : '+'}
                    </button>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      ))}
      <div className="row">
        <Btn variant="ghost sm" onClick={() => { setListening(null); onChange(undefined); toast(t('keybind.restored'), 'good'); }}>{t('keybind.restore')}</Btn>
      </div>
    </div>
  );
}
