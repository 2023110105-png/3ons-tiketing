const crypto = require('crypto')
let Jimp = null
let jsQR = null
let buildTicketQrImageNode = null
try {
  Jimp = require('jimp')
  jsQR = require('jsqr')
  // eslint-disable-next-line global-require
  ;({ buildTicketQrImageNode } = require('../ticket-image-jimp'))
} catch (err) {
  void err
}

function b64(value) {
  return Buffer.from(String(value)).toString('base64')
}

function buildSecureSignature({ tenantId, eventId, ticketId, dayNumber, secureCode, secureRef }) {
  return b64(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|${secureCode}|${secureRef}|event-secure-v3`)
}

function buildLegacySignature({ tenantId, eventId, ticketId, dayNumber }) {
  return b64(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|event-2026`)
}

function encodeQrPayload({ ticketId, name, dayNumber, tenantId, eventId, secureCode, secureRef }) {
  return JSON.stringify({
    tid: ticketId,
    n: name,
    d: dayNumber,
    t: tenantId,
    e: eventId,
    r: secureRef,
    sig: buildSecureSignature({ tenantId, eventId, ticketId, dayNumber, secureCode, secureRef }),
    v: 3
  })
}

function parseQr(rawQr) {
  const parsed = JSON.parse(String(rawQr || '{}'))
  return {
    ticketId: String(parsed.tid || ''),
    tenantId: String(parsed.t || ''),
    eventId: String(parsed.e || ''),
    dayNumber: Number(parsed.d),
    signature: String(parsed.sig || ''),
    secureRef: String(parsed.r || ''),
    version: Number(parsed.v || 1)
  }
}

function verifyServerCompat({ qrData, secureCode, secureRef }) {
  const qr = parseQr(qrData)
  if (!qr.ticketId || !qr.tenantId || !qr.eventId || !qr.signature || !Number.isFinite(qr.dayNumber)) {
    return { valid: false, reason: 'invalid_payload' }
  }

  const expectedLegacy = buildLegacySignature({
    tenantId: qr.tenantId,
    eventId: qr.eventId,
    ticketId: qr.ticketId,
    dayNumber: qr.dayNumber
  })
  const validLegacy = expectedLegacy === qr.signature

  if (qr.version >= 3 || qr.secureRef) {
    if (!secureCode || !secureRef || secureRef !== qr.secureRef) {
      if (validLegacy) return { valid: true, reason: 'ok_legacy_compat' }
      return { valid: false, reason: 'missing_secure_token' }
    }
    const expected = buildSecureSignature({
      tenantId: qr.tenantId,
      eventId: qr.eventId,
      ticketId: qr.ticketId,
      dayNumber: qr.dayNumber,
      secureCode,
      secureRef
    })
    if (expected === qr.signature) return { valid: true, reason: 'ok' }
    if (validLegacy) return { valid: true, reason: 'ok_legacy_compat' }
    return { valid: false, reason: 'invalid_signature' }
  }
  return { valid: validLegacy, reason: validLegacy ? 'ok' : 'invalid_signature' }
}

function token(len) {
  return crypto.randomBytes(len).toString('hex').slice(0, len)
}

async function decodeQrFromRenderedTicket(qrPayload, participant) {
  if (!Jimp || !jsQR || !buildTicketQrImageNode) return { ok: false, reason: 'render_modules_unavailable' }
  const imageBuffer = await buildTicketQrImageNode(participant, {})
  const image = await Jimp.read(imageBuffer)
  const imageData = {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height
  }
  const code = jsQR(imageData.data, imageData.width, imageData.height)
  if (!code || !code.data) return { ok: false, reason: 'decode_failed' }
  if (String(code.data) !== String(qrPayload)) return { ok: false, reason: 'decoded_payload_mismatch' }
  return { ok: true }
}

