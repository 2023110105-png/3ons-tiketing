// QR Security Helper - Universal untuk Frontend dan Backend
// Menyediakan format QR data yang konsisten di seluruh sistem

/**
 * Build QR payload data yang konsisten
 * Format: { tid, t, e, d, sig, v }
 * NOTE: Signature is DETERMINISTIC - same input = same signature
 * This ensures QR code never changes for the same ticket
 */
export function buildQRPayload({ ticketId, tenantId, eventId, dayNumber, name = '' }) {
  const tid = String(ticketId || '').trim();
  const t = String(tenantId || 'tenant-default').trim();
  const e = String(eventId || 'event-default').trim();
  const d = Number(dayNumber) || 1;
  const n = String(name || '').trim();
  
  // Build DETERMINISTIC signature - no timestamp, no random values
  // Same ticket_id + tenant + event + day = same signature always
  const payloadString = `${t}|${e}|${tid}|${d}|event-2026`;
  // Browser only - btoa is available in all modern browsers
  const sig = btoa(payloadString);
  
  return {
    tid,
    t,
    e,
    d,
    n,
    sig,  // This will be identical for same ticket every time
    v: 2
  };
}

/**
 * Generate QR data string (JSON) yang konsisten
 */
export function generateQRData(participant, tenantId = 'tenant-default', eventId = 'event-default') {
  if (!participant) return null;
  
  const payload = buildQRPayload({
    ticketId: participant.ticket_id || participant.id,
    tenantId,
    eventId,
    dayNumber: participant.day_number || participant.day || 1,
    name: participant.name
  });
  
  return JSON.stringify(payload);
}

/**
 * Parse QR data dari string
 */
export function parseQRData(qrString) {
  if (!qrString) return null;
  
  try {
    const parsed = JSON.parse(qrString);
    return {
      ticketId: String(parsed.tid || '').trim(),
      tenantId: String(parsed.t || '').trim(),
      eventId: String(parsed.e || '').trim(),
      dayNumber: Number(parsed.d) || 1,
      name: String(parsed.n || '').trim(),
      signature: String(parsed.sig || '').trim(),
      version: Number(parsed.v) || 1,
      secureRef: String(parsed.r || '').trim()
    };
  } catch {
    // Fallback: coba parse format key:value
    const parsed = {};
    String(qrString).split(';').forEach(pair => {
      const [k, ...rest] = pair.split(':');
      if (k && rest.length) parsed[k.trim()] = rest.join(':').trim();
    });
    
    return {
      ticketId: String(parsed.tid || '').trim(),
      tenantId: String(parsed.t || '').trim(),
      eventId: String(parsed.e || '').trim(),
      dayNumber: Number(parsed.d) || 1,
      name: String(parsed.n || '').trim(),
      signature: String(parsed.sig || '').trim(),
      version: Number(parsed.v) || 1,
      secureRef: String(parsed.r || '').trim()
    };
  }
}

/**
 * Verify QR signature
 */
export function verifyQRSignature({ tenantId, eventId, ticketId, dayNumber, signature }) {
  if (!signature) return false;
  
  const expectedPayload = `${tenantId}|${eventId}|${ticketId}|${dayNumber}|event-2026`;
  const expectedSig = btoa(expectedPayload);
  
  return signature === expectedSig;
}

/**
 * Normalize QR data untuk kirim via WA (format outgoing)
 */
export function normalizeOutgoingQR(qrString, fallback = {}) {
  const parsed = parseQRData(qrString);
  if (!parsed || !parsed.ticketId || !parsed.tenantId || !parsed.eventId) {
    return { ok: false, value: '', reason: 'invalid_qr_payload' };
  }
  
  // Verify signature
  const isValid = verifyQRSignature({
    tenantId: parsed.tenantId,
    eventId: parsed.eventId,
    ticketId: parsed.ticketId,
    dayNumber: parsed.dayNumber,
    signature: parsed.signature
  });
  
  if (!isValid) {
    return { ok: false, value: '', reason: 'invalid_signature' };
  }
  
  const payload = {
    tid: parsed.ticketId,
    n: parsed.name || String(fallback?.name || '').trim(),
    d: parsed.dayNumber,
    t: parsed.tenantId,
    e: parsed.eventId,
    r: parsed.secureRef || '',
    sig: parsed.signature,
    v: parsed.version || 2
  };
  
  return {
    ok: true,
    value: JSON.stringify(payload),
    ticketId: parsed.ticketId,
    tenantId: parsed.tenantId,
    eventId: parsed.eventId,
    dayNumber: parsed.dayNumber
  };
}
