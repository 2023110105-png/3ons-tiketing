const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs/promises');
const jsQR = require('jsqr');
const Jimp = require('jimp');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const nodemailer = require('nodemailer');
const waServerPackage = require('./package.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const serverStartedAt = Date.now();
const WA_ADMIN_SECRET_HEADER = 'x-wa-admin-secret';
const WA_ADMIN_SECRET = String(process.env.WA_ADMIN_SECRET || '').trim();

function getRequesterInfo(req) {
    // Coba ambil info user dari header, body, atau query
    const user = req?.headers['x-requested-by'] || req?.body?.requested_by || req?.query?.requested_by || '';
    return String(user).trim();
}
// Endpoint: Test Kirim Pesan WhatsApp (untuk owner/admin check-up device)
app.post('/api/wa/test-send', async (req, res) => {
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
        try { await session.initPromise; } catch {}
    }
    session = getOrCreateTenantSession(tenantId);
    if (!session.isReady || !session.client) {
        return res.json({ success: false, error: 'WA Client Not Ready', status: session.status });
    }
    const waNumber = formatPhoneWA(phone);
    try {
        console.log(`[WA TEST SEND] Mulai kirim test ke ${waNumber} (tenant: ${tenantId})`);
        const sendResult = await Promise.race([
            session.client.sendMessage(waNumber, message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))
        ]);
        console.log(`[WA TEST SEND] Sukses kirim test ke ${waNumber} (tenant: ${tenantId})`, sendResult && sendResult.id ? `msgId: ${sendResult.id.id}` : '');
        return res.json({ success: true, phone, msgId: sendResult && sendResult.id ? sendResult.id.id : undefined });
    } catch (err) {
        console.error(`[WA TEST SEND ERROR] Gagal kirim test ke ${waNumber} (tenant: ${tenantId}):`, err.message);
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
        } catch {}
        logs.unshift(entry);
        if (logs.length > 2000) logs = logs.slice(0, 2000); // keep last 2000
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error('Gagal menulis log WA:', err.message);
    }
}
// ...existing code...

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
    // Backward compatible: if secret not configured, keep endpoint accessible.
    if (!WA_ADMIN_SECRET) return true;

    const provided = String(req.get(WA_ADMIN_SECRET_HEADER) || '').trim();
    if (!provided) return false;
    return provided === WA_ADMIN_SECRET;
}

function requireWaAdminSecret(req, res) {
    if (hasValidWaAdminSecret(req)) return true;
    res.status(403).json({ success: false, error: 'Forbidden: invalid admin secret' });
    return false;
}

function createWaClient(tenantId, session) {
    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: `auth_data/${tenantId}` }),
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
        console.log(`\n==== STATUS: BUTUH SCAN QR [${tenantId}] ====`);
        console.log(`WAKTU PERMINTAAN QR: ${now}`);
        // Jika ingin menampilkan user, tambahkan info user di sini
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
        console.log(`✅ WhatsApp Bot Ready! [${tenantId}]`);
        session.isReady = true;
        session.status = 'ready';
        session.currentQR = null;
        session.lastError = null;
    });

    client.on('disconnected', () => {
        console.log(`❌ WhatsApp Disconnected! [${tenantId}]`);
        session.isReady = false;
        session.status = 'disconnected';
        session.currentQR = null;
    });

    client.on('auth_failure', () => {
        console.error(`❌ WhatsApp Auth Failed [${tenantId}]`);
        session.status = 'disconnected';
        session.isReady = false;
        session.currentQR = null;
        session.lastError = 'Authentication failure';
    });

    return client;
}

async function clearTenantAuthData(tenantId) {
    const authPath = `auth_data/${tenantId}`;
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
    } catch (err) {
        warning = warning || `Gagal membersihkan auth session: ${err.message}`;
    }

    session.client = null;
    session.isReady = false;
    session.status = 'disconnected';
    session.currentQR = null;
    session.initPromise = null;
    session.lastError = null;

    ensureTenantClient(tenantId).catch((err) => {
        session.status = 'offline';
        session.isReady = false;
        session.currentQR = null;
        session.lastError = err.message;
    });

    return warning;
}

