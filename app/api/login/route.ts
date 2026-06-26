import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (
    username !== process.env.LOGIN_ID ||
    password !== process.env.LOGIN_PASSWORD
  ) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken()
  const opts = getSessionCookieOptions()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(opts.name, token, opts)
  return res
}
