import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Build targets:
//  default          – installable PWA served from `/` (or BASE_PATH, e.g. `/repo/` for GitHub Pages)
//  VITE_TARGET=artifact – self-contained copy for hosting inside claude.ai: relative asset URLs,
//                         hash routing, no service worker.
const artifact = process.env.VITE_TARGET === 'artifact'
const base = artifact ? './' : (process.env.BASE_PATH ?? '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      disable: artifact,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: base,
        name: 'Sculpt – Glutes & Upper Body',
        short_name: 'Sculpt',
        description: 'Personal workout and progress tracker. Everything stays on your device.',
        theme_color: '#08080d',
        background_color: '#08080d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { target: 'es2020', sourcemap: false, outDir: artifact ? 'dist-artifact' : 'dist' },
})
