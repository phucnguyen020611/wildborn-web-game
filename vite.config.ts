import { defineConfig } from 'vite';

// GitHub Pages serves a project site under /<repo>/; the deploy workflow sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
});
