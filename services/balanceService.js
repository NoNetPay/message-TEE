const walletUtils = require("../utils/walletUtils");
const utils = require("../utils");
const sqlite3 = require("sqlite3").verbose();
const config = require("../config");
const {
  formatEther,
  formatUnits,
  parseEther,
  createWalletClient,
  http,
} = require("viem");
const helper = require("../utils/helper");
const { privateKeyToAccount } = require("viem/accounts");
require("dotenv").config();

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
    return usdcBalance;
  } catch (error) {
    console.error("Error fetching USDC balance:", error.message);
    return "0"; // Return 0 as string in case of error
  }
}

async function sendMintUsdcInfo(phoneNumber, givenAmount) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address, encrypted_private_key, safe_address FROM users WHERE phone_number = ?`;

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

      const safeAddress = row.safe_address;
      console.log("safeAddress", safeAddress);

      //   throw new Error("Minting USDC is not allowed for this address.");

      const RPC_URL = process.env.RPC_URL || "https://eth.llamarpc.com";
      const CHAIN_ID = Number(process.env.CHAIN_ID || 1);

      const customChain = {
        id: CHAIN_ID,
        name: process.env.CHAIN_NAME || "Custom Chain",
        network: process.env.CHAIN_NETWORK || "custom",
        nativeCurrency: {
          name: process.env.NATIVE_CURRENCY_NAME || "Ether",
          symbol: process.env.NATIVE_CURRENCY_SYMBOL || "ETH",
          decimals: Number(process.env.NATIVE_CURRENCY_DECIMALS || 18),
        },
        rpcUrls: {
          default: { http: [RPC_URL] },
          public: { http: [RPC_URL] },
        },
      };

      console.log(`🔗 Using chain with ID: ${CHAIN_ID}`);
      console.log(`🔗 Using RPC URL: ${RPC_URL}`);

      const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY;
      if (!ALICE_PRIVATE_KEY) {
        console.error("❌ ALICE_PRIVATE_KEY not found in .env file");
        process.exit(1);
      }
      const formattedAlicePrivateKey = ALICE_PRIVATE_KEY.startsWith("0x")
        ? ALICE_PRIVATE_KEY
        : `0x${ALICE_PRIVATE_KEY}`;

      const aliceAccount = privateKeyToAccount(formattedAlicePrivateKey);
      const walletClient = createWalletClient({
        account: aliceAccount,
        chain: customChain,
        transport: http(RPC_URL),
      });

      try {
        let mintAmount;
        if (givenAmount) {
          mintAmount = parseEther(givenAmount.toString());
        } else {
          mintAmount = parseEther("1");
        }
        const txHash = await mintUSDC(safeAddress, mintAmount, walletClient);

        const message = `✅ Minted ${formatEther(
          mintAmount
        )} USDC to your address!\nTx Hash: ${txHash}\nView on explorer: https://pharosscan.xyz/tx/${txHash}`;

        console.log("message", message);
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
  const getUser = `SELECT safe_address FROM users WHERE phone_number = ?`;

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

      const address = row.safe_address;

      try {
        const usdcBalance = await getUSDCBalance(address);

        const message = `Your USDC balance:\n${formatEther(
          usdcBalance
        )} USDC\n\nAddress: ${address}\nView on explorer: https://pharosscan.xyz/address/${address}/tokens`;

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
  const getUser = `SELECT safe_address FROM users WHERE phone_number = ?`;

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

      const address = row.safe_address;

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
          //   await utils.sendMessageViaAppleScript(
          //     phoneNumber,
          //     "Sorry, couldn't retrieve your ETH balance. Please try again later."
          //   );
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

async function transfer(phoneNumber, toAddress, amount) {
  const dbConn = new sqlite3.Database(config.DB_PATH);
  const getUser = `SELECT address, encrypted_private_key, safe_address FROM users WHERE phone_number = ?`;

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

      const ownerAddress = row.address;
      const encryptedPrivateKey = row.encrypted_private_key;
      const safeAddress = row.safe_address;
      
      try {
        // Decrypt the private key (you'll need to implement this based on how you encrypt it)
        const privateKey = await helper.decryptPrivateKey(encryptedPrivateKey);
        
        // Create account from private key
        const account = privateKeyToAccount(privateKey);
        
        // Create a wallet client for signing
        const walletClient = createWalletClient({
          account,
          chain: customChain,
          transport: http(RPC_URL),
        });
        
        // For this example, we'll transfer 10 USDC to address 0
        const recipient = toAddress || "0x0000000000000000000000000000000000000000";
        const transferAmount = parseEther(amount || "10");
        
        // Encode the transaction data for USDC transfer
        // For a Safe transaction, we need to create a transaction object that will be signed
        // This typically involves the Safe's contract interface
        
        // 1. Create the USDC transfer calldata
        const usdcTransferCalldata = publicClient.encodeFunctionData({
          abi: USDC_ABI,
          functionName: "transfer", // Assuming there's a transfer function in the ABI
          args: [recipient, transferAmount],
        });
        
        // 2. Create the Safe transaction object
        // Note: In a real implementation, you would use the Safe SDK or similar
        // This is a simplified version
        const safeTransaction = {
          to: USDC_ADDRESS,
          value: 0n, // No ETH is being sent
          data: usdcTransferCalldata,
          operation: 0, // 0 for Call, 1 for DelegateCall
          safeTxGas: 0n,
          baseGas: 0n,
          gasPrice: 0n,
          gasToken: "0x0000000000000000000000000000000000000000",
          refundReceiver: "0x0000000000000000000000000000000000000000",
          nonce: await getSafeNonce(safeAddress), // You'll need to implement this function
        };
        
        // 3. Calculate the transaction hash that needs to be signed
        const safeTxHash = await calculateSafeTxHash(safeTransaction, safeAddress);
        
        // 4. Sign the transaction hash
        const signature = await walletClient.signMessage({
          message: { raw: safeTxHash },
        });
        
        // 5. Send the signed transaction to the user
        const message = `✅ Transaction signed!\n
          Safe Address: ${safeAddress}
          To: ${recipient}
          Amount: ${amount || "10"} USDC
          Signature: ${signature}
          
          This signature can be used to execute the transaction on your behalf.`;
        
        await utils.sendMessageViaAppleScript(phoneNumber, message);
        console.log(`✅ Transaction signed for ${phoneNumber}`);
        
        // 6. Optionally broadcast the transaction directly
        const txHash = await executeSafeTransaction(safeTransaction, signature, safeAddress);
        
        if (txHash) {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            `Transaction broadcast! Track it here: https://pharosscan.xyz/tx/${txHash}`
          );
        }
        
        resolve();
      } catch (error) {
        console.error("❌ Failed to sign transaction:", error.message);
        try {
          await utils.sendMessageViaAppleScript(
            phoneNumber,
            "Sorry, couldn't sign the transaction. Please try again later."
          );
        } catch (sendErr) {
          console.error("Failed to send error message:", sendErr.message);
        }
        reject(error);
      }
    });
  });
}

