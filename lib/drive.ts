import { google } from 'googleapis'
import { Readable } from 'stream'

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!
const MAX_RECORDS = 30

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  return oauth2Client
}

export async function uploadZipToDrive(zipBuffer: Buffer, filename: string): Promise<string> {
  const auth = getOAuth2Client()
  const drive = google.drive({ version: 'v3', auth })

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
  const auth = getOAuth2Client()
  const drive = google.drive({ version: 'v3', auth })

  const list = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    orderBy: 'createdTime asc',
    fields: 'files(id, name, createdTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 100,
  })

  const files = list.data.files || []
  const toDelete = files.slice(0, Math.max(0, files.length - MAX_RECORDS))

  await Promise.all(
    toDelete.map(f =>
      drive.files.delete({ fileId: f.id!, supportsAllDrives: true }).catch(() => {})
    )
  )
}
