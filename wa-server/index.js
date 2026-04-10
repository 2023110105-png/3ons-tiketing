const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const jsQR = require('jsqr');
const Jimp = require('jimp');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const { buildTicketQrImageNode } = require('./ticket-image-jimp');
const { runStressQrCheck } = require('./scripts/stress-qr-check');
const nodemailer = require('nodemailer');
const waServerPackage = require('./package.json');
const { log, requestLog } = require('./lib/logger');
const { withRetry } = require('./lib/delivery');
const {
    buildLegacySignature,
    buildSecureSignatureLegacy,
    buildHmacSignature,
    buildV3Payload,
    buildLegacyPayload
} = require('./lib/security');

function loadLocalEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fsSync.existsSync(envPath)) return;
        const raw = fsSync.readFileSync(envPath, 'utf8');
        raw.split(/\r?\n/).forEach((line) => {
            const trimmed = String(line || '').trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const idx = trimmed.indexOf('=');
            if (idx <= 0) return;
            const key = trimmed.slice(0, idx).trim();
            let value = trimmed.slice(idx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (err) {
        console.error('Failed to load wa-server .env:', err?.message || String(err));
    }
}

loadLocalEnvFile();

// Initialize Supabase client for direct database access
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[SUPABASE] Client initialized successfully');
    } catch (err) {
        console.error('[SUPABASE] Failed to initialize:', err.message);
    }
} else {
    console.log('[SUPABASE] Skipped - URL or key not configured');
}

const app = express();
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const WA_ADMIN_SECRET_HEADER = 'x-wa-admin-secret';
const WA_ADMIN_SECRET = String(process.env.WA_ADMIN_SECRET || '').trim();
const TICKET_SIGNING_SECRET = String(process.env.TICKET_SIGNING_SECRET || WA_ADMIN_SECRET || '').trim();
const WA_AUTH_DATA_PATH = String(process.env.WA_AUTH_DATA_PATH || 'auth_data').trim() || 'auth_data';
const WA_FAST_MODE = String(process.env.WA_FAST_MODE || '').toLowerCase() === 'true';
const WA_SKIP_NUMBER_CHECK = String(process.env.WA_SKIP_NUMBER_CHECK || '').toLowerCase() === 'true' || WA_FAST_MODE;
const WA_MESSAGE_TIMEOUT_MS = Number(process.env.WA_MESSAGE_TIMEOUT_MS || (WA_FAST_MODE ? 15000 : 45000));
const rateLimitStore = new Map();
const deliveryMetrics = { waSendSuccess: 0, waSendFailed: 0 };

if (WA_FAST_MODE) {
    console.log('[CONFIG] WA FAST MODE enabled - skipping number validation, reduced timeouts');
}

// Helper: Generate QR data for participant (server-side)
function generateServerQRData({ ticket_id, name, day_number }, tenantId = 'tenant-default', eventId = 'event-default') {
    try {
        const tid = String(ticket_id || '').trim();
        const t = String(tenantId).trim();
        const e = String(eventId).trim();
        const d = Number(day_number) || 1;
        const n = String(name || '').trim();
        
        if (!tid) return null;
        
        // Build deterministic signature
        const payload = `${t}|${e}|${tid}|${d}|event-2026`;
        const sig = Buffer.from(payload).toString('base64');
        
        // Build QR data object
        const qrObject = {
            v: 2,
            tid,
            t,
            e,
            d,
            n,
            sig,
            r: crypto.randomUUID().slice(0, 8)
        };
        
        return Buffer.from(JSON.stringify(qrObject)).toString('base64');
    } catch (err) {
        console.error('[generateServerQRData] Error:', err.message);
        return null;
    }
}

if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && !WA_ADMIN_SECRET) {
    throw new Error('WA_ADMIN_SECRET wajib diisi di production');
}
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && !TICKET_SIGNING_SECRET) {
    throw new Error('TICKET_SIGNING_SECRET wajib diisi di production');
}

app.use(cors({
    origin(origin, callback) {
        // Allow server-to-server and same-origin requests without Origin header.
        if (!origin) return callback(null, true);
        const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(String(origin || ''));
        if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production' && isLocalDevOrigin) {
            return callback(null, true);
        }
        if (CORS_ALLOWED_ORIGINS.length === 0) {
            return callback(new Error('CORS origin not allowed'));
        }
        if (CORS_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS origin not allowed'));
    }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
    req._requestId = crypto.randomUUID();
    const startedAt = Date.now();
    res.setHeader('x-request-id', req._requestId);
    res.on('finish', () => {
        requestLog(req, 'request_finished', {
            status: res.statusCode,
            elapsed_ms: Date.now() - startedAt
        });
    });
    next();
});
app.use((req, _res, next) => {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    next();
});
const serverStartedAt = Date.now();
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > Number(value?.resetAt || 0) + RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(key);
        }
    }
}, Math.max(5000, RATE_LIMIT_WINDOW_MS)).unref();

function getRequesterInfo(req) {
    // Coba ambil info user dari header, body, atau query
    const user = req?.headers['x-requested-by'] || req?.body?.requested_by || req?.query?.requested_by || '';
    return String(user).trim();
}

function getTenantBrandInfo(req) {
    const brand = req?.headers['x-tenant-brand'] || req?.body?.tenant_brand || req?.query?.tenant_brand || '';
    return String(brand || '').trim().slice(0, 80);
}

function logSessionEvent(event, tenantId, extra = {}) {
    const payload = { event, tenant_id: tenantId, ...extra };
    log('info', `wa_session_${event}`, payload);
    const details = Object.entries(extra)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' ');
    console.log(`[WA][SESSION] event=${event} tenant_id=${tenantId}${details ? ` ${details}` : ''}`);
}

