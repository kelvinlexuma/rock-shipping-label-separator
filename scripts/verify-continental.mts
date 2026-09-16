// Run: npx tsx scripts/verify-continental.mts
// Converts the real ECang samples and diffs them cell-by-cell against the hand-made uploads.
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { decodeCsv, parseEcangCsv, convertToContinental, buildContinentalWorkbook } from '../lib/continental'

const DIR = '..'
const CASES = [
  ['2026-09-11+Continental+adress+label+data+(Ecang)+-+Original.csv', 'Upload+to+Continental+2026-09-11.xlsx'],
  ['[Step 1] Continental+orders+address.csv', '[Step 4] Upload+to+Continental.xlsx'],
]

let failures = 0
for (const [csv, expectedXlsx] of CASES) {
  console.log(`\n=== ${csv}`)
  const result = convertToContinental(parseEcangCsv(decodeCsv(readFileSync(`${DIR}/${csv}`))))
  for (const o of result.orders) if (o.warnings.length) console.log(`  warn ${o.orderNo}: ${o.warnings.join('; ')}`)
  for (const w of result.warnings) console.log(`  warn: ${w}`)

  const actual = new ExcelJS.Workbook()
  await actual.xlsx.load((await buildContinentalWorkbook(result.orders)) as unknown as ArrayBuffer)
  const expected = new ExcelJS.Workbook()
  await expected.xlsx.readFile(`${DIR}/${expectedXlsx}`)
  const a = actual.getWorksheet('order')!, e = expected.getWorksheet('order')!

  const rows = Math.max(a.rowCount, e.rowCount)
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= 23; c++) {
      const av = a.getRow(r).getCell(c).value ?? null
      const ev = e.getRow(r).getCell(c).value ?? null
      if (av !== ev) {
        failures++
        console.log(`  DIFF ${a.getRow(r).getCell(c).address}: got ${JSON.stringify(av)} expected ${JSON.stringify(ev)}`)
      }
    }
  }
  console.log(`  ${result.orders.length} orders from ${result.sourceRowCount} source rows`)
}
console.log(`\n${failures} differing cells`)
