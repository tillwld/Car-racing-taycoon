import { useRef, useState } from 'react';
import { useLoadedGame } from '../store';
import { Btn, Modal, Seg, Switch } from '../components/common';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { LOCALES, fmtNum, fmtPct, getLang, t, useLang } from '../../i18n';
import { clearGame, downloadSave, exportSave, importSave, parseSave } from '../../game/save';
import type { Settings } from '../../types';
import { KeyBindings } from './KeyBindings';

export default function SettingsScreen({ onQuit }: { onQuit: () => void }) {
  const { game: g, update, setGame, toast, saveInfo, syncNow, restoreFromCloud } = useLoadedGame();
  useLang();
  const s = g.settings;
  const set = (p: Partial<Settings>) => update((st) => void Object.assign(st.settings, p));
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <section className="card row between">
        <h3>{t('settings.language.title')}</h3>
        <LanguageSwitch id="lang" />
      </section>

      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 6 }}>
          <h3>{t('settings.drive.title')}</h3>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">{t('settings.camera.label')}</span>
            <Seg value={s.camera} onChange={(v) => set({ camera: v })} options={[{ v: 'chase', l: t('settings.camera.chase') }, { v: 'high', l: t('settings.camera.high') }, { v: 'cockpit', l: t('settings.camera.cockpit') }]} />
            <span className="muted" style={{ fontSize: 12.5 }}>{t('settings.camera.hint')}</span>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">{t('settings.touch.label')}</span>
            <Seg value={s.touchControls} onChange={(v) => set({ touchControls: v })} options={[{ v: 'auto', l: t('settings.touch.auto') }, { v: 'on', l: t('settings.touch.on') }, { v: 'off', l: t('settings.touch.off') }]} />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">{t('settings.length.label')}</span>
            <Seg value={s.raceLength} onChange={(v) => set({ raceLength: v })} options={[{ v: 'short', l: t('settings.length.short') }, { v: 'medium', l: t('settings.length.medium') }, { v: 'long', l: t('settings.length.long') }]} />
            <span className="muted" style={{ fontSize: 12.5 }}>{t('settings.length.hint')}</span>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">{t('settings.difficulty.label')}</span>
            <Seg value={s.difficulty} onChange={(v) => set({ difficulty: v })} options={[{ v: 'easy', l: t('settings.difficulty.easy') }, { v: 'normal', l: t('settings.difficulty.normal') }, { v: 'hard', l: t('settings.difficulty.hard') }]} />
          </div>
          <div className="sep" />
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('settings.keys.title')}</summary>
            <KeyBindings custom={s.keys} onChange={(keys) => update((st) => { if (keys) st.settings.keys = keys; else delete st.settings.keys; })} toast={toast} />
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('settings.aids.title')}</summary>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              <p className="muted" style={{ fontSize: 12.5 }}>{t('settings.aids.intro')}</p>
              <Switch id="corners" on={s.cornerHints} onChange={(v) => set({ cornerHints: v })} label={t('settings.aids.corners')} />
              <Switch id="line" on={s.showLine} onChange={(v) => set({ showLine: v })} label={t('settings.aids.line')} />
              <Switch id="steerassist" on={s.steerAssist} onChange={(v) => set({ steerAssist: v })} label={t('settings.aids.steer')} />
              <Switch id="brakeassist" on={s.brakeAssist} onChange={(v) => set({ brakeAssist: v })} label={t('settings.aids.brake')} />
              <div className="field" style={{ marginTop: 4 }}>
                <div className="row between">
                  <label htmlFor="sens">{t('settings.aids.sensitivity')}</label>
                  <span className="num">{fmtNum(s.steerSensitivity, 1)}</span>
                </div>
                <input id="sens" type="range" min={0.5} max={1.8} step={0.1} value={s.steerSensitivity} onChange={(e) => set({ steerSensitivity: +e.target.value })} />
              </div>
            </div>
          </details>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="card stack" style={{ gap: 6 }}>
            <h3>{t('settings.sound.title')}</h3>
            <Switch id="mute" on={!s.muted} onChange={(v) => set({ muted: !v })} label={t('settings.sound.sound')} />
            <div className="field">
              <div className="row between">
                <label htmlFor="vol">{t('settings.sound.volume')}</label>
                <span className="num">{fmtPct(s.volume)}</span>
              </div>
              <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: +e.target.value })} />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span className="lbl">{t('settings.sound.quality')}</span>
              <Seg value={s.quality} onChange={(v) => set({ quality: v })} options={[{ v: 'high', l: t('settings.sound.qualityHigh') }, { v: 'low', l: t('settings.sound.qualityLow') }]} />
            </div>
          </div>

          <div className="card stack" style={{ gap: 10 }}>
            <h3>{t('settings.save.title')}</h3>
            <div className="stack" style={{ gap: 4, fontSize: 13.5 }}>
              <div className="row between">
                <span>{t('settings.save.browser')}</span>
                <b className={saveInfo.local ? 'good' : 'bad'}>{saveInfo.local ? t('settings.save.browserOk') : t('settings.save.browserNo')}</b>
              </div>
              <div className="row between">
                <span>{t('settings.save.cloud')}</span>
                <b className={saveInfo.cloud === 'ok' ? 'good' : saveInfo.cloud === 'error' ? 'bad' : 'muted'}>
                  {saveInfo.cloud === 'off' ? t('settings.save.cloudOff') : saveInfo.cloud === 'wait' ? t('settings.save.cloudWait') : saveInfo.cloud === 'error' ? t('settings.save.cloudError') : saveInfo.cloudAt ? t('settings.save.cloudAt', { time: new Date(saveInfo.cloudAt).toLocaleTimeString(LOCALES[getLang()], { hour: '2-digit', minute: '2-digit' }) }) : t('settings.save.cloudReady')}
                </b>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>{t('settings.save.info')}</p>
            {saveInfo.cloudNewer && (
              <div className="tip">
                <span>{t('settings.save.cloudNewer')}</span>
                <Btn variant="sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await restoreFromCloud(); setBusy(false); toast(ok ? t('settings.save.newerLoaded') : t('settings.save.loadFailed'), ok ? 'good' : 'bad'); }}>{t('settings.save.loadNewer')}</Btn>
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
                  if (r === 'saved') toast(t('settings.save.fileSaved'), 'good');
                  else if (r === 'error') toast(t('settings.save.fileError'), 'bad');
                }}
              >
                {t('settings.save.toFile')}
              </Btn>
              <Btn onClick={() => fileRef.current?.click()}>{t('settings.save.fromFile')}</Btn>
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
                  if (!st) toast(t('settings.save.fileInvalid'), 'bad');
                  else {
                    setGame(st);
                    toast(t('settings.save.loadedOf', { team: st.team.name }), 'good');
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
                    toast(ok ? t('settings.save.syncOk') : t('settings.save.syncFailed'), ok ? 'good' : 'bad');
                  }}
                >
                  {t('settings.save.syncNow')}
                </Btn>
              )}
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('settings.save.textTitle')}</summary>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                <div className="row">
                  <Btn onClick={() => setExported(exportSave(g))}>{t('settings.save.export')}</Btn>
                </div>
                {exported && (
                  <>
                    <textarea id="export" readOnly value={exported} onFocus={(e) => e.currentTarget.select()} aria-label={t('settings.save.exportedAria')} />
                    <Btn
                      variant="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(exported).then(
                          () => toast(t('settings.save.copied'), 'good'),
                          () => {
                            (document.getElementById('export') as HTMLTextAreaElement | null)?.select();
                            toast(t('settings.save.copyManual'));
                          },
                        );
                      }}
                    >
                      {t('settings.save.copy')}
                    </Btn>
                  </>
                )}
              </div>
            </details>
            <div className="row">
              <Btn variant="ghost" onClick={() => update((st) => { st.tipsSeen = {}; st.flags.tipQueue = []; })}>{t('settings.save.showTips')}</Btn>
            </div>
            <div className="field">
              <label htmlFor="import">{t('settings.save.importLabel')}</label>
              <textarea id="import" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={t('settings.save.importPlaceholder')} />
            </div>
            <Btn
              disabled={!importText.trim()}
              onClick={() => {
                const st = importSave(importText) ?? parseSave(importText);
                if (!st) toast(t('settings.save.textInvalid'), 'bad');
                else {
                  setGame(st);
                  setImportText('');
                  toast(t('settings.save.loaded'), 'good');
                }
              }}
            >
              {t('settings.save.import')}
            </Btn>
            <div className="sep" />
            <Btn variant="danger" onClick={() => setConfirmReset(true)}>{t('settings.save.newGame')}</Btn>
          </div>
        </div>
      </section>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h2>{t('settings.reset.title')}</h2>
          <p className="muted">{t('settings.reset.text', { team: g.team.name })}</p>
          <div className="row">
            <Btn variant="danger" onClick={() => { clearGame(); setGame(null); setConfirmReset(false); onQuit(); }}>{t('settings.reset.confirm')}</Btn>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>{t('settings.reset.cancel')}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
