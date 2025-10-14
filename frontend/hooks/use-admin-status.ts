import { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";

export function useAdminStatus() {
  const { wallet, getContract } = useWeb3();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) {
      setIsAdmin(false);
      return;
    }

    checkAdminStatus();
  }, [wallet.isConnected, wallet.address]);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) {
        setIsAdmin(false);
        return;
      }

      // Get the contract owner
      const owner = await contract.call("owner");

      // Check if current wallet is the owner
      const isOwner =
        owner.toString().toLowerCase() === wallet.address?.toLowerCase();
      setIsAdmin(isOwner);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading };
}
