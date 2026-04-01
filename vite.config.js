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
        name: '3oNs Project Platform',
        short_name: '3oNs',
        description: 'Sistem registrasi, tiket, dan scanner event berbasis project',
        theme_color: '#3c99dc',
        background_color: '#f4f9ff',
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
