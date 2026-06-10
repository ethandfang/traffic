import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

const repo = pkg.name || 'traffic';

export default defineConfig({
  base: `/${repo}/`,
});
