const db = require("../db");
const utils = require("../utils");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const walletUtils = require("../utils/walletUtils");

const getBlockNumber = async (req, res, next) => {
  try {
    const publicClient = walletUtils.publicClient;
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);

    res.json({
      success: true,
      data: {
        blockNumber: blockNumber.toString(),
      },
    });

  } catch (err) {
    next(err);
  }
};

const getWalletBalance = async (req, res, next) => {
  try {
    const publicClient = walletUtils.publicClient;
    const blockNumber = await publicClient.getBlockNumber();
    const balance = await publicClient.getBalance({
      address: req.params.address,
      blockNumber
    });
    console.log(`Current balance: ${balance}`);

    res.json({
      success: true,
      data: {
        balance: balance.toString(),
      },
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWalletBalance,
  getBlockNumber,
};
