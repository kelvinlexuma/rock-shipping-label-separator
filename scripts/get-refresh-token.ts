/**
 * Run once to get a Google OAuth2 refresh token for shop@lexuma.com.
 * Usage (from project root): npx tsx scripts/get-refresh-token.ts
 *
 * This opens a local browser, you sign in, and the refresh token is printed.
 * Copy the GOOGLE_REFRESH_TOKEN value into your Vercel environment variables.
 */

import { google } from 'googleapis'
import * as http from 'http'
import * as fs from 'fs'
import { exec } from 'child_process'

// ── Load credentials from .env.local ─────────────────────────────────────────
const envFile = '.env.local'
let CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

try {
  const raw = fs.readFileSync(envFile, 'utf8')
  for (const line of raw.split('\n')) {
    const [k, ...vParts] = line.split('=')
    const v = vParts.join('=').trim()
    if (k?.trim() === 'GOOGLE_CLIENT_ID') CLIENT_ID = v
    if (k?.trim() === 'GOOGLE_CLIENT_SECRET') CLIENT_SECRET = v
  }
} catch { /* .env.local missing — use env vars */ }

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing credentials. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env.local\n')
  process.exit(1)
}

// ── OAuth2 client with local redirect ────────────────────────────────────────
const PORT = 3333
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
})

// ── Start local server to catch redirect ─────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.end('Not found')
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html' })
    res.end('<h2>❌ Authorization failed. Check the terminal for details.</h2>')
    console.error('\n❌ OAuth error:', error || 'no code returned')
    server.close()
    process.exit(1)
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <html><body style="font-family:monospace;padding:32px;background:#0f172a;color:#4ade80">
        <h2>✅ Success! You can close this tab.</h2>
        <p>Copy the refresh token from your terminal.</p>
      </body></html>
    `)

    server.close()

    console.log('\n✅ Authorized successfully!\n')
    console.log('Add this to your Vercel environment variables:\n')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\nAlso add this line to your .env.local for local development:\n')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end('<h2>❌ Token exchange failed. Check the terminal.</h2>')
    console.error('\n❌ Token exchange failed:', err)
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log('\n=== Rock Label Separator — Google Drive Setup ===\n')
  console.log('Opening browser for Google authorization...')
  console.log('Sign in as shop@lexuma.com when prompted.\n')
  console.log('(If the browser does not open automatically, open this URL manually:)')
  console.log('\n' + authUrl + '\n')

  // Open browser automatically
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${opener} "${authUrl}"`)
})