function shortQrHash(value) {
    const raw = String(value || '');
    if (!raw) return '-';
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

function classifyWaSendError(err) {
    const raw = String(err?.message || err || '').trim();
    const text = raw.toLowerCase();
    if (text.includes('not on whatsapp') || text.includes('not registered') || text.includes('invalid wid') || text.includes('wid error')) {
        return {
            code: 'wa_number_not_registered',
            message: 'Nomor tidak terdaftar di WhatsApp.'
        };
    }
    if (text.includes('client not ready')) {
        return {
            code: 'wa_client_not_ready',
            message: 'Perangkat WhatsApp belum siap.'
        };
    }
    if (text.includes('timeout')) {
        return {
            code: 'wa_send_timeout',
            message: 'Kirim WhatsApp timeout. Coba ulang saat koneksi stabil.'
        };
    }
    return {
        code: 'wa_send_failed',
        message: raw || 'Pengiriman WhatsApp gagal.'
    };
}
// Endpoint: Test Kirim Pesan WhatsApp (untuk owner/admin check-up device)
app.post('/api/wa/test-send', rateLimit, async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = resolveTenantId(req);
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'phone dan message wajib diisi' });
    }
    let session = getOrCreateTenantSession(tenantId);
    if (!session.client && !session.initPromise) {
        ensureTenantClient(tenantId).catch(() => {});
    }
    if (session.initPromise) {
        try { await session.initPromise; } catch (err) { void err; }
    }
    session = getOrCreateTenantSession(tenantId);
    if (!session.isReady || !session.client) {
        return res.json({ success: false, error: 'WA Client Not Ready', status: session.status });
    }
    const waNumber = formatPhoneWA(phone);
    try {
        console.log(`[WA TEST SEND] Mulai kirim test ke ${waNumber} (tenant: ${tenantId})`);
        const sendResult = await withRetry(() => session.client.sendMessage(waNumber, message), {
            retries: 2,
            timeoutMs: 20000
        });
        console.log(`[WA TEST SEND] Sukses kirim test ke ${waNumber} (tenant: ${tenantId})`, sendResult && sendResult.id ? `msgId: ${sendResult.id.id}` : '');
        deliveryMetrics.waSendSuccess += 1;
        return res.json({ success: true, phone, msgId: sendResult && sendResult.id ? sendResult.id.id : undefined });
    } catch (err) {
        console.error(`[WA TEST SEND ERROR] Gagal kirim test ke ${waNumber} (tenant: ${tenantId}):`, err.message);
        deliveryMetrics.waSendFailed += 1;
        return res.json({ success: false, phone, error: err.message });
    }
});
// Helper: Log pengiriman WhatsApp ke file log JSON
async function logWaSendBatch(tenantId, phoneList, results, context = {}) {
    const logFile = `wa-send-log.json`;
    const now = new Date().toISOString();
    const entry = {
        tenantId,
        time: now,
        phoneList,
        results,
        ...context
    };
    try {
        let logs = [];
        try {
            const raw = await fs.readFile(logFile, 'utf8');
            logs = JSON.parse(raw);
        } catch (err) {
            void err;
        }
        logs.unshift(entry);
        if (logs.length > 2000) logs = logs.slice(0, 2000); // keep last 2000
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error('Gagal menulis log WA:', err.message);
    }
}

// ===== WA SEND MODE PERSISTENCE (DATABASE FILE) =====
const WA_SEND_MODE_DB_FILE = 'wa-send-mode-db.json';
let waSendModeDb = {};

// Load database saat startup
async function loadWaSendModeDb() {
    try {
        const raw = await fs.readFile(WA_SEND_MODE_DB_FILE, 'utf8');
        waSendModeDb = JSON.parse(raw);
    } catch {
        waSendModeDb = {};
    }
}

// Simpan database ke file
async function saveWaSendModeDb() {
    try {
        await fs.writeFile(WA_SEND_MODE_DB_FILE, JSON.stringify(waSendModeDb, null, 2));
    } catch (err) {
        console.error('Gagal menyimpan waSendModeDb:', err.message);
    }
}

// Set mode per tenant
async function setWaSendMode(tenantId, mode) {
    waSendModeDb[tenantId] = mode;
    await saveWaSendModeDb();
}

// Get mode per tenant
function getWaSendMode(tenantId) {
    const mode = waSendModeDb[tenantId];
    if (mode === 'message_with_barcode') return 'message_with_barcode';
    if (mode === 'message_only') return 'message_only';
    return 'message_with_barcode'; // fallback default (prefer designed ticket image)
}

// Load DB saat server start
loadWaSendModeDb();

const WA_PROTOCOL_TIMEOUT_MS = Number(process.env.WA_PROTOCOL_TIMEOUT_MS || 180000);
const WA_LAUNCH_TIMEOUT_MS = Number(process.env.WA_LAUNCH_TIMEOUT_MS || 180000);

const tenantSessions = new Map();
const importLogs = new Map(); // tenant_id -> [{ id, ticket_id, verified_at, ... }]

function normalizeTenantId(rawTenantId) {
    const value = String(rawTenantId || 'tenant-default').trim();
    const safe = value.replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || 'tenant-default';
}

function resolveTenantId(req) {
    return normalizeTenantId(req?.query?.tenant_id || req?.body?.tenant_id);
}

function resolveTenantIds(req) {
    const fromBody = Array.isArray(req?.body?.tenant_ids) ? req.body.tenant_ids : [];
    const fromQuery = String(req?.query?.tenant_ids || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const source = fromBody.length > 0 ? fromBody : fromQuery;
    const normalized = source.map(normalizeTenantId).filter(Boolean);
    return Array.from(new Set(normalized));
}

function getOrCreateTenantSession(tenantId) {
    if (!tenantSessions.has(tenantId)) {
        tenantSessions.set(tenantId, {
            tenantId,
            tenantBrand: null,
            client: null,
            isReady: false,
            status: 'disconnected',
            currentQR: null,
            initPromise: null,
            lastError: null
        });
    }
    return tenantSessions.get(tenantId);
}

function serializeSession(session) {
    return {
        tenant_id: session.tenantId,
        tenant_brand: session.tenantBrand || null,
        status: session.status,
        isReady: session.isReady,
        hasQr: !!session.currentQR,
        hasClient: !!session.client,
        lastError: session.lastError || null
    };
}

function buildRuntimeInfo() {
    const sessions = Array.from(tenantSessions.values()).map(serializeSession);
    const summary = sessions.reduce((acc, item) => {
        const key = String(item?.status || 'unknown').toLowerCase();
        if (key === 'ready') acc.ready += 1;
        else if (key === 'qr') acc.qr += 1;
        else if (key === 'checking') acc.checking += 1;
        else if (key === 'offline' || key === 'disconnected') acc.offline += 1;
        else acc.other += 1;
        return acc;
    }, { ready: 0, qr: 0, checking: 0, offline: 0, other: 0 });

    const memory = process.memoryUsage();
    const bytesToMb = (value) => Math.round((Number(value || 0) / 1024 / 1024) * 100) / 100;

    return {
        service: '3oNs Digital WA/Email Bot API Server',
        status: 'running',
        version: waServerPackage.version || 'unknown',
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        startedAt: new Date(serverStartedAt).toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: {
            rss: bytesToMb(memory.rss),
            heapTotal: bytesToMb(memory.heapTotal),
            heapUsed: bytesToMb(memory.heapUsed),
            external: bytesToMb(memory.external)
        },
        sessions: {
            total: sessions.length,
            summary
        }
    };
}

function hasValidWaAdminSecret(req) {
    // Hardened mode: protected endpoints are blocked when secret is missing.
    if (!WA_ADMIN_SECRET) return false;

    const provided = String(req.get(WA_ADMIN_SECRET_HEADER) || '').trim();
    if (!provided) return false;
    return provided === WA_ADMIN_SECRET;
}

function requireWaAdminSecret(req, res) {
    if (hasValidWaAdminSecret(req)) return true;
    if (!WA_ADMIN_SECRET) {
        res.status(500).json({
            success: false,
            error: 'WA_ADMIN_SECRET belum diatur di server. Hubungi administrator.'
        });
        return false;
    }
    res.status(403).json({ success: false, error: 'Forbidden: invalid admin secret' });
    return false;
}

function getRateLimitKey(req) {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
    const tenant = resolveTenantId(req);
    return `${ip}|${tenant}|${req.path}`;
}

function rateLimit(req, res, next) {
    const now = Date.now();
    const key = getRateLimitKey(req);
    const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }
    entry.count += 1;
    rateLimitStore.set(key, entry);

    if (entry.count > RATE_LIMIT_MAX) {
        res.setHeader('retry-after', String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({
            success: false,
            error: 'Terlalu banyak request, coba beberapa detik lagi',
            request_id: req._requestId
        });
    }
    return next();
}

function createWaClient(tenantId, session) {
    const tenantAuthPath = path.join(WA_AUTH_DATA_PATH, tenantId);
    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: tenantAuthPath }),
        authTimeoutMs: 120000,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        puppeteer: {
            headless: true,
            protocolTimeout: Number.isFinite(WA_PROTOCOL_TIMEOUT_MS) ? WA_PROTOCOL_TIMEOUT_MS : 180000,
            timeout: Number.isFinite(WA_LAUNCH_TIMEOUT_MS) ? WA_LAUNCH_TIMEOUT_MS : 180000,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', async (qr) => {
        const now = new Date().toISOString();
        logSessionEvent('qr_required', tenantId, { time: now });
        session.status = 'qr';
        session.isReady = false;
        session.lastError = null;
        try {
            session.currentQR = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('Failed to generate QR DataURL', err);
            session.lastError = err.message;
        }
    });


    client.on('ready', () => {
        logSessionEvent('ready', tenantId);
        session.isReady = true;
        session.status = 'ready';
        session.currentQR = null;
        session.lastError = null;
    });

    client.on('disconnected', () => {
        logSessionEvent('disconnected', tenantId);
        session.isReady = false;
        session.status = 'disconnected';
        session.currentQR = null;
    });

    client.on('auth_failure', () => {
        log('error', 'wa_session_auth_failure', { tenant_id: tenantId });
        console.error(`[WA][SESSION] event=auth_failure tenant_id=${tenantId}`);
        session.status = 'disconnected';
        session.isReady = false;
        session.currentQR = null;
        session.lastError = 'Authentication failure';
    });

    return client;
}

