/**
 * Route protection. A request for an operator page without a session cookie
 * is sent to /login; a signed-in visit to /login goes home. The token itself
 * is verified by the platform on every API call, so this only checks presence
 * and expiry.
 */
import { NextResponse, type NextRequest } from 'next/server'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'cfz_sa_token'
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout']

function tokenLooksValid(token: string | undefined) {
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))

    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const signedIn = tokenLooksValid(req.cookies.get(COOKIE)?.value)

  if (pathname.startsWith('/api/gw/')) {
    if (!signedIn && !pathname.includes('/site-config/public')) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } }, { status: 401 })
    }

    return NextResponse.next()
  }

  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (signedIn && pathname === '/login') return NextResponse.redirect(new URL('/dashboard', req.url))

    return NextResponse.next()
  }

  if (!signedIn) {
    const url = new URL('/login', req.url)

    if (pathname !== '/') url.searchParams.set('next', pathname)

    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api/auth/me).*)']
}
