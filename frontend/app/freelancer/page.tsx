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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FreelancerHeader } from "@/components/freelancer/freelancer-header";
import { FreelancerStats } from "@/components/freelancer/freelancer-stats";
import { EscrowCard } from "@/components/freelancer/escrow-card";
import { FreelancerLoading } from "@/components/freelancer/freelancer-loading";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  User,
  DollarSign,
  CheckCircle,
  Calendar,
  Play,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

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
  const [submittedMilestones, setSubmittedMilestones] = useState<Set<string>>(
    new Set(),
  );
  const [approvedMilestones, setApprovedMilestones] = useState<Set<string>>(
    new Set(),
  );
  const [selectedEscrowId, setSelectedEscrowId] = useState<string | null>(null);
  const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState<
    number | null
  >(null);
  const [milestoneDescriptions, setMilestoneDescriptions] = useState<
    Record<string, string>
  >({});
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (wallet.isConnected) {
      fetchFreelancerEscrows();
    }
  }, [wallet.isConnected]);

  // Listen for milestone submission events
  useEffect(() => {
    const handleMilestoneSubmitted = () => {
      fetchFreelancerEscrows();
    };

    const handleMilestoneApproved = () => {
      fetchFreelancerEscrows();
    };

    window.addEventListener("milestoneSubmitted", handleMilestoneSubmitted);
    window.addEventListener("milestoneApproved", handleMilestoneApproved);
    return () => {
      window.removeEventListener(
        "milestoneSubmitted",
        handleMilestoneSubmitted,
      );
      window.removeEventListener("milestoneApproved", handleMilestoneApproved);
    };
  }, []);

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
              // Get milestone count from escrow summary first
              const milestoneCount = Number(escrowSummary[11]) || 0;
              console.log(
                `Escrow ${i} milestoneCount from contract:`,
                escrowSummary[11],
              );
              console.log(`Escrow ${i} parsed milestoneCount:`, milestoneCount);

              // Fetch milestones for this escrow
              const milestones = await contract.call("getMilestones", i);
              console.log(`Milestones for escrow ${i}:`, milestones);
              console.log(`Milestones type:`, typeof milestones);
              console.log(`Milestones length:`, milestones?.length);
              if (milestones && milestones.length > 0) {
                console.log(`First milestone:`, milestones[0]);
              }

              // Create all milestones - if we only have 1 milestone but need 3, create placeholders
              const allMilestones = [];
              if (milestones && Array.isArray(milestones)) {
                // Add existing milestones
                for (let j = 0; j < milestones.length; j++) {
                  allMilestones.push(milestones[j]);
                }

                // Create placeholder milestones for the missing ones
                for (let j = milestones.length; j < milestoneCount; j++) {
                  console.log(
                    `Creating placeholder milestone ${j} for escrow ${i}`,
                  );
                  allMilestones.push({
                    description: `Milestone ${j + 1} - To be defined`,
                    amount: "0",
                    status: 0, // pending
                    submittedAt: 0,
                    approvedAt: 0,
                  });
                }
              } else {
                // If no milestones returned, create all as placeholders
                for (let j = 0; j < milestoneCount; j++) {
                  console.log(
                    `Creating all placeholder milestones for escrow ${i}`,
                  );
                  allMilestones.push({
                    description: `Milestone ${j + 1} - To be defined`,
                    amount: "0",
                    status: 0, // pending
                    submittedAt: 0,
                    approvedAt: 0,
                  });
                }
              }

              console.log(`All milestones for escrow ${i}:`, allMilestones);

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
                milestones: allMilestones.map((m: any, index: number) => {
                  try {
                    // Handle milestone data structure from getMilestones
                    let description = "";
                    let amount = "0";
                    let status = 0;
                    let submittedAt = undefined;
                    let approvedAt = undefined;

                    if (m && typeof m === "object") {
                      try {
                        // Check if this is a placeholder milestone
                        if (
                          m.description &&
                          m.description.includes("To be defined")
                        ) {
                          // This is a placeholder milestone
                          description = m.description;
                          amount = m.amount || "0";
                          status = m.status || 0;
                          submittedAt = m.submittedAt || undefined;
                          approvedAt = m.approvedAt || undefined;
                          console.log(
                            `Milestone ${index} is a placeholder milestone`,
                          );
                        } else {
                          // This is a real milestone from the contract
                          // Handle Proxy(Result) objects properly
                          try {
                            // Try direct field access first
                            if (m.description !== undefined) {
                              description = String(m.description);
                            } else if (m[0] !== undefined) {
                              description = String(m[0]);
                            } else {
                              description = `Milestone ${index + 1}`;
                            }

                            if (m.amount !== undefined) {
                              amount = String(m.amount);
                            } else if (m[1] !== undefined) {
                              amount = String(m[1]);
                            } else {
                              amount = "0";
                            }

                            if (m.status !== undefined) {
                              status = Number(m.status) || 0;
                            } else if (m[2] !== undefined) {
                              status = Number(m[2]) || 0;
                            } else {
                              status = 0;
                            }

                            if (
                              m.submittedAt !== undefined &&
                              Number(m.submittedAt) > 0
                            ) {
                              submittedAt = Number(m.submittedAt) * 1000;
                            } else if (m[3] !== undefined && Number(m[3]) > 0) {
                              submittedAt = Number(m[3]) * 1000;
                            }

                            if (
                              m.approvedAt !== undefined &&
                              Number(m.approvedAt) > 0
                            ) {
                              approvedAt = Number(m.approvedAt) * 1000;
                            } else if (m[4] !== undefined && Number(m[4]) > 0) {
                              approvedAt = Number(m[4]) * 1000;
                            }
                          } catch (proxyError) {
                            console.warn(
                              `Error parsing Proxy(Result) for milestone ${index}:`,
                              proxyError,
                            );
                            // Fallback to basic parsing
                            description = `Milestone ${index + 1}`;
                            amount = "0";
                            status = 0;
                          }
                        }
                      } catch (e) {
                        console.warn(
                          `Error parsing milestone ${index} basic data:`,
                          e,
                        );
                        description = `Milestone ${index + 1}`;
                        amount = "0";
                        status = 0;
                      }

                      // Log the milestone data for debugging
                      console.log(`Milestone ${index} raw data:`, m);
                      console.log(`Milestone ${index} parsed:`, {
                        description,
                        amount,
                        status,
                        submittedAt,
                        approvedAt,
                      });
                    } else {
                      // Fallback for unexpected structure
                      description = `Milestone ${index + 1}`;
                      amount = "0";
                      status = 0;
                    }

                    // Determine the actual status based on timestamps and status
                    let finalStatus = getMilestoneStatusFromNumber(status);

                    // Check if this is a placeholder milestone
                    const isPlaceholder =
                      description && description.includes("To be defined");

                    if (isPlaceholder) {
                      // For placeholder milestones, determine status based on previous milestones
                      if (index === 0) {
                        // First milestone - should be pending
                        finalStatus = "pending";
                      } else {
                        // Check if previous milestone is approved
                        // This will be handled by the UI logic
                        finalStatus = "pending";
                      }
                      console.log(
                        `Milestone ${index} is placeholder, setting to pending`,
                      );
                    } else {
                      // Real milestone from contract
                      console.log(`Milestone ${index} status determination:`, {
                        rawStatus: status,
                        parsedStatus: getMilestoneStatusFromNumber(status),
                        submittedAt: submittedAt,
                        approvedAt: approvedAt,
                        hasSubmittedAt: submittedAt && submittedAt > 0,
                        hasApprovedAt: approvedAt && approvedAt > 0,
                      });

                      // Priority 1: If milestone status is 2 (approved), it's approved
                      if (status === 2) {
                        finalStatus = "approved";
                        console.log(
                          `Milestone ${index} setting to approved due to status 2`,
                        );
                      }
                      // Priority 2: If milestone has been approved (approvedAt exists), it's approved
                      else if (approvedAt && approvedAt > 0) {
                        finalStatus = "approved";
                        console.log(
                          `Milestone ${index} setting to approved due to approvedAt: ${approvedAt}`,
                        );
                      }
                      // Priority 3: If milestone has been submitted (submittedAt exists) but not approved, it's submitted
                      else if (submittedAt && submittedAt > 0) {
                        finalStatus = "submitted";
                        console.log(
                          `Milestone ${index} setting to submitted due to submittedAt: ${submittedAt}`,
                        );
                      }
                      // Priority 4: If milestone status is 1 (submitted), it's submitted
                      else if (status === 1) {
                        finalStatus = "submitted";
                        console.log(
                          `Milestone ${index} setting to submitted due to status 1`,
                        );
                      }
                      // Special case: If this is the first milestone and funds have been released, it should be approved
                      else if (
                        index === 0 &&
                        escrowSummary[5] &&
                        Number(escrowSummary[5]) > 0
                      ) {
                        finalStatus = "approved";
                        console.log(
                          `Milestone ${index} setting to approved due to released funds: ${escrowSummary[5]}`,
                        );
                      }
                      // Otherwise use the parsed status
                      else {
                        console.log(
                          `Milestone ${index} using parsed status: ${finalStatus}`,
                        );
                      }
                    }

                    console.log(
                      `Milestone ${index} final status:`,
                      finalStatus,
                      `(raw status: ${status}, submittedAt: ${submittedAt}, approvedAt: ${approvedAt})`,
                    );

                    // Track milestone states for submission prevention
                    const milestoneKey = `${i}-${index}`;
                    if (finalStatus === "approved") {
                      setApprovedMilestones(
                        (prev) => new Set([...prev, milestoneKey]),
                      );
                    } else if (finalStatus === "submitted") {
                      setSubmittedMilestones(
                        (prev) => new Set([...prev, milestoneKey]),
                      );
                    }

                    return {
                      description,
                      amount,
                      status: finalStatus,
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
                      status: "pending",
                    };
                  }
                }),
                projectDescription: escrowSummary[14] || "", // projectDescription
                isOpenJob: Boolean(escrowSummary[12]), // isOpenJob
                milestoneCount: Number(escrowSummary[11]) || 0, // milestoneCount
              };

              // Debug milestone count
              console.log(
                `Escrow ${i} milestoneCount from contract:`,
                escrowSummary[11],
              );
              console.log(
                `Escrow ${i} parsed milestoneCount:`,
                Number(escrowSummary[11]),
              );
              console.log(
                `Escrow ${i} milestones array length:`,
                milestones?.length,
              );

              freelancerEscrows.push(escrow);
            }
          } catch (error) {
            console.error(`Error fetching escrow ${i}:`, error);
            continue;
          }
        }
      }

      setEscrows(freelancerEscrows);

      // Update submitted milestones based on current data
      const currentSubmittedMilestones = new Set<string>();
      freelancerEscrows.forEach((escrow) => {
        escrow.milestones.forEach((milestone, index) => {
          // Mark as submitted if milestone is submitted, approved, or has been processed
          if (
            milestone.status === "submitted" ||
            milestone.status === "approved" ||
            milestone.submittedAt ||
            milestone.approvedAt
          ) {
            currentSubmittedMilestones.add(`${escrow.id}-${index}`);
          }
        });
      });
      setSubmittedMilestones(currentSubmittedMilestones);
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
    const milestoneKey = `${escrowId}-${milestoneIndex}`;
    const description = milestoneDescriptions[milestoneKey] || "";

    // Check if milestone has already been submitted
    if (submittedMilestones.has(milestoneKey)) {
      toast({
        title: "Milestone already submitted",
        description:
          "This milestone has already been submitted and cannot be submitted again",
        variant: "destructive",
      });
      return;
    }

    // Check if milestone has already been approved
    if (approvedMilestones.has(milestoneKey)) {
      toast({
        title: "Milestone already approved",
        description:
          "This milestone has already been approved and cannot be resubmitted",
        variant: "destructive",
      });
      return;
    }

    // Additional check: Get the current milestone status from contract
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      const milestones = await contract.call("getMilestones", escrowId);

      if (milestones && milestones.length > milestoneIndex) {
        const milestone = milestones[milestoneIndex];
        console.log(`Contract milestone ${milestoneIndex} status:`, milestone);

        // Check if milestone has been submitted (status 1) or approved (status 2)
        if (milestone && milestone[2] && Number(milestone[2]) > 0) {
          toast({
            title: "Milestone already processed",
            description: `This milestone has already been ${Number(milestone[2]) === 2 ? "approved" : "submitted"} and cannot be submitted again`,
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.warn("Could not check milestone status from contract:", error);
      // Continue with submission attempt
    }

    // Validate milestone description from input field
    if (!description?.trim()) {
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
        description,
      );

      // Wait for transaction confirmation
      toast({
        title: "Transaction submitted",
        description: "Waiting for blockchain confirmation...",
      });

      // Wait for transaction to be mined using polling
      let receipt;
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute timeout

      while (attempts < maxAttempts) {
        try {
          receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });

          if (receipt) {
            break;
          }
        } catch (error) {
          console.log("Waiting for transaction confirmation...", attempts + 1);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
      }

      if (!receipt) {
        throw new Error(
          "Transaction timeout - please check the blockchain explorer",
        );
      }

      if (receipt.status === "0x1") {
        toast({
          title: "Milestone submitted!",
          description: "Your milestone has been submitted for review",
        });

        // Mark this milestone as submitted to prevent double submission
        const milestoneKey = `${escrowId}-${milestoneIndex}`;
        setSubmittedMilestones((prev) => new Set([...prev, milestoneKey]));

        // Clear form
        setMilestoneDescriptions((prev) => {
          const updated = { ...prev };
          delete updated[milestoneKey];
          return updated;
        });
        setSelectedEscrowId(null);

        // Refresh escrows
        await fetchFreelancerEscrows();

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent("milestoneSubmitted"));
      } else {
        throw new Error("Transaction failed on blockchain");
      }
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
      "pending", // 0 - Not started
      "submitted", // 1 - Submitted by freelancer
      "approved", // 2 - Approved by client
      "rejected", // 3 - Rejected by client
      "disputed", // 4 - Under dispute
      "resolved", // 5 - Dispute resolved
    ];
    return statuses[status] || "pending";
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "disputed":
        return "bg-red-100 text-red-800";
      case "resolved":
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
    try {
      const num = Number(amount) / 1e18;
      if (isNaN(num) || num < 0) {
        return "0.00";
      }
      return num.toFixed(2);
    } catch (error) {
      console.warn("Error formatting amount:", amount, error);
      return "0.00";
    }
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Freelancer Dashboard
            </h1>
            <p className="text-gray-600">
              Manage your assigned projects and track your earnings
            </p>
          </div>
          <Button
            onClick={fetchFreelancerEscrows}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm text-gray-600">Total Value</p>
                          <p className="font-semibold text-green-700">
                            {formatAmount(escrow.totalAmount)} tokens
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm text-gray-600">Released</p>
                          <p className="font-semibold text-blue-700">
                            {formatAmount(escrow.releasedAmount)} tokens
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="text-sm text-gray-600">Created</p>
                          <p className="font-semibold text-purple-700">
                            {formatDate(escrow.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                        <FileText className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="text-sm text-gray-600">Milestones</p>
                          <p className="font-semibold text-orange-700">
                            {escrow.milestoneCount || escrow.milestones.length}{" "}
                            total
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Milestones - Compact Design */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Milestones (
                        {escrow.milestoneCount || escrow.milestones.length}{" "}
                        total)
                      </h4>

                      {/* Milestone Progress */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {escrow.milestones.map((milestone, index) => {
                          const milestoneKey = `${escrow.id}-${index}`;
                          const isApproved = milestone.status === "approved";
                          const isSubmitted = milestone.status === "submitted";
                          const isPending = milestone.status === "pending";
                          const isCurrent =
                            isPending &&
                            (index === 0 ||
                              escrow.milestones[index - 1]?.status ===
                                "approved");

                          return (
                            <div
                              key={index}
                              className={`p-4 rounded-lg border-2 ${
                                isApproved
                                  ? "bg-green-50 border-green-200"
                                  : isSubmitted
                                    ? "bg-yellow-50 border-yellow-200"
                                    : isCurrent
                                      ? "bg-blue-50 border-blue-200"
                                      : "bg-gray-50 border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">
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

                              {/* Client Requirements */}
                              {milestone.description &&
                                !milestone.description.includes(
                                  "To be defined",
                                ) &&
                                milestone.description !==
                                  `Milestone ${index + 1}` && (
                                  <div className="text-xs text-gray-600 mb-2">
                                    <span className="font-medium">
                                      Requirements:
                                    </span>
                                    <p className="mt-1 line-clamp-2">
                                      {milestone.description.length > 80
                                        ? milestone.description.substring(
                                            0,
                                            80,
                                          ) + "..."
                                        : milestone.description}
                                    </p>
                                  </div>
                                )}

                              <div className="text-sm font-semibold text-green-600">
                                {formatAmount(milestone.amount)} tokens
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Current Milestone Submission Form */}
                      {(() => {
                        const currentMilestoneIndex =
                          escrow.milestones.findIndex(
                            (milestone, index) =>
                              milestone.status === "pending" &&
                              (index === 0 ||
                                escrow.milestones[index - 1]?.status ===
                                  "approved"),
                          );

                        if (currentMilestoneIndex === -1) {
                          return (
                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                              <p className="text-gray-600">
                                All milestones completed or in progress
                              </p>
                            </div>
                          );
                        }

                        const currentMilestone =
                          escrow.milestones[currentMilestoneIndex];
                        const milestoneKey = `${escrow.id}-${currentMilestoneIndex}`;
                        const canSubmit =
                          currentMilestone.status === "pending" &&
                          escrow.status === "InProgress" &&
                          !submittedMilestones.has(milestoneKey) &&
                          !approvedMilestones.has(milestoneKey);

                        return (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-semibold text-blue-900 mb-3">
                              Submit Milestone {currentMilestoneIndex + 1}
                            </h5>

                            {/* Client Requirements */}
                            {currentMilestone.description &&
                              !currentMilestone.description.includes(
                                "To be defined",
                              ) &&
                              currentMilestone.description !==
                                `Milestone ${currentMilestoneIndex + 1}` && (
                                <div className="mb-3 p-3 bg-white rounded border">
                                  <div className="text-sm font-medium text-blue-800 mb-1">
                                    Client Requirements:
                                  </div>
                                  <div className="text-sm text-blue-700">
                                    {currentMilestone.description}
                                  </div>
                                </div>
                              )}

                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Your Work Description
                                </label>
                                <Textarea
                                  value={
                                    milestoneDescriptions[milestoneKey] || ""
                                  }
                                  onChange={(e) =>
                                    setMilestoneDescriptions((prev) => ({
                                      ...prev,
                                      [milestoneKey]: e.target.value,
                                    }))
                                  }
                                  className="text-sm"
                                  rows={3}
                                  placeholder="Describe what you've completed for this milestone..."
                                />
                              </div>

                              <div className="flex gap-2">
                                {canSubmit && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      submitMilestone(
                                        escrow.id,
                                        currentMilestoneIndex,
                                      )
                                    }
                                    disabled={
                                      submittingMilestone === milestoneKey ||
                                      !milestoneDescriptions[
                                        milestoneKey
                                      ]?.trim()
                                    }
                                  >
                                    {submittingMilestone === milestoneKey
                                      ? "Submitting..."
                                      : "Submit Milestone"}
                                  </Button>
                                )}

                                {currentMilestone.status === "submitted" && (
                                  <div className="flex gap-2">
                                    <Badge className="bg-yellow-100 text-yellow-800">
                                      Submitted - Awaiting Approval
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedEscrowId(escrow.id);
                                        setSelectedMilestoneIndex(
                                          currentMilestoneIndex,
                                        );
                                        setDisputeReason("");
                                        setShowDisputeDialog(true);
                                      }}
                                    >
                                      Dispute
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
