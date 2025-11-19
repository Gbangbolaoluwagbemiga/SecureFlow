"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWeb3 } from "@/contexts/web3-context";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminStats } from "@/components/admin/admin-stats";
import { ContractControls } from "@/components/admin/contract-controls";
import { AdminLoading } from "@/components/admin/admin-loading";
import { DisputeResolution } from "@/components/admin/dispute-resolution";
import {
  Lock,
  Shield,
  Play,
  Pause,
  Download,
  AlertTriangle,
  Coins,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ethers } from "ethers";
import { BASE_MAINNET } from "@/lib/web3/config";

export default function AdminPage() {
  const { wallet, getContract } = useWeb3();
  const { isAdmin, loading: adminLoading } = useAdminStatus();
  const { toast } = useToast();
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<
    "pause" | "unpause" | "withdraw" | null
  >(null);
  const [withdrawData, setWithdrawData] = useState({
    token: CONTRACTS.MOCK_ERC20,
    amount: "",
  });
  const [testMode, setTestMode] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [whitelisting, setWhitelisting] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isUnpausing, setIsUnpausing] = useState(false);
  const [contractStats, setContractStats] = useState({
    platformFeeBP: 0,
    totalEscrows: 0,
    totalVolume: "0",
    authorizedArbiters: 0,
    whitelistedTokens: 0,
  });

  useEffect(() => {
    if (wallet.isConnected) {
      checkPausedStatus();
      fetchContractOwner();
      fetchContractStats();
    }
  }, [wallet.isConnected]);

  const fetchContractOwner = async () => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      const owner = await contract.owner();
      setContractOwner(owner);
    } catch (error) {}
  };

  const fetchContractStats = async () => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Fetch platform fee
      const platformFeeBP = await contract.call("platformFeeBP");

      // Fetch total escrows count
      const totalEscrows = await contract.call("nextEscrowId");

      // Set actual contract stats
      setContractStats({
        platformFeeBP: Number(platformFeeBP),
        totalEscrows: Number(totalEscrows),
        totalVolume: "0", // Would need to be tracked in contract
        authorizedArbiters: 2, // We authorized 2 arbiters during deployment
        whitelistedTokens: 1, // We whitelisted 1 token (MockERC20)
      });
    } catch (error) {
      // Set empty stats if contract calls fail
      setContractStats({
        platformFeeBP: 0,
        totalEscrows: 0,
        totalVolume: "0",
        authorizedArbiters: 0,
        whitelistedTokens: 0,
      });
    }
  };

  const checkPausedStatus = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      const paused = await contract.call("paused");

      // Handle different possible return types - including Proxy objects
      let isPaused = false;

      if (paused === true || paused === "true" || paused === 1) {
        isPaused = true;
      } else if (paused === false || paused === "false" || paused === 0) {
        isPaused = false;
      } else if (paused && typeof paused === "object") {
        // Handle Proxy objects - try to extract the actual value
        try {
          const pausedValue = paused.toString();
          isPaused = pausedValue === "true" || pausedValue === "1";
        } catch (e) {
          isPaused = false; // Default to not paused
        }
      }

      setIsPaused(isPaused);
    } catch (error) {
      // Fallback to false if contract call fails
      setIsPaused(false);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (type: typeof actionType) => {
    setActionType(type);
    setDialogOpen(true);
  };

  const handleAction = async () => {
    try {
      // If in test mode, simulate the action without calling the contract
      if (testMode) {
        switch (actionType) {
          case "pause":
            setIsPaused(true);
            toast({
              title: "🧪 Test Mode: Contract paused",
              description: "Simulated: All escrow operations are now paused",
            });
            break;
          case "unpause":
            setIsPaused(false);
            toast({
              title: "🧪 Test Mode: Contract unpaused",
              description: "Simulated: Escrow operations have been resumed",
            });
            break;
          case "withdraw":
            toast({
              title: "🧪 Test Mode: Tokens withdrawn",
              description: `Simulated: Withdrew ${withdrawData.amount} tokens from ${withdrawData.token}`,
            });
            break;
        }
        setDialogOpen(false);
        return;
      }

      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      switch (actionType) {
        case "pause":
          setIsPausing(true);
          try {
            // Check if contract is already paused
            const currentPausedStatusForPause = await contract.call("paused");

            // Handle different possible return types - including Proxy objects
            let isPausedForPause = false;

            if (
              currentPausedStatusForPause === true ||
              currentPausedStatusForPause === "true" ||
              currentPausedStatusForPause === 1
            ) {
              isPausedForPause = true;
            } else if (
              currentPausedStatusForPause === false ||
              currentPausedStatusForPause === "false" ||
              currentPausedStatusForPause === 0
            ) {
              isPausedForPause = false;
            } else if (
              currentPausedStatusForPause &&
              typeof currentPausedStatusForPause === "object"
            ) {
              try {
                const pausedValue = currentPausedStatusForPause.toString();
                isPausedForPause =
                  pausedValue === "true" || pausedValue === "1";
              } catch (e) {
                isPausedForPause = false;
              }
            }

            if (isPausedForPause) {
              toast({
                title: "Contract Already Paused",
                description: "The contract is already in a paused state",
                variant: "default",
              });
              setIsPausing(false);
              return;
            }

            const pauseTxHash = await contract.send("pause", "no-value");

            // Wait for transaction confirmation
            toast({
              title: "Transaction submitted",
              description: "Waiting for blockchain confirmation...",
            });

            // Poll for transaction receipt
            let receipt = null;
            let attempts = 0;
            const maxAttempts = 30;

            while (attempts < maxAttempts && !receipt) {
              try {
                const provider = new ethers.JsonRpcProvider(
                  BASE_MAINNET.rpcUrls[0]
                );
                receipt = await provider.getTransactionReceipt(pauseTxHash);
                if (receipt) break;
              } catch (error) {
                // Continue polling
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
              attempts++;
            }

            if (receipt && receipt.status === 1) {
              setIsPaused(true);
              toast({
                title: "Contract paused",
                description: "All escrow operations are now paused",
              });
            } else {
              throw new Error("Transaction failed or timed out");
            }
          } finally {
            setIsPausing(false);
          }
          break;
        case "unpause":
          setIsUnpausing(true);
          try {
            // Check if contract is already unpaused
            const currentPausedStatus = await contract.call("paused");

            // Handle different possible return types - including Proxy objects
            let isPaused = false;

            if (
              currentPausedStatus === true ||
              currentPausedStatus === "true" ||
              currentPausedStatus === 1
            ) {
              isPaused = true;
            } else if (
              currentPausedStatus === false ||
              currentPausedStatus === "false" ||
              currentPausedStatus === 0
            ) {
              isPaused = false;
            } else if (
              currentPausedStatus &&
              typeof currentPausedStatus === "object"
            ) {
              try {
                const pausedValue = currentPausedStatus.toString();
                isPaused = pausedValue === "true" || pausedValue === "1";
              } catch (e) {
                isPaused = false;
              }
            }

            if (!isPaused) {
              toast({
                title: "Contract Already Unpaused",
                description: "The contract is already in an active state",
                variant: "default",
              });
              setIsUnpausing(false);
              return;
            }

            const unpauseTxHash = await contract.send("unpause", "no-value");

            // Wait for transaction confirmation
            toast({
              title: "Transaction submitted",
              description: "Waiting for blockchain confirmation...",
            });

            // Poll for transaction receipt
            let receipt = null;
            let attempts = 0;
            const maxAttempts = 30;

            while (attempts < maxAttempts && !receipt) {
              try {
                const provider = new ethers.JsonRpcProvider(
                  BASE_MAINNET.rpcUrls[0]
                );
                receipt = await provider.getTransactionReceipt(unpauseTxHash);
                if (receipt) break;
              } catch (error) {
                // Continue polling
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
              attempts++;
            }

            if (receipt && receipt.status === 1) {
              setIsPaused(false);
              toast({
                title: "Contract unpaused",
                description: "Escrow operations have been resumed",
              });
            } else {
              throw new Error("Transaction failed or timed out");
            }
          } finally {
            setIsUnpausing(false);
          }
          break;
        case "withdraw":
          await contract.send(
            "withdrawStuckTokens",
            "no-value",
            withdrawData.token,
            withdrawData.amount
          );
          toast({
            title: "Tokens withdrawn",
            description: `Successfully withdrew ${withdrawData.amount} tokens`,
          });
          setWithdrawData({ token: CONTRACTS.MOCK_ERC20, amount: "" });
          break;
      }

      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Action failed",
        description: error.message || "Failed to perform admin action",
        variant: "destructive",
      });
    }
  };

  const handleWhitelistToken = async () => {
    if (!tokenAddress || !tokenAddress.startsWith("0x")) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid token address",
        variant: "destructive",
      });
      return;
    }

    try {
      setWhitelisting(true);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Check if already whitelisted
      const isWhitelisted = await contract.call(
        "whitelistedTokens",
        tokenAddress
      );
      if (isWhitelisted) {
        toast({
          title: "Token Already Whitelisted",
          description: "This token is already whitelisted",
          variant: "default",
        });
        setTokenAddress("");
        return;
      }

      await contract.send("whitelistToken", "no-value", tokenAddress);
      toast({
        title: "Token Whitelisted",
        description: `Successfully whitelisted token at ${tokenAddress.slice(
          0,
          6
        )}...${tokenAddress.slice(-4)}`,
      });
      setTokenAddress("");
      fetchContractStats();
    } catch (error: any) {
      toast({
        title: "Whitelist Failed",
        description: error.message || "Failed to whitelist token",
        variant: "destructive",
      });
    } finally {
      setWhitelisting(false);
    }
  };

  const handleAuthorizeArbiter = async () => {
    if (!arbiterAddress || !arbiterAddress.startsWith("0x")) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid arbiter address",
        variant: "destructive",
      });
      return;
    }

    try {
      setAuthorizing(true);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Check if already authorized
      const isAuthorized = await contract.call(
        "authorizedArbiters",
        arbiterAddress
      );
      if (isAuthorized) {
        toast({
          title: "Arbiter Already Authorized",
          description: "This arbiter is already authorized",
          variant: "default",
        });
        setArbiterAddress("");
        return;
      }

      await contract.send("authorizeArbiter", "no-value", arbiterAddress);
      toast({
        title: "Arbiter Authorized",
        description: `Successfully authorized arbiter at ${arbiterAddress.slice(
          0,
          6
        )}...${arbiterAddress.slice(-4)}`,
      });
      setArbiterAddress("");
      fetchContractStats();
    } catch (error: any) {
      toast({
        title: "Authorization Failed",
        description: error.message || "Failed to authorize arbiter",
        variant: "destructive",
      });
    } finally {
      setAuthorizing(false);
    }
  };

  const getDialogContent = () => {
    const testModePrefix = testMode ? "🧪 Test Mode: " : "";
    const testModeSuffix = testMode ? " (Simulated)" : "";

    switch (actionType) {
      case "pause":
        return {
          title: `${testModePrefix}Pause Contract${testModeSuffix}`,
          description: testMode
            ? "This will simulate pausing all escrow operations. No real transaction will be sent."
            : "This will pause all escrow operations. Users will not be able to create new escrows or interact with existing ones until the contract is unpaused.",
          icon: Pause,
          confirmText: testMode ? "Simulate Pause" : "Pause Contract",
          variant: "destructive" as const,
        };
      case "unpause":
        return {
          title: `${testModePrefix}Unpause Contract${testModeSuffix}`,
          description: testMode
            ? "This will simulate resuming all escrow operations. No real transaction will be sent."
            : "This will resume all escrow operations. Users will be able to interact with escrows again.",
          icon: Play,
          confirmText: testMode ? "Simulate Unpause" : "Unpause Contract",
          variant: "default" as const,
        };
      case "withdraw":
        return {
          title: `${testModePrefix}Withdraw Stuck Tokens${testModeSuffix}`,
          description: testMode
            ? "This will simulate withdrawing tokens. No real transaction will be sent."
            : "Withdraw tokens that may be stuck in the contract. This should only be used in emergency situations.",
          icon: Download,
          confirmText: testMode ? "Simulate Withdraw" : "Withdraw Tokens",
          variant: "destructive" as const,
        };
      default:
        return {
          title: "",
          description: "",
          icon: Shield,
          confirmText: "Confirm",
          variant: "default" as const,
        };
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-primary/20 p-12 text-center max-w-md">
          <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to access admin controls
          </p>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-destructive/20 p-12 text-center max-w-md">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You do not have permission to access this page. Only the contract
            owner can access admin controls.
          </p>
          <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Your wallet:</span>
              <br />
              <span className="font-mono">{wallet.address}</span>
            </p>
            {contractOwner && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Contract owner:</span>
                <br />
                <span className="font-mono">{contractOwner}</span>
              </p>
            )}
            <p className="text-xs text-amber-600 mt-4">
              💡 <span className="font-semibold">Tip:</span> Make sure you're
              connected with the wallet that deployed the SecureFlow contract.
              {/* Update the owner address in{" "} */}
              {/* <code className="bg-muted px-1 rounded">
                contexts/web3-context.tsx
              </code> */}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const dialogContent = getDialogContent();
  const Icon = dialogContent.icon;

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold">Admin Controls</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-8">
            Manage the SecureFlow escrow contract
          </p>

          {isPaused && (
            <Alert variant="destructive" className="mb-8">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Contract Paused</AlertTitle>
              <AlertDescription>
                All escrow operations are currently paused. Users cannot create
                or interact with escrows.
              </AlertDescription>
            </Alert>
          )}

          <Card className="glass border-primary/20 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">Contract Status</h2>
                  {testMode && (
                    <Badge variant="secondary" className="gap-1">
                      🧪 Test Mode
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">Current State:</span>
                  {isPaused ? (
                    <Badge variant="destructive" className="gap-2">
                      <Pause className="h-3 w-3" />
                      Paused
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-2">
                      <Play className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">
                  Contract Address
                </p>
                <p className="font-mono text-sm">
                  {CONTRACTS.SECUREFLOW_ESCROW.slice(0, 20)}...
                </p>
              </div>
            </div>
          </Card>

          {/* Token Management & Arbiter Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Token Management */}
            <Card className="glass border-primary/20 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Token Management</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Whitelist tokens that can be used in escrow transactions
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token-address">Token Address</Label>
                  <Input
                    id="token-address"
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    className="font-mono"
                    disabled={whitelisting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a token address to whitelist it. Only whitelisted
                    tokens can be used in escrows.
                  </p>
                </div>
                <Button
                  onClick={handleWhitelistToken}
                  disabled={whitelisting || !tokenAddress}
                  className="w-full gap-2"
                >
                  {whitelisting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Whitelisting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Whitelist Token
                    </>
                  )}
                </Button>
                {CONTRACTS.MOCK_ERC20 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">
                      Quick Actions:
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setTokenAddress(CONTRACTS.MOCK_ERC20)}
                      disabled={whitelisting}
                    >
                      Use MockERC20 ({CONTRACTS.MOCK_ERC20.slice(0, 6)}...
                      {CONTRACTS.MOCK_ERC20.slice(-4)})
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Arbiter Management */}
            <Card className="glass border-primary/20 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10">
                  <UserCheck className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Arbiter Management</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Authorize arbiters who can resolve disputes in escrows
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="arbiter-address">Arbiter Address</Label>
                  <Input
                    id="arbiter-address"
                    placeholder="0x..."
                    value={arbiterAddress}
                    onChange={(e) => setArbiterAddress(e.target.value)}
                    className="font-mono"
                    disabled={authorizing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter an arbiter address to authorize them. Only authorized
                    arbiters can be used in escrows.
                  </p>
                </div>
                <Button
                  onClick={handleAuthorizeArbiter}
                  disabled={authorizing || !arbiterAddress}
                  className="w-full gap-2"
                  variant="default"
                >
                  {authorizing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Authorizing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Authorize Arbiter
                    </>
                  )}
                </Button>
                {wallet.address && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">
                      Quick Actions:
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setArbiterAddress(wallet.address!)}
                      disabled={authorizing}
                    >
                      Use Your Wallet ({wallet.address.slice(0, 6)}...
                      {wallet.address.slice(-4)})
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <DisputeResolution onDisputeResolved={fetchContractStats} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="glass border-primary/20 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  {isPaused ? (
                    <Play className="h-6 w-6 text-primary" />
                  ) : (
                    <Pause className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">
                    {isPaused ? "Unpause Contract" : "Pause Contract"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isPaused
                      ? "Resume all escrow operations and allow users to interact with the contract"
                      : "Temporarily halt all escrow operations for maintenance or emergency situations"}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => openDialog(isPaused ? "unpause" : "pause")}
                variant={isPaused ? "default" : "destructive"}
                className="w-full gap-2"
                disabled={isPausing || isUnpausing}
              >
                {isPausing || isUnpausing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {isPausing ? "Pausing..." : "Unpausing..."}
                  </>
                ) : isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Unpause Contract
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause Contract
                  </>
                )}
              </Button>
            </Card>

            <Card className="glass border-primary/20 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                  <Download className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">
                    Withdraw Stuck Tokens
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Emergency function to withdraw tokens that may be stuck in
                    the contract
                  </p>
                </div>
              </div>
              <Button
                onClick={() => openDialog("withdraw")}
                variant="destructive"
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Withdraw Tokens
              </Button>
            </Card>
          </div>

          <Card className="glass border-primary/20 p-6">
            <h2 className="text-2xl font-bold mb-6">Contract Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Owner Address
                </Label>
                <p className="font-mono text-sm bg-muted/50 p-3 rounded-lg">
                  {contractOwner || wallet.address}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Connected Wallet
                </Label>
                <p className="font-mono text-sm bg-muted/50 p-3 rounded-lg">
                  {wallet.address}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Contract Address
                </Label>
                <p className="font-mono text-sm bg-muted/50 p-3 rounded-lg">
                  {CONTRACTS.SECUREFLOW_ESCROW}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Network
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  Base Mainnet
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Chain ID
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">8453</p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Platform Fee
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {contractStats.platformFeeBP}% (
                  {(contractStats.platformFeeBP / 100).toFixed(2)}%)
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Total Escrows
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {contractStats.totalEscrows}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Authorized Arbiters
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {contractStats.authorizedArbiters}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Whitelisted Tokens
                </Label>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {contractStats.whitelistedTokens}
                </p>
              </div>
            </div>
          </Card>

          <Alert className="mt-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Admin Privileges</AlertTitle>
            <AlertDescription>
              These controls have significant impact on the contract and all
              users. Use them responsibly and only when necessary. All actions
              are recorded on the blockchain.
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  dialogContent.variant === "destructive"
                    ? "bg-destructive/10"
                    : "bg-primary/10"
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${
                    dialogContent.variant === "destructive"
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                />
              </div>
              <DialogTitle className="text-2xl">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base leading-relaxed">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>

          {actionType === "withdraw" && (
            <div className="space-y-4 my-4">
              <div className="space-y-2">
                <Label htmlFor="token">Token Address</Label>
                <Input
                  id="token"
                  placeholder="0x..."
                  value={withdrawData.token}
                  onChange={(e) =>
                    setWithdrawData({ ...withdrawData, token: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="1000"
                  value={withdrawData.amount}
                  onChange={(e) =>
                    setWithdrawData({ ...withdrawData, amount: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <Alert
            variant={
              dialogContent.variant === "destructive"
                ? "destructive"
                : "default"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will be recorded on the blockchain and cannot be
              undone.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPausing || isUnpausing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              variant={dialogContent.variant}
              disabled={isPausing || isUnpausing}
            >
              {isPausing || isUnpausing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  {isPausing ? "Pausing..." : "Unpausing..."}
                </>
              ) : (
                dialogContent.confirmText
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
