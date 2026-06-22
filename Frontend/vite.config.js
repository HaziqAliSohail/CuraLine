import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy for the PRODUCTION build only. Injected as a <meta>
// so it travels with the HTML even on static hosts (Vercel/Netlify) that don't
// run our nginx config. NOT applied in dev - Vite's HMR needs eval/ws which a
// strict CSP would block.
// The web app talks to its API same-origin (axios baseURL '/v1'), so
// connect-src 'self' is correct. script-src 'self' (no inline/eval) is the key
// XSS protection; 'unsafe-inline' for styles is required by React inline styles.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "form-action 'self'",
].join('; ')

function cspPlugin() {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), cspPlugin()],
  build: {
    sourcemap: false, // never ship source maps to production
  },
  // Strip console/debugger from production bundles only (defense-in-depth
  // against accidental data logging); keep them in dev for debugging.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  server: {
    port: 3001,
    host: '127.0.0.1',
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
}))
