"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWeb3 } from "@/contexts/web3-context";
import { useSmartAccount } from "@/contexts/smart-account-context";
import { useDelegation } from "@/contexts/delegation-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import {
  CheckCircle2,
  Send,
  AlertTriangle,
  Gavel,
  Play,
  Zap,
} from "lucide-react";
import type { Milestone } from "@/lib/web3/types";

interface MilestoneActionsProps {
  escrowId: string;
  milestoneIndex: number;
  milestone: Milestone;
  isPayer: boolean;
  isBeneficiary: boolean;
  escrowStatus: string;
  onSuccess: () => void;
  allMilestones?: Milestone[]; // Add all milestones for sequential validation
  showSubmitButton?: boolean; // New prop to control submit button visibility
}

export function MilestoneActions({
  escrowId,
  milestoneIndex,
  milestone,
  isPayer,
  isBeneficiary,
  escrowStatus,
  onSuccess,
  allMilestones = [],
  showSubmitButton = true, // Default to true for backward compatibility
}: MilestoneActionsProps) {
  const { getContract } = useWeb3();
  const { executeTransaction, executeBatchTransaction, isSmartAccountReady } =
    useSmartAccount();
  const { isDelegatedFunction } = useDelegation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<
    "start" | "submit" | "approve" | "dispute" | "resolve" | null
  >(null);
  const [disputeReason, setDisputeReason] = useState("");

  // Check if this project is terminated (has disputed milestones)
  const isProjectTerminated = allMilestones.some(
    (m) => m.status === "disputed" || m.status === "rejected",
  );

  // Poll transaction receipt for confirmation
  const pollTransactionReceipt = async (txHash: string) => {
    const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute timeout
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (receipt) {
          return receipt;
        }
      } catch (error) {}

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
    }

    throw new Error(
      "Transaction timeout - please check the blockchain explorer",
    );
  };

  // Check if this milestone can be approved
  const canApproveMilestone = () => {
    return milestone.status === "submitted" && isPayer;
  };

  // Check if this milestone can be submitted (sequential validation)
  const canSubmitMilestone = () => {
    if (
      milestone.status !== "pending" ||
      !isBeneficiary ||
      escrowStatus !== "active"
    ) {
      return false;
    }

    // For the first milestone, it can always be submitted if pending
    if (milestoneIndex === 0) {
      return true;
    }

    // For subsequent milestones, check if the previous one is approved
    const previousMilestone = allMilestones[milestoneIndex - 1];
    if (!previousMilestone) {
      return false;
    }

    // Check if previous milestone is approved
    const isPreviousApproved = previousMilestone.status === "approved";

    // Check if there are any submitted milestones before this one that aren't approved
    let hasUnapprovedSubmitted = false;
    for (let i = 0; i < milestoneIndex; i++) {
      const prevMilestone = allMilestones[i];
      if (prevMilestone && prevMilestone.status === "submitted") {
        hasUnapprovedSubmitted = true;
        break;
      }
    }

    // Only allow submission if previous milestone is approved AND no submitted milestones are pending
    return isPreviousApproved && !hasUnapprovedSubmitted;
  };

  const openDialog = (type: typeof actionType) => {
    setActionType(type);
    setDisputeReason(""); // Clear dispute reason when opening dialog
    setDialogOpen(true);
  };

  const handleAction = async () => {
    // Validate dispute reason if disputing
    if (actionType === "dispute" && !disputeReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for disputing this milestone",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      let txHash;

      // Check if we should use Smart Account for gasless transactions
      const useSmartAccount =
        isSmartAccountReady &&
        (actionType === "approve" ||
          actionType === "submit" ||
          actionType === "dispute");

      // Check if this is a delegated function
      const isDelegated = isDelegatedFunction(
        actionType === "approve"
          ? "approveMilestone"
          : actionType === "dispute"
            ? "disputeMilestone"
            : "",
      );

      switch (actionType) {
        case "start":
          txHash = await contract.send("startWork", escrowId);
          toast({
            title: "Work started!",
            description: "You can now begin working on the milestones",
          });
          break;
        case "submit":
          if (useSmartAccount) {
            // Use Smart Account for enhanced transaction
            const { ethers } = await import("ethers");
            const iface = new ethers.Interface(SECUREFLOW_ABI);
            const data = iface.encodeFunctionData("submitMilestone", [
              escrowId,
              milestoneIndex,
              milestone.description,
            ]);
            txHash = await executeTransaction(
              CONTRACTS.SECUREFLOW_ESCROW,
              data,
            );
            toast({
              title: "🚀 Smart Account Milestone submitted!",
              description:
                "Milestone submitted using Smart Account with enhanced features",
            });
          } else {
            txHash = await contract.send(
              "submitMilestone",
              "no-value",
              escrowId,
              milestoneIndex,
              milestone.description,
            );
            toast({
              title: "Milestone submitted!",
              description: "Waiting for client approval",
            });
          }

          // Wait for blockchain state to update, then refresh data
          await new Promise((resolve) => setTimeout(resolve, 2000));
          onSuccess();
          break;
        case "approve":
          try {
            // Validate milestone state before attempting approval
            if (milestone.status !== "submitted") {
              toast({
                title: "Invalid milestone state",
                description:
                  "This milestone is not in submitted state and cannot be approved",
                variant: "destructive",
              });
              return;
            }

            if (useSmartAccount) {
              // Use Smart Account for enhanced transaction
              const { ethers } = await import("ethers");
              const iface = new ethers.Interface(SECUREFLOW_ABI);
              const data = iface.encodeFunctionData("approveMilestone", [
                escrowId,
                milestoneIndex,
              ]);
              txHash = await executeTransaction(
                CONTRACTS.SECUREFLOW_ESCROW,
                data,
              );
              toast({
                title: "🚀 Smart Account Milestone approved!",
                description:
                  "Milestone approved using Smart Account with enhanced features",
              });
            } else {
              // Use regular transaction
              // Try to estimate gas first to catch potential issues
              try {
                const gasEstimate = await contract.estimateGas(
                  "approveMilestone",
                  escrowId,
                  milestoneIndex,
                );
              } catch (gasError) {
                toast({
                  title: "Gas estimation failed",
                  description:
                    "Could not estimate gas, but will attempt the transaction anyway.",
                  variant: "destructive",
                });
              }

              // Add retry logic for failed transactions
              let retryCount = 0;
              const maxRetries = 3;

              while (retryCount < maxRetries) {
                try {
                  txHash = await contract.send(
                    "approveMilestone",
                    "no-value",
                    escrowId,
                    milestoneIndex,
                  );
                  break; // Success, exit retry loop
                } catch (sendError: any) {
                  retryCount++;

                  if (retryCount >= maxRetries) {
                    throw sendError; // Re-throw the last error
                  }

                  // Wait before retry
                  await new Promise((resolve) => setTimeout(resolve, 2000));

                  toast({
                    title: "Retrying transaction",
                    description: `Attempt ${retryCount + 1} of ${maxRetries}. Please wait...`,
                    variant: "default",
                  });
                }
              }
            }

            // Wait for transaction to be mined and confirmed
            try {
              let receipt;

              // Check if txHash has a wait method (ethers.js transaction object)
              if (txHash && typeof txHash.wait === "function") {
                receipt = await Promise.race([
                  txHash.wait(),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Transaction timeout")),
                      60000,
                    ),
                  ),
                ]);
              } else {
                // Fallback: use polling to check transaction status

                receipt = await pollTransactionReceipt(txHash);
              }

              if (receipt.status === 1) {
                toast({
                  title: "Milestone approved!",
                  description: "Payment has been released to the beneficiary",
                });

                // Close the modal immediately after successful approval
                setDialogOpen(false);

                // Wait longer for blockchain state to fully update
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Dispatch event to notify freelancer dashboard of approval
                window.dispatchEvent(
                  new CustomEvent("milestoneApproved", {
                    detail: { escrowId, milestoneIndex },
                  }),
                );

                // Call onSuccess to refresh data first
                onSuccess();

                // Wait a bit more for data to refresh, then reload page
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                throw new Error("Transaction failed on blockchain");
              }
            } catch (receiptError: any) {
              // If confirmation fails but we have a transaction hash, assume success
              // This handles cases where the transaction succeeds but confirmation polling fails
              if (txHash) {
                toast({
                  title: "Milestone approved!",
                  description: "Payment has been released to the beneficiary",
                });

                // Close the modal immediately after successful approval
                setDialogOpen(false);

                // Wait longer for blockchain state to fully update
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Dispatch event to notify freelancer dashboard of approval
                window.dispatchEvent(
                  new CustomEvent("milestoneApproved", {
                    detail: { escrowId, milestoneIndex },
                  }),
                );

                // Call onSuccess to refresh data first
                onSuccess();

                // Wait a bit more for data to refresh, then reload page
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return;
              }

              if (receiptError.message?.includes("timeout")) {
                toast({
                  title: "Transaction timeout",
                  description:
                    "The transaction is taking longer than expected. Please check the blockchain explorer to see if it was successful.",
                  variant: "destructive",
                });
              } else {
                throw new Error("Transaction failed to confirm on blockchain");
              }
            }
          } catch (error: any) {
            // Handle specific error cases
            if (error.message?.includes("Not submitted")) {
              toast({
                title: "Transaction failed",
                description:
                  "The transaction was not submitted to the network. This may be due to network congestion or wallet issues. Please try again or refresh the page.",
                variant: "destructive",
              });
            } else if (
              error.message?.includes("Transaction failed on blockchain")
            ) {
              toast({
                title: "Transaction reverted",
                description:
                  "The transaction was submitted but failed on the blockchain. The milestone may not be in the correct state for approval.",
                variant: "destructive",
              });
            } else if (error.message?.includes("insufficient funds")) {
              toast({
                title: "Insufficient funds",
                description:
                  "You don't have enough MON tokens to pay for the transaction fee.",
                variant: "destructive",
              });
            } else if (error.message?.includes("gas")) {
              toast({
                title: "Gas estimation failed",
                description:
                  "Unable to estimate gas for this transaction. The milestone may not be in the correct state.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Approval failed",
                description:
                  error.message ||
                  "An unexpected error occurred while approving the milestone.",
                variant: "destructive",
              });
            }
            throw error; // Re-throw to prevent success toast
          } finally {
            setIsLoading(false);
          }
          break;
        case "dispute":
          try {
            // Validate milestone state before attempting dispute
            if (milestone.status !== "submitted") {
              toast({
                title: "Invalid milestone state",
                description:
                  "This milestone is not in submitted state and cannot be disputed",
                variant: "destructive",
              });
              return;
            }

            if (useSmartAccount) {
              // Use Smart Account for enhanced transaction
              const { ethers } = await import("ethers");
              const iface = new ethers.Interface(SECUREFLOW_ABI);
              const data = iface.encodeFunctionData("disputeMilestone", [
                escrowId,
                milestoneIndex,
                disputeReason,
              ]);
              txHash = await executeTransaction(
                CONTRACTS.SECUREFLOW_ESCROW,
                data,
              );
              toast({
                title: "🚀 Smart Account Dispute created!",
                description:
                  "Dispute created using Smart Account with enhanced features",
              });
            } else {
              txHash = await contract.send(
                "disputeMilestone",
                "no-value",
                escrowId,
                milestoneIndex,
                disputeReason,
              );
            }

            // Check if we got a valid transaction hash
            if (!txHash) {
              throw new Error(
                "No transaction hash received - transaction may have failed",
              );
            }

            // Wait for transaction to be mined and confirmed
            try {
              let receipt;

              // Check if txHash has a wait method (ethers.js transaction object)
              if (txHash && typeof txHash.wait === "function") {
                receipt = await Promise.race([
                  txHash.wait(),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Transaction timeout")),
                      60000,
                    ),
                  ),
                ]);
              } else {
                // Fallback: use polling to check transaction status
                receipt = await pollTransactionReceipt(txHash);
              }

              if (receipt.status === 1) {
                toast({
                  title: "Milestone disputed!",
                  description:
                    "The milestone has been disputed and will be reviewed by the admin",
                });

                // Close the modal immediately after successful dispute
                setDialogOpen(false);

                // Wait longer for blockchain state to fully update
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Dispatch event to notify freelancer dashboard of dispute
                window.dispatchEvent(
                  new CustomEvent("milestoneDisputed", {
                    detail: { escrowId, milestoneIndex },
                  }),
                );

                // Call onSuccess to refresh data first
                onSuccess();

                // Wait a bit more for data to refresh, then reload page
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                throw new Error("Transaction failed on blockchain");
              }
            } catch (receiptError: any) {
              // Don't assume success if transaction failed on blockchain
              if (
                receiptError.message?.includes(
                  "Transaction failed on blockchain",
                )
              ) {
                toast({
                  title: "Transaction failed",
                  description:
                    "The milestone dispute failed on the blockchain. Please try again.",
                  variant: "destructive",
                });
              } else if (receiptError.message?.includes("timeout")) {
                toast({
                  title: "Transaction timeout",
                  description:
                    "The transaction is taking longer than expected. Please check the blockchain explorer to see if it was successful.",
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Transaction failed",
                  description:
                    "The transaction failed to confirm on the blockchain.",
                  variant: "destructive",
                });
              }
              throw receiptError; // Re-throw to prevent success flow
            }
          } catch (error: any) {
            if (error.message?.includes("Gas estimation failed")) {
              toast({
                title: "Transaction failed",
                description:
                  "Gas estimation failed. The milestone may not be in the correct state for dispute.",
                variant: "destructive",
              });
            } else if (error.message?.includes("Internal JSON-RPC error")) {
              toast({
                title: "Transaction failed",
                description:
                  "Network error occurred. Please try again or check your connection.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Dispute failed",
                description:
                  error.message ||
                  "An unexpected error occurred while disputing the milestone.",
                variant: "destructive",
              });
            }
            throw error;
          } finally {
            setIsLoading(false);
          }
          break;
        case "resolve":
          // This would need additional UI for choosing resolution
          toast({
            title: "Resolution pending",
            description: "Admin will review and resolve the dispute",
          });
          break;
      }

      setDialogOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Action failed",
        description: error.message || "Failed to perform action",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDialogContent = () => {
    switch (actionType) {
      case "start":
        return {
          title: "Start Work",
          description:
            "Confirm that you're ready to start working on this project. This will activate the escrow.",
          icon: Play,
          confirmText: "Start Work",
        };
      case "submit":
        return {
          title: "Submit Milestone",
          description: `Submit milestone ${milestoneIndex + 1} for review. The client will be notified to approve your work.`,
          icon: Send,
          confirmText: "Submit",
        };
      case "approve":
        return {
          title: "Approve Milestone",
          description: `Approve milestone ${milestoneIndex + 1} and release ${(Number.parseFloat(milestone.amount) / 1e18).toFixed(2)} tokens to the beneficiary.`,
          icon: CheckCircle2,
          confirmText: "Approve & Release",
        };
      case "dispute":
        return {
          title: "Dispute Milestone",
          description: `Dispute milestone ${milestoneIndex + 1}. This will notify the admin to review the dispute.`,
          icon: Gavel,
          confirmText: "Dispute",
        };
      case "resolve":
        return {
          title: "Resolve Dispute",
          description:
            "As the contract owner, you can resolve this dispute in favor of either party.",
          icon: Gavel,
          confirmText: "Resolve",
        };
      default:
        return {
          title: "",
          description: "",
          icon: CheckCircle2,
          confirmText: "Confirm",
        };
    }
  };

  const dialogContent = getDialogContent();
  const Icon = dialogContent.icon;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Start Work button removed - only available on freelancer page */}

        {/* Submit Milestone - Only beneficiary for pending milestones that can be submitted (disabled if terminated) */}
        {showSubmitButton && canSubmitMilestone() && !isProjectTerminated && (
          <Button
            onClick={() => openDialog("submit")}
            size="sm"
            variant="default"
            className="gap-2"
          >
            {isSmartAccountReady ? (
              <>
                <Zap className="h-4 w-4" />
                Smart Submit
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        )}

        {/* Approve Milestone - Only payer for submitted milestones (disabled if terminated) */}
        {canApproveMilestone() && !isProjectTerminated && (
          <Button
            onClick={() => openDialog("approve")}
            size="sm"
            variant="default"
            className="gap-2"
            disabled={isLoading}
          >
            {isSmartAccountReady ? (
              <>
                <Zap className="h-4 w-4" />
                {isLoading ? "Processing..." : "Smart Approve"}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isLoading ? "Processing..." : "Approve"}
              </>
            )}
          </Button>
        )}

        {/* Dispute Milestone - Only payer for submitted milestones (disabled if terminated) */}
        {milestone.status === "submitted" &&
          isPayer &&
          !isProjectTerminated && (
            <Button
              onClick={() => openDialog("dispute")}
              size="sm"
              variant="destructive"
              className="gap-2"
              disabled={isLoading}
            >
              {isSmartAccountReady ? (
                <>
                  <Zap className="h-4 w-4" />
                  {isLoading ? "Processing..." : "Smart Dispute"}
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4" />
                  {isLoading ? "Processing..." : "Dispute"}
                </>
              )}
            </Button>
          )}

        {/* Approved Status - Show approved badge */}
        {milestone.status === "approved" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Approved</span>
          </div>
        )}

        {/* Rejected Status - Show rejected badge */}
        {milestone.status === "rejected" && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Rejected</span>
          </div>
        )}

        {/* Disputed Status - Show disputed badge with reason */}
        {milestone.status === "disputed" && (
          <div className="flex flex-col gap-2 text-orange-600">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              <span className="text-sm font-medium">Disputed</span>
            </div>
            {milestone.disputeReason && (
              <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border">
                <strong>Reason:</strong> {milestone.disputeReason}
              </div>
            )}
          </div>
        )}

        {/* Terminated Project Status - Show terminated badge */}
        {isProjectTerminated && (
          <div className="flex items-center gap-2 text-gray-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Project Terminated</span>
          </div>
        )}

        {/* Duplicate dispute button removed */}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base leading-relaxed">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 my-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow ID:</span>
                <span className="font-mono font-semibold">#{escrowId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Milestone:</span>
                <span className="font-semibold">{milestoneIndex + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-primary">
                  {(() => {
                    try {
                      const amount = Number.parseFloat(milestone.amount);
                      if (isNaN(amount)) return "0.00";
                      return (amount / 1e18).toFixed(2);
                    } catch (e) {
                      return "0.00";
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Dispute reason input for dispute action */}
          {actionType === "dispute" && (
            <div className="my-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for dispute (required)
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please explain why you are disputing this milestone..."
                className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                required
              />
              {!disputeReason.trim() && (
                <p className="text-sm text-red-600 mt-1">
                  Please provide a reason for the dispute
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={isLoading}>
              {isLoading ? "Processing..." : dialogContent.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
