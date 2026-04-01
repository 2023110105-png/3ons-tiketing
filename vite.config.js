import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['yamaha-logo.svg', 'icons.svg'],
      manifest: {
        name: 'Yamaha Scanner',
        short_name: 'Gate Scanner',
        description: 'Sistem Registrasi dan Scanner Event Yamaha',
        theme_color: '#E60012',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/yamaha-logo.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
