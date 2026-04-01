import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
