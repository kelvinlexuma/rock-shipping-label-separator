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
  return uploadFileToDrive(zipBuffer, filename, 'application/zip', FOLDER_ID)
}

export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId: string,
): Promise<string> {
  const drive = getDriveClient()

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  })

  return res.data.webViewLink || res.data.id || ''
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

/** Find (or create) a subfolder of the main folder, e.g. "Continental". */
export async function getOrCreateSubfolder(name: string): Promise<string> {
  const drive = getDriveClient()
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const found = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name = '${escaped}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existing = found.data.files?.[0]?.id
  if (existing) return existing

  const created = await drive.files.create({
    requestBody: { name, parents: [FOLDER_ID], mimeType: FOLDER_MIME },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id!
}

export async function enforceRecordLimit(folderId: string = FOLDER_ID): Promise<void> {
  const drive = getDriveClient()

  // Collect all files across pages before deciding what to delete.
  // pageSize: 1000 (API max) + nextPageToken in fields ensures we never miss files
  // due to partial first-page responses (which the Drive API explicitly allows).
  const allFiles: Array<{ id: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      // Subfolders (e.g. Continental) don't count toward the cap and are never deleted.
      q: `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
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
