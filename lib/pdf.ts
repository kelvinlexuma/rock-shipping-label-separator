import { PDFDocument } from 'pdf-lib'

const BARCODE_PATTERNS = [
  /BB\d{8,}/,        // EAE format:  BB56318727959
  /R\d{8,}FRCU\d*/, // FRCU format: R1326060400001FRCU00
]

// Scale for rasterising a page when we have to read the barcode from the image.
// 5 ≈ 360 DPI — enough resolution for zxing to decode the Code128 tracking bars.
const RENDER_SCALE = 5

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

function pickBarcode(candidates: string[]): string | null {
  for (const pattern of BARCODE_PATTERNS) {
    for (const c of candidates) {
      const m = c.match(pattern)
      if (m) return m[0]
    }
  }
  return null
}

/**
 * Tier 1 — extract per-page text from the original PDF using unpdf.
 *
 * Works for "text-based" labels (the original EAE/FRCU exports) where the
 * barcode value is embedded as real text. unpdf ships a self-contained
 * serverless pdf.js build, so it bundles cleanly into a Vercel Lambda.
 */
async function extractPageTexts(fullPdfBytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(fullPdfBytes))
  const { text } = await extractText(pdf, { mergePages: false })
  return text
}

/**
 * Tier 2 — read the barcode from the rendered page image.
 *
 * Some exports (e.g. RE1ALL.pdf) have NO text layer: no embedded fonts, and the
 * barcode/labels are drawn as images + vector outlines. There is nothing for
 * Tier 1 to read, so we rasterise the page (unpdf + @napi-rs/canvas) and decode
 * the Code128 bars with zxing-wasm (pure WASM). Only called for pages where the
 * text tier found nothing, so text-based PDFs keep their fast path.
 *
 * Returns a map of pageIndex -> barcode for the requested pages.
 */
async function readBarcodesFromImages(
  fullPdfBytes: Uint8Array,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  const found = new Map<number, string>()
  if (pageNumbers.length === 0) return found

  const { renderPageAsImage } = await import('unpdf')
  const { readBarcodesFromImageFile } = await import('zxing-wasm/reader')
  // Common 1D shipping-label symbologies. These labels use Code128; the rest
  // are cheap insurance for future formats. (Linear-only keeps decoding fast.)
  const formats = [
    'Code128', 'Code39', 'Code93', 'ITF', 'Codabar',
    'EAN13', 'EAN8', 'UPCA', 'UPCE',
  ] as const

  for (const pageNum of pageNumbers) {
    try {
      // Pass a fresh copy each call — pdf.js detaches the buffer it receives.
      const png = await renderPageAsImage(new Uint8Array(fullPdfBytes), pageNum, {
        canvasImport: () => import('@napi-rs/canvas'),
        scale: RENDER_SCALE,
      })
      const blob = new Blob([png], { type: 'image/png' })
      const results = await readBarcodesFromImageFile(blob, {
        tryHarder: true,
        formats: [...formats],
        maxNumberOfSymbols: 20,
      })
      const barcode = pickBarcode(results.map(r => r.text))
      if (barcode) found.set(pageNum - 1, barcode)
    } catch (err) {
      console.error(`Image barcode decode failed for page ${pageNum}:`, err)
    }
  }

  return found
}

export async function splitAndNamePages(pdfBytes: Uint8Array): Promise<LabelPage[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const pageCount = srcDoc.getPageCount()

  // Tier 1: text extraction from the original PDF (fast, font data intact)
  let pageTexts: string[] = []
  try {
    pageTexts = await extractPageTexts(pdfBytes)
  } catch (err) {
    console.error('unpdf text extraction failed:', err)
  }

  // Resolve a barcode per page from text; collect the ones that need image OCR
  const barcodes: (string | null)[] = []
  const needImage: number[] = []
  for (let i = 0; i < pageCount; i++) {
    const fromText = pageTexts[i] ? findBarcode(pageTexts[i]) : null
    barcodes.push(fromText)
    if (!fromText) needImage.push(i + 1) // 1-based page number for the renderer
  }

  // Tier 2: image-based barcode decode for the pages text couldn't resolve
  if (needImage.length > 0) {
    console.log(`Text tier missed ${needImage.length} page(s); decoding from image…`)
    const fromImages = await readBarcodesFromImages(pdfBytes, needImage)
    for (const [idx, barcode] of fromImages) barcodes[idx] = barcode
  }

  const results: LabelPage[] = []
  for (let i = 0; i < pageCount; i++) {
    const pageDoc = await PDFDocument.create()
    const [copiedPage] = await pageDoc.copyPages(srcDoc, [i])
    pageDoc.addPage(copiedPage)
    const pageBytes = await pageDoc.save()

    const barcode = barcodes[i]
    const filename = barcode ? `${barcode}.pdf` : `page_${i + 1}.pdf`
    console.log(`Page ${i + 1}: barcode=${barcode ?? 'none'} → ${filename}`)
    results.push({ filename, bytes: pageBytes })
  }

  return results
}