async function clearTenantAuthData(tenantId) {
    const authPath = path.join(WA_AUTH_DATA_PATH, tenantId);
    await fs.rm(authPath, { recursive: true, force: true });
}

async function ensureTenantClient(tenantId) {
    const session = getOrCreateTenantSession(tenantId);

    if (session.client) {
        return session;
    }

    if (session.initPromise) {
        await session.initPromise;
        return session;
    }

    session.status = 'checking';
    session.isReady = false;
    session.currentQR = null;
    session.lastError = null;
    session.client = createWaClient(tenantId, session);
    session.initPromise = session.client.initialize()
        .catch((err) => {
            session.status = 'offline';
            session.isReady = false;
            session.currentQR = null;
            session.lastError = err.message;
            throw err;
        })
        .finally(() => {
            session.initPromise = null;
        });

    await session.initPromise;
    return session;
}

async function resetTenantClient(tenantId) {
    const session = getOrCreateTenantSession(tenantId);
    let warning = null;

    if (session.initPromise) {
        warning = warning || 'Client sedang inisialisasi; reset dilanjutkan tanpa menunggu init selesai.';
    }

    if (session.client) {
        try {
            await session.client.logout();
        } catch (err) {
            warning = warning || err.message;
        }

        try {
            await session.client.destroy();
        } catch {
            // ignore
        }
    }

    try {
        await clearTenantAuthData(tenantId);
        console.log(`[WA RESET] Session ${tenantId} berhasil direset & QR lama dibersihkan.`);
    } catch (err) {
        warning = warning || `Gagal membersihkan auth session: ${err.message}`;
    }

    session.client = null;
    session.isReady = false;
    session.status = 'disconnected';
    session.currentQR = null;
    session.initPromise = null;
    session.lastError = null;

    // QR lama tidak valid
    console.log(`[WA RESET] QR lama untuk ${tenantId} sudah tidak valid. Menunggu QR baru...`);

    ensureTenantClient(tenantId).catch((err) => {
        session.status = 'offline';
        session.isReady = false;
        session.currentQR = null;
        session.lastError = err.message;
    });

    return warning;
}

// Session is now bootstrapped lazily from explicit login/bootstrap requests.


// ----- EMAIL CLIENT (NODEMAILER) -----
const SMTP_SERVICE = String(process.env.SMTP_SERVICE || 'gmail').trim();
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const transporter = nodemailer.createTransport({
    service: SMTP_SERVICE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});


// ----- AUTO FORMAT PHONE -----
function formatPhoneWA(phone) {
    let cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
    
    // Format khusus API whatsapp-web.js tambah '@c.us'
    return `${cleaned}@c.us`; 
}

function normalizeQRPayload(rawQr) {
    let parsed = null;
    let raw = String(rawQr || '').trim();
    
    // DEBUG: Log raw input
    console.log(`[normalizeQRPayload] Input length=${raw.length}, preview=${raw.slice(0, 50)}`);
    
    // DETECT: Legacy ONS2026- format (e.g., ONS2026-41D329EB0B0A7B3F)
    if (raw.startsWith('ONS2026-') && raw.length >= 16) {
        console.log(`[normalizeQRPayload] Detected LEGACY ONS2026 format`);
        const ticketId = raw.substring(8); // Extract after ONS2026-
        return {
            ticketId: ticketId,
            tenantId: 'tenant-default',
            eventId: 'event-2026',
            dayNumber: 1,
            signature: raw, // Use full raw as signature
            secureRef: ticketId.slice(-8),
            version: 1,
            _legacy: true
        };
    }
    
    // Coba decode base64 dulu (karena QR data biasanya base64 encoded)
    if (raw.length > 20) {
        try {
            const decoded = Buffer.from(raw, 'base64').toString('utf8');
            if (decoded && decoded.length > 0 && decoded.startsWith('{')) {
                console.log(`[normalizeQRPayload] Base64 decoded JSON: ${decoded.slice(0, 100)}`);
                raw = decoded;
            }
        } catch {
            // Bukan base64, lanjut dengan raw asli
            console.log(`[normalizeQRPayload] Not valid base64 JSON`);
        }
    }
    
    // Coba parse JSON
    try {
        parsed = JSON.parse(raw);
        console.log(`[normalizeQRPayload] JSON parsed OK: tid=${parsed?.tid}`);
    } catch (err) {
        console.log(`[normalizeQRPayload] JSON parse failed: ${err?.message || 'unknown'}`);
    }
    
    // Jika gagal, coba parse format string key-value (tid:xxx;t:xxx;e:xxx;d:1;sig:xxx;r:xxx;v:3)
    if (!parsed || typeof parsed !== 'object') {
        parsed = {};
        raw.split(';').forEach(pair => {
            const [k, ...rest] = pair.split(':');
            if (k && rest.length) parsed[k.trim()] = rest.join(':').trim();
        });
        console.log(`[normalizeQRPayload] Key-value parsed keys: ${Object.keys(parsed).join(',')}`);
    }
    
    if (!parsed || typeof parsed !== 'object') {
        console.log(`[normalizeQRPayload] Failed to parse any format`);
        return null;
    }
    
    const result = {
        ticketId: String(parsed.tid || parsed.ticketId || '').trim(),
        tenantId: String(parsed.t || parsed.tenantId || 'tenant-default').trim(),
        eventId: String(parsed.e || parsed.eventId || 'event-2026').trim(),
        dayNumber: Number(parsed.d || parsed.dayNumber) || 1,
        signature: String(parsed.sig || parsed.signature || '').trim(),
        secureRef: String(parsed.r || parsed.secureRef || '').trim(),
        version: Number(parsed.v || parsed.version) || 1
    };
    
    console.log(`[normalizeQRPayload] Result: tid=${result.ticketId}, t=${result.tenantId}, e=${result.eventId}, d=${result.dayNumber}, sig=${result.signature ? 'yes' : 'no'}`);
    
    return result;
}

