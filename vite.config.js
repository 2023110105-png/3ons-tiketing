import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('xlsx')) {
            return 'vendor-export-xlsx'
          }

          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'vendor-export-pdf'
          }

          if (id.includes('html2canvas')) {
            return 'vendor-export-canvas'
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-logo.svg', 'icons.svg'],
      manifest: {
        name: '3oNs Digital - Event Platform',
        short_name: '3oNs Digital',
        description: '3oNs Digital - Sistem registrasi, tiket, dan scanner event berbasis project',
        theme_color: '#4da6e8',
        background_color: '#f5f3eb',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/brand-logo.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
