import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { splitAndNamePages } from '@/lib/pdf'
import { uploadZipToDrive, enforceRecordLimit } from '@/lib/drive'

function getTimestampFilename(): string {
  const now = new Date()
  // HKT = UTC+8
  const hkt = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${hkt.getUTCFullYear()}-${pad(hkt.getUTCMonth() + 1)}-${pad(hkt.getUTCDate())}`
  const time = `${pad(hkt.getUTCHours())}${pad(hkt.getUTCMinutes())}${pad(hkt.getUTCSeconds())}`
  return `${date}_${time}.zip`
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdfBytes = new Uint8Array(arrayBuffer)

  // Split into labelled pages
  let pages
  try {
    pages = await splitAndNamePages(pdfBytes)
  } catch (err) {
    console.error('PDF processing error:', err)
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 })
  }

  // Build ZIP
  const zip = new JSZip()
  // Deduplicate filenames in case two pages share a barcode
  const seen = new Map<string, number>()
  for (const { filename, bytes } of pages) {
    let name = filename
    if (seen.has(filename)) {
      const count = seen.get(filename)! + 1
      seen.set(filename, count)
      name = filename.replace('.pdf', `_${count}.pdf`)
    } else {
      seen.set(filename, 1)
    }
    zip.file(name, bytes)
  }

  const zipFilename = getTimestampFilename()
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  // Upload to Google Drive and enforce 30-record limit
  let driveUrl = ''
  try {
    driveUrl = await uploadZipToDrive(zipBuffer, zipFilename)
    await enforceRecordLimit()
  } catch (err) {
    console.error('Drive upload error:', err)
    // Continue — still return ZIP to user even if Drive fails
  }

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'X-Page-Count': String(pages.length),
      'X-Drive-Url': driveUrl,
      'X-Filename': zipFilename,
    },
  })
}