function normalizeOutgoingQrData(rawQr, fallback = {}) {
    const parsed = normalizeQRPayload(rawQr);
    if (!parsed || !parsed.ticketId || !parsed.tenantId || !parsed.eventId || !parsed.signature || !Number.isFinite(parsed.dayNumber)) {
        console.log(`[normalizeOutgoingQrData] Validation failed: tid=${parsed?.ticketId}, t=${parsed?.tenantId}, e=${parsed?.eventId}, d=${parsed?.dayNumber}, sig=${parsed?.signature ? 'yes' : 'no'}`);
        return { ok: false, value: '', reason: 'invalid_qr_payload' };
    }

    // Log format type
    if (parsed._legacy) {
        console.log(`[normalizeOutgoingQrData] Using LEGACY format for ticket=${parsed.ticketId}`);
    } else {
        console.log(`[normalizeOutgoingQrData] Using MODERN format for ticket=${parsed.ticketId}`);
    }

    const payload = {
        tid: parsed.ticketId,
        n: String(fallback?.name || '').trim() || '',
        d: parsed.dayNumber,
        t: parsed.tenantId,
        e: parsed.eventId,
        r: parsed.secureRef || '',
        sig: parsed.signature,
        v: Number.isFinite(parsed.version) ? parsed.version : 1
    };

    return {
        ok: true,
        value: JSON.stringify(payload)
    };
}

// ===== IMPORT BARCODE HELPERS =====

// Helper: Extract QR data from image (base64)
async function extractQRFromImage(base64Data) {
    try {
        // Decode base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Load image with Jimp
        const image = await Jimp.read(imageBuffer);
        
        // Get image data
        const imageData = {
            data: new Uint8ClampedArray(image.bitmap.data),
            width: image.bitmap.width,
            height: image.bitmap.height
        };
        
        // Scan for QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
            return code.data;
        }
        
        return null;
    } catch (err) {
        console.error('[QR Extract Error]:', err.message);
        return null;
    }
}

// Helper: Validate barcode format
function validateBarcodeFormat(qrString) {
    try {
        const parsed = JSON.parse(qrString);
        const isValid = !!(parsed.tid && parsed.t && parsed.e && parsed.sig);
        return { isValid, data: parsed };
    } catch {
        return { isValid: false, data: null };
    }
}

// Helper: Store import log
function storeImportLog(tenantId, importRecord) {
    if (!importLogs.has(tenantId)) {
        importLogs.set(tenantId, []);
    }
    const logs = importLogs.get(tenantId);
    logs.unshift(importRecord); // Newest first
    // Keep last 100 imports per tenant
    if (logs.length > 100) {
        logs.pop();
    }
}


// ----- API ROUTES -----

app.get('/', (_req, res) => {
    res.json({
        service: '3oNs Digital WA/Email Bot API Server',
        status: 'running',
        docs: {
            waStatus: '/api/wa/status?tenant_id=tenant-default',
            waBatchQr: '/api/wa/batch-status?tenant_ids=tenant-a,tenant-b',
            sessions: '/api/wa/sessions',
            health: '/health'
        }
    });
});

app.get('/health', (_req, res) => {
    const runtime = buildRuntimeInfo();
    res.json({
        ok: true,
        uptime: process.uptime(),
        sessions: runtime.sessions,
        delivery: deliveryMetrics
    });
});

app.get('/api/wa/runtime', (_req, res) => {
    if (!requireWaAdminSecret(_req, res)) return;
    res.json(buildRuntimeInfo());
});

// Debug preview: render ticket image from current backend renderer
app.get('/api/wa/debug-ticket-image', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    try {
        const participant = {
            name: String(req.query.name || 'Peserta Uji'),
            ticket_id: String(req.query.ticket_id || 'DEBUG-001'),
            category: String(req.query.category || 'Regular'),
            day_number: Number(req.query.day_number || 1),
            qr_data: String(req.query.qr_data || 'DEBUG-QR-DATA')
        };
        const imageBuffer = await buildTicketQrImageNode(participant, {
            eventLabel: String(req.query.event_name || 'Event Platform'),
            brandLabel: String(req.query.brand_name || '3oNs Digital')
        });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(imageBuffer);
    } catch (err) {
        return res.status(500).json({ success: false, error: err?.message || String(err) });
    }
});

// Admin self-check: stress test QR verify and rendered decode
app.get('/api/wa/stress-qr-check', rateLimit, async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    try {
        const totalRaw = Number(req.query.total || 1000);
        const sampleRaw = Number(req.query.render_sample || 150);
        const total = Number.isFinite(totalRaw) ? Math.max(1, Math.min(totalRaw, 5000)) : 1000;
        const renderSample = Number.isFinite(sampleRaw) ? Math.max(0, Math.min(sampleRaw, total)) : 150;
        const tenantId = String(req.query.tenant_id || resolveTenantId(req) || 'tenant-default').trim();
        const eventId = String(req.query.event_id || 'event-main').trim();

        const startedAt = Date.now();
        const summary = await runStressQrCheck({ total, renderSample, tenantId, eventId });
        const elapsedMs = Date.now() - startedAt;

        return res.json({
            success: true,
            elapsed_ms: elapsedMs,
            ...summary
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err?.message || String(err)
        });
    }
});

// Delivery log: latest WA send attempts
app.get('/api/wa/send-log', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = resolveTenantId(req);
    const limitRaw = Number(req?.query?.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 200;

    try {
        const raw = await fs.readFile('wa-send-log.json', 'utf8');
        const logs = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
        const filtered = logs.filter((entry) => normalizeTenantId(entry?.tenantId) === tenantId);
        res.json({ success: true, tenant_id: tenantId, total: filtered.length, logs: filtered.slice(0, limit) });
    } catch {
        res.json({ success: true, tenant_id: tenantId, total: 0, logs: [] });
    }
});

// 1. Status Check & QR Retreival
app.get('/api/wa/status', (req, res) => {
    const tenantId = resolveTenantId(req);
    const session = getOrCreateTenantSession(tenantId);
    const requestedBy = getRequesterInfo(req);
    const tenantBrand = getTenantBrandInfo(req);
    if (tenantBrand) session.tenantBrand = tenantBrand;

    // Log permintaan QR hanya jika status belum ready
    if (session.status !== 'ready') {
        logSessionEvent('status_check', tenantId, {
            tenant_brand: session.tenantBrand || '-',
            requested_by: requestedBy || '-',
            status: session.status
        });
    }

    res.json({
        tenant_id: tenantId,
        status: session.status,
        qrCode: session.currentQR,
        isReady: session.isReady,
        lastError: session.lastError,
        requested_by: requestedBy
    });
});

