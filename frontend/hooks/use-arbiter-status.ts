import { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";

export function useArbiterStatus() {
  const { wallet, getContract } = useWeb3();
  const [isArbiter, setIsArbiter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) {
      setIsArbiter(false);
      return;
    }

    checkArbiterStatus();
  }, [wallet.isConnected, wallet.address]);

  const checkArbiterStatus = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) {
        setIsArbiter(false);
        return;
      }

      // Check if current wallet is an authorized arbiter
      const isAuthorized = await contract.call(
        "authorizedArbiters",
        wallet.address
      );
      setIsArbiter(isAuthorized);
    } catch (error) {
      console.error("Error checking arbiter status:", error);
      setIsArbiter(false);
    } finally {
      setLoading(false);
    }
  };

  return { isArbiter, loading, refreshArbiterStatus: checkArbiterStatus };
}
