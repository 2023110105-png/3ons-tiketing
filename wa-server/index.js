const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const tenantSessions = new Map();

function normalizeTenantId(rawTenantId) {
    const value = String(rawTenantId || 'tenant-default').trim();
    const safe = value.replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || 'tenant-default';
}

function resolveTenantId(req) {
    return normalizeTenantId(req?.query?.tenant_id || req?.body?.tenant_id);
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

function createWaClient(tenantId, session) {
    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: `auth_data/${tenantId}` }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        console.log(`\n==== STATUS: BUTUH SCAN QR [${tenantId}] ====`);
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

    try {
        if (!session.client && !session.initPromise) {
            await ensureTenantClient(tenantId);
        }
    } catch (err) {
        warning = err.message;
    }

    if (session.initPromise) {
        try {
            await session.initPromise;
        } catch (err) {
            warning = warning || err.message;
        }
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

    session.client = null;
    session.isReady = false;
    session.status = 'disconnected';
    session.currentQR = null;
    session.initPromise = null;
    session.lastError = null;

    await ensureTenantClient(tenantId);
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


// ----- API ROUTES -----

// 1. Status Check & QR Retreival
app.get('/api/wa/status', (req, res) => {
    const tenantId = resolveTenantId(req);
    const session = getOrCreateTenantSession(tenantId);

    if (!session.client && !session.initPromise) {
        ensureTenantClient(tenantId).catch((err) => {
            const current = getOrCreateTenantSession(tenantId);
            current.status = 'offline';
            current.lastError = err.message;
        });
    }

    res.json({
        tenant_id: tenantId,
        status: session.status,
        qrCode: session.currentQR,
        isReady: session.isReady,
        lastError: session.lastError
    });
});

// 1.5. Logout/Disconnect Bot
app.post('/api/wa/logout', async (req, res) => {
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
    const { name, phone, email, ticket_id, category, day_number, qr_data, send_wa, send_email } = req.body;

    const results = { wa: null, email: null };
    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_data)}`;

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

    // A. PROSES SEND WHATSAPP
    if (send_wa && phone) {
        if (!session.isReady || !session.client) {
            results.wa = 'Failed - WA Client Not Ready';
        } else {
            try {
                const waNumber = formatPhoneWA(phone);
                
                // Ambil gambar secara manual untuk menghindari error MIME
                const response = await fetch(qrPublicUrl);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64Str = buffer.toString('base64');
                const media = new MessageMedia('image/png', base64Str, `Ticket_${ticket_id}.png`);

                const waMessage = req.body.wa_message || `🎫 *E-Ticket*\n\nHalo *${name}*,\nBerikut tiket masuk Anda untuk *Hari ke-${day_number}*.\n\n📋 *Ticket ID:* ${ticket_id}\n📂 *Kategori:* ${category}\n\nSilakan tunjukkan barcode tiket ini kepada petugas gerbang event. Terima kasih.\n\n_3oNs Digital_`;
                
                // Kirim Gambar + Caption
                await session.client.sendMessage(waNumber, media, { caption: waMessage });
                results.wa = 'Success';
            } catch (err) {
                console.error('WA Send Error:', err.message);
                results.wa = 'Failed - ' + err.message;
            }
        }
    }

    // B. PROSES SEND EMAIL
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

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 3oNs Digital WA/Email Bot API Server berjalan di http://localhost:${PORT}`);
});
