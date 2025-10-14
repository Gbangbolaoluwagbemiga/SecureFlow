"use client";

import { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Play,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Send,
  User,
  Calendar,
  Coins,
} from "lucide-react";

interface Escrow {
  id: string;
  payer: string;
  beneficiary: string;
  token: string;
  totalAmount: string;
  releasedAmount: string;
  status: string;
  createdAt: number;
  duration: number;
  milestones: Milestone[];
  projectDescription: string;
  isOpenJob: boolean;
}

interface Milestone {
  description: string;
  amount: string;
  status: string;
  submittedAt?: number;
  approvedAt?: number;
}

export default function FreelancerPage() {
  const { wallet, getContract } = useWeb3();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingMilestone, setSubmittingMilestone] = useState<string | null>(
    null,
  );
  const [selectedEscrowId, setSelectedEscrowId] = useState<string | null>(null);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (wallet.isConnected) {
      fetchFreelancerEscrows();
    }
  }, [wallet.isConnected]);

  const fetchFreelancerEscrows = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Get total number of escrows
      const totalEscrows = await contract.call("nextEscrowId");
      const escrowCount = Number(totalEscrows);
      console.log(
        "Freelancer page - Total escrows from contract:",
        totalEscrows,
        "Count:",
        escrowCount,
      );

      const freelancerEscrows: Escrow[] = [];

      // Fetch escrows where current user is the beneficiary
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            console.log(`Fetching escrow ${i} for freelancer...`);
            const escrowSummary = await contract.call("getEscrowSummary", i);
            console.log(`Escrow ${i} data:`, escrowSummary);

            // Check if current user is the beneficiary
            const isBeneficiary =
              escrowSummary[1].toLowerCase() === wallet.address?.toLowerCase();

            if (isBeneficiary) {
              // Fetch milestones for this escrow
              const milestones = await contract.call("getMilestones", i);
              console.log(`Milestones for escrow ${i}:`, milestones);
              console.log(`Milestones type:`, typeof milestones);
              console.log(`Milestones length:`, milestones?.length);
              if (milestones && milestones.length > 0) {
                console.log(`First milestone:`, milestones[0]);
              }

              // Convert contract data to our Escrow type
              const escrow: Escrow = {
                id: i.toString(),
                payer: escrowSummary[0], // depositor
                beneficiary: escrowSummary[1], // beneficiary
                token: escrowSummary[7], // token
                totalAmount: escrowSummary[4].toString(), // totalAmount
                releasedAmount: escrowSummary[5].toString(), // paidAmount
                status: getStatusFromNumber(Number(escrowSummary[3])), // status
                createdAt: Number(escrowSummary[10]) * 1000, // createdAt (convert to milliseconds)
                duration: Number(escrowSummary[8]) - Number(escrowSummary[10]), // deadline - createdAt (in seconds)
                milestones:
                  milestones && Array.isArray(milestones)
                    ? milestones.map((m: any, index: number) => {
                        try {
                          // Handle different milestone data structures
                          let description = "";
                          let amount = "0";
                          let status = 0;
                          let submittedAt = undefined;
                          let approvedAt = undefined;

                          if (m && typeof m === "object") {
                            // If milestone is an object with indexed properties
                            description = m[0] || m.description || "";
                            amount = m[1]
                              ? m[1].toString()
                              : m.amount
                                ? m.amount.toString()
                                : "0";
                            status = Number(m[2] || m.status || 0);
                            submittedAt = m[3]
                              ? Number(m[3]) * 1000
                              : m.submittedAt
                                ? Number(m.submittedAt) * 1000
                                : undefined;
                            approvedAt = m[4]
                              ? Number(m[4]) * 1000
                              : m.approvedAt
                                ? Number(m.approvedAt) * 1000
                                : undefined;
                          } else {
                            // Fallback for unexpected structure
                            description = `Milestone ${index + 1}`;
                            amount = "0";
                            status = 0;
                          }

                          return {
                            description,
                            amount,
                            status: getMilestoneStatusFromNumber(status),
                            submittedAt,
                            approvedAt,
                          };
                        } catch (error) {
                          console.error(
                            `Error processing milestone ${index}:`,
                            error,
                          );
                          return {
                            description: `Milestone ${index + 1}`,
                            amount: "0",
                            status: "NotStarted",
                          };
                        }
                      })
                    : [], // Fallback to empty array if milestones is not an array
                projectDescription: escrowSummary[13] || "", // projectTitle
                isOpenJob: Boolean(escrowSummary[12]), // isOpenJob
              };

              freelancerEscrows.push(escrow);
            }
          } catch (error) {
            console.error(`Error fetching escrow ${i}:`, error);
            continue;
          }
        }
      }

      setEscrows(freelancerEscrows);
    } catch (error) {
      console.error("Error fetching freelancer escrows:", error);
      toast({
        title: "Failed to load escrows",
        description:
          "Could not fetch your assigned escrows from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startWork = async (escrowId: string) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      toast({
        title: "Starting work...",
        description: "Submitting transaction to start work on this escrow",
      });

      const txHash = await contract.send("startWork", "no-value", escrowId);

      toast({
        title: "Work started!",
        description: "You can now submit milestones for this project",
      });

      // Refresh escrows
      await fetchFreelancerEscrows();
    } catch (error) {
      console.error("Error starting work:", error);
      toast({
        title: "Failed to start work",
        description: "Could not start work on this escrow",
        variant: "destructive",
      });
    }
  };

  const submitMilestone = async (escrowId: string, milestoneIndex: number) => {
    // Get the milestone description from the escrow data
    const escrow = escrows.find((e) => e.id === escrowId);
    const milestone = escrow?.milestones[milestoneIndex];

    if (!milestone?.description?.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description of your work",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      toast({
        title: "Submitting milestone...",
        description: "Submitting transaction to submit your milestone",
      });

      const txHash = await contract.send(
        "submitMilestone",
        "no-value",
        escrowId,
        milestoneIndex,
        milestone.description,
      );

      toast({
        title: "Milestone submitted!",
        description: "Your milestone has been submitted for review",
      });

      // Clear form
      setMilestoneDescription("");
      setSelectedEscrowId(null);

      // Refresh escrows
      await fetchFreelancerEscrows();
    } catch (error) {
      console.error("Error submitting milestone:", error);
      toast({
        title: "Failed to submit milestone",
        description: "Could not submit your milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const openDispute = async (
    escrowId: string,
    milestoneIndex: number,
    reason: string,
  ) => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the dispute",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      toast({
        title: "Opening dispute...",
        description: "Submitting transaction to open dispute",
      });

      const txHash = await contract.send(
        "openDispute",
        "no-value",
        escrowId,
        milestoneIndex,
        reason,
      );

      toast({
        title: "Dispute opened!",
        description: "A dispute has been opened for this milestone",
      });

      // Refresh escrows
      await fetchFreelancerEscrows();
    } catch (error) {
      console.error("Error opening dispute:", error);
      toast({
        title: "Failed to open dispute",
        description: "Could not open dispute for this milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const getStatusFromNumber = (status: number): string => {
    const statuses = [
      "Pending",
      "InProgress",
      "Released",
      "Refunded",
      "Disputed",
      "Expired",
    ];
    return statuses[status] || "Unknown";
  };

  const getMilestoneStatusFromNumber = (status: number): string => {
    const statuses = [
      "NotStarted",
      "Submitted",
      "Approved",
      "Disputed",
      "Resolved",
    ];
    return statuses[status] || "Unknown";
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case "NotStarted":
        return "bg-gray-100 text-gray-800";
      case "Submitted":
        return "bg-yellow-100 text-yellow-800";
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Disputed":
        return "bg-red-100 text-red-800";
      case "Resolved":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "inprogress":
        return "bg-blue-100 text-blue-800";
      case "released":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "submitted":
        return "bg-blue-100 text-blue-800";
      case "approved":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatAmount = (amount: string) => {
    const num = Number(amount) / 1e18;
    return num.toFixed(2);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Please connect your wallet to view your freelancer dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Freelancer Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your assigned projects and track your earnings
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : escrows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No assigned projects
              </h3>
              <p className="text-gray-600 text-center">
                You don't have any assigned projects yet. Check the jobs page to
                find open opportunities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {escrows.map((escrow) => (
              <motion.div
                key={escrow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Project #{escrow.id}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {escrow.projectDescription}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(escrow.status)}>
                        {escrow.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="font-semibold">
                          {formatAmount(escrow.totalAmount)} tokens
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-600">Paid:</span>
                        <span className="font-semibold">
                          {formatAmount(escrow.releasedAmount)} tokens
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="font-semibold">
                          {formatDate(escrow.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Milestones
                      </h4>
                      <div className="space-y-3">
                        {escrow.milestones.map((milestone, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  Milestone {index + 1}
                                </span>
                                <Badge
                                  className={getMilestoneStatusColor(
                                    milestone.status,
                                  )}
                                >
                                  {milestone.status}
                                </Badge>
                              </div>
                              {milestone.status === "NotStarted" ? (
                                <div className="mb-2">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Description (Editable)
                                  </label>
                                  <Textarea
                                    value={milestone.description}
                                    onChange={(e) => {
                                      // Update milestone description in local state
                                      const updatedEscrows = escrows.map(
                                        (esc) => {
                                          if (esc.id === escrow.id) {
                                            return {
                                              ...esc,
                                              milestones: esc.milestones.map(
                                                (m, i) =>
                                                  i === index
                                                    ? {
                                                        ...m,
                                                        description:
                                                          e.target.value,
                                                      }
                                                    : m,
                                              ),
                                            };
                                          }
                                          return esc;
                                        },
                                      );
                                      setEscrows(updatedEscrows);
                                    }}
                                    className="text-sm"
                                    rows={2}
                                    placeholder="Describe what you'll complete for this milestone..."
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600 mb-1">
                                  {milestone.description}
                                </p>
                              )}
                              <p className="text-sm font-semibold text-green-600">
                                {formatAmount(milestone.amount)} tokens
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {milestone.status === "NotStarted" &&
                                escrow.status === "InProgress" && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      submitMilestone(escrow.id, index)
                                    }
                                    disabled={
                                      submittingMilestone ===
                                      `${escrow.id}-${index}`
                                    }
                                  >
                                    {submittingMilestone ===
                                    `${escrow.id}-${index}`
                                      ? "Submitting..."
                                      : "Submit"}
                                  </Button>
                                )}
                              {milestone.status === "Submitted" && (
                                <div className="flex gap-2">
                                  <Badge className="bg-yellow-100 text-yellow-800">
                                    Submitted
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedEscrowId(escrow.id);
                                      setSelectedMilestoneIndex(index);
                                      setDisputeReason("");
                                      setShowDisputeDialog(true);
                                    }}
                                    disabled={
                                      submittingMilestone ===
                                      `${escrow.id}-${index}`
                                    }
                                  >
                                    Dispute
                                  </Button>
                                </div>
                              )}
                              {milestone.status === "Approved" && (
                                <Badge className="bg-green-100 text-green-800">
                                  Approved
                                </Badge>
                              )}
                              {milestone.status === "Rejected" && (
                                <div className="flex gap-2">
                                  <Badge className="bg-red-100 text-red-800">
                                    Rejected
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedEscrowId(escrow.id);
                                      setSelectedMilestoneIndex(index);
                                      setDisputeReason("");
                                      setShowDisputeDialog(true);
                                    }}
                                  >
                                    Dispute
                                  </Button>
                                </div>
                              )}
                              {milestone.status === "Disputed" && (
                                <Badge className="bg-red-100 text-red-800">
                                  Under Dispute
                                </Badge>
                              )}
                              {milestone.status === "Resolved" && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  Resolved
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      {escrow.status === "Pending" && (
                        <Button
                          onClick={() => startWork(escrow.id)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Start Work
                        </Button>
                      )}
                      {escrow.status === "InProgress" && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedEscrowId(escrow.id);
                            setMilestoneDescription("");
                          }}
                          className="flex items-center gap-2"
                        >
                          <Send className="h-4 w-4" />
                          Submit Milestone
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Dispute Dialog */}
        {showDisputeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Open Dispute</CardTitle>
                <CardDescription>
                  Provide a reason for disputing this milestone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Dispute Reason
                    </label>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Explain why you're disputing this milestone..."
                      className="w-full p-3 border rounded-lg resize-none"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (
                          selectedEscrowId &&
                          selectedMilestoneIndex !== null
                        ) {
                          openDispute(
                            selectedEscrowId,
                            selectedMilestoneIndex,
                            disputeReason,
                          );
                          setShowDisputeDialog(false);
                        }
                      }}
                      disabled={
                        !disputeReason.trim() || submittingMilestone !== null
                      }
                      className="flex-1"
                    >
                      {submittingMilestone ? "Opening..." : "Open Dispute"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDisputeDialog(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
