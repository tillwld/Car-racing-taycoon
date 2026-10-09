// Tastenbelegung: Standardtasten, Anzeigenamen und das Zusammenführen mit eigenen Einstellungen.
import { t } from '../i18n';

export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'boost' | 'pit' | 'pitFuel' | 'pitRepair' | 'camera' | 'line' | 'tower' | 'reset' | 'mute' | 'interact';
export type KeyMap = Record<KeyAction, string[]>;

/** Bereiche der Tastenbelegung (Ids; die Anzeigenamen stehen im Wörterbuch unter keys.group.*) */
export type KeyGroup = 'drive' | 'pit' | 'view' | 'grounds';
export const KEY_GROUPS: readonly KeyGroup[] = ['drive', 'pit', 'view', 'grounds'];

/** Anzeigename eines Bereichs in der aktuellen Sprache */
export function keyGroupLabel(g: KeyGroup): string {
  return t(`keys.group.${g}`);
}

const ACTION_DEFS: [KeyAction, KeyGroup][] = [
  ['up', 'drive'],
  ['down', 'drive'],
  ['left', 'drive'],
  ['right', 'drive'],
  ['boost', 'drive'],
  ['reset', 'drive'],
  ['pit', 'pit'],
  ['pitFuel', 'pit'],
  ['pitRepair', 'pit'],
  ['camera', 'view'],
  ['line', 'view'],
  ['tower', 'view'],
  ['mute', 'view'],
  ['interact', 'grounds'],
];

/** Alle belegbaren Aktionen; `label` wird bei jedem Zugriff in der aktuellen Sprache geliefert (Wörterbuch keys.action.*) */
export const KEY_ACTIONS: { id: KeyAction; label: string; group: KeyGroup }[] = ACTION_DEFS.map(([id, group]) => ({
  id,
  group,
  get label() {
    return t(`keys.action.${id}`);
  },
}));

export const DEFAULT_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  boost: ['Space', 'ShiftLeft'],
  pit: ['KeyP', 'KeyB'],
  pitFuel: ['KeyF'],
  pitRepair: ['KeyE'],
  camera: ['KeyC'],
  line: ['KeyL'],
  tower: ['KeyT'],
  reset: ['KeyR'],
  mute: ['KeyM'],
  interact: ['KeyE', 'Enter'],
};

let cached: { src: unknown; map: KeyMap; rev: Map<string, KeyAction[]> } | null = null;

/** Eigene Einstellungen über die Standardtasten legen; unbekannte oder leere Einträge fallen auf den Standard zurück */
export function resolveKeys(custom?: Partial<Record<string, string[]>> | null): KeyMap {
  const out = {} as KeyMap;
  for (const a of Object.keys(DEFAULT_KEYS) as KeyAction[]) {
    const c = custom?.[a];
    out[a] = Array.isArray(c) && c.length ? c.filter((x) => typeof x === 'string').slice(0, 3) : [...DEFAULT_KEYS[a]];
  }
  return out;
}

/** Zuordnung Taste → Aktionen (eine Taste kann in verschiedenen Bereichen mehrfach vorkommen, z. B. E im Boxenmenü und im Gelände) */
export function reverseKeys(custom?: Partial<Record<string, string[]>> | null): { map: KeyMap; rev: Map<string, KeyAction[]> } {
  if (cached && cached.src === custom) return cached;
  const map = resolveKeys(custom);
  const rev = new Map<string, KeyAction[]>();
  for (const a of Object.keys(map) as KeyAction[]) for (const code of map[a]) rev.set(code, [...(rev.get(code) ?? []), a]);
  cached = { src: custom, map, rev };
  return cached;
}

/** Tastennamen, die in jeder Sprache gleich sind (Symbole) */
const NAMES: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Tab: 'Tab',
  Escape: 'Esc',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: '’',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '^',
};

/** Tastennamen, die je nach Sprache anders heißen (Wörterbuch keys.name.*) */
const NAME_KEYS: Record<string, string> = {
  Space: 'keys.name.space',
  ShiftLeft: 'keys.name.shiftLeft',
  ShiftRight: 'keys.name.shiftRight',
  ControlLeft: 'keys.name.ctrlLeft',
  ControlRight: 'keys.name.ctrlRight',
  AltLeft: 'keys.name.altLeft',
  AltRight: 'keys.name.altRight',
  Enter: 'keys.name.enter',
  Backspace: 'keys.name.backspace',
};

/** Anzeigename einer Taste in der aktuellen Sprache (nur beim Rendern oder in Funktionen aufrufen) */
export function keyLabel(code: string): string {
  if (NAME_KEYS[code]) return t(NAME_KEYS[code]);
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return t('keys.name.numpad', { key: code.slice(6) });
  return code;
}

/** z. B. „W / ↑“ */
export function labelsFor(map: KeyMap, a: KeyAction): string {
  return map[a].map(keyLabel).join(' / ');
}

/** Tasten, die nie belegt werden dürfen: Esc pausiert, 1–5 wählen im Boxenmenü die Reifen. Liefert den Grund als Text in der aktuellen Sprache. */
export function reservedKey(code: string): string | null {
  if (code === 'Escape') return t('keys.reserved.escape');
  if (/^Digit[1-5]$/.test(code)) return t('keys.reserved.digits');
  return null;
}
