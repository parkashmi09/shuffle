import { serverConfig } from '@/configs/site'
import { decodeToken, readSessionToken } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Who is signed in. The token's claims plus the platform's CURRENT permission
 * resolution, so a demoted role is reflected without a re-login.
 */
export async function GET() {
  const token = await readSessionToken()

  if (!token) return Response.json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } }, { status: 401 })

  const claims = decodeToken(token)!

  let permissions = claims.permissions ?? []
  let live: Record<string, unknown> = {}

  try {
    const res = await fetch(`${serverConfig.apiUrl}/api/v1/admin/access/me/permissions`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store'
    })

    if (res.status === 401) {
      return Response.json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }, { status: 401 })
    }
    const json = (await res.json()) as { success: boolean; data?: { permissions?: string[] } & Record<string, unknown> }

    if (json.success && json.data) {
      live = json.data
      if (Array.isArray(json.data.permissions)) permissions = json.data.permissions
    }
  } catch {
    // Gateway down: fall back to the token's claims so the shell still renders.
  }

  return Response.json({
    success: true,
    data: {
      staffId: Number(claims.sub),
      roleId: claims.roleId,
      roleName: claims.roleName,
      level: claims.level,
      executiveId: claims.executiveId ?? null,
      permissions,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      ...live
    }
  })
}
