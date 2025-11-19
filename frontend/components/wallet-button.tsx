"use client";

import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/contexts/web3-context";
import { Wallet, AlertCircle } from "lucide-react";
import { BASE_MAINNET } from "@/lib/web3/config";

export function WalletButton() {
  const { wallet, connectWallet, openAccountModal } = useWeb3();

  if (!wallet.isConnected) {
    return (
      <Button onClick={connectWallet} className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  const targetChainId = Number.parseInt(BASE_MAINNET.chainId, 16);
  const isOnBase = wallet.chainId === targetChainId;

  return (
    <Button
      variant="outline"
      className="gap-2 bg-transparent"
      onClick={openAccountModal}
    >
      <Wallet className="h-4 w-4" />
      {!isOnBase && <AlertCircle className="h-4 w-4 text-destructive" />}
      {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
    </Button>
  );
}
