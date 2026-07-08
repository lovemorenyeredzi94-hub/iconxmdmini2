const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('queenruva-sockets');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { makeid } = require('./Id');

// Store pairing codes
const pairStore = {};

// Pairing page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Generate pairing code
router.post('/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const sessionPath = path.join(__dirname, 'session');
        await fs.ensureDir(sessionPath);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false,
        });

        sock.ev.on('creds.update', saveCreds);

        // Request pairing code
        const code = await sock.requestPairingCode(cleanNumber);
        
        // Store for verification
        const pairId = makeid(8);
        pairStore[pairId] = {
            number: cleanNumber,
            code: code,
            timestamp: Date.now()
        };

        // Clean up old entries
        setTimeout(() => {
            delete pairStore[pairId];
        }, 300000); // 5 minutes

        res.json({
            success: true,
            pairId: pairId,
            message: `Pairing code sent to ${cleanNumber}`,
            code: code
        });

        console.log(`📱 Pairing code sent to ${cleanNumber}: ${code}`);

    } catch (error) {
        console.error('❌ Pairing error:', error);
        res.status(500).json({ 
            error: 'Failed to generate pairing code',
            details: error.message 
        });
    }
});

// Verify pair code
router.post('/verify', async (req, res) => {
    try {
        const { pairId, code } = req.body;
        
        if (!pairStore[pairId]) {
            return res.status(404).json({ error: 'Pairing session not found or expired' });
        }

        if (pairStore[pairId].code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Success - start the bot
        delete pairStore[pairId];
        
        res.json({
            success: true,
            message: '✅ Bot paired successfully!',
            number: pairStore[pairId]?.number
        });

    } catch (error) {
        console.error('❌ Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Get pairing status
router.get('/status/:pairId', (req, res) => {
    const { pairId } = req.params;
    if (pairStore[pairId]) {
        res.json({
            exists: true,
            number: pairStore[pairId].number,
            timestamp: pairStore[pairId].timestamp
        });
    } else {
        res.json({ exists: false });
    }
});

module.exports = router;