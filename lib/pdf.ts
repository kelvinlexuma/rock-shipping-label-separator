import { PDFDocument } from 'pdf-lib'

// Barcode patterns in priority order
const BARCODE_PATTERNS = [
  /BB\d{8,}/,          // EAE format:  BB56318727959
  /R\d{8,}FRCU\d*/,   // FRCU format: R1326060400001FRCU00
]

export interface LabelPage {
  filename: string
  bytes: Uint8Array
}

function findBarcode(text: string): string | null {
  for (const pattern of BARCODE_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[0]
  }
  return null
}

async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  // pdf-parse is an ESM module without a default export; import namespace directly
  const pdfModule = await import('pdf-parse')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfModule as any).default ?? pdfModule
  const data = await pdfParse(Buffer.from(bytes))
  return data.text
}

export async function splitAndNamePages(pdfBytes: Uint8Array): Promise<LabelPage[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()
  const results: LabelPage[] = []

  for (let i = 0; i < pageCount; i++) {
    // Extract single page
    const pageDoc = await PDFDocument.create()
    const [page] = await pageDoc.copyPages(srcDoc, [i])
    pageDoc.addPage(page)
    const pageBytes = await pageDoc.save()

    // Extract text and find barcode
    let barcode: string | null = null
    try {
      const text = await extractTextFromPdfBytes(pageBytes)
      barcode = findBarcode(text)
    } catch (err) {
      console.error(`Text extraction failed for page ${i + 1}:`, err)
    }

    const filename = barcode ? `${barcode}.pdf` : `page_${i + 1}.pdf`
    results.push({ filename, bytes: pageBytes })
  }

  return results
}
