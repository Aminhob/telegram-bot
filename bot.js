const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// === CONFIG ===
const BOT_TOKEN = "8287251560:AAHuqI8SlfpdVotxjaHNnHpTwptemuUI8jU"; // bedel markale reset
const PORT = 3000;

// === INIT BOT ===
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// === INIT EXPRESS API ===
const app = express();
app.use(bodyParser.json());

// === INIT DB ===
const db = new sqlite3.Database('./licenses.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS licenses (
    code TEXT PRIMARY KEY,
    expiresAt INTEGER
  )`);
});

// === FUNCTION: CREATE LICENSE ===
function createLicense(days) {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  db.run("INSERT INTO licenses (code, expiresAt) VALUES (?, ?)", [code, expiresAt]);
  return { code, expiresAt };
}

// === BOT COMMAND: /gen ===
bot.onText(/\/gen (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const days = parseInt(match[1]);
  const { code, expiresAt } = createLicense(days);
  bot.sendMessage(chatId, `✅ License Created\nCode: ${code}\nValid for: ${days} days\nExpires: ${new Date(expiresAt).toLocaleString()}`);
});

// === BOT COMMAND: /start ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 Salaam! Isticmaal /gen <days> si aad license u abuurto.\nTusaale: /gen 30");
});

// === API ENDPOINT: VERIFY LICENSE ===
app.post('/verify', (req, res) => {
  const { code } = req.body;
  db.get("SELECT * FROM licenses WHERE code = ?", [code], (err, row) => {
    if (err) return res.json({ success: false, error: err.message });
    if (!row) return res.json({ success: false, message: "❌ License not found" });

    if (Date.now() > row.expiresAt) {
      return res.json({ success: false, message: "❌ License expired" });
    }

    return res.json({ success: true, message: "✅ License valid", expiresAt: row.expiresAt });
  });
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`);
});
