"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";
import { useAccount, useDisconnect, useConnect, useSwitchChain } from "wagmi";
import { BASE_MAINNET, CONTRACTS } from "@/lib/web3/config";
import type { WalletState } from "@/lib/web3/types";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";

// Initialize Reown AppKit
const projectId =
  process.env.NEXT_PUBLIC_REOWN_ID || "1db88bda17adf26df9ab7799871788c4";

const metadata = {
  name: "SecureFlow",
  description: "Trustless Escrow on Base",
  url: "https://secureflow.xyz",
  icons: ["https://secureflow.xyz/favicon.ico"],
};

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [base],
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [base],
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: ["github", "x", "discord"],
  },
});

interface Web3ContextType {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToBase: () => Promise<void>;
  getContract: (address: string, abi: any) => any;
  isOwner: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useConnect();
  const { switchChain } = useSwitchChain();
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    balance: "0",
  });
  const [isOwner, setIsOwner] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    if (isConnected && address && chainId) {
      setWallet({
        address,
        chainId: Number(chainId),
        isConnected: true,
        balance: "0",
      });
      checkOwnerStatus(address);
      updateBalance(address);
    } else {
      setWallet({
        address: null,
        chainId: null,
        isConnected: false,
        balance: "0",
      });
      setIsOwner(false);
    }
  }, [address, chainId, isConnected]);

  const updateBalance = async (address: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_MAINNET.rpcUrls[0]);
      const balance = await provider.getBalance(address);
      const balanceInEther = ethers.formatEther(balance);
      setWallet((prev) => ({
        ...prev,
        balance: parseFloat(balanceInEther).toFixed(4),
      }));
    } catch (error) {
      console.error("Failed to update balance:", error);
    }
  };

  const checkOwnerStatus = async (address: string) => {
    try {
      const knownOwner = "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";
      setIsOwner(address.toLowerCase() === knownOwner.toLowerCase());
    } catch (error) {
      setIsOwner(false);
    }
  };

  const connectWallet = async () => {
    try {
      await open();
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
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
    } catch (error: any) {
      toast({
        title: "Disconnect failed",
        description: error.message || "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  const switchToBase = async () => {
    if (isSwitchingNetwork) {
      return;
    }

    const targetChainId = Number.parseInt(BASE_MAINNET.chainId, 16);

    if (chainId === targetChainId) {
      toast({
        title: "Already connected",
        description: "You're already on Base Mainnet",
      });
      return;
    }

    setIsSwitchingNetwork(true);

    try {
      switchChain({ chainId: base.id });
      toast({
        title: "Network switched",
        description: "Successfully switched to Base Mainnet",
      });
    } catch (error: any) {
      if (error.code === 4902 || error.message?.includes("not added")) {
        toast({
          title: "Network error",
          description: "Please add Base Mainnet to your wallet manually",
          variant: "destructive",
        });
      } else if (error.code === 4001) {
        toast({
          title: "Request cancelled",
          description: "You cancelled the network switch",
        });
      } else {
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
    // Normalize address to a valid checksum to avoid INVALID_ARGUMENT errors
    let targetAddress = address;
    try {
      targetAddress = ethers.getAddress(address.toLowerCase());
    } catch {}

    return {
      async call(method: string, ...args: any[]) {
        try {
          // Use direct RPC connection for read operations
          const provider = new ethers.JsonRpcProvider(BASE_MAINNET.rpcUrls[0]);
          const contract = new ethers.Contract(targetAddress, abi, provider);
          const result = await contract[method](...args);
          return result;
        } catch (error) {
          throw error;
        }
      },
      async send(method: string, value: string = "0x0", ...args: any[]) {
        try {
          if (!address) {
            throw new Error("Wallet not connected");
          }

          // Get provider from wagmi
          const provider = wagmiAdapter.getProvider();
          if (!provider) {
            throw new Error("Provider not available");
          }

          // Create ethers provider and signer
          const ethersProvider = new ethers.BrowserProvider(provider as any);
          const signer = await ethersProvider.getSigner();

          const contract = new ethers.Contract(targetAddress, abi, signer);
          const contractMethod = contract[method];

          let txResponse;
          if (value !== "0x0" && value !== "no-value") {
            txResponse = await contractMethod(...args, {
              value: ethers.parseEther(value),
            });
          } else {
            txResponse = await contractMethod(...args);
          }

          const receipt = await txResponse.wait();
          return receipt.hash;
        } catch (error) {
          throw error;
        }
      },
      async owner() {
        return "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";
      },
    };
  };

  return (
    <Web3Context.Provider
      value={{
        wallet,
        connectWallet,
        disconnectWallet,
        switchToBase,
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
