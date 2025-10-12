const fs = require("fs");
const path = require("path");

// Read deployment info
let deploymentInfo;
try {
  const deployedData = fs.readFileSync("deployed-addresses.json", "utf8");
  deploymentInfo = JSON.parse(deployedData);
} catch (error) {
  console.log("❌ No deployment info found. Please deploy the contract first.");
  process.exit(1);
}

const secureFlowAddress = deploymentInfo.secureFlow;

console.log("🔄 Updating frontend files for new contract...");
console.log("Contract address:", secureFlowAddress);

// Update frontend config
const frontendConfigPath = "Frontend/lib/web3/config.ts";
const configContent = `export const MONAD_TESTNET = {
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
  SECUREFLOW_ESCROW: "${secureFlowAddress}",
  MOCK_ERC20: "0x0000000000000000000000000000000000000000", // No mock token in production
};
`;

fs.writeFileSync(frontendConfigPath, configContent);
console.log("✅ Frontend config updated");

// Update web3 context to handle new contract features
const web3ContextPath = "Frontend/contexts/web3-context.tsx";
const web3ContextContent = `"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { MONAD_TESTNET } from "@/lib/web3/config";
import type { WalletState } from "@/lib/web3/types";
import { useToast } from "@/hooks/use-toast";

interface Web3ContextType {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToMonad: () => Promise<void>;
  getContract: (address: string, abi: any) => any;
  isOwner: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    balance: "0",
  });
  const [isOwner, setIsOwner] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    checkConnection();

    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged,
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) {
        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        });
        const balance = await window.ethereum.request({
          method: "eth_getBalance",
          params: [accounts[0], "latest"],
        });

        setWallet({
          address: accounts[0],
          chainId: Number.parseInt(chainId, 16),
          isConnected: true,
          balance: (Number.parseInt(balance, 16) / 1e18).toFixed(4),
        });

        await checkOwnerStatus(accounts[0]);
      }
    } catch (error) {
      console.error("[v0] Error checking connection:", error);
    }
  };

  const checkOwnerStatus = async (address: string) => {
    try {
      const knownOwner = "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";
      setIsOwner(address.toLowerCase() === knownOwner.toLowerCase());
    } catch (error) {
      console.error("[v0] Error checking owner status:", error);
      setIsOwner(false);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setWallet((prev) => ({ ...prev, address: accounts[0] }));
      checkOwnerStatus(accounts[0]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install MetaMask or another Web3 wallet",
        variant: "destructive",
      });
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      const chainIdNumber = Number.parseInt(chainId, 16);
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      });

      setWallet({
        address: accounts[0],
        chainId: chainIdNumber,
        isConnected: true,
        balance: (Number.parseInt(balance, 16) / 1e18).toFixed(4),
      });

      await checkOwnerStatus(accounts[0]);

      const targetChainId = Number.parseInt(MONAD_TESTNET.chainId, 16);
      console.log("[v0] Connected to chain:", chainIdNumber);
      console.log("[v0] Target chain:", targetChainId);

      if (chainIdNumber !== targetChainId) {
        toast({
          title: "Wrong network",
          description: "Please switch to Monad Testnet to use this app",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Wallet connected",
          description: \`Connected to \${accounts[0].slice(0, 6)}...\${accounts[0].slice(-4)}\`,
        });
      }
    } catch (error: any) {
      console.error("[v0] Error connecting wallet:", error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = () => {
    setWallet({
      address: null,
      chainId: null,
      isConnected: false,
      balance: "0",
    });
    setIsOwner(false);
    toast({
      title: "Wallet disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const switchToMonad = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    if (isSwitchingNetwork) {
      console.log("[v0] Network switch already in progress");
      return;
    }

    const currentChainId = await window.ethereum.request({
      method: "eth_chainId",
    });
    const currentChainIdNumber = Number.parseInt(currentChainId, 16);
    const targetChainId = Number.parseInt(MONAD_TESTNET.chainId, 16);

    console.log("[v0] Current chain:", currentChainIdNumber);
    console.log("[v0] Target chain:", targetChainId);

    if (currentChainIdNumber === targetChainId) {
      console.log("[v0] Already on Monad Testnet");
      toast({
        title: "Already connected",
        description: "You're already on Monad Testnet",
      });
      return;
    }

    setIsSwitchingNetwork(true);

    try {
      console.log("[v0] Attempting to switch to Monad...");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });

      toast({
        title: "Network switched",
        description: "Successfully switched to Monad Testnet",
      });
    } catch (error: any) {
      console.log("[v0] Switch error code:", error.code);

      if (error.code === 4902) {
        try {
          console.log("[v0] Adding Monad network...");
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [MONAD_TESTNET],
        });

        toast({
          title: "Network added",
          description: "Monad Testnet has been added to your wallet",
        });
      } catch (addError: any) {
        console.error("[v0] Error adding Monad network:", addError);
        toast({
          title: "Network error",
          description: addError.message || "Failed to add Monad Testnet",
          variant: "destructive",
        });
      }
    } else if (error.code === 4001) {
      toast({
        title: "Request cancelled",
        description: "You cancelled the network switch",
      });
    } else {
      console.error("[v0] Error switching network:", error);
      toast({
        title: "Switch failed",
        description: error.message || "Failed to switch network",
        variant: "destructive",
      });
    }
  } finally {
    setIsSwitchingNetwork(false);
  }
};

const getContract = (address: string, abi: any) => {
  if (typeof window === "undefined" || !window.ethereum) return null;

  return {
    async call(method: string, ...args: any[]) {
      try {
        const data = encodeFunction(abi, method, args);
        const result = await window.ethereum.request({
          method: "eth_call",
          params: [{ to: address, data }, "latest"],
        });
        return result;
      } catch (error) {
        console.error(\`[v0] Error calling \${method}:\`, error);
        throw error;
      }
    },
    async send(method: string, ...args: any[]) {
      try {
        const data = encodeFunction(abi, method, args);
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: wallet.address,
              to: address,
              data,
              gas: "0x100000",
            },
          ],
        });
        return txHash;
      } catch (error) {
        console.error(\`[v0] Error sending \${method}:\`, error);
        throw error;
      }
    },
    async sendWithValue(method: string, value: string, ...args: any[]) {
      try {
      try {
        const data = encodeFunction(abi, method, args);
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: wallet.address,
              to: address,
              data,
              value,
              gas: "0x100000",
            },
          ],
        });
        return txHash;
      } catch (error) {
        console.error(\`[v0] Error sending \${method} with value:\`, error);
        throw error;
      }
    },
    async owner() {
      return "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";
    },
  };
};

const encodeFunction = (abi: any, method: string, args: any[]) => {
  return "0x";
};

return (
  <Web3Context.Provider
    value={{
      wallet,
      connectWallet,
      disconnectWallet,
      switchToMonad,
      getContract,
      isOwner,
    }}
  >
    {children}
  </Web3Context.Provider>
);
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
`;

fs.writeFileSync(web3ContextPath, web3ContextContent);
console.log("✅ Web3 context updated");

console.log("\n🎉 Frontend update completed!");
console.log("\n📝 Next steps:");
console.log("1. Deploy the contract with: npx hardhat run scripts/deploy-and-update.js --network monad");
console.log("2. Test the frontend with the new contract");
console.log("3. Update any custom components that use the old contract interface");
}

// Run the update
main().catch(console.error);
