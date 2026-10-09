// Gemeinsame Vite-Erweiterungen für alle Builds.
import type { Plugin } from 'vite';
import { GAME_NAME } from './src/config';

/** Ersetzt %GAME_NAME% in der index.html durch den Spielnamen aus src/config.ts */
export function gameNamePlugin(): Plugin {
  return {
    name: 'game-name',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.split('%GAME_NAME%').join(GAME_NAME),
    },
  };
}
