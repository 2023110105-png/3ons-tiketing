#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'
import XLSX from 'xlsx'
import { randomUUID } from 'crypto'

// Minimal DOM + storage + crypto stubs for mockData to run in Node
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document
try { if (typeof global.navigator === 'undefined') global.navigator = dom.window.navigator } catch (e) {}
try { if (typeof global.localStorage === 'undefined') global.localStorage = dom.window.localStorage } catch (e) {}
try { if (typeof global.sessionStorage === 'undefined') global.sessionStorage = dom.window.sessionStorage } catch (e) {}
try { if (typeof global.CustomEvent === 'undefined') global.CustomEvent = dom.window.CustomEvent } catch (e) {}
try { if (typeof global.Event === 'undefined') global.Event = dom.window.Event } catch (e) {}
try { if (typeof global.location === 'undefined') global.location = dom.window.location } catch (e) {}
global.fetch = (...args) => {
  console.warn('stubbed fetch called', args[0])
  return Promise.resolve({ ok: false, status: 0, json: async () => ({}) })
}
try {
  if (typeof global.crypto === 'undefined') global.crypto = { randomUUID }
} catch (e) {}

const target = process.argv[2] || 'import_day2.csv'
const filePath = path.resolve(process.cwd(), target)
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath)
  process.exit(1)
}

try {
  const workbook = XLSX.readFile(filePath, { raw: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, blankrows: false })

  // Basic sanitize like UI does
  const rows = rawRows.map((r) => {
    const out = {}
    Object.entries(r).forEach(([k, v]) => {
      const key = String(k || '').replace(/^\uFEFF/, '').trim()
      if (!key) return
      if (key.startsWith('__')) return
      out[key] = v
    })
    return out
  })

  console.log('[IMPORT DEBUG] Data rows yang akan diimport (sample):', rows.slice(0, 10))

  const { bulkAddParticipants, getParticipants } = await import('../src/store/mockData.js')

  // Detect fallback day from first row if present, otherwise let bulkAddParticipants use fallbackDay param
  const detectedDay = (rows[0] && (rows[0].hari || rows[0].day || rows[0].day_number)) ? Number(String(rows[0].hari || rows[0].day || rows[0].day_number).trim()) || 1 : 1

  const result = bulkAddParticipants(rows, detectedDay, 'cli-import', { duplicatesPolicy: 'add', matchBy: 'phone' })

  console.log('[IMPORT DEBUG] Hasil bulkAddParticipants:', result)
  console.log('Summary: added=%d updated=%d skipped=%d errors=%d', result.added?.length || 0, result.updated?.length || 0, result.skipped?.length || 0, result.errors?.length || 0)

  const participants = getParticipants(detectedDay) || []
  console.log('Participants for day', detectedDay, 'count', participants.length)
  console.log(participants.slice(0, 5))

  // Persist store snapshot to disk so it can be injected into browser localStorage if needed
  try {
    const persisted = (global.localStorage && global.localStorage.getItem('ons_event_data')) || null
    if (persisted) {
      const outPath = path.resolve(process.cwd(), `import_day${detectedDay}_store.json`)
      fs.writeFileSync(outPath, persisted)
      console.log('Wrote store snapshot to', outPath)
      // Also print persisted JSON boundaries so caller can capture it
      console.log('---STORE_JSON_START---')
      console.log(persisted)
      console.log('---STORE_JSON_END---')
    }
  } catch (e) {
    // ignore
  }

  process.exit(0)
} catch (err) {
  console.error('Import failed:', err)
  process.exit(2)
}
