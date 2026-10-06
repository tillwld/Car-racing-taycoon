import { useRef, useState } from 'react';
import { useLoadedGame } from '../store';
import { Btn, Modal, Seg, Switch } from '../components/common';
import { clearGame, downloadSave, exportSave, importSave, parseSave } from '../../game/save';
import type { Settings } from '../../types';
import { KeyBindings } from './KeyBindings';

export default function SettingsScreen({ onQuit }: { onQuit: () => void }) {
  const { game: g, update, setGame, toast, saveInfo, syncNow, restoreFromCloud } = useLoadedGame();
  const s = g.settings;
  const set = (p: Partial<Settings>) => update((st) => void Object.assign(st.settings, p));
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 6 }}>
          <h3>Fahren</h3>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">Kamera im Rennen</span>
            <Seg value={s.camera} onChange={(v) => set({ camera: v })} options={[{ v: 'chase', l: 'Verfolger' }, { v: 'high', l: 'Weit' }, { v: 'cockpit', l: 'Cockpit' }]} />
            <span className="muted" style={{ fontSize: 12.5 }}>Verfolger zeigt das Auto aus tiefem Winkel von hinten. Weit schaut etwas höher und weiter voraus. Die Kamerataste stellst du unter „Tastenbelegung“ ein.</span>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">Touch-Steuerung</span>
            <Seg value={s.touchControls} onChange={(v) => set({ touchControls: v })} options={[{ v: 'auto', l: 'Automatisch' }, { v: 'on', l: 'Immer' }, { v: 'off', l: 'Nie' }]} />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">Renndistanz</span>
            <Seg value={s.raceLength} onChange={(v) => set({ raceLength: v })} options={[{ v: 'short', l: 'Kurz' }, { v: 'medium', l: 'Mittel' }, { v: 'long', l: 'Lang' }]} />
            <span className="muted" style={{ fontSize: 12.5 }}>Gilt ab dem nächsten Rennwochenende.</span>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">Stärke der Gegner</span>
            <Seg value={s.difficulty} onChange={(v) => set({ difficulty: v })} options={[{ v: 'easy', l: 'Leicht' }, { v: 'normal', l: 'Normal' }, { v: 'hard', l: 'Schwer' }]} />
          </div>
          <div className="sep" />
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Tastenbelegung</summary>
            <KeyBindings custom={s.keys} onChange={(keys) => update((st) => { if (keys) st.settings.keys = keys; else delete st.settings.keys; })} toast={toast} />
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Fahrhilfen und Feintuning</summary>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              <p className="muted" style={{ fontSize: 12.5 }}>Standardmäßig bekommst du keine Hinweise: Du bremst nach den Schildern an der Strecke und nach Gefühl. Wenn du magst, kannst du dir hier helfen lassen.</p>
              <Switch id="corners" on={s.cornerHints} onChange={(v) => set({ cornerHints: v })} label="Kurvenvorschau mit Bremshinweis einblenden" />
              <Switch id="line" on={s.showLine} onChange={(v) => set({ showLine: v })} label="Ideallinie mit Bremszonen auf der Strecke zeigen" />
              <Switch id="steerassist" on={s.steerAssist} onChange={(v) => set({ steerAssist: v })} label="Lenkhilfe (stabilisiert das Heck, das Auto bricht seltener aus)" />
              <Switch id="brakeassist" on={s.brakeAssist} onChange={(v) => set({ brakeAssist: v })} label="Bremsassistent (bremst vor Kurven automatisch)" />
              <div className="field" style={{ marginTop: 4 }}>
                <div className="row between">
                  <label htmlFor="sens">Lenkempfindlichkeit</label>
                  <span className="num">{s.steerSensitivity.toFixed(1)}</span>
                </div>
                <input id="sens" type="range" min={0.5} max={1.8} step={0.1} value={s.steerSensitivity} onChange={(e) => set({ steerSensitivity: +e.target.value })} />
              </div>
            </div>
          </details>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="card stack" style={{ gap: 6 }}>
            <h3>Ton &amp; Grafik</h3>
            <Switch id="mute" on={!s.muted} onChange={(v) => set({ muted: !v })} label="Ton" />
            <div className="field">
              <div className="row between">
                <label htmlFor="vol">Lautstärke</label>
                <span className="num">{Math.round(s.volume * 100)} %</span>
              </div>
              <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: +e.target.value })} />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span className="lbl">Grafikqualität</span>
              <Seg value={s.quality} onChange={(v) => set({ quality: v })} options={[{ v: 'high', l: 'Hoch' }, { v: 'low', l: 'Sparsam (ältere Geräte)' }]} />
            </div>
          </div>

          <div className="card stack" style={{ gap: 10 }}>
            <h3>Spielstand</h3>
            <div className="stack" style={{ gap: 4, fontSize: 13.5 }}>
              <div className="row between">
                <span>In diesem Browser</span>
                <b className={saveInfo.local ? 'good' : 'bad'}>{saveInfo.local ? 'automatisch gespeichert' : 'nicht möglich'}</b>
              </div>
              <div className="row between">
                <span>Dauerhafter Artifact-Speicher</span>
                <b className={saveInfo.cloud === 'ok' ? 'good' : saveInfo.cloud === 'error' ? 'bad' : 'muted'}>
                  {saveInfo.cloud === 'off' ? 'hier nicht verfügbar' : saveInfo.cloud === 'wait' ? 'prüft …' : saveInfo.cloud === 'error' ? 'Fehler beim Speichern' : saveInfo.cloudAt ? `gesichert ${new Date(saveInfo.cloudAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : 'bereit'}
                </b>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              Der Spielstand wird laufend im Browser gespeichert. Läuft das Spiel als Artifact in claude.ai, liegt zusätzlich eine Kopie im dauerhaften Speicher: Sie übersteht neue Versionen, gelöschte Browserdaten und Gerätewechsel. Als Datei sicherst du ihn zusätzlich selbst.
            </p>
            {saveInfo.cloudNewer && (
              <div className="tip">
                <span>Im dauerhaften Speicher liegt ein neuerer Spielstand als hier.</span>
                <Btn variant="sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await restoreFromCloud(); setBusy(false); toast(ok ? 'Neuerer Spielstand geladen' : 'Laden fehlgeschlagen', ok ? 'good' : 'bad'); }}>Neueren Stand laden</Btn>
              </div>
            )}
            <div className="row">
              <Btn
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await downloadSave(g);
                  setBusy(false);
                  if (r === 'saved') toast('Spielstand als Datei gesichert', 'good');
                  else if (r === 'error') toast('Die Datei konnte nicht gespeichert werden. Nutze den Text-Export unten.', 'bad');
                }}
              >
                Als Datei sichern
              </Btn>
              <Btn onClick={() => fileRef.current?.click()}>Aus Datei laden</Btn>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json,text/plain"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const st = importSave(await f.text());
                  if (!st) toast('Die Datei ist kein gültiger Spielstand.', 'bad');
                  else {
                    setGame(st);
                    toast(`Spielstand von ${st.team.name} geladen`, 'good');
                  }
                }}
              />
              {saveInfo.cloud !== 'off' && (
                <Btn
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await syncNow();
                    setBusy(false);
                    toast(ok ? 'Im dauerhaften Speicher gesichert' : 'Sichern fehlgeschlagen', ok ? 'good' : 'bad');
                  }}
                >
                  Jetzt dauerhaft sichern
                </Btn>
              )}
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Spielstand als Text kopieren oder einfügen</summary>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                <div className="row">
                  <Btn onClick={() => setExported(exportSave(g))}>Spielstand exportieren</Btn>
                </div>
                {exported && (
                  <>
                    <textarea id="export" readOnly value={exported} onFocus={(e) => e.currentTarget.select()} aria-label="Exportierter Spielstand" />
                    <Btn
                      variant="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(exported).then(
                          () => toast('In die Zwischenablage kopiert', 'good'),
                          () => {
                            (document.getElementById('export') as HTMLTextAreaElement | null)?.select();
                            toast('Text markiert – bitte manuell kopieren');
                          },
                        );
                      }}
                    >
                      Kopieren
                    </Btn>
                  </>
                )}
              </div>
            </details>
            <div className="row">
              <Btn variant="ghost" onClick={() => update((st) => { st.tipsSeen = {}; st.flags.tipQueue = []; })}>Alle Erklärungen wieder anzeigen</Btn>
            </div>
            <div className="field">
              <label htmlFor="import">Spielstand importieren</label>
              <textarea id="import" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Exportierten Text hier einfügen" />
            </div>
            <Btn
              disabled={!importText.trim()}
              onClick={() => {
                const st = importSave(importText) ?? parseSave(importText);
                if (!st) toast('Der Text ist kein gültiger Spielstand.', 'bad');
                else {
                  setGame(st);
                  setImportText('');
                  toast('Spielstand geladen', 'good');
                }
              }}
            >
              Importieren
            </Btn>
            <div className="sep" />
            <Btn variant="danger" onClick={() => setConfirmReset(true)}>Neues Spiel beginnen</Btn>
          </div>
        </div>
      </section>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h2>Wirklich neu anfangen?</h2>
          <p className="muted">{g.team.name} und alle Fortschritte werden gelöscht. Exportiere den Spielstand vorher, wenn du ihn behalten willst.</p>
          <div className="row">
            <Btn variant="danger" onClick={() => { clearGame(); setGame(null); setConfirmReset(false); onQuit(); }}>Alles löschen</Btn>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Abbrechen</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
