import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shuffle-redeem-code.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* Web push. On only when the backend says so — see lib/onesignal.js, shared with the other CFZ
   sites. The api layer is proxied same-origin in dev (vite.config.js), so the base is the page's
   own origin unless VITE_API_BASE names a deployed API; lib/session.jsx ties the subscription to
   the signed-in player. */
import { initPush } from './lib/onesignal.js'
const apiBase = /^https?:/.test(import.meta.env.VITE_API_BASE || '') ? import.meta.env.VITE_API_BASE.replace(/\/api\/v1\/?$/, '') : ''
initPush({ apiBase })
