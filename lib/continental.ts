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
 *   Digital Camera / Camcorder > Mobile Telephone > Lens > Camera accessories
 * - non-standard product types fall back by group: camera/lens → JP, phone → VN,
 *   accessories → CN; Insta360 / GoPro cameras → CN
 * - Continental's field limits (template row 2) are checked; an over-long
 *   address line 1 spills into line 2 at a word boundary when it fits
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
  productName: '产品英文名称',
} as const

type SrcKey = keyof typeof SRC
const OPTIONAL_COLUMNS: SrcKey[] = ['addr2', 'state', 'productName']
export type EcangRow = Record<SrcKey, string>

interface Category {
  label: string
  origin: string
  rank: number
}

// Lower rank wins when an order mixes item types.
const CATEGORIES: Array<{ match: RegExp } & Category> = [
  { match: /^digital\s*camera$/i, label: 'Digital Camera', origin: 'JP', rank: 0 },
  { match: /^camcorders?$/i, label: 'Camcorder', origin: 'JP', rank: 0 },
  { match: /^mobile\s*tele?phone$/i, label: 'Mobile Telephone', origin: 'VN', rank: 1 },
  { match: /^(camera\s*)?lens$/i, label: 'Camera Lens', origin: 'JP', rank: 2 },
  { match: /^camera\s*accessories$/i, label: 'Camera accessories', origin: 'CN', rank: 3 },
]

// Non-standard types: classified by keyword, product_type keeps ECang's wording.
// Accessories are tested first so "Camera accessories"-like names don't match "camera".
const FALLBACKS: Array<{ match: RegExp; group: string; origin: string; rank: number }> = [
  { match: /accessor|battery|charger|adapter|grip|cable|strap|filter|tripod|mount|bag|case|memory\s*card/i, group: 'accessories', origin: 'CN', rank: 3 },
  { match: /phone|mobile|smartphone/i, group: 'phone', origin: 'VN', rank: 1 },
  { match: /lens/i, group: 'lens', origin: 'JP', rank: 2 },
  { match: /camera|camcorder|video/i, group: 'camera', origin: 'JP', rank: 0 },
]

// Brands whose cameras are declared as made in China (client rule 2026-09-17).
const CN_CAMERA_BRANDS = /insta\s*360|\binsta\b|gopro/i

// Continental's limits, from row 2 of their upload template.
const LIMITS = {
  buyerFullname: 100, addr1: 40, addr2: 40, city: 60, state: 50, zip: 30,
  phone: 50, salesRecordNumber: 50, productType: 100, sku: 50,
} as const

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
    if (idx < 0 && !OPTIONAL_COLUMNS.includes(key)) missing.push(SRC[key])
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

interface ParsedItem {
  category: Category | null
  text: string
  hsCode: string
  /** Set when a non-standard type was classified by keyword — shown to staff. */
  note?: string
}

function parseItem(row: EcangRow): ParsedItem {
  const raw = row.declaredName
  const [before] = raw.split(/HS\s*#/i)
  const text = clean(before)
  const hsCode = raw.match(/HS\s*#\s*(\d{6,14})/i)?.[1] ?? ''

  let category: Category | null = null
  let note: string | undefined
  const known = CATEGORIES.find(c => c.match.test(text))
  if (known) {
    category = { label: known.label, origin: known.origin, rank: known.rank }
  } else {
    const fb = FALLBACKS.find(f => f.match.test(text))
    if (fb) {
      category = { label: text, origin: fb.origin, rank: fb.rank }
      note = `Non-standard type "${text}" treated as ${fb.group} (${fb.origin})`
    }
  }

  // Insta360 / GoPro cameras are CN, whatever the declared camera type.
  if (category && category.rank === 0 && CN_CAMERA_BRANDS.test(`${row.sku} ${row.productName}`)) {
    category = { ...category, origin: 'CN' }
  }
  return { category, text, hsCode, note }
}

/** Move the overflow of address line 1 to the front of line 2, split at a word boundary. */
function fitAddress(addr1: string, addr2: string): { addr1: string; addr2: string; moved: boolean } {
  if (addr1.trim().length <= LIMITS.addr1) return { addr1, addr2, moved: false }
  const text = addr1.trim()
  const cut = text.lastIndexOf(' ', LIMITS.addr1)
  if (cut <= 0) return { addr1, addr2, moved: false }
  const head = text.slice(0, cut).trimEnd()
  const newAddr2 = [text.slice(cut + 1).trim(), addr2.trim()].filter(Boolean).join(' ')
  if (newAddr2.length > LIMITS.addr2) return { addr1, addr2, moved: false }
  return { addr1: head, addr2: newAddr2, moved: true }
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
    const candidates = (productItems.length ? productItems : items).map(parseItem)
    const winner = candidates.reduce((best, c) =>
      (c.category?.rank ?? 99) < (best.category?.rank ?? 99) ? c : best
    )
    for (const c of candidates) {
      if (!c.category) orderWarnings.push(`Unknown product type "${c.text}" — no country of origin`)
      else if (c.note) orderWarnings.push(c.note)
    }
    if (!winner.hsCode) orderWarnings.push('No HS code found')

    const amounts = [...new Set(group.map(r => parseUsdAmount(r.remark)))]
    const cost = amounts[0]
    if (cost === null) orderWarnings.push('No USD amount in remark')
    if (amounts.length > 1) orderWarnings.push(`Rows disagree on USD amount (${amounts.join(' / ')})`)

    const zip = clean(first.zip)
    const phone = clean(first.phone)
    if (!zip) orderWarnings.push('Missing postcode')

    const address = fitAddress(first.addr1, first.addr2)
    if (address.moved) orderWarnings.push(`Address line 1 over ${LIMITS.addr1} chars — overflow moved to line 2`)

    const order: ContinentalOrder = {
      orderNo,
      buyerFullname: first.name,
      addr1: address.addr1,
      addr2: address.addr2,
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
      warnings: [],
    }

    for (const [field, max] of Object.entries(LIMITS) as Array<[keyof typeof LIMITS, number]>) {
      const len = String(order[field]).trim().length
      if (len > max) orderWarnings.push(`${FIELD_NAMES[field]} is ${len} chars (Continental max ${max})`)
    }
    if (order.hsCode && (order.hsCode.length < 6 || order.hsCode.length > 14)) {
      orderWarnings.push('HS code must be 6–14 characters')
    }

    order.warnings = [...new Set(orderWarnings)]
    orders.push(order)
  }

  return { orders, warnings, sourceRowCount: rows.length }
}

const FIELD_NAMES: Record<keyof typeof LIMITS, string> = {
  buyerFullname: 'buyer_fullname', addr1: 'buyer_addr1', addr2: 'buyer_addr2', city: 'buyer_city',
  state: 'buyer_state', zip: 'buyer_zip', phone: 'buyer_phone', salesRecordNumber: 'sales_record_number',
  productType: 'product_type', sku: 'sku',
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
