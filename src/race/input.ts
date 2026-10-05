// Tastatur- und Touch-Eingaben werden zu einem gemeinsamen Steuerzustand zusammengeführt.
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

const MAP: Record<string, keyof ControlState> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'boost',
  ShiftLeft: 'boost',
};

export function bindKeyboard(ctrl: ControlState, onAction: (action: string) => void) {
  const down = (e: KeyboardEvent) => {
    const k = MAP[e.code];
    if (k) {
      (ctrl as any)[k] = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'KeyB') onAction('pit');
    else if (e.code === 'Escape') onAction('pause');
    else if (e.code === 'KeyC') onAction('camera');
    else if (e.code === 'KeyM') onAction('mute');
    else if (e.code === 'KeyT') onAction('tower');
    else if (e.code === 'KeyL') onAction('line');
    else if (e.code === 'KeyR') onAction('reset');
  };
  const up = (e: KeyboardEvent) => {
    const k = MAP[e.code];
    if (k) {
      (ctrl as any)[k] = false;
      e.preventDefault();
    }
  };
  const blur = () => {
    for (const k of Object.values(MAP)) (ctrl as any)[k] = false;
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
