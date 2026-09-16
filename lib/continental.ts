import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * ECang "Continental Label" CSV → Continental upload XLSX.
 *
 * Rules (confirmed with Rock Enterprise, see CLAUDE.md "Continental Converter"):
 * - one output row per order number, sorted A→Z
 * - SHIPPINGCHARGE-1 rows are dropped; remaining SKUs joined "A + B + C"
 * - if the order has REPAIR-n SKUs, only those SKUs are kept
 * - product_type / hs_code / country_of_origin come from the highest-priority item:
 *   Digital Camera > Mobile Telephone > Lens > Camera accessories
 * - cost & insured_value = the amount after "USD" in the 客服备注 remark
 * - quantity always 1 (parcel count), weight(g) always 100
 * - zip / phone / hs_code written as text so leading zeros survive
 */

// ── Source columns (matched by header name, so column order may change) ──
const SRC = {
  orderNo: '订单号',
  name: '收件人姓名',
  addr1: '收件人公司名&聯繫地址1',
  addr2: '联系地址2',
  city: '城市',
  state: '州\\省',
  zip: '收件人邮编',
  country: '目的国家英文名称',
  phone: '收件人电话',
  reference: '订单系统参考号',
  declaredName: '英文申报品名',
  remark: '客服备注',
  service: '运输方式',
  sku: '产品代码',
} as const

type SrcKey = keyof typeof SRC
export type EcangRow = Record<SrcKey, string>

interface Category {
  label: string
  origin: string
  rank: number
}

// Lower rank wins when an order mixes item types.
const CATEGORIES: Array<{ match: RegExp } & Category> = [
  { match: /^digital\s*camera$/i, label: 'Digital Camera', origin: 'JP', rank: 0 },
  { match: /^mobile\s*tele?phone$/i, label: 'Mobile Telephone', origin: 'VN', rank: 1 },
  { match: /^(camera\s*)?lens$/i, label: 'Camera Lens', origin: 'JP', rank: 2 },
  { match: /^camera\s*accessories$/i, label: 'Camera accessories', origin: 'CN', rank: 3 },
]

const SHIPPING_CHARGE = /^SHIPPINGCHARGE-\d+$/i
const REPAIR = /^REPAIR-\d+$/i

export interface ContinentalOrder {
  orderNo: string
  buyerFullname: string
  addr1: string
  addr2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  salesRecordNumber: string | number
  productType: string
  cost: number | null
  serviceType: string
  quantity: number
  sku: string
  hsCode: string
  countryOfOrigin: string
  insuredValue: number | null
  weight: number
  warnings: string[]
}

export interface ConversionResult {
  orders: ContinentalOrder[]
  /** Problems not tied to a single output row (e.g. an order that was skipped). */
  warnings: string[]
  sourceRowCount: number
}

/** Decode upload bytes: ECang exports UTF-8 with BOM; fall back to GB18030 just in case. */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('gb18030').decode(bytes)
  }
}

/** Strip the tab / whitespace ECang prefixes to force text in Excel. */
function clean(v: string | undefined): string {
  return (v ?? '').replace(/^[\s\t]+|[\s\t]+$/g, '')
}

export function parseEcangCsv(text: string): EcangRow[] {
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })

  // The report metadata block above the header varies in length — find the header by its first cell.
  const headerIdx = data.findIndex(r => clean(r[0]) === SRC.orderNo)
  if (headerIdx < 0) {
    throw new Error('Could not find the header row (订单号). Is this the ECang "Continental Label" export?')
  }
  const header = data[headerIdx].map(clean)

  const colIdx = {} as Record<SrcKey, number>
  const missing: string[] = []
  for (const key of Object.keys(SRC) as SrcKey[]) {
    const idx = header.indexOf(SRC[key])
    if (idx < 0 && key !== 'addr2' && key !== 'state') missing.push(SRC[key])
    colIdx[key] = idx
  }
  if (missing.length) throw new Error(`Missing columns in CSV: ${missing.join(', ')}`)

  const rows: EcangRow[] = []
  for (const r of data.slice(headerIdx + 1)) {
    // Data ends at the first blank row; the field-description block follows it.
    if (!r.some(c => clean(c))) break
    const row = {} as EcangRow
    for (const key of Object.keys(SRC) as SrcKey[]) {
      row[key] = colIdx[key] >= 0 ? (r[colIdx[key]] ?? '') : ''
    }
    rows.push(row)
  }
  return rows
}

