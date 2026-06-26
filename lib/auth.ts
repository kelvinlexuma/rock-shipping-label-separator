import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'rock_session'
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-me'
)

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ auth: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  }
}

export { SESSION_COOKIE }
