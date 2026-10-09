import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { gameNamePlugin } from './vite.plugins';

export default defineConfig({
  plugins: [react(), gameNamePlugin()],
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