function parseDeclaredName(raw: string): { category: Category | null; text: string; hsCode: string } {
  const [before] = raw.split(/HS\s*#/i)
  const text = clean(before)
  const hsCode = raw.match(/HS\s*#\s*(\d{6,14})/i)?.[1] ?? ''
  const found = CATEGORIES.find(c => c.match.test(text))
  return { category: found ? { label: found.label, origin: found.origin, rank: found.rank } : null, text, hsCode }
}

function parseUsdAmount(remark: string): number | null {
  const m = remark.match(/USD\s*([\d,]+(?:\.\d+)?)/i)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

/** Pure digits without a leading zero go in as numbers (matches the hand-made uploads). */
function toRecordNumber(v: string): string | number {
  return /^[1-9]\d{0,14}$/.test(v) ? Number(v) : v
}

export function convertToContinental(rows: EcangRow[]): ConversionResult {
  const groups = new Map<string, EcangRow[]>()
  for (const row of rows) {
    const key = clean(row.orderNo)
    if (!key) continue
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const orders: ContinentalOrder[] = []
  const warnings: string[] = []

  for (const orderNo of [...groups.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const group = groups.get(orderNo)!
    const orderWarnings: string[] = []
    const first = group[0]

    const items = group.filter(r => !SHIPPING_CHARGE.test(clean(r.sku)))
    if (items.length === 0) {
      warnings.push(`${orderNo}: only a shipping-charge line — order skipped`)
      continue
    }

    const skus = items.map(r => clean(r.sku)).filter(Boolean)
    const repairSkus = skus.filter(s => REPAIR.test(s))
    const productItems = items.filter(r => !REPAIR.test(clean(r.sku)))

    // Pick the item that decides product type / HS code / origin.
    const candidates = (productItems.length ? productItems : items).map(r => parseDeclaredName(r.declaredName))
    const winner = candidates.reduce((best, c) =>
      (c.category?.rank ?? 99) < (best.category?.rank ?? 99) ? c : best
    )
    for (const c of candidates) {
      if (!c.category) orderWarnings.push(`Unknown product type "${c.text}"`)
    }
    if (!winner.hsCode) orderWarnings.push('No HS code found')

    const amounts = [...new Set(group.map(r => parseUsdAmount(r.remark)))]
    const cost = amounts[0]
    if (cost === null) orderWarnings.push('No USD amount in remark')
    if (amounts.length > 1) orderWarnings.push(`Rows disagree on USD amount (${amounts.join(' / ')})`)

    const zip = clean(first.zip)
    const phone = clean(first.phone)
    if (!zip) orderWarnings.push('Missing postcode')

    orders.push({
      orderNo,
      buyerFullname: first.name,
      addr1: first.addr1,
      addr2: first.addr2,
      city: first.city,
      state: first.state,
      zip,
      country: clean(first.country),
      phone,
      salesRecordNumber: toRecordNumber(clean(first.reference)),
      productType: winner.category?.label ?? winner.text,
      cost,
      serviceType: clean(first.service),
      quantity: 1,
      sku: (repairSkus.length ? repairSkus : skus).join(' + '),
      hsCode: winner.hsCode,
      countryOfOrigin: winner.category?.origin ?? '',
      insuredValue: cost,
      weight: 100,
      warnings: [...new Set(orderWarnings)],
    })
  }

  return { orders, warnings, sourceRowCount: rows.length }
}

const OUTPUT_HEADERS = [
  'buyer_fullname*', 'buyer_addr1*', 'buyer_addr2', 'buyer_city*', 'buyer_state', 'buyer_zip*',
  'buyer_country*', 'buyer_phone', 'sales_record_number*', 'product_type*', 'cost*', 'service_type*',
  'quantity*', 'sku', 'hs_code*', 'country_of_origin*', 'insured_value', 'weight(g)', 'length(cm)',
  'width(cm)', 'height(cm)', 'tracking_number', 'remarks',
]

/** Build the upload workbook in the same shape as Continental's template (sheets "order" + "HS code"). */
export async function buildContinentalWorkbook(orders: ContinentalOrder[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('order')
  ws.addRow(OUTPUT_HEADERS)

  // Text-formatted columns: zip (F), phone (H), hs_code (O).
  for (const col of ['F', 'H', 'O']) ws.getColumn(col).numFmt = '@'

  for (const o of orders) {
    ws.addRow([
      o.buyerFullname, o.addr1, o.addr2 || null, o.city, o.state || null, o.zip,
      o.country, o.phone || null, o.salesRecordNumber, o.productType, o.cost, o.serviceType,
      o.quantity, o.sku, o.hsCode, o.countryOfOrigin, o.insuredValue, o.weight,
    ])
  }

  const widths = [26, 34, 22, 20, 12, 12, 14, 18, 22, 20, 10, 12, 10, 34, 12, 18, 12, 10, 11, 11, 11, 16, 12]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const hs = wb.addWorksheet('HS code')
  hs.getCell('A1').value = 'Mobile Telephone HS#85171200'
  hs.getCell('B1').value = 85171200
  hs.getCell('A4').value = 'Continental - Colissimo'
  hs.getCell('B4').value = 'CORI'
  hs.getCell('A5').value = 'Continental - Courier Service'
  hs.getCell('B5').value = 'FRCU'
  hs.getColumn('A').width = 30

  return Buffer.from(await wb.xlsx.writeBuffer())
}
