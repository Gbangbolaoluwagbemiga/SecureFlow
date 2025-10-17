"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import type { Escrow, Milestone } from "@/lib/web3/types";
import { motion } from "framer-motion";
import { Wallet, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { EscrowCard } from "@/components/dashboard/escrow-card";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { RealTimeEscrows } from "@/components/envio/real-time-escrows";
import { AnalyticsDashboard } from "@/components/envio/analytics-dashboard";

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
      "pending", // 0 - Not started
      "submitted", // 1 - Submitted by freelancer
      "approved", // 2 - Approved by client
      "rejected", // 3 - Rejected by client
      "disputed", // 4 - Under dispute
      "resolved", // 5 - Dispute resolved
    ];
    console.log(
      `Milestone status number: ${status}, mapped to: ${statuses[status] || "pending"}`,
    );
    return statuses[status] || "pending";
  };

  const calculateDaysLeft = (createdAt: number, duration: number): number => {
    const now = Date.now();
    // Duration is already in seconds from the contract, convert to milliseconds
    const projectEndTime = createdAt + duration * 1000;
    const daysLeft = Math.ceil((projectEndTime - now) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft); // Don't show negative days
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
                  console.log(
                    `Calculated milestone amount: escrowTotal=${escrowTotal}, milestoneCount=${milestoneCount}, calculatedAmount=${calculatedAmount}`,
                  );
                }
              } catch (e) {
                amount = "0";
              }

              try {
                // Handle status parsing with proper nested Proxy access
                console.log(`Raw milestone ${index} data:`, m);
                console.log(`Milestone ${index} m[0]:`, m[0]);
                console.log(`Milestone ${index} m[1]:`, m[1]);
                console.log(`Milestone ${index} m[2]:`, m[2]);

                // Try to access nested Proxy structure
                let statusValue = null;

                // Check if m[0] is a Proxy with nested data
                if (m[0] && typeof m[0] === "object" && m[0][2] !== undefined) {
                  statusValue = m[0][2];
                  console.log(
                    `Milestone ${index} found status in m[0][2]:`,
                    statusValue,
                  );
                }
                // Check if m[1] is a Proxy with nested data
                else if (
                  m[1] &&
                  typeof m[1] === "object" &&
                  m[1][2] !== undefined
                ) {
                  statusValue = m[1][2];
                  console.log(
                    `Milestone ${index} found status in m[1][2]:`,
                    statusValue,
                  );
                }
                // Check if m[2] exists directly
                else if (m[2] !== undefined) {
                  statusValue = m[2];
                  console.log(
                    `Milestone ${index} found status in m[2]:`,
                    statusValue,
                  );
                }
                // Check if m.status exists
                else if (m.status !== undefined) {
                  statusValue = m.status;
                  console.log(
                    `Milestone ${index} found status in m.status:`,
                    statusValue,
                  );
                }

                if (statusValue !== null) {
                  status = Number(statusValue) || 0;
                  console.log(
                    `Milestone ${index} final parsed status:`,
                    status,
                  );
                } else {
                  status = 0;
                  console.log(
                    `Milestone ${index} using default status:`,
                    status,
                  );
                }
              } catch (e) {
                console.error(`Error parsing milestone ${index} status:`, e);
                status = 0;
              }

              try {
                // Handle submittedAt parsing with proper nested Proxy access
                console.log(`Milestone ${index} checking submittedAt...`);
                console.log(`Milestone ${index} m[0]:`, m[0]);
                console.log(`Milestone ${index} m[1]:`, m[1]);
                console.log(`Milestone ${index} m[3]:`, m[3]);

                let submittedValue = null;

                // Check if m[0] is a Proxy with nested data (submittedAt at index 3)
                if (m[0] && typeof m[0] === "object" && m[0][3] !== undefined) {
                  submittedValue = m[0][3];
                  console.log(
                    `Milestone ${index} found submittedAt in m[0][3]:`,
                    submittedValue,
                  );
                }
                // Check if m[1] is a Proxy with nested data
                else if (
                  m[1] &&
                  typeof m[1] === "object" &&
                  m[1][3] !== undefined
                ) {
                  submittedValue = m[1][3];
                  console.log(
                    `Milestone ${index} found submittedAt in m[1][3]:`,
                    submittedValue,
                  );
                }
                // Check if m[3] exists directly
                else if (m[3] !== undefined) {
                  submittedValue = m[3];
                  console.log(
                    `Milestone ${index} found submittedAt in m[3]:`,
                    submittedValue,
                  );
                }
                // Check if m.submittedAt exists
                else if (m.submittedAt !== undefined) {
                  submittedValue = m.submittedAt;
                  console.log(
                    `Milestone ${index} found submittedAt in m.submittedAt:`,
                    submittedValue,
                  );
                }

                if (submittedValue && submittedValue !== 0) {
                  submittedAt = Number(submittedValue) * 1000;
                  console.log(
                    `Milestone ${index} parsed submittedAt:`,
                    submittedAt,
                  );
                } else {
                  submittedAt = undefined;
                  console.log(`Milestone ${index} no submittedAt found`);
                }
              } catch (e) {
                console.error(
                  `Error parsing milestone ${index} submittedAt:`,
                  e,
                );
                submittedAt = undefined;
              }

              try {
                // Handle approvedAt parsing with proper nested Proxy access
                console.log(`Milestone ${index} checking approvedAt...`);
                console.log(`Milestone ${index} m[0]:`, m[0]);
                console.log(`Milestone ${index} m[1]:`, m[1]);
                console.log(`Milestone ${index} m[4]:`, m[4]);

                let approvedValue = null;

                // Check if m[0] is a Proxy with nested data (approvedAt at index 4)
                if (m[0] && typeof m[0] === "object" && m[0][4] !== undefined) {
                  approvedValue = m[0][4];
                  console.log(
                    `Milestone ${index} found approvedAt in m[0][4]:`,
                    approvedValue,
                  );
                }
                // Check if m[1] is a Proxy with nested data
                else if (
                  m[1] &&
                  typeof m[1] === "object" &&
                  m[1][4] !== undefined
                ) {
                  approvedValue = m[1][4];
                  console.log(
                    `Milestone ${index} found approvedAt in m[1][4]:`,
                    approvedValue,
                  );
                }
                // Check if m[4] exists directly
                else if (m[4] !== undefined) {
                  approvedValue = m[4];
                  console.log(
                    `Milestone ${index} found approvedAt in m[4]:`,
                    approvedValue,
                  );
                }
                // Check if m.approvedAt exists
                else if (m.approvedAt !== undefined) {
                  approvedValue = m.approvedAt;
                  console.log(
                    `Milestone ${index} found approvedAt in m.approvedAt:`,
                    approvedValue,
                  );
                }

                if (approvedValue && approvedValue !== 0) {
                  approvedAt = Number(approvedValue) * 1000;
                  console.log(
                    `Milestone ${index} parsed approvedAt:`,
                    approvedAt,
                  );
                } else {
                  approvedAt = undefined;
                  console.log(`Milestone ${index} no approvedAt found`);
                }
              } catch (e) {
                console.error(
                  `Error parsing milestone ${index} approvedAt:`,
                  e,
                );
                approvedAt = undefined;
              }
            } else {
              // Fallback for unexpected structure
              description = `Milestone ${index + 1}`;
              amount = "0";
              status = 0;
            }

            // Check if milestone was actually submitted by looking at submittedAt
            const isActuallySubmitted =
              submittedAt !== undefined && submittedAt > 0;
            const finalStatus = isActuallySubmitted
              ? "submitted"
              : getMilestoneStatusFromNumber(status);

            console.log(`Milestone ${index} submittedAt:`, submittedAt);
            console.log(
              `Milestone ${index} isActuallySubmitted:`,
              isActuallySubmitted,
            );
            console.log(`Milestone ${index} finalStatus:`, finalStatus);

            const milestoneData = {
              description,
              amount,
              status: finalStatus,
              submittedAt,
              approvedAt,
            };
            console.log(`Parsed milestone ${index}:`, milestoneData);
            console.log(
              `Milestone ${index} raw status: ${status}, mapped to: ${getMilestoneStatusFromNumber(status)}`,
            );
            console.log(`Milestone ${index} raw milestone data:`, m);
            console.log(`Milestone ${index} approvedAt:`, approvedAt);
            console.log(
              `Milestone ${index} raw amount:`,
              amount,
              "Converted:",
              (Number.parseFloat(amount) / 1e18).toFixed(2),
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
            console.log(
              `Escrow ${i} - releasedAmount (paidAmount):`,
              escrowSummary[5],
            );
            console.log(`Escrow ${i} - totalAmount:`, escrowSummary[4]);

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
                status: getStatusFromNumber(Number(escrowSummary[3])) as
                  | "pending"
                  | "active"
                  | "completed"
                  | "disputed", // status
                createdAt: Number(escrowSummary[10]) * 1000, // createdAt (convert to milliseconds)
                duration: Number(escrowSummary[8]) - Number(escrowSummary[10]), // deadline - createdAt (in seconds)
                milestones: (await fetchMilestones(
                  contract,
                  i,
                  escrowSummary,
                )) as Milestone[], // Fetch milestones from contract and assert correct type
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
    return total > 0 ? (released / total) * 100 : 0;
  };

  const formatAmount = (amount: string) => {
    return (Number.parseFloat(amount) / 1e18).toFixed(2);
  };

  const getTokenInfo = (tokenAddress: string) => {
    return {
      name:
        tokenAddress === "0x0000000000000000000000000000000000000000"
          ? "MON"
          : "Token",
      symbol:
        tokenAddress === "0x0000000000000000000000000000000000000000"
          ? "MON"
          : "TKN",
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "active":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "disputed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "submitted":
        return "bg-blue-100 text-blue-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "disputed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSubmitMilestone = async (
    escrowId: string,
    milestoneIndex: number,
    description: string,
  ) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      setSubmittingMilestone(escrowId);

      const txHash = await contract.send(
        "submitMilestone",
        "no-value",
        Number(escrowId),
        milestoneIndex,
        description,
      );

      toast({
        title: "Milestone Submitted",
        description: `Transaction: ${txHash}`,
      });

      await fetchUserEscrows();
    } catch (error) {
      console.error("Error submitting milestone:", error);
      toast({
        title: "Error",
        description: "Failed to submit milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const filterEscrows = (filter: string) => {
    if (filter === "all") return escrows;
    return escrows.filter((e) => e.status === filter);
  };

  const disputeMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      await contract.send(
        "disputeMilestone",
        escrowId,
        milestoneIndex,
        "Disputed by client",
      );
      toast({
        title: "Milestone Disputed",
        description: "A dispute has been opened for this milestone",
      });

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      console.error("Error disputing milestone:", error);
      toast({
        title: "Dispute Failed",
        description: "Could not open dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const startWork = async (escrowId: string) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      setSubmittingMilestone(escrowId);
      await contract.send("startWork", escrowId);
      toast({
        title: "Work Started",
        description: "You have started work on this escrow",
      });

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      console.error("Error starting work:", error);
      toast({
        title: "Start Work Failed",
        description: "Could not start work. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const openDispute = async (escrowId: string) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      setSubmittingMilestone(escrowId);
      await contract.send("disputeMilestone", escrowId, 0, "General dispute");
      toast({
        title: "Dispute Opened",
        description: "A dispute has been opened for this escrow",
      });

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      console.error("Error opening dispute:", error);
      toast({
        title: "Dispute Failed",
        description: "Could not open dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const approveMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      toast({
        title: "Approving milestone...",
        description: "Please confirm the transaction in your wallet",
      });

      const txHash = await contract.send(
        "approveMilestone",
        "no-value",
        escrowId,
        milestoneIndex,
      );

      // Wait for transaction confirmation
      let receipt;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        try {
          receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });
          if (receipt) break;
        } catch (error) {
          console.log("Waiting for transaction confirmation...", attempts + 1);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!receipt) {
        throw new Error(
          "Transaction timeout - please check the blockchain explorer",
        );
      }

      if (receipt.status === "0x1") {
        toast({
          title: "Milestone Approved!",
          description: "Payment has been sent to the freelancer",
        });
        await fetchUserEscrows();
      } else {
        throw new Error("Transaction failed on blockchain");
      }
    } catch (error: any) {
      console.error("Error approving milestone:", error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const rejectMilestone = async (
    escrowId: string,
    milestoneIndex: number,
    reason: string,
  ) => {
    try {
      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      toast({
        title: "Rejecting milestone...",
        description: "Please confirm the transaction in your wallet",
      });

      const txHash = await contract.send(
        "rejectMilestone",
        "no-value",
        escrowId,
        milestoneIndex,
        reason,
      );

      // Wait for transaction confirmation
      let receipt;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        try {
          receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });
          if (receipt) break;
        } catch (error) {
          console.log("Waiting for transaction confirmation...", attempts + 1);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!receipt) {
        throw new Error(
          "Transaction timeout - please check the blockchain explorer",
        );
      }

      if (receipt.status === "0x1") {
        toast({
          title: "Milestone Rejected",
          description: "The freelancer has been notified and can resubmit",
        });
        await fetchUserEscrows();
      } else {
        throw new Error("Transaction failed on blockchain");
      }
    } catch (error: any) {
      console.error("Error rejecting milestone:", error);
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject milestone",
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
    return <DashboardLoading isConnected={wallet.isConnected} />;
  }

  const completedEscrows = escrows.filter((e) => e.status === "completed");
  const totalVolume = escrows
    .reduce((sum, e) => sum + Number.parseFloat(e.totalAmount) / 1e18, 0)
    .toFixed(2);

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <DashboardHeader />
          <Card className="glass border-primary/20 p-12 text-center max-w-md">
            <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to view your escrows and manage milestones.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <DashboardHeader />
          <DashboardLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <DashboardHeader />
        <DashboardStats escrows={escrows} />

        {escrows.length === 0 ? (
          <Card className="glass border-muted p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-bold mb-2">No Escrows Found</h3>
            <p className="text-muted-foreground">
              You don't have any escrows yet. Create one to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {escrows.map((escrow, index) => (
              <EscrowCard
                key={escrow.id}
                escrow={escrow}
                index={index}
                expandedEscrow={expandedEscrow}
                submittingMilestone={submittingMilestone === escrow.id}
                onToggleExpanded={() =>
                  setExpandedEscrow(
                    expandedEscrow === escrow.id ? null : escrow.id,
                  )
                }
                onSubmitMilestone={handleSubmitMilestone}
                onApproveMilestone={approveMilestone}
                onRejectMilestone={rejectMilestone}
                onDisputeMilestone={disputeMilestone}
                onStartWork={startWork}
                onDispute={openDispute}
                calculateDaysLeft={calculateDaysLeft}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
