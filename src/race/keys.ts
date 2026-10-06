// Tastenbelegung: Standardtasten, Anzeigenamen und das Zusammenführen mit eigenen Einstellungen.
export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'boost' | 'pit' | 'pitFuel' | 'pitRepair' | 'camera' | 'line' | 'tower' | 'reset' | 'mute' | 'interact';
export type KeyMap = Record<KeyAction, string[]>;

export const KEY_ACTIONS: { id: KeyAction; label: string; group: 'Fahren' | 'Boxenstopp' | 'Ansicht' | 'Gelände' }[] = [
  { id: 'up', label: 'Gas (im Gelände: nach oben)', group: 'Fahren' },
  { id: 'down', label: 'Bremse, rückwärts (nach unten)', group: 'Fahren' },
  { id: 'left', label: 'Links lenken', group: 'Fahren' },
  { id: 'right', label: 'Rechts lenken', group: 'Fahren' },
  { id: 'boost', label: 'Boost', group: 'Fahren' },
  { id: 'reset', label: 'Auf die Strecke zurücksetzen', group: 'Fahren' },
  { id: 'pit', label: 'Boxenstopp anfordern oder absagen', group: 'Boxenstopp' },
  { id: 'pitFuel', label: 'Im Boxenmenü: Nachtanken', group: 'Boxenstopp' },
  { id: 'pitRepair', label: 'Im Boxenmenü: Reparatur', group: 'Boxenstopp' },
  { id: 'camera', label: 'Kamera wechseln', group: 'Ansicht' },
  { id: 'line', label: 'Ideallinie ein/aus', group: 'Ansicht' },
  { id: 'tower', label: 'Zeitenliste ein/aus', group: 'Ansicht' },
  { id: 'mute', label: 'Ton ein/aus', group: 'Ansicht' },
  { id: 'interact', label: 'Gebäude betreten', group: 'Gelände' },
];

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

const NAMES: Record<string, string> = {
  Space: 'Leertaste',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Shift links',
  ShiftRight: 'Shift rechts',
  ControlLeft: 'Strg links',
  ControlRight: 'Strg rechts',
  AltLeft: 'Alt links',
  AltRight: 'Alt rechts',
  Enter: 'Eingabe',
  Tab: 'Tab',
  Backspace: 'Rück',
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

export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** z. B. „W / ↑“ */
export function labelsFor(map: KeyMap, a: KeyAction): string {
  return map[a].map(keyLabel).join(' / ');
}

/** Tasten, die nie belegt werden dürfen: Esc pausiert, 1–5 wählen im Boxenmenü die Reifen */
export function reservedKey(code: string): string | null {
  if (code === 'Escape') return 'Esc pausiert immer';
  if (/^Digit[1-5]$/.test(code)) return '1 bis 5 wählen im Boxenmenü die Reifen';
  return null;
}
