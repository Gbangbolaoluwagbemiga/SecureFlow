"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useWeb3 } from "./web3-context";
import { useSmartAccount } from "./smart-account-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import { ethers } from "ethers";

interface Delegation {
  id: string;
  delegator: string;
  delegatee: string;
  functions: string[];
  expiry: number;
  isActive: boolean;
}

interface DelegationContextType {
  delegations: Delegation[];
  createDelegation: (
    delegatee: string,
    functions: string[],
    duration: number,
  ) => Promise<void>;
  revokeDelegation: (delegationId: string) => Promise<void>;
  executeDelegatedFunction: (
    delegationId: string,
    functionName: string,
    args: any[],
  ) => Promise<string>;
  isDelegatedFunction: (functionName: string) => boolean;
  getActiveDelegations: () => Delegation[];
}

const DelegationContext = createContext<DelegationContextType | undefined>(
  undefined,
);

export function DelegationProvider({ children }: { children: ReactNode }) {
  const { wallet, getContract } = useWeb3();
  const { executeTransaction, isSmartAccountReady } = useSmartAccount();
  const { toast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);

  // Admin functions that can be delegated
  const DELEGATABLE_FUNCTIONS = [
    "pause",
    "unpause",
    "resolveDispute",
    "authorizeArbiter",
    "revokeArbiter",
    "whitelistToken",
    "blacklistToken",
    "approveMilestone",
    "rejectMilestone",
    "resubmitMilestone",
    "disputeMilestone",
    "submitMilestone",
    "startWork",
  ];

  useEffect(() => {
    if (wallet.isConnected) {
      loadDelegations();
    }
  }, [wallet.isConnected]);

  const loadDelegations = async () => {
    try {
      // In a real implementation, this would load from the blockchain
      // For now, we'll use localStorage for demo purposes
      const stored = localStorage.getItem("secureflow_delegations");
      if (stored) {
        setDelegations(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load delegations:", error);
    }
  };

  const saveDelegations = (newDelegations: Delegation[]) => {
    setDelegations(newDelegations);
    localStorage.setItem(
      "secureflow_delegations",
      JSON.stringify(newDelegations),
    );
  };

  const createDelegation = async (
    delegatee: string,
    functions: string[],
    duration: number,
  ) => {
    try {
      if (!wallet.isConnected) {
        throw new Error("Wallet not connected");
      }

      // Validate functions
      const invalidFunctions = functions.filter(
        (fn) => !DELEGATABLE_FUNCTIONS.includes(fn),
      );
      if (invalidFunctions.length > 0) {
        throw new Error(`Invalid functions: ${invalidFunctions.join(", ")}`);
      }

      const delegation: Delegation = {
        id: `delegation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        delegator: wallet.address!,
        delegatee,
        functions,
        expiry: Math.floor(Date.now() / 1000) + duration,
        isActive: true,
      };

      const updatedDelegations = [...delegations, delegation];
      saveDelegations(updatedDelegations);

      toast({
        title: "Delegation Created",
        description: `Delegated ${functions.length} functions to ${delegatee.slice(0, 6)}...${delegatee.slice(-4)}`,
      });
    } catch (error: any) {
      console.error("Delegation creation failed:", error);
      toast({
        title: "Delegation Failed",
        description: error.message || "Failed to create delegation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const revokeDelegation = async (delegationId: string) => {
    try {
      const updatedDelegations = delegations.map((delegation) =>
        delegation.id === delegationId
          ? { ...delegation, isActive: false }
          : delegation,
      );

      saveDelegations(updatedDelegations);

      toast({
        title: "Delegation Revoked",
        description: "Delegation has been successfully revoked",
      });
    } catch (error: any) {
      console.error("Delegation revocation failed:", error);
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke delegation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const executeDelegatedFunction = async (
    delegationId: string,
    functionName: string,
    args: any[],
  ) => {
    try {
      const delegation = delegations.find((d) => d.id === delegationId);
      if (!delegation) {
        throw new Error("Delegation not found");
      }

      if (!delegation.isActive) {
        throw new Error("Delegation is not active");
      }

      if (delegation.expiry < Math.floor(Date.now() / 1000)) {
        throw new Error("Delegation has expired");
      }

      if (!delegation.functions.includes(functionName)) {
        throw new Error(`Function ${functionName} is not delegated`);
      }

      // Get contract instance
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) {
        throw new Error("Contract not available");
      }

      // Encode function call
      const iface = new ethers.Interface(SECUREFLOW_ABI);
      const data = iface.encodeFunctionData(functionName, args);

      let txHash: string;

      if (isSmartAccountReady) {
        // Execute via Smart Account
        txHash = await executeTransaction(CONTRACTS.SECUREFLOW_ESCROW, data);
      } else {
        // Execute via regular transaction
        const tx = await contract.send(functionName, ...args);
        txHash = tx.hash;
      }

      toast({
        title: "Delegated Function Executed",
        description: `Function ${functionName} executed successfully`,
      });

      return txHash;
    } catch (error: any) {
      console.error("Delegated function execution failed:", error);
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute delegated function",
        variant: "destructive",
      });
      throw error;
    }
  };

  const isDelegatedFunction = (functionName: string): boolean => {
    return delegations.some(
      (delegation) =>
        delegation.isActive &&
        delegation.delegatee.toLowerCase() === wallet.address?.toLowerCase() &&
        delegation.functions.includes(functionName) &&
        delegation.expiry > Math.floor(Date.now() / 1000),
    );
  };

  const getActiveDelegations = (): Delegation[] => {
    return delegations.filter(
      (delegation) =>
        delegation.isActive &&
        delegation.expiry > Math.floor(Date.now() / 1000),
    );
  };

  return (
    <DelegationContext.Provider
      value={{
        delegations,
        createDelegation,
        revokeDelegation,
        executeDelegatedFunction,
        isDelegatedFunction,
        getActiveDelegations,
      }}
    >
      {children}
    </DelegationContext.Provider>
  );
}

export function useDelegation() {
  const context = useContext(DelegationContext);
  if (context === undefined) {
    throw new Error("useDelegation must be used within a DelegationProvider");
  }
  return context;
}
