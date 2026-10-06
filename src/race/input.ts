// Tastatur- und Touch-Eingaben werden zu einem gemeinsamen Steuerzustand zusammengeführt.
import { reverseKeys, type KeyAction } from './keys';

export interface ControlState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  tUp: boolean;
  tDown: boolean;
  tLeft: boolean;
  tRight: boolean;
  tBoost: boolean;
}

export const newControls = (): ControlState => ({
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  tUp: false,
  tDown: false,
  tLeft: false,
  tRight: false,
  tBoost: false,
});

const HOLD: Partial<Record<KeyAction, keyof ControlState>> = { up: 'up', down: 'down', left: 'left', right: 'right', boost: 'boost' };
const ONCE: Partial<Record<KeyAction, string>> = {
  pit: 'pit',
  camera: 'camera',
  mute: 'mute',
  tower: 'tower',
  line: 'line',
  reset: 'reset',
  pitFuel: 'pit:fuel',
  pitRepair: 'pit:repair',
};

/** Tastatur anbinden. getCustom liefert die eigenen Tasten aus den Einstellungen und wird bei jedem Tastendruck gelesen. */
export function bindKeyboard(ctrl: ControlState, onAction: (action: string) => void, getCustom: () => Partial<Record<string, string[]>> | undefined) {
  const down = (e: KeyboardEvent) => {
    const acts = reverseKeys(getCustom()).rev.get(e.code) ?? [];
    let handled = false;
    for (const a of acts) {
      const hold = HOLD[a];
      if (hold) {
        (ctrl as any)[hold] = true;
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Escape') {
      onAction('pause');
      return;
    }
    const digit = /^Digit([1-5])$/.exec(e.code);
    if (digit) {
      onAction(`pit:${digit[1]}`);
      return;
    }
    for (const a of acts) {
      const once = ONCE[a];
      if (once) {
        onAction(once);
        return;
      }
    }
  };
  const up = (e: KeyboardEvent) => {
    const acts = reverseKeys(getCustom()).rev.get(e.code) ?? [];
    for (const a of acts) {
      const hold = HOLD[a];
      if (hold) {
        (ctrl as any)[hold] = false;
        e.preventDefault();
      }
    }
  };
  const blur = () => {
    for (const k of ['up', 'down', 'left', 'right', 'boost'] as const) ctrl[k] = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

export function readInput(c: ControlState) {
  const steer = (c.right || c.tRight ? 1 : 0) - (c.left || c.tLeft ? 1 : 0);
  return {
    throttle: c.up || c.tUp ? 1 : 0,
    brake: c.down || c.tDown ? 1 : 0,
    steer,
    boost: c.boost || c.tBoost,
  };
}

export function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  } catch {
    return false;
  }
}
