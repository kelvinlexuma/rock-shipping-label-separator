import { google } from 'googleapis'
import { Readable } from 'stream'

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!
const IMPERSONATE_USER = process.env.GOOGLE_IMPERSONATE_USER || 'account@lexuma.com'
const MAX_RECORDS = 30

/**
 * Auth via a Google service account with domain-wide delegation, impersonating
 * IMPERSONATE_USER (account@lexuma.com), who has edit rights on the target
 * folder. The service-account JSON is provided base64-encoded in the
 * GOOGLE_SERVICE_ACCOUNT_B64 env var (avoids newline-escaping issues with the
 * private key). This replaces the previous OAuth refresh-token flow, which
 * required a fragile one-time browser sign-in and could expire.
 */
function getDriveAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 is not set')
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  return new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: IMPERSONATE_USER,
  })
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getDriveAuth() })
}

export async function uploadZipToDrive(zipBuffer: Buffer, filename: string): Promise<string> {
  const drive = getDriveClient()
  const stream = Readable.from(zipBuffer)

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [FOLDER_ID],
      mimeType: 'application/zip',
    },
    media: {
      mimeType: 'application/zip',
      body: stream,
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  })

  return res.data.webViewLink || res.data.id || ''
}

export async function enforceRecordLimit(): Promise<void> {
  const drive = getDriveClient()

  // Collect all files across pages before deciding what to delete.
  // pageSize: 1000 (API max) + nextPageToken in fields ensures we never miss files
  // due to partial first-page responses (which the Drive API explicitly allows).
  const allFiles: Array<{ id: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      orderBy: 'createdTime asc',
      fields: 'nextPageToken, files(id, createdTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    })
    for (const f of res.data.files ?? []) {
      if (f.id) allFiles.push({ id: f.id })
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  const toDelete = allFiles.slice(0, Math.max(0, allFiles.length - MAX_RECORDS))
  await Promise.all(
    toDelete.map(f =>
      drive.files.delete({ fileId: f.id, supportsAllDrives: true }).catch(() => {})
    )
  )
}