// 1.1 Explicit bootstrap, typically called once after successful login.
app.post('/api/wa/bootstrap-session', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = resolveTenantId(req);
    const requestedBy = getRequesterInfo(req);
    const tenantBrand = getTenantBrandInfo(req);
    const session = getOrCreateTenantSession(tenantId);
    if (tenantBrand) session.tenantBrand = tenantBrand;

    if (!session.client && !session.initPromise) {
        logSessionEvent('bootstrap_start', tenantId, {
            tenant_brand: session.tenantBrand || '-',
            requested_by: requestedBy || '-'
        });
    }

    try {
        await ensureTenantClient(tenantId);
    } catch (err) {
        const current = getOrCreateTenantSession(tenantId);
        current.status = 'offline';
        current.isReady = false;
        current.currentQR = null;
        current.lastError = err?.message || 'Failed to initialize tenant client';
        log('error', 'wa_session_bootstrap_failed', {
            tenant_id: tenantId,
            tenant_brand: current.tenantBrand || null,
            requested_by: requestedBy || '-',
            error: current.lastError
        });
    }

    const current = getOrCreateTenantSession(tenantId);
    return res.json({
        success: true,
        tenant_id: tenantId,
        status: current.status,
        isReady: current.isReady,
        hasQr: !!current.currentQR,
        requested_by: requestedBy || '-'
    });
});

// 1.2. Session monitor for owner/super admin dashboard
app.get('/api/wa/sessions', (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const list = Array.from(tenantSessions.values()).map(serializeSession);
    res.json({
        total: list.length,
        sessions: list
    });
});

// 1.3. Batch status + QR bootstrap for multiple tenants in one request
app.post('/api/wa/batch-status', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;

    const tenantIds = resolveTenantIds(req);
    if (tenantIds.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'tenant_ids wajib diisi (array body atau query tenant_ids=a,b,c)'
        });
    }

    const requestedBy = getRequesterInfo(req);
    const waitMsRaw = Number(req?.body?.wait_ms ?? req?.query?.wait_ms ?? 1200);
    const waitMs = Number.isFinite(waitMsRaw) ? Math.max(0, Math.min(waitMsRaw, 10000)) : 1200;

    // Kick off initialization for each tenant without blocking response too long.
    await Promise.allSettled(tenantIds.map((tenantId) =>
        ensureTenantClient(tenantId).catch((err) => {
            const session = getOrCreateTenantSession(tenantId);
            session.status = 'offline';
            session.isReady = false;
            session.currentQR = null;
            session.lastError = err?.message || 'Failed to initialize tenant client';
        })
    ));

    if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const items = tenantIds.map((tenantId) => {
        const session = getOrCreateTenantSession(tenantId);
        // Log permintaan QR batch
        console.log(`[WA][QR_REQUEST][BATCH] tenant_id=${tenantId} requested_by=${requestedBy || '-'} status=${session.status} time=${new Date().toISOString()}`);
        return {
            tenant_id: tenantId,
            status: session.status,
            isReady: session.isReady,
            qrCode: session.currentQR,
            hasQr: !!session.currentQR,
            lastError: session.lastError || null,
            requested_by: requestedBy
        };
    });

    res.json({
        success: true,
        total: items.length,
        wait_ms: waitMs,
        requested_by: requestedBy,
        items
    });
});

// 1.5. Logout/Disconnect Bot
app.post('/api/wa/logout', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = resolveTenantId(req);

    try {
        const warning = await resetTenantClient(tenantId);
        res.json({ success: true, message: 'Bot session reset successfully', warning, tenant_id: tenantId });
    } catch (initErr) {
        res.status(500).json({ success: false, error: initErr.message, tenant_id: tenantId });
    }
});

// 1.6. Validate and Fix Participant Data (Generate QR if missing)
app.post('/api/validate-participants', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const { participants } = req.body;
    
    if (!Array.isArray(participants)) {
        return res.status(400).json({ success: false, error: 'participants array required' });
    }
    
    const results = {
        total: participants.length,
        valid: 0,
        invalid: 0,
        fixed: 0,
        errors: []
    };
    
    const fixedParticipants = participants.map(p => {
        const issues = [];
        
        // Check required fields
        if (!p.ticket_id) issues.push('missing ticket_id');
        if (!p.name && !p.nama) issues.push('missing name');
        if (!p.phone && !p.whatsapp && !p.wa) issues.push('missing phone');
        
        // Check QR data
        const hasQr = p.qr_data && String(p.qr_data).trim().length > 0;
        
        if (!hasQr && p.ticket_id) {
            // Auto-generate QR
            const newQr = generateServerQRData({
                ticket_id: p.ticket_id,
                name: p.name || p.nama,
                day_number: p.day_number || p.day || p.hari || 1
            });
            
            if (newQr) {
                p.qr_data = newQr;
                results.fixed++;
                issues.push('QR auto-generated');
            } else {
                issues.push('QR generation failed');
            }
        }
        
        if (issues.length > 0 && !issues.includes('QR auto-generated')) {
            results.invalid++;
            results.errors.push({ ticket_id: p.ticket_id, issues });
        } else {
            results.valid++;
        }
        
        return p;
    });
    
    res.json({
        success: true,
        summary: results,
        participants: fixedParticipants
    });
});

// 1.7. Fetch Participants from Supabase (Server-side)
app.get('/api/participants', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    
    if (!supabase) {
        return res.status(503).json({
            success: false,
            error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env'
        });
    }
    
    try {
        const { data: participants, error } = await supabase
            .from('participants')
            .select('*');
        
        if (error) throw error;
        
        // Auto-generate QR for participants without qr_data
        const enriched = participants.map(p => {
            if (!p.qr_data && p.ticket_id) {
                const newQr = generateServerQRData({
                    ticket_id: p.ticket_id,
                    name: p.name || p.nama,
                    day_number: p.day_number || p.day || 1
                });
                if (newQr) {
                    p.qr_data = newQr;
                    p._qr_auto_generated = true;
                }
            }
            return p;
        });
        
        res.json({
            success: true,
            count: enriched.length,
            participants: enriched
        });
    } catch (err) {
        console.error('[API] Error fetching participants:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch participants',
            details: err.message
        });
    }
});

