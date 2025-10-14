"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { MONAD_TESTNET, CONTRACTS } from "@/lib/web3/config";
import type { WalletState } from "@/lib/web3/types";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";

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
      console.error("Error checking connection:", error);
    }
  };

  const checkOwnerStatus = async (address: string) => {
    try {
      const knownOwner = "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";

      console.log("Checking owner status for:", address);
      console.log("Known owner:", knownOwner);

      setIsOwner(address.toLowerCase() === knownOwner.toLowerCase());
    } catch (error) {
      console.error("Error checking owner status:", error);
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
      console.log("Connected to chain:", chainIdNumber);
      console.log("Target chain:", targetChainId);

      if (chainIdNumber !== targetChainId) {
        toast({
          title: "Wrong network",
          description: "Please switch to Monad Testnet to use this app",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Wallet connected",
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        });
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
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
      console.log("Network switch already in progress");
      return;
    }

    const currentChainId = await window.ethereum.request({
      method: "eth_chainId",
    });
    const currentChainIdNumber = Number.parseInt(currentChainId, 16);
    const targetChainId = Number.parseInt(MONAD_TESTNET.chainId, 16);

    console.log("Current chain:", currentChainIdNumber);
    console.log("Target chain:", targetChainId);

    if (currentChainIdNumber === targetChainId) {
      console.log("Already on Monad Testnet");
      toast({
        title: "Already connected",
        description: "You're already on Monad Testnet",
      });
      return;
    }

    setIsSwitchingNetwork(true);

    try {
      console.log("Attempting to switch to Monad...");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });

      toast({
        title: "Network switched",
        description: "Successfully switched to Monad Testnet",
      });
    } catch (error: any) {
      console.log("Switch error code:", error.code);

      if (error.code === 4902) {
        try {
          console.log("Adding Monad network...");
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [MONAD_TESTNET],
          });

          toast({
            title: "Network added",
            description: "Monad Testnet has been added to your wallet",
          });
        } catch (addError: any) {
          console.error("Error adding Monad network:", addError);
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
        console.error("Error switching network:", error);
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
            params: [
              {
                to: address,
                data,
              },
              "latest",
            ],
          });

          // Decode the result using ethers.js
          try {
            const iface = new ethers.Interface(abi);
            const decodedResult = iface.decodeFunctionResult(method, result);
            return decodedResult;
          } catch (decodeError) {
            console.warn(
              `Could not decode result for ${method}, returning raw data:`,
              decodeError,
            );
            return result;
          }
        } catch (error) {
          console.error(`Error calling ${method}:`, error);
          throw error;
        }
      },
      async send(method: string, value: string = "0x0", ...args: any[]) {
        try {
          const data = encodeFunction(abi, method, args);

          // Estimate gas for the transaction
          let gasLimit = "0x100000"; // Default fallback
          try {
            const estimatedGas = await window.ethereum.request({
              method: "eth_estimateGas",
              params: [
                {
                  from: wallet.address,
                  to: address,
                  data,
                  value:
                    value !== "0x0" && value !== "no-value" ? value : "0x0",
                },
              ],
            });
            // Add 20% buffer to estimated gas
            const gasWithBuffer = Math.floor(Number(estimatedGas) * 1.2);
            gasLimit = `0x${gasWithBuffer.toString(16)}`;
            console.log(`Gas estimated: ${estimatedGas}, using: ${gasLimit}`);
          } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError);
            // For specific functions that might fail gas estimation, use lower defaults
            if (method === "unpause" || method === "pause") {
              gasLimit = "0x30000"; // 196,608 gas - much lower for simple functions
              console.log(`Using reduced gas limit for ${method}: ${gasLimit}`);
            }
          }

          const txParams: any = {
            from: wallet.address,
            to: address,
            data,
            gas: gasLimit,
          };

          // Only add value field if it's not "0x0" or "no-value" (for native token transactions)
          if (value !== "0x0" && value !== "no-value") {
            txParams.value = value;
          }

          const txHash = await window.ethereum.request({
            method: "eth_sendTransaction",
            params: [txParams],
          });
          return txHash;
        } catch (error) {
          console.error(`Error sending ${method}:`, error);
          throw error;
        }
      },
      async owner() {
        return "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41";
      },
    };
  };

  const encodeFunction = (abi: any, method: string, args: any[]) => {
    console.log(`Encoding function ${method} with args:`, args);

    try {
      // Create a proper interface from the ABI
      const iface = new ethers.Interface(abi);

      // Encode the function call with proper parameters
      const encodedData = iface.encodeFunctionData(method, args);

      console.log(`Encoded data for ${method}:`, encodedData);
      return encodedData;
    } catch (error) {
      console.error(`Error encoding function ${method}:`, error);

      // Fallback to basic encoding for common functions
      if (method === "approve") {
        // approve(address,uint256) selector
        return (
          "0x095ea7b3" +
          "0000000000000000000000000000000000000000000000000000000000000000".repeat(
            2,
          )
        );
      } else if (method === "createEscrow") {
        // createEscrow function selector (this needs to be calculated from the actual function signature)
        return (
          "0x" +
          "12345678" +
          "0000000000000000000000000000000000000000000000000000000000000000".repeat(
            8,
          )
        );
      } else if (method === "createEscrowNative") {
        // createEscrowNative function selector
        return (
          "0x" +
          "87654321" +
          "0000000000000000000000000000000000000000000000000000000000000000".repeat(
            7,
          )
        );
      }

      return "0x";
    }
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
