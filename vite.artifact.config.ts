// Build für die gehostete Einzelseite: alles (React, three.js, Code, Styles) wird in eine HTML-Datei gebündelt.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { target: 'es2020', outDir: 'dist-artifact', chunkSizeWarningLimit: 3000 },
});
