"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useWeb3 } from "./web3-context";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";

interface SmartAccountState {
  isInitialized: boolean;
  safeAddress: string | null;
  isDeployed: boolean;
  balance: string;
  nonce: number;
}

interface SmartAccountContextType {
  smartAccount: SmartAccountState;
  initializeSmartAccount: () => Promise<void>;
  deploySmartAccount: () => Promise<string>;
  executeTransaction: (
    to: string,
    data: string,
    value?: string,
  ) => Promise<string>;
  executeBatchTransaction: (
    transactions: Array<{ to: string; data: string; value?: string }>,
  ) => Promise<string>;
  isSmartAccountReady: boolean;
}

const SmartAccountContext = createContext<SmartAccountContextType | undefined>(
  undefined,
);

export function SmartAccountProvider({ children }: { children: ReactNode }) {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [smartAccount, setSmartAccount] = useState<SmartAccountState>({
    isInitialized: false,
    safeAddress: null,
    isDeployed: false,
    balance: "0",
    nonce: 0,
  });

  const [safeApiKit, setSafeApiKit] = useState<any>(null);
  const [safeFactory, setSafeFactory] = useState<any>(null);

  useEffect(() => {
    if (wallet.isConnected) {
      initializeSmartAccount();
    }
  }, [wallet.isConnected]);

  const initializeSmartAccount = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Create a deterministic Smart Account address based on user's EOA
      // This simulates a real Smart Account deployment
      const smartAccountAddress = ethers.getCreate2Address(
        "0x0000000000000000000000000000000000000000", // factory address (placeholder)
        ethers.keccak256(ethers.toUtf8Bytes(address)), // salt (bytes32)
        ethers.ZeroHash, // init code hash (bytes32)
      );

      // Check if Smart Account is already deployed
      const code = await provider.getCode(smartAccountAddress);
      const isDeployed = code !== "0x";

      setSmartAccount({
        isInitialized: true,
        safeAddress: smartAccountAddress,
        isDeployed,
        balance: "0",
        nonce: 0,
      });

      toast({
        title: "Smart Account Initialized",
        description: `Smart Account: ${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`,
      });
    } catch (error: any) {
      console.error("Smart Account initialization failed:", error);
      toast({
        title: "Smart Account Error",
        description: error.message || "Failed to initialize Smart Account",
        variant: "destructive",
      });
    }
  };

  const deploySmartAccount = async () => {
    try {
      if (!smartAccount.safeAddress) {
        throw new Error("Smart Account not initialized");
      }

      // Simulate deployment
      setSmartAccount((prev) => ({
        ...prev,
        isDeployed: true,
        balance: "1.0", // Mock balance
      }));

      toast({
        title: "Smart Account Deployed",
        description: `Smart Account deployed at: ${smartAccount.safeAddress}`,
      });

      return smartAccount.safeAddress;
    } catch (error: any) {
      console.error("Smart Account deployment failed:", error);
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy Smart Account",
        variant: "destructive",
      });
      throw error;
    }
  };

  const executeTransaction = async (
    to: string,
    data: string,
    value: string = "0",
  ) => {
    try {
      if (!smartAccount.safeAddress) {
        throw new Error("Smart Account not initialized");
      }

      // Execute transaction through user's EOA with Smart Account features
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      // Create transaction object
      const tx = {
        to,
        data,
        value: ethers.parseEther(value),
        gasLimit: 500000, // Set gas limit for Smart Account operations
      };

      // Send transaction
      const txResponse = await signer.sendTransaction(tx);

      toast({
        title: "🚀 Smart Account Transaction Executed!",
        description: `Transaction submitted: ${txResponse.hash}`,
      });

      return txResponse.hash;
    } catch (error: any) {
      console.error("Transaction execution failed:", error);
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to execute transaction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const executeBatchTransaction = async (
    transactions: Array<{ to: string; data: string; value?: string }>,
  ) => {
    try {
      if (!smartAccount.safeAddress) {
        throw new Error("Smart Account not initialized");
      }

      // Execute batch transaction through user's EOA
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      // For batch operations, we'll execute them sequentially
      // In a real Smart Account, this would be a single atomic transaction
      const txHashes = [];

      for (const tx of transactions) {
        const txResponse = await signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: ethers.parseEther(tx.value || "0"),
          gasLimit: 500000,
        });
        txHashes.push(txResponse.hash);
      }

      toast({
        title: "🚀 Batch Transaction Executed!",
        description: `Batch transactions submitted: ${txHashes.length} transactions`,
      });

      return txHashes[0]; // Return first transaction hash
    } catch (error: any) {
      console.error("Batch transaction execution failed:", error);
      toast({
        title: "Batch Transaction Failed",
        description: error.message || "Failed to execute batch transaction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const isSmartAccountReady =
    smartAccount.isInitialized && smartAccount.isDeployed;

  return (
    <SmartAccountContext.Provider
      value={{
        smartAccount,
        initializeSmartAccount,
        deploySmartAccount,
        executeTransaction,
        executeBatchTransaction,
        isSmartAccountReady,
      }}
    >
      {children}
    </SmartAccountContext.Provider>
  );
}

export function useSmartAccount() {
  const context = useContext(SmartAccountContext);
  if (context === undefined) {
    throw new Error(
      "useSmartAccount must be used within a SmartAccountProvider",
    );
  }
  return context;
}
