import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' + HashRouter => works on any static host (Vercel, GitHub Pages, ...) without server rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
});
