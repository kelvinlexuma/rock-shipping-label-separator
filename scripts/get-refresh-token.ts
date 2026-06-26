/**
 * Run once to get a Google OAuth2 refresh token for shop@lexuma.com.
 * Usage: npx tsx scripts/get-refresh-token.ts
 *
 * Copy the printed GOOGLE_REFRESH_TOKEN value into your Vercel environment variables.
 */

import { google } from 'googleapis'
import * as readline from 'readline'
import * as dotenv from 'fs'

// Read .env.local for credentials (run from project root)
const envFile = '.env.local'
let CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

try {
  const raw = dotenv.readFileSync(envFile, 'utf8')
  for (const line of raw.split('\n')) {
    const [k, ...vParts] = line.split('=')
    const v = vParts.join('=').trim()
    if (k?.trim() === 'GOOGLE_CLIENT_ID') CLIENT_ID = v
    if (k?.trim() === 'GOOGLE_CLIENT_SECRET') CLIENT_SECRET = v
  }
} catch { /* ignore if file missing */ }

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.')
  process.exit(1)
}

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
})

console.log('\n=== Rock Label Separator — Google Drive Setup ===\n')
console.log('1. Open this URL in your browser and sign in as shop@lexuma.com:')
console.log('\n' + authUrl + '\n')
console.log('2. After authorizing, paste the code below.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Enter the authorization code: ', async (code) => {
  rl.close()
  try {
    const { tokens } = await oauth2Client.getToken(code.trim())
    console.log('\n✅ Success! Add this to your Vercel environment variables:\n')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err)
    process.exit(1)
  }
})
