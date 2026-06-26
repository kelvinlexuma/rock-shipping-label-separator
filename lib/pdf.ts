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
 * Extract per-page text from the original full PDF using unpdf.
 *
 * unpdf ships a self-contained serverless build of pdf.js with NO external
 * worker/font/cmap files, so it bundles cleanly into a Vercel Lambda. The
 * previous `pdfjs-dist/legacy/build/pdf.mjs` import worked in local dev but
 * failed at runtime on Vercel (file tracing missed pdf.js's dependencies),
 * silently falling back to page_N.pdf names. Tested on both EAE (BB...) and
 * FRCU (R...FRCU...) sample PDFs.
 */
async function extractPageTexts(fullPdfBytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  // getDocumentProxy consumes the buffer; pass a copy so pdf-lib can reuse the original
  const pdf = await getDocumentProxy(new Uint8Array(fullPdfBytes))
  const { text } = await extractText(pdf, { mergePages: false })
  return text
}

export async function splitAndNamePages(pdfBytes: Uint8Array): Promise<LabelPage[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  // Extract all page texts from the original PDF first (font data intact)
  let pageTexts: string[] = []
  try {
    pageTexts = await extractPageTexts(pdfBytes)
  } catch (err) {
    console.error('unpdf text extraction failed:', err)
  }

  const results: LabelPage[] = []

  for (let i = 0; i < pageCount; i++) {
    // Build single-page PDF
    const pageDoc = await PDFDocument.create()
    const [copiedPage] = await pageDoc.copyPages(srcDoc, [i])
    pageDoc.addPage(copiedPage)
    const pageBytes = await pageDoc.save()

    const barcode = pageTexts[i] ? findBarcode(pageTexts[i]) : null

    const filename = barcode ? `${barcode}.pdf` : `page_${i + 1}.pdf`
    console.log(`Page ${i + 1}: barcode=${barcode ?? 'none'} → ${filename}`)
    results.push({ filename, bytes: pageBytes })
  }

  return results
}
