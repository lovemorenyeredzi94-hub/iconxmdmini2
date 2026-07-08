require('dotenv').config();
const path = require("path");

const parseList = (envVar, fallback) => {
  if (!envVar) return fallback;
  try {
    return JSON.parse(envVar);
  } catch {
    return envVar.split(',').map(s => s.trim()).filter(Boolean);
  }
};

global.commandCount = 0;

module.exports = {
  // Bot behavior
  AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'true',
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'true',
  AUTO_RECORDING: process.env.AUTO_RECORDING || 'true',
  AUTO_BIO_UPDATE: 'true',
  AUTO_LIKE_EMOJI: parseList(process.env.AUTO_LIKE_EMOJI, ['💋', '🍬', '🫆', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭']),
  PREFIX: process.env.PREFIX || '.',
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),

  // Paths
  ADMIN_LIST_PATH: process.env.ADMIN_LIST_PATH || './database/admin.json',
  SESSION_BASE_PATH: process.env.SESSION_BASE_PATH || './session',
  NUMBER_LIST_PATH: process.env.NUMBER_LIST_PATH || './numbers.json',

  // Images / UI
  RCD_IMAGE_PATH: process.env.RCD_IMAGE_PATH || path.join(__dirname, "./lucid.jpg"),
  CAPTION: process.env.CAPTION || 'ICON-X MD',

  // Newsletter / channels
  NEWSLETTER_JID: (process.env.NEWSLETTER_JID || '120363426745883545@newsletter').trim(),
  CHANNEL_LINK: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb886p7GpLHSZRVeKQ39',
  MINI_URL: process.env.MINI_URL || 'https://iconxmdmini-1.onrender.com',

  // OTP & owner
  OTP_EXPIRY: parseInt(process.env.OTP_EXPIRY || '300000', 10),
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263781328870',

  // Misc
  GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://whatsapp.com/channel/0029Vb886p7GpLHSZRVeKQ39',
  PM2_NAME: process.env.PM2_NAME || 'ICON-X',
  
  // Keep alive settings
  KEEP_ALIVE_INTERVAL: parseInt(process.env.KEEP_ALIVE_INTERVAL || '240000', 10),
  PRESENCE_INTERVAL: parseInt(process.env.PRESENCE_INTERVAL || '60000', 10),
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY || '3000', 10),
};