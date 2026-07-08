const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair');

// Import WhatsApp modules
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers } = require('queenruva-sockets');
const { sms } = require('./msg');
const config = require('./config');
const fs = require('fs-extra');
const path = require('path');

// Import your case.js
const { handleCommand } = require('./case');

require('events').EventEmitter.defaultMaxListeners = 500;

// ============ EXPRESS SERVER (Keep-Alive) ============
app.use('/code', code);
app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html');
});
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

// ============ WHATSAPP CLIENT ============
let conn = null;
let isConnecting = false;

async function startBot() {
    if (isConnecting) return;
    isConnecting = true;
    
    try {
        // Session management
        const sessionPath = path.join(__dirname, 'session');
        await fs.ensureDir(sessionPath);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // Create WhatsApp connection
        conn = makeWASocket({
            auth: state,
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: true,
            defaultQueryTimeoutMs: undefined,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
        });

        // Save credentials when updated
        conn.ev.on('creds.update', saveCreds);

        // Handle connection updates
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 Scan QR Code with WhatsApp');
                console.log(qr);
            }

            if (connection === 'open') {
                isConnecting = false;
                console.log('✅ WhatsApp Bot Connected Successfully!');
                console.log(`📱 Bot Number: ${conn.user.id}`);
                
                // Send startup notification to owner
                try {
                    const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `🤖 *Bot Started Successfully!*\n\n🟢 Status: Online\n📱 Number: ${conn.user.id}\n⏰ Time: ${new Date().toLocaleString()}` 
                    });
                } catch (e) {}

                await conn.sendPresenceUpdate('available');
            }

            if (connection === 'close') {
                isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ Connection closed. Status: ${statusCode}`);
                
                if (statusCode !== 401) {
                    console.log('🔄 Reconnecting in 3 seconds...');
                    setTimeout(startBot, 3000);
                } else {
                    console.log('⚠️ Session expired. Please re-pair.');
                    await fs.remove(sessionPath).catch(() => {});
                    setTimeout(startBot, 5000);
                }
            }
        });

        // ============ MESSAGE HANDLER ============
        conn.ev.on('messages.upsert', async (messageData) => {
            try {
                const m = messageData.messages[0];
                if (!m.message) return;
                if (m.key && m.key.fromMe) return;

                const message = await sms(conn, m);
                const prefix = config.PREFIX || '.';
                
                if (!message.body || !message.body.startsWith(prefix)) return;
                
                const args = message.body.slice(prefix.length).trim().split(/ +/);
                const command = args.shift().toLowerCase();

                console.log(`📨 Command: ${command} from ${message.sender}`);

                try {
                    await handleCommand({
                        command: command,
                        args: args,
                        message: message,
                        conn: conn,
                        prefix: prefix,
                        config: config,
                        isOwner: message.sender.split('@')[0] === config.OWNER_NUMBER,
                        isAdmin: await checkAdmin(message.sender.split('@')[0])
                    });
                } catch (handlerError) {
                    console.error('❌ Case.js handler error:', handlerError);
                    await message.reply('⚠️ Error executing command. Please try again.');
                }

                global.commandCount = (global.commandCount || 0) + 1;

            } catch (error) {
                console.error('❌ Message handler error:', error);
            }
        });

        // ============ CHECK ADMIN FUNCTION ============
        async function checkAdmin(number) {
            try {
                const adminList = JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf-8'));
                return adminList.includes(number);
            } catch (e) {
                return false;
            }
        }

        // ============ AUTO VIEW STATUS ============
        if (config.AUTO_VIEW_STATUS === 'true') {
            conn.ev.on('messages.upsert', async (m) => {
                try {
                    const msg = m.messages[0];
                    if (msg.message?.statusUpdateMessage) {
                        // Handle status updates if needed
                    }
                } catch (e) {}
            });
        }

        // ============ KEEP-ALIVE MECHANISM ============
        // Self-ping to keep Render awake
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}`);
                console.log('💓 Self-ping successful at', new Date().toISOString());
            } catch (e) {
                console.log('⚠️ Self-ping failed');
            }
        }, 240000);

        // WhatsApp keep-alive
        setInterval(async () => {
            try {
                if (conn && conn.user) {
                    await conn.sendPresenceUpdate('available');
                    console.log('💚 Presence updated');
                }
            } catch (e) {}
        }, 60000);

        // External URL ping
        if (process.env.RENDER_EXTERNAL_URL) {
            setInterval(async () => {
                try {
                    await fetch(process.env.RENDER_EXTERNAL_URL);
                } catch (e) {}
            }, 240000);
        }

        isConnecting = false;
        return conn;

    } catch (error) {
        isConnecting = false;
        console.error('❌ Bot initialization error:', error);
        console.log('🔄 Restarting in 5 seconds...');
        setTimeout(startBot, 5000);
    }
}

// ============ STATUS ENDPOINT ============
app.get('/status', async (req, res) => {
    try {
        const isOnline = conn && conn.user ? true : false;
        const uptime = process.uptime();
        
        let adminCount = 0;
        try {
            const adminList = JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf-8'));
            adminCount = adminList.length;
        } catch (e) {}

        res.json({
            status: isOnline ? 'online' : 'offline',
            botNumber: conn?.user?.id || 'Not connected',
            uptime: uptime,
            commandCount: global.commandCount || 0,
            adminCount: adminCount,
            serverTime: new Date().toISOString(),
            memory: process.memoryUsage(),
            version: require('./package.json').version
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// ============ START THE BOT ============
startBot();

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (conn) {
        await conn.ws.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM. Shutting down...');
    if (conn) {
        await conn.ws.close();
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

module.exports = app;