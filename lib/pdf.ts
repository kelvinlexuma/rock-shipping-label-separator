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
 * Extract per-page text from the original full PDF using pdfjs-dist.
 * Tested and confirmed working on both EAE (BB...) and FRCU (R...FRCU...) formats.
 * pdf-parse was replaced because its pagerender callback had import/API issues
 * and single-page copies made by pdf-lib lost font data needed for text extraction.
 */
async function extractPageTexts(fullPdfBytes: Uint8Array): Promise<string[]> {
  // Dynamic import keeps pdfjs-dist server-side only (serverExternalPackages)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const loadingTask = pdfjsLib.getDocument({
    data: fullPdfBytes,
    // Suppress font warning — doesn't affect text extraction
    verbosity: 0,
  })
  const pdfDoc = await loadingTask.promise
  const texts: string[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const content = await page.getTextContent()
    const text = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str ?? '')
      .join(' ')
    texts.push(text)
  }

  return texts
}

export async function splitAndNamePages(pdfBytes: Uint8Array): Promise<LabelPage[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  // Extract all page texts from the original PDF first (font data intact)
  let pageTexts: string[] = []
  try {
    pageTexts = await extractPageTexts(pdfBytes)
  } catch (err) {
    console.error('pdfjs text extraction failed:', err)
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
    console.log(`Page ${i + 1}: "${pageTexts[i]?.slice(0, 60)}" → ${filename}`)
    results.push({ filename, bytes: pageBytes })
  }

  return results
}
