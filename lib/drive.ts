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

// The Sheets API accepts the drive scope, so no extra domain-wide-delegation scope is needed.
function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getDriveAuth() })
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
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

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
      // Subfolders (e.g. Continental) and the conversion log sheet don't count toward
      // the cap and are never deleted.
      q: `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}' and mimeType != '${SHEET_MIME}'`,
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

// ── Conversion log ──────────────────────────────────────────────────────────
// One row per conversion (both tools) in a "Conversion log" Google Sheet in the main
// folder, so "did staff use it / did the backup work?" can be answered later —
// Vercel only keeps ~1 day of request logs.

const LOG_SHEET_NAME = 'Conversion log'
const LOG_HEADERS = ['Time (HKT)', 'Tool', 'Uploaded file', 'Output file', 'Count', 'Warnings', 'Drive backup', 'Error']

export interface ConversionLogEntry {
  tool: 'Continental Converter' | 'Label Separator'
  uploadedFile: string
  outputFile?: string
  /** Orders (Continental) or labels (Separator). */
  count?: number
  warnings?: number
  driveBackup: 'Saved' | 'FAILED' | '—'
  error?: string
}

let logSheetId: string | null = null

async function getLogSheetId(): Promise<string> {
  if (logSheetId) return logSheetId
  const drive = getDriveClient()
  const found = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name = '${LOG_SHEET_NAME}' and mimeType = '${SHEET_MIME}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  let id = found.data.files?.[0]?.id
  if (!id) {
    const created = await drive.files.create({
      requestBody: { name: LOG_SHEET_NAME, parents: [FOLDER_ID], mimeType: SHEET_MIME },
      fields: 'id',
      supportsAllDrives: true,
    })
    id = created.data.id!
    await getSheetsClient().spreadsheets.values.update({
      spreadsheetId: id,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: [LOG_HEADERS] },
    })
  }
  logSheetId = id
  return id
}

export function hktTimestamp(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

/** Append a row to the conversion log. Never throws — logging must not break a conversion. */
export async function logConversion(entry: ConversionLogEntry): Promise<void> {
  try {
    const spreadsheetId = await getLogSheetId()
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId,
      range: 'A:H',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          hktTimestamp(), entry.tool, entry.uploadedFile, entry.outputFile ?? '',
          entry.count ?? '', entry.warnings ?? '', entry.driveBackup, entry.error ?? '',
        ]],
      },
    })
  } catch (err) {
    console.error('Conversion log write failed:', err)
  }
}

export function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300)
}
