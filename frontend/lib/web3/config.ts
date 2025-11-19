export const BASE_MAINNET = {
  chainId: "0x2105", // 8453 in hex (Base Mainnet)
  chainName: "Base",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

export const MONAD_TESTNET = {
  chainId: "0x279F", // 10143 in hex (Monad Testnet)
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet-explorer.monad.xyz"],
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  // Base Mainnet Deployment (Latest)
  SECUREFLOW_ESCROW: "0x8084cDAfEB15D0C8D7F14dd88cfC3d123804A4d7", // Base mainnet
  MOCK_ERC20: "0x92a0C47e819b84069eb95776497421850103aa37", // Base mainnet
  REVIEW_SYSTEM: "0x7aB0853325529aF7EB5c4745413BF01E98c0020f", // Base mainnet - ReviewSystem contract

  // OLD Deployments (for reference)
  // SECUREFLOW_ESCROW: "0x540fDEc0D5675711f7Be40a648b3F8739Be3be5a", // Monad testnet
  // MOCK_ERC20: "0x87c0Df0ED2D84727CD568Ed991c41c044cB6875F", // Monad testnet
};
