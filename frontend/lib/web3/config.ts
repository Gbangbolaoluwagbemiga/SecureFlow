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
  SECUREFLOW_ESCROW: "0xC423E1272d73C2a80F6e4450b35F4eC134101DEe",
  MOCK_ERC20: "0x7ab26a7ce5d4479bf6Be1B30D27a74C4a997ebf4",
};
// is there a page where the client get to approve the jobs a freelancer bids for, also once the job has been approved another freelancer should not be able to bid for it anymore`