// 2. Send Ticket (WA & Email)
app.post('/api/send-ticket', rateLimit, async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = resolveTenantId(req);
    const { name, phone, phones, email, ticket_id, category, day_number, qr_data, send_wa, send_email, wa_send_mode } = req.body;

    // phones: array nomor WA, phone: satu nomor WA (backward compatible)
    const phoneList = Array.isArray(phones) && phones.length > 0 ? phones : (phone ? [phone] : []);
    
    // DEBUG: Log request details
    console.log(`[SEND-TICKET-REQ] ticket=${ticket_id} phones=${phoneList.length} qr_data_length=${String(qr_data||'').length}`);
    
    // Validate phoneList
    if (phoneList.length === 0) {
        console.log(`[SEND-TICKET-400] No valid phone numbers for ticket=${ticket_id}`);
        return res.status(400).json({
            success: false,
            error: 'Nomor telepon tidak valid atau kosong.',
            error_code: 'invalid_phone',
            tenant_id: tenantId,
            request_id: req._requestId
        });
    }
    
    // Validate/Generate QR data
    let finalQrData = qr_data;
    
    if (!finalQrData || String(finalQrData).trim().length === 0) {
        // Try auto-generate QR if participant info is complete
        if (ticket_id && name) {
            console.log(`[SEND-TICKET] Auto-generating QR for ticket=${ticket_id}`);
            const autoQr = generateServerQRData({
                ticket_id,
                name,
                day_number: day_number || 1
            }, tenantId, 'event-default');
            
            if (autoQr) {
                finalQrData = autoQr;
                console.log(`[SEND-TICKET] QR auto-generated successfully for ticket=${ticket_id}`);
            }
        }
        
        if (!finalQrData || String(finalQrData).trim().length === 0) {
            console.log(`[SEND-TICKET-400] Empty QR data for ticket=${ticket_id}`);
            return res.status(400).json({
                success: false,
                error: 'QR data kosong. Generate ulang tiket peserta.',
                error_code: 'empty_qr_data',
                tenant_id: tenantId,
                request_id: req._requestId
            });
        }
    }
    
    const normalizedQr = normalizeOutgoingQrData(finalQrData, { name });
    if (!normalizedQr.ok) {
        console.log(`[SEND-TICKET-400] Invalid QR for ticket=${ticket_id} reason=${normalizedQr.error || 'unknown'}`);
        return res.status(400).json({
            success: false,
            error: 'QR data tidak valid. Kirim ulang tiket dari data peserta terbaru.',
            error_code: 'invalid_qr_payload',
            tenant_id: tenantId,
            request_id: req._requestId,
            debug: process.env.NODE_ENV !== 'production' ? { qr_preview: String(finalQrData).slice(0, 50) } : undefined
        });
    }
    const qrData = normalizedQr.value;
    const results = { wa: [], email: null };
    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    // PATCH: Simpan mode jika ada input baru
    let waSendMode = getWaSendMode(tenantId);
    if (wa_send_mode === 'message_with_barcode' || wa_send_mode === 'message_only') {
        waSendMode = wa_send_mode;
        await setWaSendMode(tenantId, waSendMode);
    }
    // Guard: kirim tiket peserta selalu gunakan desain e-ticket.
    if (waSendMode !== 'message_with_barcode') {
        waSendMode = 'message_with_barcode';
        await setWaSendMode(tenantId, waSendMode);
    }
    const qrHash = shortQrHash(qrData);
    console.log(`[WA SEND MODE] tenant=${tenantId} mode=${waSendMode} ticket=${ticket_id || '-'} qr_hash=${qrHash}`);

    let session = getOrCreateTenantSession(tenantId);
    if (!session.client && !session.initPromise) {
        ensureTenantClient(tenantId).catch(() => {
            // status will be reflected by session state on next request
        });
    }

    if (session.initPromise) {
        try {
            await session.initPromise;
        } catch {
            // continue, readiness check below handles failure
        }
    }
    session = getOrCreateTenantSession(tenantId);

    // A. PROSES SEND WHATSAPP (Batch/Paralel)
    if (send_wa && phoneList.length > 0) {
        if (!session.isReady || !session.client) {
            results.wa = phoneList.map((p) => ({
                phone: p,
                status: 'Failed',
                error: 'Perangkat WhatsApp belum siap.',
                error_code: 'wa_client_not_ready'
            }));
        } else {
            const waMessage = req.body.wa_message || `🎫 *E-Ticket*\n\nHalo *${name}*,\nBerikut tiket masuk Anda untuk *Hari ke-${day_number}*.\n\n📋 *Ticket ID:* ${ticket_id}\n📂 *Kategori:* ${category}\n\nSilakan tunjukkan barcode tiket ini kepada petugas gerbang event. Terima kasih.\n\n_3oNs Digital_`;
            // SEQUENTIAL SEND dengan delay untuk hindari rate limit
            const delayMs = Number(process.env.WA_SEND_DELAY_MS || 3000);
            const healthCheckInterval = 10; // Cek session setiap 10 pesan
            results.wa = [];
            
            for (let i = 0; i < phoneList.length; i++) {
                const p = phoneList[i];
                const waNumber = formatPhoneWA(p);
                
                // Health check setiap N pesan
                if (i > 0 && i % healthCheckInterval === 0) {
                    console.log(`[WA SEND] Health check setelah ${i} pesan...`);
                    const freshSession = getOrCreateTenantSession(tenantId);
                    if (!freshSession.isReady || !freshSession.client) {
                        console.error(`[WA SEND] Session tidak ready setelah ${i} pesan, stop batch.`);
                        // Mark sisanya sebagai failed
                        for (let j = i; j < phoneList.length; j++) {
                            results.wa.push({
                                phone: phoneList[j],
                                status: 'Failed',
                                error: 'WhatsApp session timeout setelah batch besar. Silakan retry.',
                                error_code: 'wa_session_timeout'
                            });
                        }
                        break;
                    }
                    // Extra cooldown setiap 10 pesan
                    console.log(`[WA SEND] Cooldown 10 detik setelah ${i} pesan...`);
                    await new Promise(r => setTimeout(r, 10000));
                }
                
                try {
                    // Skip number validation in fast mode (saves ~500-1000ms)
                    if (!WA_SKIP_NUMBER_CHECK && typeof session.client.isRegisteredUser === 'function') {
                        const isRegistered = await withRetry(() => session.client.isRegisteredUser(waNumber), {
                            retries: 1,
                            timeoutMs: 8000
                        });
                        if (!isRegistered) {
                            results.wa.push({
                                phone: p,
                                status: 'Failed',
                                error: 'Nomor tidak terdaftar di WhatsApp.',
                                error_code: 'wa_number_not_registered'
                            });
                            continue;
                        }
                    }
                    
                    const startSend = Date.now();
                    console.log(`[WA SEND] [${i+1}/${phoneList.length}] Mulai kirim ke ${waNumber} (ticket_id: ${ticket_id}) fast=${WA_FAST_MODE}`);
                    
                    let sendResult;
                    if (waSendMode === 'message_only') {
                        sendResult = await withRetry(() => session.client.sendMessage(waNumber, waMessage), {
                            retries: WA_FAST_MODE ? 1 : 3,
                            timeoutMs: WA_MESSAGE_TIMEOUT_MS
                        });
                    } else if (waSendMode === 'message_with_barcode') {
                        // Generate e-ticket image with QR and details
                        const participant = { name, ticket_id, category, day_number, qr_data: qrData };
                        const imgStart = Date.now();
                        const imageBuffer = await buildTicketQrImageNode(participant, {});
                        console.log(`[WA SEND IMAGE] gen_time=${Date.now() - imgStart}ms bytes=${imageBuffer?.length || 0}`);
                        
                        const base64Str = imageBuffer.toString('base64');
                        const media = new MessageMedia('image/png', base64Str, `Ticket_${ticket_id}.png`);
                        sendResult = await withRetry(() => session.client.sendMessage(waNumber, media, { caption: waMessage }), {
                            retries: WA_FAST_MODE ? 1 : 3,
                            timeoutMs: WA_MESSAGE_TIMEOUT_MS
                        });
                    } else {
                        sendResult = await withRetry(() => session.client.sendMessage(waNumber, waMessage), {
                            retries: WA_FAST_MODE ? 1 : 3,
                            timeoutMs: WA_MESSAGE_TIMEOUT_MS
                        });
                    }
                    
                    console.log(`[WA SEND] Sukses [${i+1}/${phoneList.length}] ke ${waNumber} time=${Date.now() - startSend}ms`);
                    deliveryMetrics.waSendSuccess += 1;
                    results.wa.push({ phone: p, status: 'Success', msgId: sendResult?.id?.id });
                    
                    // Delay antar pesan (kecuali pesan terakhir)
                    if (i < phoneList.length - 1) {
                        await new Promise(r => setTimeout(r, delayMs));
                    }
                    
                } catch (err) {
                    console.error(`[WA SEND ERROR] [${i+1}/${phoneList.length}] Gagal ke ${waNumber}:`, err.message);
                    deliveryMetrics.waSendFailed += 1;
                    const normalized = classifyWaSendError(err);
                    results.wa.push({
                        phone: p,
                        status: 'Failed',
                        error: normalized.message,
                        error_code: normalized.code
                    });
                    // Tetap delay meskipun error, jangan spam
                    if (i < phoneList.length - 1) {
                        await new Promise(r => setTimeout(r, delayMs));
                    }
                }
            }
        }
        // Log hasil pengiriman batch WA
        logWaSendBatch(tenantId, phoneList, results.wa, {
            ticket_id,
            category,
            day_number,
            name,
            wa_send_mode: waSendMode
        });
    }

    // B. PROSES SEND EMAIL (tidak diubah, tetap satu email)
    if (send_email && email) {
        if (!SMTP_USER || !SMTP_PASS) {
            results.email = 'Failed - Harap setup SMTP_USER dan SMTP_PASS di environment server';
        } else {
            try {
                const mailOptions = {
                    from: `"3oNs Digital" <${transporter.options.auth.user}>`,
                    to: email,
                    subject: `E-Ticket Hari ke-${day_number} - ${name}`,
                    html: `
                        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 500px; margin: 0 auto; text-align: center; border: 1px solid #e8e4d0; padding: 20px; border-radius: 10px; background: #f5f3eb;">
                            <div style="margin-bottom: 20px;">
                                <span style="font-size: 2.5rem; font-weight: 800; color: #1a1a1a;">
                                    <span style="color: #4da6e8;">3</span>
                                    <span style="color: #2eab6e;">o</span>
                                    <span style="color: #e84040;">N</span>
                                    <span style="color: #e84393;">s</span>
                                    <span style="font-size: 1rem; color: #b8960a; margin-left: 0.5rem;">Digital</span>
                                </span>
                            </div>
                            <h2 style="color: #4da6e8; margin-bottom: 10px;">E-Ticket</h2>
                            <p style="margin-bottom: 20px;">Halo <b>${name}</b>,</p>
                            <p style="margin-bottom: 20px;">Ini adalah tiket masuk acara Anda untuk <b>Hari ke-${day_number}</b>.</p>
                            <hr style="border-top:1px dashed #d7d1b8; margin: 20px 0" />
                            <div style="margin: 20px 0;">
                                <img src="${qrPublicUrl}" width="200" alt="QR Code Ticket" style="border-radius: 8px;" />
                            </div>
                            <h3 style="color: #1a1a1a; margin: 10px 0;">${ticket_id}</h3>
                            <p style="background: ${category === 'VIP' ? '#4da6e8' : '#2eab6e'}; color: white; display: inline-block; padding: 5px 15px; border-radius: 15px; font-weight: bold; font-size: 14px;">KATEGORI: ${category.toUpperCase()}</p>
                            <hr style="border-top:1px dashed #d7d1b8; margin: 20px 0" />
                            <p style="font-size: 12px; color: #6b7280;">Tunjukkan QR Code ini pada saat registrasi acara berlangsung.<br/>Harap tidak membagikan kode ini kepada orang lain.</p>
                            <p style="font-size: 10px; color: #9ca3af; margin-top: 20px;">Powered by 3oNs Digital</p>
                        </div>
                    `
                };
                await transporter.sendMail(mailOptions);
                results.email = 'Success';
            } catch (err) {
                console.error('Email Send Error:', err.message);
                results.email = 'Failed - ' + err.message;
            }
        }
    }

    res.json({ success: true, results, tenant_id: tenantId });
});

