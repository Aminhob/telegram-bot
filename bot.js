const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// CONFIG
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = [123456789]; // <-- beddel chatId-gaaga adiga (admin)
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// INIT DB
const db = new sqlite3.Database('./licenses.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS licenses (
    code TEXT PRIMARY KEY,
    expiresAt INTEGER,
    agent TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agents (
    username TEXT PRIMARY KEY,
    promo_code TEXT
  )`);
});

// KAYDKA SESSION-KA TEMP
let sessions = {}; // { chatId: { step: "username"/"promo", temp: {} } }

// ----------------- COMMAND: /addagent -----------------
bot.onText(/\/addagent (\w+) (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!ADMIN_IDS.includes(chatId)) return;

  const username = match[1];
  const promo = match[2];

  db.run("INSERT OR REPLACE INTO agents (username, promo_code) VALUES (?, ?)", [username, promo], (err) => {
    if (err) {
      bot.sendMessage(chatId, "❌ Error adding agent.");
    } else {
      bot.sendMessage(chatId, `✅ Agent added: ${username} / ${promo}`);
    }
  });
});

// ----------------- COMMAND: /gen -----------------
bot.onText(/\/gen (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const days = parseInt(match[1]);

  // Start session
  sessions[chatId] = { step: "username", temp: { days } };
  bot.sendMessage(chatId, "✅ Please enter your username:");
});

// ----------------- HANDLE TEXT MESSAGES -----------------
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const session = sessions[chatId];

  if (!session || msg.text.startsWith("/")) return;

  if (session.step === "username") {
    session.temp.username = msg.text;
    session.step = "promo";
    bot.sendMessage(chatId, "Please enter your promo code:");
  } else if (session.step === "promo") {
    const inputUsername = session.temp.username;
    const inputPromo = msg.text;

    db.get("SELECT * FROM agents WHERE username = ? AND promo_code = ?", [inputUsername, inputPromo], (err, row) => {
      if (row) {
        // Promo correct → create license
        const code = crypto.randomBytes(6).toString('hex').toUpperCase();
        const expiresAt = Date.now() + session.temp.days * 24 * 60 * 60 * 1000;

        db.run("INSERT INTO licenses (code, expiresAt, agent) VALUES (?, ?, ?)", [code, expiresAt, inputUsername]);

        bot.sendMessage(chatId, `✅ License Created!\nCode: ${code}\nValid for: ${session.temp.days} days\nAgent: ${inputUsername}`);
      } else {
        bot.sendMessage(chatId, "❌ Username or promo code incorrect. License not created.");
      }
    });

    // Clear session
    delete sessions[chatId];
  }
});

// ----------------- OPTIONAL: /verify -----------------
bot.onText(/\/verify (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const code = match[1];

  db.get("SELECT * FROM licenses WHERE code = ?", [code], (err, row) => {
    if (row) {
      const valid = Date.now() < row.expiresAt;
      bot.sendMessage(chatId, `License: ${code}\nAgent: ${row.agent}\nValid: ${valid ? "Yes" : "Expired"}`);
    } else {
      bot.sendMessage(chatId, `License not found.`);
    }
  });
});
