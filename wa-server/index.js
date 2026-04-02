const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// ----- WHATSAPP CLIENT -----
const waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: 'auth_data' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isWaReady = false;
let waStatus = 'disconnected'; // disconnected, qr, ready
let currentQR = null;

waClient.on('qr', async (qr) => {
    console.log('\n==== STATUS: BUTUH SCAN QR ====');
    waStatus = 'qr';
    try {
        currentQR = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('Failed to generate QR DataURL', err);
    }
});

waClient.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready!');
    isWaReady = true;
    waStatus = 'ready';
    currentQR = null;
});

waClient.on('disconnected', () => {
    console.log('❌ WhatsApp Disconnected!');
    isWaReady = false;
    waStatus = 'disconnected';
    currentQR = null;
});

waClient.on('auth_failure', () => {
    console.error('❌ WhatsApp Auth Failed');
    waStatus = 'disconnected';
});

waClient.initialize();


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
    res.json({ status: waStatus, qrCode: currentQR, isReady: isWaReady });
});

// 1.5. Logout/Disconnect Bot
app.post('/api/wa/logout', async (req, res) => {
    try {
        await waClient.logout();
        waStatus = 'disconnected';
        isWaReady = false;
        currentQR = null;
        res.json({ success: true, message: 'Bot Logout Successfully' });
        
        // Re-initialize to get a new QR code
        waClient.initialize();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Send Ticket (WA & Email)
app.post('/api/send-ticket', async (req, res) => {
    const { name, phone, email, ticket_id, category, day_number, qr_data, send_wa, send_email } = req.body;

    const results = { wa: null, email: null };
    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_data)}`;

    // A. PROSES SEND WHATSAPP
    if (send_wa && phone) {
        if (!isWaReady) {
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
                await waClient.sendMessage(waNumber, media, { caption: waMessage });
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

    res.json({ success: true, results });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 3oNs Digital WA/Email Bot API Server berjalan di http://localhost:${PORT}`);
});
