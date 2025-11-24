export const BASE_MAINNET = {
  chainId: "0x2105", // 8453 in hex (Base Mainnet)
  chainName: "Base",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://1rpc.io/base",
    "https://base.llamarpc.com",
  ],
  blockExplorerUrls: ["https://basescan.org"],
};

export const BASE_TESTNET = {
  chainId: "0x14A34", // 84532 in hex (Base Sepolia Testnet)
  chainName: "Base Sepolia",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  // Base Mainnet - DEPLOYED ✅ (Updated with Rating & Arbiter Features)
  SECUREFLOW_ESCROW_MAINNET: "0xf87ED6B0B54f6B47c59F7e7a0D3C9Bb0F4d236c7", // SecureFlow on Base Mainnet
  USDC_MAINNET: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  SECUREFLOW_TOKEN_MAINNET: "0xdc2D33270ACfC4D573440B9f5648B0C915F44126", // SecureFlow Token (STK) on Base Mainnet

  // Default contracts (used by frontend) - Base Mainnet
  SECUREFLOW_ESCROW: "0xf87ED6B0B54f6B47c59F7e7a0D3C9Bb0F4d236c7", // SecureFlow on Base Mainnet
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  SECUREFLOW_TOKEN: "0xdc2D33270ACfC4D573440B9f5648B0C915F44126", // SecureFlow Token (STK) on Base Mainnet
  MOCK_ERC20: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base

  BASESCAN_API_KEY: process.env.BASESCAN_API_KEY || "",
};
