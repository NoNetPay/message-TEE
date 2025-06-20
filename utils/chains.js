const { defineChain } = require("viem");

const pharosTestnet = defineChain({
  id: 688688,
  name: "Pharos Testnet",
  network: "pharos-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Pharos",
    symbol: "PHRS",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.dplabs-internal.com"],
      webSocket: ["wss://testnet.dplabs-internal.com"],
    },
    public: {
      http: ["https://testnet.dplabs-internal.com"],
      webSocket: ["wss://testnet.dplabs-internal.com"],
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

module.exports = { pharosTestnet };
