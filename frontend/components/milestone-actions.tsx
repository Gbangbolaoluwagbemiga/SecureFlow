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
}

export function MilestoneActions({
  escrowId,
  milestoneIndex,
  milestone,
  isPayer,
  isBeneficiary,
  escrowStatus,
  onSuccess,
}: MilestoneActionsProps) {
  const { getContract } = useWeb3();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<
    "start" | "submit" | "approve" | "dispute" | "resolve" | null
  >(null);

  const openDialog = (type: typeof actionType) => {
    setActionType(type);
    setDialogOpen(true);
  };

  const handleAction = async () => {
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
            escrowId,
            milestoneIndex,
          );
          toast({
            title: "Milestone submitted!",
            description: "Waiting for client approval",
          });
          break;
        case "approve":
          txHash = await contract.send(
            "approveMilestone",
            escrowId,
            milestoneIndex,
          );
          toast({
            title: "Milestone approved!",
            description: "Payment has been released to the beneficiary",
          });
          break;
        case "dispute":
          txHash = await contract.send("disputeMilestone", escrowId);
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
          description: `Approve milestone ${milestoneIndex + 1} and release ${milestone.amount} tokens to the beneficiary.`,
          icon: CheckCircle2,
          confirmText: "Approve & Release",
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

        {/* Submit Milestone - Only beneficiary for pending milestones */}
        {milestone.status === "pending" &&
          isBeneficiary &&
          escrowStatus === "active" && (
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
        {milestone.status === "submitted" && isPayer && (
          <Button
            onClick={() => openDialog("approve")}
            size="sm"
            variant="default"
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
        )}

        {/* Dispute - Both parties can dispute */}
        {(milestone.status === "submitted" || escrowStatus === "active") &&
          (isPayer || isBeneficiary) && (
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
                  {milestone.amount}
                </span>
              </div>
            </div>
          </div>

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
