const crypto = require('crypto');

function buildLegacySignature({ tenantId, eventId, ticketId, dayNumber }) {
  return Buffer.from(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|event-2026`).toString('base64');
}

function buildSecureSignatureLegacy({ tenantId, eventId, ticketId, dayNumber, secureCode, secureRef }) {
  return Buffer.from(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|${secureCode}|${secureRef}|event-secure-v3`).toString('base64');
}

function buildHmacSignature(payload, signingSecret) {
  const normalized = String(payload || '').trim();
  const secret = String(signingSecret || '').trim();
  if (!normalized || !secret) return '';
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

function buildV3Payload({ tenantId, eventId, ticketId, dayNumber, secureCode, secureRef }) {
  return `${tenantId}|${eventId}|${ticketId}|${dayNumber}|${secureCode}|${secureRef}|event-secure-v4`;
}

function buildLegacyPayload({ tenantId, eventId, ticketId, dayNumber }) {
  return `${tenantId}|${eventId}|${ticketId}|${dayNumber}|event-v2-legacy`;
}

module.exports = {
  buildLegacySignature,
  buildSecureSignatureLegacy,
  buildHmacSignature,
  buildV3Payload,
  buildLegacyPayload
};