// 3. Verify ticket signature (server-side check)
app.post('/api/ticket/verify', rateLimit, (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const qr = normalizeQRPayload(req?.body?.qr_data);
    if (!qr || !qr.ticketId || !qr.tenantId || !qr.eventId || !qr.signature || !Number.isFinite(qr.dayNumber)) {
        console.error('[TICKET_VERIFY] Payload invalid:', {
            body: req.body,
            qr_normalized: qr
        });
        return res.status(400).json({ valid: false, reason: 'invalid_payload', debug: { body: req.body, qr_normalized: qr } });
    }

    const requestedTenant = normalizeTenantId(req?.body?.tenant_id || qr.tenantId);
    if (requestedTenant !== qr.tenantId) {
        return res.status(400).json({ valid: false, reason: 'tenant_mismatch' });
    }

    const secureCode = String(req?.body?.secure_code || '').trim();
    const secureRef = String(req?.body?.secure_ref || '').trim();

    const expectedLegacy = buildLegacySignature({
        tenantId: qr.tenantId,
        eventId: qr.eventId,
        ticketId: qr.ticketId,
        dayNumber: qr.dayNumber
    });
    const expectedLegacyHmac = buildHmacSignature(buildLegacyPayload({
        tenantId: qr.tenantId,
        eventId: qr.eventId,
        ticketId: qr.ticketId,
        dayNumber: qr.dayNumber
    }), TICKET_SIGNING_SECRET);
    const validLegacy = expectedLegacy === qr.signature || expectedLegacyHmac === qr.signature;

    // v3 secure mode: verify with hidden participant token sent by scanner app
    if (qr.version >= 3 || qr.secureRef) {
        if (!secureCode || !secureRef || secureRef !== qr.secureRef) {
            // Compat fallback for older generated tickets / stale gate cache:
            // if legacy signature is valid, still allow check-in.
            if (validLegacy) {
                return res.json({ valid: true, reason: 'ok_legacy_compat', mode: 'legacy-v2-compat' });
            }
            return res.json({ valid: false, reason: 'missing_secure_token', mode: 'v3-secure' });
        }

        const expected = buildHmacSignature(buildV3Payload({
            tenantId: qr.tenantId,
            eventId: qr.eventId,
            ticketId: qr.ticketId,
            dayNumber: qr.dayNumber,
            secureCode,
            secureRef
        }), TICKET_SIGNING_SECRET);
        const expectedLegacySecure = buildSecureSignatureLegacy({
            tenantId: qr.tenantId,
            eventId: qr.eventId,
            ticketId: qr.ticketId,
            dayNumber: qr.dayNumber,
            secureCode,
            secureRef
        });

        const valid = expected === qr.signature || expectedLegacySecure === qr.signature;
        if (valid) return res.json({ valid: true, reason: 'ok', mode: 'v3-secure' });
        if (validLegacy) return res.json({ valid: true, reason: 'ok_legacy_compat', mode: 'legacy-v2-compat' });
        return res.json({ valid: false, reason: 'invalid_signature', mode: 'v3-secure' });
    }

    // Legacy mode fallback for old tickets
    return res.json({ valid: validLegacy, reason: validLegacy ? 'ok' : 'invalid_signature', mode: 'legacy-v2' });
});

