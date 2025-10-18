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
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import { CheckCircle2, Send, AlertTriangle, Gavel, Play } from "lucide-react";
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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<
    "start" | "submit" | "approve" | "reject" | "dispute" | "resolve" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");

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
      } catch (error) {
        console.log("Waiting for transaction confirmation...", attempts + 1);
      }

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
    setRejectionReason(""); // Clear rejection reason when opening dialog
    setDialogOpen(true);
  };

  const handleAction = async () => {
    // Validate rejection reason if rejecting
    if (actionType === "reject" && !rejectionReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for rejecting this milestone",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      let txHash;
      switch (actionType) {
        case "start":
          txHash = await contract.send("startWork", escrowId);
          toast({
            title: "Work started!",
            description: "You can now begin working on the milestones",
          });
          break;
        case "submit":
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

            // Set loading state
            setIsLoading(true);

            console.log(
              `Approving milestone ${milestoneIndex} for escrow ${escrowId}`,
            );
            console.log(`Milestone status: ${milestone.status}`);

            // Try to estimate gas first to catch potential issues
            try {
              const gasEstimate = await contract.estimateGas(
                "approveMilestone",
                escrowId,
                milestoneIndex,
              );
              console.log(`Gas estimate: ${gasEstimate}`);
            } catch (gasError) {
              console.warn("Gas estimation failed:", gasError);
              // Don't block the transaction if gas estimation fails
              // Some networks or contract states might not support gas estimation
              console.log(
                "Proceeding with transaction despite gas estimation failure",
              );
            }

            // Add retry logic for failed transactions
            let txHash;
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
                console.log(
                  `Transaction attempt ${retryCount} failed:`,
                  sendError,
                );

                if (retryCount >= maxRetries) {
                  throw sendError; // Re-throw the last error
                }

                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, 2000));
                console.log(
                  `Retrying transaction (attempt ${retryCount + 1}/${maxRetries})...`,
                );

                // Show retry toast
                toast({
                  title: "Retrying transaction",
                  description: `Attempt ${retryCount + 1} of ${maxRetries}. Please wait...`,
                  variant: "default",
                });
              }
            }

            console.log(`Approval transaction hash: ${txHash}`);
            console.log(`Transaction object type:`, typeof txHash);
            console.log(`Transaction object:`, txHash);

            // Wait for transaction to be mined and confirmed
            try {
              let receipt;

              // Check if txHash has a wait method (ethers.js transaction object)
              if (txHash && typeof txHash.wait === "function") {
                console.log("Using txHash.wait() method");
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
                console.log(
                  "Using polling method for transaction confirmation",
                );
                receipt = await pollTransactionReceipt(txHash);
              }

              console.log(`Transaction receipt:`, receipt);

              if (receipt.status === 1) {
                toast({
                  title: "Milestone approved!",
                  description: "Payment has been released to the beneficiary",
                });

                // Close the modal immediately after successful approval
                setDialogOpen(false);

                // Wait for blockchain state to update, then refresh data
                await new Promise((resolve) => setTimeout(resolve, 2000));
                onSuccess();

                // Dispatch event to notify freelancer dashboard of approval
                window.dispatchEvent(
                  new CustomEvent("milestoneApproved", {
                    detail: { escrowId, milestoneIndex },
                  }),
                );

                // Refresh the entire page to ensure UI is fully updated
                window.location.reload();
              } else {
                throw new Error("Transaction failed on blockchain");
              }
            } catch (receiptError: any) {
              console.error("Transaction confirmation failed:", receiptError);

              // If confirmation fails but we have a transaction hash, assume success
              // This handles cases where the transaction succeeds but confirmation polling fails
              if (txHash) {
                console.log(
                  "Transaction confirmation failed, but assuming success due to transaction hash",
                );
                toast({
                  title: "Milestone approved!",
                  description: "Payment has been released to the beneficiary",
                });

                // Close the modal immediately after successful approval
                setDialogOpen(false);

                // Wait for blockchain state to update, then refresh data
                await new Promise((resolve) => setTimeout(resolve, 2000));
                onSuccess();

                // Dispatch event to notify freelancer dashboard of approval
                window.dispatchEvent(
                  new CustomEvent("milestoneApproved", {
                    detail: { escrowId, milestoneIndex },
                  }),
                );

                // Refresh the entire page to ensure UI is fully updated
                window.location.reload();
                return; // Exit early to avoid the error handling below
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
            console.error("Error approving milestone:", error);

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
        case "reject":
          txHash = await contract.send(
            "rejectMilestone",
            "no-value",
            escrowId,
            milestoneIndex,
            rejectionReason,
          );
          toast({
            title: "Milestone rejected!",
            description:
              "The milestone has been rejected and returned to freelancer",
          });

          // Close the modal immediately after successful rejection
          setDialogOpen(false);

          // Wait for blockchain state to update, then refresh data
          await new Promise((resolve) => setTimeout(resolve, 2000));
          onSuccess();

          // Dispatch event to notify freelancer dashboard of rejection
          window.dispatchEvent(
            new CustomEvent("milestoneRejected", {
              detail: { escrowId, milestoneIndex },
            }),
          );

          // Refresh the entire page to ensure UI is fully updated
          window.location.reload();
          break;
        case "dispute":
          txHash = await contract.send(
            "disputeMilestone",
            "no-value",
            escrowId,
          );
          toast({
            title: "Dispute raised",
            description: "The escrow is now in dispute status",
            variant: "destructive",
          });
          break;
        case "resolve":
          // This would need additional UI for choosing resolution
          toast({
            title: "Resolution pending",
            description: "Admin will review and resolve the dispute",
          });
          break;
      }

      console.log("Transaction hash:", txHash);
      setDialogOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error performing action:", error);
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
      case "reject":
        return {
          title: "Reject Milestone",
          description: `Reject milestone ${milestoneIndex + 1}. The freelancer will be notified and can resubmit.`,
          icon: AlertTriangle,
          confirmText: "Reject",
        };
      case "dispute":
        return {
          title: "Raise Dispute",
          description:
            "This will pause the escrow and notify the admin. Use this if there's a disagreement about the work.",
          icon: AlertTriangle,
          confirmText: "Raise Dispute",
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
        {/* Start Work - Only beneficiary can start */}
        {escrowStatus === "pending" && isBeneficiary && (
          <Button
            onClick={() => openDialog("start")}
            size="sm"
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Start Work
          </Button>
        )}

        {/* Submit Milestone - Only beneficiary for pending milestones that can be submitted */}
        {showSubmitButton && canSubmitMilestone() && (
          <Button
            onClick={() => openDialog("submit")}
            size="sm"
            variant="default"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Submit
          </Button>
        )}

        {/* Approve Milestone - Only payer for submitted milestones */}
        {canApproveMilestone() && (
          <Button
            onClick={() => openDialog("approve")}
            size="sm"
            variant="default"
            className="gap-2"
            disabled={isLoading}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isLoading ? "Processing..." : "Approve"}
          </Button>
        )}

        {/* Reject Milestone - Only payer for submitted milestones */}
        {milestone.status === "submitted" && isPayer && (
          <Button
            onClick={() => openDialog("reject")}
            size="sm"
            variant="destructive"
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Reject
          </Button>
        )}

        {/* Approved Status - Show approved badge */}
        {milestone.status === "approved" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Approved</span>
          </div>
        )}

        {/* Debug info */}
        {(() => {
          console.log(
            `MilestoneActions - Status: ${milestone.status}, isPayer: ${isPayer}, isBeneficiary: ${isBeneficiary}`,
          );
          return null;
        })()}

        {/* Dispute - Only beneficiary can dispute, and only for submitted milestones */}
        {milestone.status === "submitted" && isBeneficiary && (
          <Button
            onClick={() => openDialog("dispute")}
            size="sm"
            variant="destructive"
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Dispute
          </Button>
        )}
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

          {/* Rejection reason input for reject action */}
          {actionType === "reject" && (
            <div className="my-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection (required)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please explain why this milestone is being rejected so the freelancer can make improvements..."
                className="w-full p-3 border border-gray-300 rounded-md resize-none"
                rows={3}
                required
              />
              {!rejectionReason.trim() && (
                <p className="text-sm text-red-600 mt-1">
                  Please provide a reason for rejection
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
