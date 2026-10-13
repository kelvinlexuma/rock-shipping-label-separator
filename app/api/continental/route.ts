import { NextRequest, NextResponse } from 'next/server'
import {
  decodeCsv,
  parseEcangCsv,
  convertToContinental,
  buildContinentalWorkbook,
} from '@/lib/continental'
import {
  uploadFileToDrive,
  getOrCreateSubfolder,
  enforceRecordLimit,
  logConversion,
  errorMessage,
} from '@/lib/drive'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function hktStamp(): { date: string; time: string } {
  const hkt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${hkt.getUTCFullYear()}-${pad(hkt.getUTCMonth() + 1)}-${pad(hkt.getUTCDate())}`,
    time: `${pad(hkt.getUTCHours())}${pad(hkt.getUTCMinutes())}${pad(hkt.getUTCSeconds())}`,
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || !/\.csv$/i.test(file.name)) {
    return NextResponse.json({ error: 'A .csv file exported from ECang is required' }, { status: 400 })
  }

  const csvBytes = new Uint8Array(await file.arrayBuffer())

  let result
  try {
    result = convertToContinental(parseEcangCsv(decodeCsv(csvBytes)))
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not read the CSV'
    await logConversion({ tool: 'Continental Converter', uploadedFile: file.name, driveBackup: '—', error })
    return NextResponse.json({ error }, { status: 400 })
  }
  if (result.orders.length === 0) {
    const error = 'No orders found in the CSV'
    await logConversion({ tool: 'Continental Converter', uploadedFile: file.name, driveBackup: '—', error })
    return NextResponse.json({ error }, { status: 400 })
  }

  const xlsx = await buildContinentalWorkbook(result.orders)
  const { date, time } = hktStamp()
  const filename = `Upload to Continental ${date}.xlsx`

  // Back up the source CSV and the output to Drive/Continental (own 30-file cap).
  let driveSaved = false
  let driveError = ''
  try {
    const folderId = await getOrCreateSubfolder('Continental')
    await uploadFileToDrive(xlsx, `${date}_${time} ${filename}`, XLSX_MIME, folderId)
    await uploadFileToDrive(Buffer.from(csvBytes), `${date}_${time} ${file.name}`, 'text/csv', folderId)
    await enforceRecordLimit(folderId)
    driveSaved = true
  } catch (err) {
    console.error('Drive upload error:', err)
    driveError = errorMessage(err)
    // Continue — the user still gets the file.
  }

  await logConversion({
    tool: 'Continental Converter',
    uploadedFile: file.name,
    outputFile: filename,
    count: result.orders.length,
    warnings: result.orders.filter(o => o.warnings.length).length + result.warnings.length,
    driveBackup: driveSaved ? 'Saved' : 'FAILED',
    error: driveError ? `Drive: ${driveError}` : undefined,
  })

  return NextResponse.json({
    filename,
    xlsxBase64: xlsx.toString('base64'),
    orders: result.orders,
    warnings: result.warnings,
    sourceRowCount: result.sourceRowCount,
    driveSaved,
  })
}
