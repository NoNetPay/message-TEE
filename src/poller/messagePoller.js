const db = require("../db");
const utils = require("../utils");
const {
  sendBalanceInfo,
  sendUsdcBalanceInfo,
  sendMintUsdcInfo,transfer
} = require("../services/balanceService");
const { registerIfNeeded } = require("../services/registrationService");

let lastSeenTimestamp = 0;

async function pollMessagesAndProcess() {
  try {
    if (!utils.checkDatabaseExists()) return;

    // Get the most recent messages
    const rows = await db.getAllMessages(100, 0);
    const messages = utils.formatMessages(rows);

    let newMessagesProcessed = false;

    for (const row of messages) {
      const msg = row.text?.trim().toLowerCase();
      const ts = row.timestamp;

      // Only process messages newer than our last seen timestamp
      if (ts <= lastSeenTimestamp) continue;

      // Update the last seen timestamp for any new message
      if (ts > lastSeenTimestamp) {
        lastSeenTimestamp = ts;
        newMessagesProcessed = true;
      }

      if (msg === "register" && row.phoneNumber) {
        console.log("⏳ Registering new user:", row.phoneNumber);
        const receivedData = await registerIfNeeded(row.phoneNumber);
        console.log("receivedData", receivedData);

       
        if (receivedData !== "already_registered") {
          await utils.sendMessageViaAppleScript(
            row.phoneNumber,
            `You are now registered.`
          );

          await utils.sendMessageViaAppleScript(
            row.phoneNumber,
            `https://pharosscan.xyz/address/${receivedData.safeAddress}`
          );
        } else {
          await utils.sendMessageViaAppleScript(
            row.phoneNumber,
            `You are already registered.`
          );
        }
      } else if (msg === "balance" && row.phoneNumber) {
        console.log("💰 Checking ETH balance for user:", row.phoneNumber);
        await sendBalanceInfo(row.phoneNumber);
      } else if (msg === "usdc balance" && row.phoneNumber) {
        console.log("💵 Checking USDC balance for user:", row.phoneNumber);
        await sendUsdcBalanceInfo(row.phoneNumber);
      } else if (msg === "mint usdc" && row.phoneNumber) {
        console.log("💸 Minting USDC for user:", row.phoneNumber);
        await sendMintUsdcInfo(row.phoneNumber);
      } else if (
        msg.startsWith("mint") &&
        msg.includes("usdc") &&
        row.phoneNumber
      ) {
        console.log("Message contains mint command:", msg);
        const parts = msg.split(" ");
        const amountIndex = parts.findIndex((p) => p === "mint") + 1;
        const amount = parseFloat(parts[amountIndex]);

        if (!isNaN(amount) && amount > 0) {
          console.log(`💸 Minting ${amount} USDC for user:`, row.phoneNumber);
          await sendMintUsdcInfo(row.phoneNumber, amount);
        } else {
          console.log(`⚠️ Invalid mint amount from ${row.phoneNumber}`);
          await utils.sendMessageViaAppleScript(
            row.phoneNumber,
            "Invalid mint command. Use: mint 5 usdc"
          );
        }
      } else if (msg === "transfer" && row.phoneNumber) {
        console.log("💸 Transfer USDC for user:", row.phoneNumber);
        await transfer(row.phoneNumber);
      }
    }

    if (newMessagesProcessed) {
      console.log(`Processed messages up to timestamp: ${lastSeenTimestamp}`);
    }
  } catch (err) {
    console.error("Error polling messages:", err.message);
  }
}

async function initializeLastSeen() {
  try {
    if (!utils.checkDatabaseExists()) return;

    const rows = await db.getAllMessages(1, 0);
    if (rows && rows.length > 0) {
      const messages = utils.formatMessages(rows);
      if (messages.length > 0) {
        // Set the initial lastSeenTimestamp to the most recent message
        lastSeenTimestamp = messages[0].timestamp;
        console.log(`Initialized last seen timestamp to: ${lastSeenTimestamp}`);
      }
    }
  } catch (err) {
    console.error("Error initializing last seen timestamp:", err.message);
  }
}

function startPolling(interval = 1000) {
  console.log("🛰️ Starting iMessage poller...");
  initializeLastSeen().then(() => {
    setInterval(pollMessagesAndProcess, interval);
  });
}

module.exports = { startPolling };
