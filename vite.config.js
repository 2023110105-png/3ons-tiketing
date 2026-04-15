import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const ENABLE_PWA = true
const ENABLE_HTTPS = false  // Disabled: mkcert not available in production build

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    https: ENABLE_HTTPS,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://cdn.jsdelivr.net; connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.railway.app https://*.supabase.co wss://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: blob: https: http://localhost:3001; frame-src 'self';"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (
            id.includes('/firebase/') ||
            id.includes('/@firebase/')
          ) {
            return 'vendor-firebase'
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }

          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) {
            return 'vendor-router'
          }

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
    ...(ENABLE_PWA ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-logo.svg', 'favicon-brand.svg', 'icons.svg'],
      manifest: {
        id: '/',
        name: '3ons - Event Platform',
        short_name: '3ons',
        description: '3ons - Sistem registrasi, tiket, dan scanner event berbasis project',
        theme_color: '#4da6e8',
        background_color: '#f5f3eb',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon-brand.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/brand-logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Reduce stale cache risk after deployments.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//]
      }
    })] : []),
  ]
})
