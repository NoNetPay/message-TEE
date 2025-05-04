const utils = require("../utils");
const sqlite3 = require("sqlite3").verbose();
const config = require("../config");

async function registerIfNeeded(phoneNumber) {
  // Existing registration code unchanged
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
      const privateKeyHex =
        typeof privateKey === "string"
          ? privateKey
          : privateKeyToHex(privateKey);
      const encrypted = utils.encrypt(privateKeyHex);

      const insertUser = `INSERT INTO users (phone_number, address, encrypted_private_key) VALUES (?, ?, ?)`;
      dbConn.run(
        insertUser,
        [phoneNumber, account.address, encrypted],
        async (err) => {
          dbConn.close();
          if (err) return reject(err);

          console.log(`✅ Registered ${phoneNumber}: ${account.address}`);
          try {
            const confirmation = `Wallet created Check it at:\nhttps://pharosscan.xyz/address/${account.address}`;
            await utils.sendMessageViaAppleScript(phoneNumber, confirmation);
          } catch (sendErr) {
            console.error(
              "❌ Failed to send confirmation message:",
              sendErr.message
            );
          }

          resolve(account.address);
        }
      );
    });
  });
}

async function getUserByPhoneNumber(phoneNumber) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address FROM users WHERE phone_number = ?`;

  return new Promise((resolve, reject) => {
    dbConn.get(getUser, [phoneNumber], (err, row) => {
      dbConn.close();

      if (err) return reject(err);

      if (!row) {
        return resolve(null); // User not found
      }

      resolve(row.address);
    });
  });
}

module.exports = {
  registerIfNeeded,
  getUserByPhoneNumber,
};
