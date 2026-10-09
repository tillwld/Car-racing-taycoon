// Startablauf: Portal-SDK starten, Spielstand in einem Aufruf laden, Sprache wählen, dann das Spiel zeigen. Währenddessen steht ein Ladebildschirm mit Fortschrittsbalken da.
import { useEffect, useState } from 'react';
import App from './App';
import { GAME_NAME } from './config';
import { detectLang, setLang, t, useLang } from './i18n';
import { initPlatform, platform } from './platform/platform';
import { installPlatformGlue } from './platform/glue';
import { storedLanguage } from './platform/prefs';
import { store } from './platform/storage';
import { STORAGE_KEYS } from './game/save';

export function LoadingScreen({ progress }: { progress: number }) {
  useLang();
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <h1 className="boot-name">{GAME_NAME}</h1>
      <div className="boot-bar" role="progressbar" aria-label={t('boot.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
        <i style={{ width: `${p}%` }} />
      </div>
      <div className="boot-text">{t('boot.loading')} {p} %</div>
    </div>
  );
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

async function startup(report: (p: number) => void) {
  report(8);
  await initPlatform().catch(() => {});
  installPlatformGlue();
  report(35);
  platform.loadingProgress(35);
  // Spielstand, Einstellungen und Sprache in einem einzigen Aufruf laden
  await Promise.race([store.hydrate(STORAGE_KEYS), sleep(8000)]).catch(() => {});
  report(70);
  setLang(storedLanguage() ?? detectLang(platform.language));
  document.title = GAME_NAME;
  platform.loadingProgress(70);
  // Schriften bereit, damit nichts nachspringt (höchstens kurz warten)
  try {
    if (document.fonts?.load) {
      const faces = ['500', '600', '700', '800'].map((w) => `${w} 16px "Saira Condensed"`).concat(['400', '500', '600', '700'].map((w) => `${w} 16px Barlow`), ['400', '600'].map((w) => `${w} 16px "Chivo Mono"`));
      await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, 'AaÄ0'))), sleep(2500)]);
    }
  } catch {
    /* egal: es gibt Ersatzschriften */
  }
  report(95);
  platform.loadingProgress(100);
}

export default function Boot() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(5);
  useEffect(() => {
    let dead = false;
    const guard = window.setTimeout(() => !dead && setReady(true), 12000);
    startup((p) => !dead && setProgress(p))
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(guard);
        if (!dead) {
          setProgress(100);
          setReady(true);
        }
      });
    return () => {
      dead = true;
      window.clearTimeout(guard);
    };
  }, []);
  return ready ? <App /> : <LoadingScreen progress={progress} />;
}
