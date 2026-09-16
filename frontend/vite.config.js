import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Drop the `Origin` header on the way through.
 *
 * A same-origin GET carries no `Origin`, so reads proxy cleanly — but a browser
 * DOES send one on a same-origin POST, and it names the dev server
 * (`http://192.168.1.8:5174`), not the gateway. The gateway's CORS middleware
 * then refuses a request the browser never treated as cross-origin at all, and
 * login fails while every read works. That combination is confusing enough to
 * be worth preventing rather than chasing.
 *
 * Once proxied this is a server-to-server call and has no web origin, so
 * removing the header is what the request actually is. It also keeps
 * CORS_ORIGIN in ../backend/.env from needing an entry per dev port and LAN
 * address. A deployed frontend calling the API directly (VITE_API_BASE) is
 * genuinely cross-origin and must be listed there — this changes nothing about
 * that.
 */
const stripOrigin = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin')
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // The gateway is the only port a browser addresses. Services 4001-4004 are an
  // implementation detail and `/internal/*` is refused at the edge.
  const gateway = env.VITE_GATEWAY_URL || 'http://127.0.0.1:4000'

  return {
    plugins: [react()],
    server: {
      // `host: true` also binds the LAN address, which is what the reference
      // comparison runs against — shuffle.com is compared side by side in a
      // real browser and `localhost` is not reachable from it.
      host: true,
      proxy: {
        // Proxying keeps the browser same-origin, so no preflight, no cookie
        // SameSite question and no CORS_ORIGIN list to keep in step with dev
        // ports. `VITE_API_BASE` bypasses this for a deployed API.
        '/api': { target: gateway, changeOrigin: true, configure: stripOrigin },
        '/health': { target: gateway, changeOrigin: true, configure: stripOrigin },
      },
    },
  }
})
