const walletUtils = require("../utils/walletUtils");
const utils = require("../utils");
const sqlite3 = require("sqlite3").verbose();
const config = require("../config");
const { formatEther, formatUnits, parseEther } = require("viem");
const helper = require("../utils/helper");

const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const USDC_ADDRESS = "0xa3B2a0D85A9A4e4d19880ccB9622b1cA4f3C6690";
const publicClient = walletUtils.publicClient;

async function getUSDCBalance(address) {
  try {
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    // USDC has 6 decimals
    return formatUnits(usdcBalance, 6);
  } catch (error) {
    console.error("Error fetching USDC balance:", error.message);
    return "0"; // Return 0 as string in case of error
  }
}

async function sendMintUsdcInfo(phoneNumber, givenAmount) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address, encrypted_private_key FROM users WHERE phone_number = ?`;

  return new Promise((resolve, reject) => {
    dbConn.get(getUser, [phoneNumber], async (err, row) => {
      dbConn.close();

      if (err) return reject(err);

      if (!row) {
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "You don't have a registered wallet. Text 'register' to create one."
          );
          return resolve();
        } catch (sendErr) {
          return reject(sendErr);
        }
      }

      const address = row.address;
      const encryptedPrivateKey = row.encrypted_private_key;
      const decryptedPrivateKey = helper.decrypt(encryptedPrivateKey);

      const walletClient = walletUtils.createWallet(decryptedPrivateKey);

      try {
        let mintAmount;
        if (givenAmount) {
          mintAmount = parseEther(givenAmount.toString());
        } else {
          mintAmount = parseEther("1");
        }
        const txHash = await mintUSDC(address, mintAmount, walletClient);

        const message = `✅ Minted ${formatEther(
          mintAmount
        )} USDC to your address!\nTx Hash: ${txHash}\nView on explorer: https://pharosscan.xyz/tx/${txHash}`;

        await utils.sendMessageViaAppleScript(phoneNumber, message);
        console.log(`✅ Minted USDC for ${phoneNumber}`);
        resolve();
      } catch (error) {
        console.error("❌ Failed to mint USDC:", error.message);
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "Sorry, couldn't mint USDC. Please try again later."
          );
        } catch (sendErr) {
          console.error("Failed to send error message:", sendErr.message);
        }
        reject(error);
      }
    });
  });
}

async function sendUsdcBalanceInfo(phoneNumber) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address FROM users WHERE phone_number = ?`;

  return new Promise((resolve, reject) => {
    dbConn.get(getUser, [phoneNumber], async (err, row) => {
      dbConn.close();

      if (err) return reject(err);

      if (!row) {
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "You don't have a registered wallet. Text 'register' to create one."
          );
          return resolve();
        } catch (sendErr) {
          return reject(sendErr);
        }
      }

      const address = row.address;

      try {
        const usdcBalance = await getUSDCBalance(address);

        const message = `Your USDC balance:\n${usdcBalance} USDC\n\nAddress: ${address}\nView on explorer: https://pharosscan.xyz/address/${address}/tokens`;

        await utils.sendMessageViaAppleScript(phoneNumber, message);
        console.log(`✅ Sent USDC balance info to ${phoneNumber}`);
        resolve();
      } catch (error) {
        console.error("❌ Failed to get USDC balance:", error.message);
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "Sorry, couldn't retrieve your USDC balance. Please try again later."
          );
        } catch (sendErr) {
          console.error("Failed to send error message:", sendErr.message);
        }
        reject(error);
      }
    });
  });
}

async function sendBalanceInfo(phoneNumber) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address FROM users WHERE phone_number = ?`;

  return new Promise((resolve, reject) => {
    dbConn.get(getUser, [phoneNumber], async (err, row) => {
      dbConn.close();

      if (err) return reject(err);

      if (!row) {
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "You don't have a registered wallet. Text 'register' to create one."
          );
          return resolve();
        } catch (sendErr) {
          return reject(sendErr);
        }
      }

      const address = row.address;

      try {
        // Get ETH balance
        const ethBalance = await publicClient.getBalance({ address });
        const formattedEthBalance = formatEther(ethBalance);

        // Send balance information back to the user
        const message = `Your ETH balance:\n${formattedEthBalance} ETH\n\nAddress: ${address}\nView on explorer: https://pharosscan.xyz/address/${address}`;

        await utils.sendMessageViaAppleScript(phoneNumber, message);
        console.log(`✅ Sent ETH balance info to ${phoneNumber}`);
        resolve();
      } catch (error) {
        console.error("❌ Failed to get ETH balance:", error.message);
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "Sorry, couldn't retrieve your ETH balance. Please try again later."
          );
        } catch (sendErr) {
          console.error("Failed to send error message:", sendErr.message);
        }
        reject(error);
      }
    });
  });
}

async function mintUSDC(address, amount, walletClient) {
  try {
    const result = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "mint",
      args: [address, amount],
    });
    return result; // This will be the transaction hash
  } catch (error) {
    console.error("Error minting USDC:", error.message);
    throw error;
  }
}

module.exports = { sendUsdcBalanceInfo, sendBalanceInfo, sendMintUsdcInfo };
