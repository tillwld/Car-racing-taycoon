// Verbindet die Pause- und Ton-Ereignisse des Portals (Tab im Hintergrund, Werbung, Portal-Pause, Stummtaste) mit dem Spiel.
import { useSyncExternalStore } from 'react';
import { sound } from '../audio/sound';
import { isPaused, isPlatformAudioEnabled, onPauseChange, onPlatformAudioChange } from './platform';

let installed = false;

/** Einmal beim Start aufrufen: der Audio-Kontext wird bei Pause angehalten und danach wieder gestartet. Der Wunsch des Spielers (Ton aus) bleibt erhalten. */
export function installPlatformGlue() {
  if (installed) return;
  installed = true;
  sound.setPlatformAudio(isPlatformAudioEnabled());
  sound.setSuspended(isPaused());
  onPauseChange((p) => sound.setSuspended(p));
  onPlatformAudioChange((enabled) => sound.setPlatformAudio(enabled));
}

/** true, solange das Portal Pause verlangt, der Tab versteckt ist oder eine Werbung läuft */
export function usePlatformPaused(): boolean {
  return useSyncExternalStore(onPauseChange, isPaused, isPaused);
}