async function runStressQrCheck({ total = 1000, renderSample = 150, tenantId = 'tenant-default', eventId = 'event-main' } = {}) {

  let verifyPass = 0
  let verifyFail = 0
  const verifyFailures = []

  let decodePass = 0
  let decodeFail = 0
  const decodeFailures = []

  const participants = []

  for (let i = 0; i < total; i += 1) {
    const dayNumber = (i % 3) + 1
    const ticketId = `EVEN-D${dayNumber}-${String(i + 1).padStart(4, '0')}`
    const secureCode = token(24)
    const secureRef = token(14)
    const name = `Peserta-${i + 1}`
    const qrData = encodeQrPayload({ ticketId, name, dayNumber, tenantId, eventId, secureCode, secureRef })
    participants.push({ ticketId, secureCode, secureRef, qrData, dayNumber, name })
  }

  for (const p of participants) {
    const v = verifyServerCompat({ qrData: p.qrData, secureCode: p.secureCode, secureRef: p.secureRef })
    if (v.valid) verifyPass += 1
    else {
      verifyFail += 1
      if (verifyFailures.length < 10) verifyFailures.push({ ticketId: p.ticketId, reason: v.reason })
    }
  }

  const canRunRenderDecode = !!(Jimp && jsQR && buildTicketQrImageNode)
  const sampleSize = canRunRenderDecode ? Math.min(renderSample, participants.length) : 0
  if (canRunRenderDecode) {
    for (let i = 0; i < sampleSize; i += 1) {
      const p = participants[i]
      const participant = {
        name: p.name,
        ticket_id: p.ticketId,
        category: i % 4 === 0 ? 'VIP' : 'Regular',
        day_number: p.dayNumber,
        qr_data: p.qrData
      }
      // eslint-disable-next-line no-await-in-loop
      const d = await decodeQrFromRenderedTicket(p.qrData, participant)
      if (d.ok) decodePass += 1
      else {
        decodeFail += 1
        if (decodeFailures.length < 10) decodeFailures.push({ ticketId: p.ticketId, reason: d.reason })
      }
    }
  }

  const summary = {
    total,
    tenantId,
    eventId,
    serverVerify: {
      pass: verifyPass,
      fail: verifyFail,
      failureSamples: verifyFailures
    },
    renderDecode: {
      enabled: canRunRenderDecode,
      sampleSize,
      pass: decodePass,
      fail: decodeFail,
      failureSamples: decodeFailures
    },
    ok: verifyFail === 0 && (!canRunRenderDecode || decodeFail === 0)
  }
  return summary
}

module.exports = { runStressQrCheck }

if (require.main === module) {
  runStressQrCheck({
    total: Number(process.argv[2] || 1000),
    renderSample: Number(process.argv[3] || 150)
  })
    .then((summary) => {
      console.log('=== STRESS QR CHECK RESULT ===')
      console.log(`Total tickets generated       : ${summary.total}`)
      console.log(`Server verify pass/fail       : ${summary.serverVerify.pass}/${summary.serverVerify.fail}`)
      console.log(`Rendered decode sample size   : ${summary.renderDecode.sampleSize}`)
      console.log(`Rendered decode pass/fail     : ${summary.renderDecode.pass}/${summary.renderDecode.fail}`)
      if (!summary.renderDecode.enabled) {
        console.log('Rendered decode status        : SKIPPED (jimp/jsqr modules unavailable in current environment)')
      }
      if (summary.serverVerify.failureSamples.length > 0) {
        console.log('Verify failure samples:')
        summary.serverVerify.failureSamples.forEach(f => console.log(`- ${f.ticketId}: ${f.reason}`))
      }
      if (summary.renderDecode.failureSamples.length > 0) {
        console.log('Decode failure samples:')
        summary.renderDecode.failureSamples.forEach(f => console.log(`- ${f.ticketId}: ${f.reason}`))
      }
      if (!summary.ok) process.exitCode = 1
    })
    .catch((err) => {
      console.error('Stress test crashed:', err)
      process.exit(1)
    })
}

