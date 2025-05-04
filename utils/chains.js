const { defineChain } = require("viem");

const pharosDevnet = defineChain({
  id: 50002,
  name: "Pharos Devnet",
  network: "pharos-devnet",
  nativeCurrency: {
    decimals: 18,
    name: "Pharos",
    symbol: "PHS",
  },
  rpcUrls: {
    default: {
      http: ["https://devnet.dplabs-internal.com"],
      webSocket: ["wss://devnet.dplabs-internal.com"],
    },
    public: {
      http: ["https://devnet.dplabs-internal.com"],
      webSocket: ["wss://devnet.dplabs-internal.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "PharosScan",
      url: "https://pharosscan.xyz/",
    },
  },
  testnet: true,
  rateLimit: "500 times/5m",
  maxPendingTxs: 64,
});

module.exports = { pharosDevnet };
