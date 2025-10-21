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
  // OLD: SECUREFLOW_ESCROW: "0xC423E1272d73C2a80F6e4450b35F4eC134101DEe",
  SECUREFLOW_ESCROW: "0x540fDEc0D5675711f7Be40a648b3F8739Be3be5a", // Latest deployment with resubmitMilestone
  MOCK_ERC20: "0x87c0Df0ED2D84727CD568Ed991c41c044cB6875F", // Latest MockERC20
};
