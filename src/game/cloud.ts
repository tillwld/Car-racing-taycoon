// Dauerhafter Spielstand außerhalb des Browsers. Er gibt es nur, wenn das Spiel als Artifact in claude.ai läuft:
// Dort legt die Artifact-Datenbank den Spielstand in den privaten Bereich des jeweiligen Spielers. Er bleibt über
// Neuveröffentlichungen, Browserwechsel und gelöschte Browserdaten hinweg erhalten. Ohne Artifact tut dieses Modul nichts.
//
// Aufbau: data/users/<id>/profile/save/meta  -> { slot, chunks, savedAt, gz }
//         data/users/<id>/profile/save/a0..aN bzw. b0..bN -> { data }  (zwei abwechselnde Plätze, damit ein
//         abgebrochenes Schreiben nie den letzten vollständigen Stand zerstört)
//
// Der Spielstand wird (wenn möglich) gzip-komprimiert und in Stücke unter 200 000 Zeichen geteilt (Grenze je Dokument: 256 KiB).

const CHUNK = 190_000;

type DocRef = {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
type Conn = { doc: (path: string) => DocRef; base: string };

let conn: Promise<Conn | null> | null = null;

function connect(): Promise<Conn | null> {
  if (conn) return conn;
  conn = (async () => {
    try {
      const c = (window as unknown as { claude?: { use?: (n: string) => Promise<any> } }).claude;
      if (!c || typeof c.use !== 'function') return null;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid || typeof uid !== 'string') return null;
      return { doc: (p: string) => db.doc(p) as DocRef, base: `data/users/${uid}/profile/save` };
    } catch {
      return null;
    }
  })();
  return conn;
}

async function gzip(text: string): Promise<string | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

async function gunzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

export interface CloudSave {
  json: string;
  savedAt: number;
}

export const cloud = {
  /** Gibt es hier einen dauerhaften Speicher? (dauert höchstens wenige Sekunden) */
  async available(): Promise<boolean> {
    return !!(await connect());
  },

  async save(json: string, savedAt: number): Promise<boolean> {
    const c = await connect();
    if (!c) return false;
    try {
      const gz = await gzip(json);
      const payload = gz ?? json;
      const parts: string[] = [];
      for (let i = 0; i < payload.length; i += CHUNK) parts.push(payload.slice(i, i + CHUNK));
      if (!parts.length) parts.push('');
      const meta = await c.doc(`${c.base}/meta`).get();
      const prev = (meta.exists ? meta.data() : undefined) as { slot?: string; chunks?: number } | undefined;
      const slot = prev?.slot === 'a' ? 'b' : 'a';
      for (let i = 0; i < parts.length; i++) await c.doc(`${c.base}/${slot}${i}`).set({ data: parts[i] });
      await c.doc(`${c.base}/meta`).set({ slot, chunks: parts.length, savedAt, gz: gz !== null, bytes: json.length });
      // Reste des vorigen Platzes aufräumen (nach dem Umschalten, also gefahrlos)
      if (prev?.slot && prev.slot !== slot && typeof prev.chunks === 'number') {
        for (let i = 0; i < prev.chunks; i++) await c.doc(`${c.base}/${prev.slot}${i}`).delete().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  },

  async load(): Promise<CloudSave | null> {
    const c = await connect();
    if (!c) return null;
    try {
      const meta = await c.doc(`${c.base}/meta`).get();
      if (!meta.exists) return null;
      const m = meta.data() as { slot: string; chunks: number; savedAt: number; gz: boolean };
      let payload = '';
      for (let i = 0; i < m.chunks; i++) {
        const d = await c.doc(`${c.base}/${m.slot}${i}`).get();
        if (!d.exists) return null;
        payload += String((d.data() as { data?: string }).data ?? '');
      }
      const json = m.gz ? await gunzip(payload) : payload;
      return { json, savedAt: Number(m.savedAt) || 0 };
    } catch {
      return null;
    }
  },

  /** Beim bewussten Neustart („Neues Team“): den alten Spielstand dort entfernen, damit er nicht wiederkommt */
  async clear(): Promise<void> {
    const c = await connect();
    if (!c) return;
    try {
      const meta = await c.doc(`${c.base}/meta`).get();
      if (!meta.exists) return;
      const m = meta.data() as { slot: string; chunks: number };
      await c.doc(`${c.base}/meta`).delete();
      for (let i = 0; i < m.chunks; i++) await c.doc(`${c.base}/${m.slot}${i}`).delete().catch(() => {});
    } catch {
      /* nicht kritisch */
    }
  },
};