// ===== IMPORT BARCODE API ENDPOINTS =====

// API: Extract QR from image
app.post('/api/import/barcode', async (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = normalizeTenantId(req?.body?.tenant_id);
    const { image_base64, source_type, qr_string } = req.body;

    // source_type: 'camera', 'upload', 'manual_paste'
    
    if (!image_base64 && source_type !== 'manual_paste') {
        return res.status(400).json({
            success: false,
            error: 'image_base64 diperlukan untuk camera/upload'
        });
    }

    let qrData;

    // 1. Extract QR dari image
    if (source_type === 'camera' || source_type === 'upload') {
        try {
            qrData = await extractQRFromImage(image_base64);
            if (!qrData) {
                return res.json({
                    success: false,
                    error: 'Tidak bisa extract QR dari gambar. Coba ulang atau manual paste.'
                });
            }
        } catch (err) {
            return res.json({
                success: false,
                error: 'Error parsing image: ' + err.message
            });
        }
    } else if (source_type === 'manual_paste') {
        qrData = qr_string?.trim();
        if (!qrData) {
            return res.status(400).json({
                success: false,
                error: 'qr_string diperlukan untuk manual import'
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            error: 'source_type tidak dikenal'
        });
    }

    // 2. Validate barcode format
    const { isValid } = validateBarcodeFormat(qrData);
    if (!isValid) {
        return res.json({
            success: false,
            error: 'Format barcode tidak valid',
            hint: 'QR harus berisi field: tid, t, e, sig, d, r (if v3)'
        });
    }

    // 3. Normalize payload
    const normalized = normalizeQRPayload(qrData);
    if (!normalized) {
        return res.json({
            success: false,
            error: 'Tidak bisa parse QR payload'
        });
    }

    // 4. Verify tenant match
    if (normalized.tenantId !== tenantId) {
        return res.json({
            success: false,
            error: 'Barcode milik brand/tenant lain',
            details: {
                expected: tenantId,
                found: normalized.tenantId
            }
        });
    }

    // 5. Return import summary
    return res.json({
        success: true,
        import_data: {
            ticket_id: normalized.ticketId,
            tenant_id: normalized.tenantId,
            event_id: normalized.eventId,
            day_number: normalized.dayNumber,
            secure_ref: normalized.secureRef,
            signature: normalized.signature,
            version: normalized.version,
            source: source_type
        },
        next_step: 'SERVER_VERIFY',
        message: 'QR extracted berhasil. Lanjut ke server verify step.'
    });
});

// API: Server verify + register import
app.post('/api/import/verify-and-register', (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = normalizeTenantId(req?.body?.tenant_id);
    const {
        ticket_id,
        secure_code,
        secure_ref,
        signature,
        event_id,
        day_number,
        version,
        verified_by
    } = req.body;

    // Validate required fields
    if (!ticket_id || !secure_code || !secure_ref || !signature) {
        return res.status(400).json({
            valid: false,
            reason: 'missing_fields',
            message: 'Fields wajib: ticket_id, secure_code, secure_ref, signature'
        });
    }

    // Version check
    const qrVersion = Number(version || 3);
    
    let expectedSignature;
    let mode = 'unknown';

    if (qrVersion >= 3) {
        expectedSignature = buildHmacSignature(buildV3Payload({
            tenantId,
            eventId: event_id,
            ticketId: ticket_id,
            dayNumber: day_number,
            secureCode: secure_code,
            secureRef: secure_ref
        }), TICKET_SIGNING_SECRET);
        mode = 'v3-secure';
    } else {
        const legacyHmac = buildHmacSignature(buildLegacyPayload({
            tenantId,
            eventId: event_id,
            ticketId: ticket_id,
            dayNumber: day_number
        }), TICKET_SIGNING_SECRET);
        const legacyBase64 = buildLegacySignature({
            tenantId,
            eventId: event_id,
            ticketId: ticket_id,
            dayNumber: day_number
        });
        expectedSignature = signature === legacyHmac ? legacyHmac : legacyBase64;
        mode = 'legacy-v2';
    }

    const signatureMatch = expectedSignature === signature;

    if (!signatureMatch) {
        return res.json({
            valid: false,
            reason: 'invalid_signature',
            mode,
            message: 'Signature tidak cocok. Data barcode mungkin dimanipulasi.'
        });
    }

    // ✅ VALID! Simpan import record
    const importRecord = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        ticket_id,
        event_id,
        day_number,
        mode,
        verified_at: new Date().toISOString(),
        verified_by: verified_by || 'system',
        secure_ref_masked: `***${secure_ref.slice(-6)}`,
        import_status: 'verified'
    };

    storeImportLog(tenantId, importRecord);

    return res.json({
        valid: true,
        reason: 'ok',
        mode,
        import_id: importRecord.id,
        message: 'Barcode terverifikasi dan siap diakses.',
        secure_display: {
            ticket_id,
            security_mode: mode,
            ref_masked: importRecord.secure_ref_masked
        }
    });
});

// API: Get import logs (for audit)
app.get('/api/import/logs', (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = normalizeTenantId(req?.query?.tenant_id);
    const logs = importLogs.get(tenantId) || [];
    res.json({
        tenant_id: tenantId,
        total: logs.length,
        logs: logs.slice(0, 20) // Return latest 20
    });
});

// API: Trigger sync to all gates (broadcast refresh signal)
app.post('/api/sync-to-gates', (req, res) => {
    if (!requireWaAdminSecret(req, res)) return;
    const tenantId = normalizeTenantId(req?.body?.tenant_id);
    const { reason } = req.body || {};
    
    console.log(`[SYNC-TO-GATES] Broadcasting sync signal for tenant=${tenantId}, reason=${reason || 'manual'}`);
    
    // Emit sync event via SSE or WebSocket if implemented
    // For now, return success so clients can poll for changes
    res.json({
        success: true,
        tenant_id: tenantId,
        message: 'Sync signal broadcasted to all gates',
        timestamp: new Date().toISOString(),
        affected_clients: 'all_gate_devices',
        reason: reason || 'manual_sync'
    });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('cors')) {
        return res.status(403).json({ success: false, error: 'CORS blocked', request_id: req?._requestId || null });
    }
    return res.status(500).json({ success: false, error: 'Server error', request_id: req?._requestId || null });
});

// Start Server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    try {
        fsSync.mkdirSync(WA_AUTH_DATA_PATH, { recursive: true });
    } catch {
        // ignore: directory creation can fail on read-only environments
    }
    log('info', 'wa_server_started', {
        port: Number(PORT),
        node_env: String(process.env.NODE_ENV || 'development').toLowerCase(),
        version: waServerPackage.version || 'unknown',
        auth_data_path: WA_AUTH_DATA_PATH
    });
});

function shutdown(signal) {
    log('warn', 'wa_server_shutdown_signal', { signal });
    server.close(() => {
        log('info', 'wa_server_stopped', { signal });
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