ensureTenantClient('tenant-default').catch((err) => {
    const session = getOrCreateTenantSession('tenant-default');
    console.error('Failed to initialize WhatsApp client [tenant-default]', err.message);
    session.status = 'offline';
    session.isReady = false;
    session.currentQR = null;
    session.lastError = err.message;
});


// ----- EMAIL CLIENT (NODEMAILER) -----
// Anda perlu mengganti konfigurasi ini dengan Gmail Anda
// dan mengaktifkan "App Password" dari setelan keamanan Google Account
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'EMAIL_ANDA@gmail.com', // Ganti dengan Gmail Admin
        pass: 'APP_PASSWORD_ANDA'     // Ganti dengan Google App Password
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

function buildLegacySignature({ tenantId, eventId, ticketId, dayNumber }) {
    return Buffer.from(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|event-2026`).toString('base64');
}

function buildSecureSignature({ tenantId, eventId, ticketId, dayNumber, secureCode, secureRef }) {
    return Buffer.from(`${tenantId}|${eventId}|${ticketId}|${dayNumber}|${secureCode}|${secureRef}|event-secure-v3`).toString('base64');
}

function normalizeQRPayload(rawQr) {
    let parsed;
    try {
        parsed = JSON.parse(String(rawQr || ''));
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    return {
        ticketId: String(parsed.tid || '').trim(),
        tenantId: String(parsed.t || '').trim(),
        eventId: String(parsed.e || '').trim(),
        dayNumber: Number(parsed.d),
        signature: String(parsed.sig || '').trim(),
        secureRef: String(parsed.r || '').trim(),
        version: Number(parsed.v || 1)
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
    res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/wa/runtime', (_req, res) => {
    if (!requireWaAdminSecret(_req, res)) return;
    res.json(buildRuntimeInfo());
});

// 1. Status Check & QR Retreival
app.get('/api/wa/status', (req, res) => {
    const tenantId = resolveTenantId(req);
    const session = getOrCreateTenantSession(tenantId);
    const requestedBy = getRequesterInfo(req);

    if (!session.client && !session.initPromise) {
        ensureTenantClient(tenantId).catch((err) => {
            const current = getOrCreateTenantSession(tenantId);
            current.status = 'offline';
            current.lastError = err.message;
        });
    }

    // Log permintaan QR
    console.log(`[WA][QR_REQUEST] tenant_id=${tenantId} requested_by=${requestedBy || '-'} status=${session.status} time=${new Date().toISOString()}`);

    res.json({
        tenant_id: tenantId,
        status: session.status,
        qrCode: session.currentQR,
        isReady: session.isReady,
        lastError: session.lastError,
        requested_by: requestedBy
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

// 2. Send Ticket (WA & Email)
app.post('/api/send-ticket', async (req, res) => {
    const tenantId = resolveTenantId(req);
    const { name, phone, phones, email, ticket_id, category, day_number, qr_data, send_wa, send_email, wa_send_mode } = req.body;

    // phones: array nomor WA, phone: satu nomor WA (backward compatible)
    const phoneList = Array.isArray(phones) && phones.length > 0 ? phones : (phone ? [phone] : []);
    const results = { wa: [], email: null };
    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_data)}`;
    const waSendMode = wa_send_mode === 'message_with_barcode' ? 'message_with_barcode' : 'message_only';

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
            results.wa = phoneList.map(p => ({ phone: p, status: 'Failed', error: 'WA Client Not Ready' }));
        } else {
            const waMessage = req.body.wa_message || `🎫 *E-Ticket*\n\nHalo *${name}*,\nBerikut tiket masuk Anda untuk *Hari ke-${day_number}*.\n\n📋 *Ticket ID:* ${ticket_id}\n📂 *Kategori:* ${category}\n\nSilakan tunjukkan barcode tiket ini kepada petugas gerbang event. Terima kasih.\n\n_3oNs Digital_`;
            const sendTasks = phoneList.map(async (p) => {
                const waNumber = formatPhoneWA(p);
                try {
                    console.log(`[WA SEND] Mulai kirim ke ${waNumber} (ticket_id: ${ticket_id})`);
                    let sendResult;
                    if (waSendMode === 'message_only') {
                        sendResult = await Promise.race([
                            session.client.sendMessage(waNumber, waMessage),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))
                        ]);
                    } else {
                        const response = await fetch(qrPublicUrl);
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const base64Str = buffer.toString('base64');
                        const media = new MessageMedia('image/png', base64Str, `Ticket_${ticket_id}.png`);
                        sendResult = await Promise.race([
                            session.client.sendMessage(waNumber, media, { caption: waMessage }),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))
                        ]);
                    }
                    console.log(`[WA SEND] Sukses kirim ke ${waNumber} (ticket_id: ${ticket_id})`, sendResult && sendResult.id ? `msgId: ${sendResult.id.id}` : '');
                    return { phone: p, status: 'Success', msgId: sendResult && sendResult.id ? sendResult.id.id : undefined };
                } catch (err) {
                    console.error(`[WA SEND ERROR] Gagal kirim ke ${waNumber} (ticket_id: ${ticket_id}):`, err.message);
                    return { phone: p, status: 'Failed', error: err.message };
                }
            });
            results.wa = await Promise.all(sendTasks);
        }
        // Log hasil pengiriman batch WA
        logWaSendBatch(tenantId, phoneList, results.wa, { ticket_id, category, day_number });
    }

    // B. PROSES SEND EMAIL (tidak diubah, tetap satu email)
    if (send_email && email) {
        if (transporter.options.auth.user === 'EMAIL_ANDA@gmail.com') {
            results.email = 'Failed - Harap setup Nodemailer Auth di index.js Server';
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
app.post('/api/ticket/verify', (req, res) => {
    const qr = normalizeQRPayload(req?.body?.qr_data);
    if (!qr || !qr.ticketId || !qr.tenantId || !qr.eventId || !qr.signature || !Number.isFinite(qr.dayNumber)) {
        return res.status(400).json({ valid: false, reason: 'invalid_payload' });
    }

    const requestedTenant = normalizeTenantId(req?.body?.tenant_id || qr.tenantId);
    if (requestedTenant !== qr.tenantId) {
        return res.status(400).json({ valid: false, reason: 'tenant_mismatch' });
    }

    const secureCode = String(req?.body?.secure_code || '').trim();
    const secureRef = String(req?.body?.secure_ref || '').trim();

    // v3 secure mode: verify with hidden participant token sent by scanner app
    if (qr.version >= 3 || qr.secureRef) {
        if (!secureCode || !secureRef || secureRef !== qr.secureRef) {
            return res.json({ valid: false, reason: 'missing_secure_token', mode: 'v3-secure' });
        }

        const expected = buildSecureSignature({
            tenantId: qr.tenantId,
            eventId: qr.eventId,
            ticketId: qr.ticketId,
            dayNumber: qr.dayNumber,
            secureCode,
            secureRef
        });

        const valid = expected === qr.signature;
        return res.json({ valid, reason: valid ? 'ok' : 'invalid_signature', mode: 'v3-secure' });
    }

    // Legacy mode fallback for old tickets
    const expectedLegacy = buildLegacySignature({
        tenantId: qr.tenantId,
        eventId: qr.eventId,
        ticketId: qr.ticketId,
        dayNumber: qr.dayNumber
    });

    const validLegacy = expectedLegacy === qr.signature;
    return res.json({ valid: validLegacy, reason: validLegacy ? 'ok' : 'invalid_signature', mode: 'legacy-v2' });
});

// ===== IMPORT BARCODE API ENDPOINTS =====

// API: Extract QR from image
app.post('/api/import/barcode', async (req, res) => {
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
        expectedSignature = buildSecureSignature({
            tenantId,
            eventId: event_id,
            ticketId: ticket_id,
            dayNumber: day_number,
            secureCode: secure_code,
            secureRef: secure_ref
        });
        mode = 'v3-secure';
    } else {
        expectedSignature = buildLegacySignature({
            tenantId,
            eventId: event_id,
            ticketId: ticket_id,
            dayNumber: day_number
        });
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
    const tenantId = normalizeTenantId(req?.query?.tenant_id);
    const logs = importLogs.get(tenantId) || [];
    res.json({
        tenant_id: tenantId,
        total: logs.length,
        logs: logs.slice(0, 20) // Return latest 20
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 3oNs Digital WA/Email Bot API Server berjalan di http://localhost:${PORT}`);
});
