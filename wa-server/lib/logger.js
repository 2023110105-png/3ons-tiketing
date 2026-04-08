function log(level, message, meta = {}) {
  const payload = {
    level: String(level || 'info').toLowerCase(),
    message: String(message || ''),
    time: new Date().toISOString(),
    ...meta
  };
  const line = JSON.stringify(payload);
  if (payload.level === 'error' || payload.level === 'warn') {
    console.error(line);
    return;
  }
  console.log(line);
}

function shortId(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= 8) return text;
  return `${text.slice(0, 8)}...`;
}

function toTenantLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
}

function formatPathForOperator(req, rawPath) {
  const pathText = String(rawPath || '').trim();
  if (!pathText) return '-';
  try {
    const parsed = new URL(pathText, 'http://localhost');
    const tenantId = parsed.searchParams.get('tenant_id');
    const tenantBrand = parsed.searchParams.get('tenant_brand')
      || req?.headers?.['x-tenant-brand']
      || req?.body?.tenant_brand
      || '';
    const tenantLabel = toTenantLabel(tenantBrand);

    if (tenantId) {
      parsed.searchParams.delete('tenant_id');
      parsed.searchParams.set('tenant', tenantLabel || shortId(tenantId));
    } else if (tenantLabel) {
      parsed.searchParams.set('tenant', tenantLabel);
    }

    parsed.searchParams.delete('tenant_brand');
    const qs = parsed.searchParams.toString();
    return `${parsed.pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return pathText.replace(/tenant_id=([^&]+)/i, (_match, value) => `tenant=${shortId(value)}`);
  }
}

function requestLog(req, message, meta = {}, level = 'info') {
  const payload = {
    request_id: req?._requestId || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.url || null,
    ...meta
  };

  // Operator-friendly line for high-volume HTTP request logs.
  if (message === 'request_finished') {
    const time = new Date().toISOString();
    const method = String(payload.method || '-').toUpperCase();
    const path = formatPathForOperator(req, payload.path);
    const status = payload.status ?? '-';
    const elapsed = payload.elapsed_ms ?? '-';
    const rid = shortId(payload.request_id);
    const line = `[REQ] ${time} ${method} ${path} -> ${status} (${elapsed}ms) rid=${rid}`;
    if (String(level).toLowerCase() === 'error' || Number(status) >= 500) {
      console.error(line);
    } else {
      console.log(line);
    }
    return;
  }

  return log(level, message, payload);
}

module.exports = {
  log,
  requestLog
};
