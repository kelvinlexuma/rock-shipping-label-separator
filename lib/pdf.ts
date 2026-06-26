import { PDFDocument } from 'pdf-lib'

const BARCODE_PATTERNS = [
  /BB\d{8,}/,        // EAE format:  BB56318727959
  /R\d{8,}FRCU\d*/, // FRCU format: R1326060400001FRCU00
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

/**
 * Extract per-page text from the original full PDF.
 * Parsing the original preserves font/encoding tables that get lost
 * when pdf-lib re-saves single-page copies.
 */
async function extractPageTexts(fullPdfBytes: Uint8Array): Promise<string[]> {
  const pdfModule = await import('pdf-parse')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (buf: Buffer, opts?: any) => Promise<{ text: string }> =
    (pdfModule as any).default ?? pdfModule

  const pageTexts: string[] = []

  await pdfParse(Buffer.from(fullPdfBytes), {
    // pagerender is called once per page before the final text is assembled
    pagerender: (pageData: any) =>
      pageData.getTextContent().then((content: any) => {
        const text: string = content.items
          .map((item: any) => item.str ?? '')
          .join('\n')
        pageTexts.push(text)
        return text
      }),
  })

  return pageTexts
}

export async function splitAndNamePages(pdfBytes: Uint8Array): Promise<LabelPage[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  // Extract per-page text from the original PDF first
  let pageTexts: string[] = []
  try {
    pageTexts = await extractPageTexts(pdfBytes)
  } catch (err) {
    console.error('Batch text extraction failed, will try per-page fallback:', err)
  }

  const results: LabelPage[] = []

  for (let i = 0; i < pageCount; i++) {
    // Build single-page PDF
    const pageDoc = await PDFDocument.create()
    const [copiedPage] = await pageDoc.copyPages(srcDoc, [i])
    pageDoc.addPage(copiedPage)
    const pageBytes = await pageDoc.save()

    // Try barcode from pre-extracted text first
    let barcode = pageTexts[i] ? findBarcode(pageTexts[i]) : null

    // Fallback: parse the single-page copy directly
    if (!barcode) {
      try {
        const pdfModule = await import('pdf-parse')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
          (pdfModule as any).default ?? pdfModule
        const { text } = await pdfParse(Buffer.from(pageBytes))
        barcode = findBarcode(text)
      } catch (err) {
        console.error(`Fallback extraction failed for page ${i + 1}:`, err)
      }
    }

    const filename = barcode ? `${barcode}.pdf` : `page_${i + 1}.pdf`
    console.log(`Page ${i + 1}: barcode="${barcode ?? 'none'}" → ${filename}`)
    results.push({ filename, bytes: pageBytes })
  }

  return results
}