// Helper functions that you'll need to implement
async function getSafeNonce(safeAddress) {
  // Get the current nonce of the Safe contract
  try {
    // You would need the Safe ABI for this
    const nonce = await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI, // You'll need to define this
      functionName: "nonce",
    });
    return nonce;
  } catch (error) {
    console.error("Error getting Safe nonce:", error.message);
    return 0n; // Default to 0 if there's an error
  }
}

async function calculateSafeTxHash(safeTransaction, safeAddress) {
  // This would typically be done using the Safe SDK
  // For this example, we'll use a simplified approach
  
  // Pack the transaction data according to the Safe contract format
  // This is a simplified version and may need adjustment based on your Safe version
  const txData = publicClient.encodeFunctionData({
    abi: [
      {
        inputs: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "operation", type: "uint8" },
          { name: "safeTxGas", type: "uint256" },
          { name: "baseGas", type: "uint256" },
          { name: "gasPrice", type: "uint256" },
          { name: "gasToken", type: "address" },
          { name: "refundReceiver", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
        name: "getTransactionHash",
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getTransactionHash",
    args: [
      safeTransaction.to,
      safeTransaction.value,
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      safeTransaction.nonce,
    ],
  });
  
  // Call the Safe contract to get the transaction hash
  const txHash = await publicClient.readContract({
    address: safeAddress,
    abi: SAFE_ABI, // You'll need to define this
    functionName: "getTransactionHash",
    args: [
      safeTransaction.to,
      safeTransaction.value,
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      safeTransaction.nonce,
    ],
  });
  
  return txHash;
}

async function executeSafeTransaction(safeTransaction, signature, safeAddress) {
  try {
    // Get the wallet client for the default account that will broadcast the transaction
    const RPC_URL = process.env.RPC_URL || "https://eth.llamarpc.com";
    const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY;
    const formattedAlicePrivateKey = ALICE_PRIVATE_KEY.startsWith("0x")
      ? ALICE_PRIVATE_KEY
      : `0x${ALICE_PRIVATE_KEY}`;
    
    const aliceAccount = privateKeyToAccount(formattedAlicePrivateKey);
    const walletClient = createWalletClient({
      account: aliceAccount,
      chain: customChain,
      transport: http(RPC_URL),
    });
    
    // Execute the Safe transaction through the Safe contract
    const txHash = await walletClient.writeContract({
      address: safeAddress,
      abi: SAFE_ABI, // You'll need to define this
      functionName: "execTransaction",
      args: [
        safeTransaction.to,
        safeTransaction.value,
        safeTransaction.data,
        safeTransaction.operation,
        safeTransaction.safeTxGas,
        safeTransaction.baseGas,
        safeTransaction.gasPrice,
        safeTransaction.gasToken,
        safeTransaction.refundReceiver,
        signature,
      ],
    });
    
    return txHash;
  } catch (error) {
    console.error("Error executing Safe transaction:", error.message);
    return null;
  }
}

module.exports = { sendUsdcBalanceInfo, sendBalanceInfo, sendMintUsdcInfo, transfer };
