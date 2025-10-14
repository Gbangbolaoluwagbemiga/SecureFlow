"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import type { Escrow } from "@/lib/web3/types";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Wallet,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { MilestoneActions } from "@/components/milestone-actions";
import { ReputationScore } from "@/components/reputation-score";
import { EscrowNFTBadge } from "@/components/escrow-nft-badge";

export default function DashboardPage() {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEscrow, setExpandedEscrow] = useState<string | null>(null);
  const [submittingMilestone, setSubmittingMilestone] = useState<string | null>(
    null,
  );

  const getStatusFromNumber = (status: number): string => {
    switch (status) {
      case 0:
        return "pending";
      case 1:
        return "active";
      case 2:
        return "completed";
      case 3:
        return "disputed";
      case 4:
        return "cancelled";
      default:
        return "pending";
    }
  };

  const getMilestoneStatusFromNumber = (status: number): string => {
    const statuses = [
      "pending",
      "submitted",
      "approved",
      "disputed",
      "resolved",
    ];
    console.log(
      `Milestone status number: ${status}, mapped to: ${statuses[status] || "pending"}`,
    );
    return statuses[status] || "pending";
  };

  const fetchMilestones = async (
    contract: any,
    escrowId: number,
    escrowSummary?: any,
  ) => {
    try {
      const milestones = await contract.call("getMilestones", escrowId);
      console.log(`Milestones for escrow ${escrowId}:`, milestones);
      if (milestones && Array.isArray(milestones)) {
        return milestones.map((m: any, index: number) => {
          try {
            console.log(`Raw milestone ${index}:`, m);

            // Handle different milestone data structures
            let description = "";
            let amount = "0";
            let status = 0;
            let submittedAt = undefined;
            let approvedAt = undefined;

            if (m && typeof m === "object") {
              // Try to access properties safely
              try {
                // Handle different possible data structures
                // The milestone data structure from contract is: [description, amount, status, submittedAt, approvedAt]
                if (m[0] !== undefined) {
                  // Check if m[0] is another Proxy object (nested structure)
                  if (
                    m[0] &&
                    typeof m[0] === "object" &&
                    m[0][0] !== undefined
                  ) {
                    // Nested structure: m[0][0] contains the description
                    const rawDescription = String(m[0][0]);
                    const cleanDescription = rawDescription
                      .split(",")[0]
                      .trim();
                    description = cleanDescription || `Milestone ${index + 1}`;
                  } else {
                    // Direct structure: m[0] contains the description
                    const rawDescription = String(m[0]);
                    const cleanDescription = rawDescription
                      .split(",")[0]
                      .trim();
                    description = cleanDescription || `Milestone ${index + 1}`;
                  }
                } else if (m.description !== undefined) {
                  description = String(
                    m.description || `Milestone ${index + 1}`,
                  );
                } else {
                  description = `Milestone ${index + 1}`;
                }
              } catch (e) {
                description = `Milestone ${index + 1}`;
              }

              try {
                // Handle amount parsing more carefully
                if (m[1] !== undefined) {
                  // Check if m[1] is another Proxy object (nested structure)
                  if (
                    m[1] &&
                    typeof m[1] === "object" &&
                    m[1][1] !== undefined
                  ) {
                    // Nested structure: m[1][1] contains the amount
                    const amountValue = m[1][1];
                    if (
                      typeof amountValue === "number" ||
                      typeof amountValue === "bigint"
                    ) {
                      amount = amountValue.toString();
                    } else if (typeof amountValue === "string") {
                      amount = amountValue;
                    } else {
                      amount = "0";
                    }
                  } else {
                    // Direct structure: m[1] contains the amount
                    const amountValue = m[1];
                    if (
                      typeof amountValue === "number" ||
                      typeof amountValue === "bigint"
                    ) {
                      amount = amountValue.toString();
                    } else if (typeof amountValue === "string") {
                      amount = amountValue;
                    } else {
                      amount = "0";
                    }
                  }
                } else if (m.amount !== undefined) {
                  const amountValue = m.amount;
                  if (
                    typeof amountValue === "number" ||
                    typeof amountValue === "bigint"
                  ) {
                    amount = amountValue.toString();
                  } else if (typeof amountValue === "string") {
                    amount = amountValue;
                  } else {
                    amount = "0";
                  }
                } else {
                  // If no amount is set in milestone data, calculate it from escrow total
                  // This is a fallback - ideally milestone amounts should be set during creation
                  const escrowTotal =
                    Number.parseFloat(escrowSummary[4].toString()) || 0;
                  const milestoneCount = Number(escrowSummary[11]) || 1;
                  const calculatedAmount = Math.floor(
                    escrowTotal / milestoneCount,
                  );
                  amount = calculatedAmount.toString();
                }
              } catch (e) {
                amount = "0";
              }

              try {
                // Handle status parsing
                if (m[2] !== undefined) {
                  // Check if m[2] is another Proxy object (nested structure)
                  if (
                    m[2] &&
                    typeof m[2] === "object" &&
                    m[2][2] !== undefined
                  ) {
                    // Nested structure: m[2][2] contains the status
                    status = Number(m[2][2]) || 0;
                  } else {
                    // Direct structure: m[2] contains the status
                    status = Number(m[2]) || 0;
                  }
                } else if (m.status !== undefined) {
                  status = Number(m.status) || 0;
                } else {
                  status = 0;
                }
              } catch (e) {
                status = 0;
              }

              try {
                // Handle submittedAt parsing
                if (m[3] !== undefined) {
                  // Check if m[3] is another Proxy object (nested structure)
                  if (
                    m[3] &&
                    typeof m[3] === "object" &&
                    m[3][3] !== undefined
                  ) {
                    // Nested structure: m[3][3] contains the submittedAt
                    const submittedValue = m[3][3];
                    if (submittedValue && submittedValue !== 0) {
                      submittedAt = Number(submittedValue) * 1000;
                    }
                  } else {
                    // Direct structure: m[3] contains the submittedAt
                    const submittedValue = m[3];
                    if (submittedValue && submittedValue !== 0) {
                      submittedAt = Number(submittedValue) * 1000;
                    }
                  }
                } else if (m.submittedAt !== undefined) {
                  const submittedValue = m.submittedAt;
                  if (submittedValue && submittedValue !== 0) {
                    submittedAt = Number(submittedValue) * 1000;
                  }
                }
              } catch (e) {
                submittedAt = undefined;
              }

              try {
                // Handle approvedAt parsing
                if (m[4] !== undefined) {
                  // Check if m[4] is another Proxy object (nested structure)
                  if (
                    m[4] &&
                    typeof m[4] === "object" &&
                    m[4][4] !== undefined
                  ) {
                    // Nested structure: m[4][4] contains the approvedAt
                    const approvedValue = m[4][4];
                    if (approvedValue && approvedValue !== 0) {
                      approvedAt = Number(approvedValue) * 1000;
                    }
                  } else {
                    // Direct structure: m[4] contains the approvedAt
                    const approvedValue = m[4];
                    if (approvedValue && approvedValue !== 0) {
                      approvedAt = Number(approvedValue) * 1000;
                    }
                  }
                } else if (m.approvedAt !== undefined) {
                  const approvedValue = m.approvedAt;
                  if (approvedValue && approvedValue !== 0) {
                    approvedAt = Number(approvedValue) * 1000;
                  }
                }
              } catch (e) {
                approvedAt = undefined;
              }
            } else {
              // Fallback for unexpected structure
              description = `Milestone ${index + 1}`;
              amount = "0";
              status = 0;
            }

            const milestoneData = {
              description,
              amount,
              status: getMilestoneStatusFromNumber(status),
              submittedAt,
              approvedAt,
            };
            console.log(`Parsed milestone ${index}:`, milestoneData);
            console.log(
              `Milestone ${index} raw status: ${status}, mapped to: ${getMilestoneStatusFromNumber(status)}`,
            );
            return milestoneData;
          } catch (error) {
            console.error(`Error processing milestone ${index}:`, error);
            return {
              description: `Milestone ${index + 1}`,
              amount: "0",
              status: "pending",
            };
          }
        });
      }
      return [];
    } catch (error) {
      console.error("Error fetching milestones:", error);
      return [];
    }
  };

  useEffect(() => {
    if (wallet.isConnected) {
      fetchUserEscrows();
    }
  }, [wallet.isConnected]);

  const fetchUserEscrows = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Get total number of escrows
      const totalEscrows = await contract.call("nextEscrowId");
      const escrowCount = Number(totalEscrows);
      console.log(
        "Total escrows from contract:",
        totalEscrows,
        "Count:",
        escrowCount,
      );

      const userEscrows: Escrow[] = [];

      // Fetch user's escrows from the contract
      // Check if there are any escrows created yet (nextEscrowId > 1 means at least one escrow exists)
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            console.log(`Fetching escrow ${i}...`);
            const escrowSummary = await contract.call("getEscrowSummary", i);
            console.log(`Escrow ${i} data:`, escrowSummary);

            // Check if user is involved in this escrow
            // getEscrowSummary returns indexed properties: [depositor, beneficiary, arbiters, status, totalAmount, paidAmount, remaining, token, deadline, workStarted, createdAt, milestoneCount, isOpenJob, projectTitle, projectDescription]
            const isPayer =
              escrowSummary[0].toLowerCase() === wallet.address?.toLowerCase();
            const isBeneficiary =
              escrowSummary[1].toLowerCase() === wallet.address?.toLowerCase();

            if (isPayer || isBeneficiary) {
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
                milestones: await fetchMilestones(contract, i, escrowSummary), // Fetch milestones from contract
                projectDescription: escrowSummary[13] || "", // projectTitle
              };

              userEscrows.push(escrow);
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual escrows from the contract
      setEscrows(userEscrows);
    } catch (error) {
      console.error("Error fetching escrows:", error);
      toast({
        title: "Failed to load escrows",
        description: "Could not fetch your escrows from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> =
      {
        pending: { variant: "secondary", icon: Clock, label: "Pending" },
        active: { variant: "default", icon: TrendingUp, label: "Active" },
        completed: {
          variant: "outline",
          icon: CheckCircle2,
          label: "Completed",
        },
        disputed: {
          variant: "destructive",
          icon: AlertCircle,
          label: "Disputed",
        },
      };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getMilestoneStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      submitted: { variant: "default", label: "Submitted" },
      approved: { variant: "outline", label: "Approved" },
      disputed: { variant: "destructive", label: "Disputed" },
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const calculateProgress = (escrow: Escrow) => {
    const released = Number.parseFloat(escrow.releasedAmount) / 1e18;
    const total = Number.parseFloat(escrow.totalAmount) / 1e18;
    return (released / total) * 100;
  };

  const filterEscrows = (filter: string) => {
    if (filter === "all") return escrows;
    return escrows.filter((e) => e.status === filter);
  };

  const approveMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      await contract.send("approveMilestone", escrowId, milestoneIndex);
      toast({
        title: "Milestone Approved",
        description: "The milestone has been approved and payment released",
      });
      await fetchUserEscrows();
    } catch (error) {
      console.error("Error approving milestone:", error);
      toast({
        title: "Approval Failed",
        description: "Could not approve milestone. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedEscrow(expandedEscrow === id ? null : id);
  };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-primary/20 p-12 text-center max-w-md">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your escrows
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
          <p className="text-muted-foreground">Loading your escrows...</p>
        </div>
      </div>
    );
  }

  const completedEscrows = escrows.filter((e) => e.status === "completed");
  const totalVolume = escrows
    .reduce((sum, e) => sum + Number.parseFloat(e.totalAmount) / 1e18, 0)
    .toFixed(2);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Dashboard</h1>
              <p className="text-xl text-muted-foreground">
                Manage your escrows and milestones
              </p>
            </div>
          </div>

          <div className="mb-8">
            <ReputationScore
              address={wallet.address || ""}
              completedEscrows={completedEscrows.length}
              totalVolume={totalVolume}
              role="both"
            />
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="glass border-primary/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Escrows
                  </p>
                  <p className="text-3xl font-bold">{escrows.length}</p>
                </div>
                <FileText className="h-10 w-10 text-primary opacity-50" />
              </div>
            </Card>

            <Card className="glass border-accent/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Active Projects
                  </p>
                  <p className="text-3xl font-bold">
                    {escrows.filter((e) => e.status === "active").length}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-accent opacity-50" />
              </div>
            </Card>

            <Card className="glass border-primary/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Completed
                  </p>
                  <p className="text-3xl font-bold">
                    {completedEscrows.length}
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-primary opacity-50" />
              </div>
            </Card>
          </div>

          {completedEscrows.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Your Completion Badges
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedEscrows.map((escrow) => (
                  <EscrowNFTBadge
                    key={escrow.id}
                    escrowId={escrow.id}
                    completedAt={escrow.createdAt + escrow.duration * 86400000}
                    totalAmount={escrow.totalAmount}
                    milestones={escrow.milestones.length}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Escrows List */}
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="glass">
              <TabsTrigger value="all">All ({escrows.length})</TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({filterEscrows("pending").length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({filterEscrows("active").length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({filterEscrows("completed").length})
              </TabsTrigger>
            </TabsList>

            {["all", "pending", "active", "completed"].map((filter) => (
              <TabsContent key={filter} value={filter} className="space-y-4">
                {filterEscrows(filter).length === 0 ? (
                  <Card className="glass border-muted p-12 text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      No {filter !== "all" ? filter : ""} escrows found
                    </p>
                  </Card>
                ) : (
                  filterEscrows(filter).map((escrow, index) => {
                    const isClient =
                      escrow.payer.toLowerCase() ===
                      wallet.address?.toLowerCase();
                    const isFreelancer =
                      escrow.beneficiary.toLowerCase() ===
                      wallet.address?.toLowerCase();

                    return (
                      <motion.div
                        key={escrow.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Card className="glass border-primary/20 overflow-hidden">
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-bold">
                                    Escrow #{escrow.id}
                                  </h3>
                                  {getStatusBadge(escrow.status)}
                                  {isClient && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-500/10 text-blue-500 border-blue-500/20"
                                    >
                                      You: Client
                                    </Badge>
                                  )}
                                  {isFreelancer && (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-500/10 text-green-500 border-green-500/20"
                                    >
                                      You: Freelancer
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <p>
                                    <span className="font-medium">Client:</span>{" "}
                                    <span className="font-mono">
                                      {escrow.payer.slice(0, 10)}...
                                    </span>
                                  </p>
                                  <p>
                                    <span className="font-medium">
                                      Freelancer:
                                    </span>{" "}
                                    <span className="font-mono">
                                      {escrow.beneficiary.slice(0, 10)}...
                                    </span>
                                  </p>
                                  <p>
                                    <span className="font-medium">
                                      Created:
                                    </span>{" "}
                                    {new Date(
                                      escrow.createdAt,
                                    ).toLocaleDateString()}
                                  </p>
                                  {escrow.projectDescription && (
                                    <p className="mt-2 pt-2 border-t border-border">
                                      <span className="font-medium">
                                        Project:
                                      </span>{" "}
                                      {escrow.projectDescription}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">
                                  Total Amount
                                </p>
                                <p className="text-2xl font-bold text-primary">
                                  {(
                                    Number.parseFloat(escrow.totalAmount) / 1e18
                                  ).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Released:{" "}
                                  {(
                                    Number.parseFloat(escrow.releasedAmount) /
                                    1e18
                                  ).toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">
                                  Progress
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {calculateProgress(escrow).toFixed(0)}%
                                </span>
                              </div>
                              <Progress
                                value={calculateProgress(escrow)}
                                className="h-2"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  {escrow.milestones.length} Milestones
                                </span>
                                <span className="text-muted-foreground">
                                  {
                                    escrow.milestones.filter(
                                      (m) => m.status === "approved",
                                    ).length
                                  }{" "}
                                  Approved
                                </span>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(escrow.id)}
                                className="gap-2"
                              >
                                {expandedEscrow === escrow.id
                                  ? "Hide Details"
                                  : "View Details"}
                                {expandedEscrow === escrow.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {expandedEscrow === escrow.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-border bg-muted/20"
                            >
                              <div className="p-6 space-y-4">
                                <h4 className="font-semibold mb-4">
                                  Milestones
                                </h4>
                                {escrow.milestones.map((milestone, idx) => (
                                  <Card key={idx} className="p-4 border-muted">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="font-semibold">
                                            Milestone {idx + 1}
                                          </span>
                                          {getMilestoneStatusBadge(
                                            milestone.status,
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {milestone.description}
                                        </p>
                                        {milestone.submittedAt && (
                                          <p className="text-xs text-muted-foreground mt-2">
                                            Submitted:{" "}
                                            {new Date(
                                              milestone.submittedAt,
                                            ).toLocaleDateString()}
                                          </p>
                                        )}
                                        {milestone.approvedAt && (
                                          <p className="text-xs text-muted-foreground">
                                            Approved:{" "}
                                            {new Date(
                                              milestone.approvedAt,
                                            ).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <span className="font-bold text-primary ml-4">
                                        {(() => {
                                          try {
                                            const amount = Number.parseFloat(
                                              milestone.amount,
                                            );
                                            if (isNaN(amount)) return "0.00";
                                            return (amount / 1e18).toFixed(2);
                                          } catch (e) {
                                            return "0.00";
                                          }
                                        })()}
                                      </span>
                                    </div>

                                    <div className="mt-4">
                                      <MilestoneActions
                                        escrowId={escrow.id}
                                        milestoneIndex={idx}
                                        milestone={milestone}
                                        isPayer={
                                          escrow.payer.toLowerCase() ===
                                          wallet.address?.toLowerCase()
                                        }
                                        isBeneficiary={
                                          escrow.beneficiary.toLowerCase() ===
                                          wallet.address?.toLowerCase()
                                        }
                                        escrowStatus={escrow.status}
                                        onSuccess={fetchUserEscrows}
                                      />

                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
