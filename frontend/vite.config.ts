import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: ['..', '../..'],
    },
    // `npm run dev` memakai scripts/dev-vite.sh agar 1444 tidak tertahan proses Vite lama
    port: 1444,
    strictPort: true,
    headers: {
      // Izinkan pratinjau terbenam (IDE / portal) memuat dev server; tidak mengubah produksi.
      'Content-Security-Policy': 'frame-ancestors *',
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:2111', changeOrigin: true },
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': 'frame-ancestors *',
    },
  },
})
