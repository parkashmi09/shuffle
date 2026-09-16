import type { NextRequest } from 'next/server'

import { serverConfig } from '@/configs/site'
import { writeSessionToken } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Staff sign-in. Forwards to the platform, and on success keeps the token in
 * the httpOnly cookie rather than handing it to the browser.
 *
 * `mode` picks the platform route: 'staff' (default) or 'executive'.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const mode = body.mode === 'executive' ? 'executive' : 'staff'
  const path = mode === 'executive' ? '/api/v1/admin/auth/executive/login' : '/api/v1/admin/auth/login'
  const { mode: _mode, ...payload } = body

  let upstream: Response

  try {
    upstream = await fetch(`${serverConfig.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '127.0.0.1' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    })
  } catch (error) {
    return Response.json(
      { success: false, error: { code: 'GATEWAY_UNREACHABLE', message: `Gateway ${serverConfig.apiUrl} did not answer`, details: { cause: String(error) } } },
      { status: 502 }
    )
  }

  const json = (await upstream.json().catch(() => null)) as
    | { success: true; data: { token: string; [k: string]: unknown } }
    | { success: false; error: unknown }
    | null

  if (!json) return Response.json({ success: false, error: { code: 'BAD_UPSTREAM', message: 'Unreadable login response' } }, { status: 502 })
  if (!json.success || !('data' in json) || !json.data?.token) return Response.json(json, { status: upstream.status })

  await writeSessionToken(json.data.token)

  const { token: _token, ...rest } = json.data

  return Response.json({ success: true, data: rest })
}
