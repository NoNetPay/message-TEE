const db = require("../db");
const utils = require("../utils");
const { privateKeyToAccount, generatePrivateKey , privateKeyToHex} = require("viem/accounts");
const sqlite3 = require("sqlite3").verbose();
const config = require("../config");

let lastSeenTimestamp = 0;

async function pollMessagesAndRegister() {
  try {
    if (!utils.checkDatabaseExists()) return;

    const rows = await db.getAllMessages(100, 0);
    const messages = utils.formatMessages(rows);

    for (const row of messages) {
      const msg = row.text?.trim().toLowerCase();
      const ts = row.timestamp;

      if (msg === "register" && row.phoneNumber && ts > lastSeenTimestamp) {
        console.log("⏳ Registering new user:", row.phoneNumber);
        await registerIfNeeded(row.phoneNumber);
        lastSeenTimestamp = ts;
      }
    }
  } catch (err) {
    console.error("Error polling messages:", err.message);
  }
}

function startPolling(interval = 1000) {
  console.log("🛰️ Starting iMessage poller...");
  setInterval(pollMessagesAndRegister, interval);
}

async function registerIfNeeded(phoneNumber) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const checkUser = `SELECT * FROM users WHERE phone_number = ?`;

  return new Promise((resolve, reject) => {
    dbConn.get(checkUser, [phoneNumber], async (err, row) => {
      if (err) return reject(err);
      if (row) {
        dbConn.close();
        return resolve(null); // already registered
      }

      const privateKey = generatePrivateKey();
      console.log("Generated PK:", privateKey);

      const account = privateKeyToAccount(privateKey);
      const privateKeyHex = typeof privateKey === "string" ? privateKey : privateKeyToHex(privateKey);
const encrypted = utils.encrypt(privateKeyHex);


      const insertUser = `INSERT INTO users (phone_number, address, encrypted_private_key) VALUES (?, ?, ?)`;
      dbConn.run(insertUser, [phoneNumber, account.address, encrypted], async (err) => {
        dbConn.close();
        if (err) return reject(err);

        console.log(`✅ Registered ${phoneNumber}: ${account.address}`);
        try {
          const confirmation = `Wallet created Check it at:\nhttps://pharosscan.xyz/address/${account.address}`;
          await utils.sendMessageViaAppleScript(phoneNumber, confirmation);
        } catch (sendErr) {
          console.error("❌ Failed to send confirmation message:", sendErr.message);
        }

        resolve(account.address);
      });
    });
  });
}

module.exports = { startPolling };
