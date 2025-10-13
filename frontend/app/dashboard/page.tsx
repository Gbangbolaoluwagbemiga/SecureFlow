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

      const userEscrows: Escrow[] = [];

      // Fetch user's escrows from the contract
      for (let i = 1; i <= escrowCount; i++) {
        try {
          const escrowSummary = await contract.call("getEscrowSummary", i);

          // Check if user is involved in this escrow
          const isPayer =
            escrowSummary.depositor.toLowerCase() ===
            wallet.address?.toLowerCase();
          const isBeneficiary =
            escrowSummary.beneficiary.toLowerCase() ===
            wallet.address?.toLowerCase();

          if (isPayer || isBeneficiary) {
            // Convert contract data to our Escrow type
            const escrow: Escrow = {
              id: i.toString(),
              payer: escrowSummary.depositor,
              beneficiary: escrowSummary.beneficiary,
              token: escrowSummary.token,
              totalAmount: escrowSummary.totalAmount.toString(),
              releasedAmount: escrowSummary.releasedAmount.toString(),
              status: getStatusFromNumber(escrowSummary.status),
              createdAt: Number(escrowSummary.createdAt) * 1000, // Convert to milliseconds
              duration: Number(escrowSummary.duration),
              milestones: [], // Would need to fetch milestones separately
              projectDescription: escrowSummary.projectTitle || "",
            };

            userEscrows.push(escrow);
          }
        } catch (error) {
          // Skip escrows that don't exist or user doesn't have access to
          continue;
        }
      }

      // If no real escrows found, use mock data for demonstration
      if (userEscrows.length === 0) {
        const mockEscrows: Escrow[] = [
          {
            id: "1",
            payer: "0x1234567890123456789012345678901234567890",
            beneficiary: "0x0987654321098765432109876543210987654321",
            token: CONTRACTS.MOCK_ERC20,
            totalAmount: "5000",
            releasedAmount: "2000",
            status: "active",
            createdAt: Date.now() - 86400000 * 5,
            duration: 30,
            milestones: [
              {
                description: "Initial design mockups and wireframes",
                amount: "1000",
                status: "approved",
                submittedAt: Date.now() - 86400000 * 4,
                approvedAt: Date.now() - 86400000 * 3,
              },
              {
                description: "Frontend development - Homepage and navigation",
                amount: "1000",
                status: "approved",
                submittedAt: Date.now() - 86400000 * 2,
                approvedAt: Date.now() - 86400000 * 1,
              },
              {
                description: "Backend API integration and database setup",
                amount: "1500",
                status: "submitted",
                submittedAt: Date.now() - 86400000,
              },
              {
                description: "Testing, deployment, and documentation",
                amount: "1500",
                status: "pending",
              },
            ],
            projectDescription: "Website Development Project",
          },
          {
            id: "2",
            payer: "0x1234567890123456789012345678901234567890",
            beneficiary: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            token: CONTRACTS.MOCK_ERC20,
            totalAmount: "3000",
            releasedAmount: "3000",
            status: "completed",
            createdAt: Date.now() - 86400000 * 45,
            duration: 30,
            milestones: [
              {
                description: "Logo design and brand identity",
                amount: "1500",
                status: "approved",
                submittedAt: Date.now() - 86400000 * 40,
                approvedAt: Date.now() - 86400000 * 39,
              },
              {
                description: "Marketing materials and social media assets",
                amount: "1500",
                status: "approved",
                submittedAt: Date.now() - 86400000 * 35,
                approvedAt: Date.now() - 86400000 * 34,
              },
            ],
            projectDescription: "Brand Identity Project",
          },
          {
            id: "3",
            payer: "0x9999999999999999999999999999999999999999",
            beneficiary: wallet.address || "",
            token: CONTRACTS.MOCK_ERC20,
            totalAmount: "8000",
            releasedAmount: "0",
            status: "pending",
            createdAt: Date.now() - 86400000 * 2,
            duration: 60,
            milestones: [
              {
                description: "Smart contract development",
                amount: "3000",
                status: "pending",
              },
              {
                description: "Frontend dApp interface",
                amount: "3000",
                status: "pending",
              },
              {
                description: "Testing and audit preparation",
                amount: "2000",
                status: "pending",
              },
            ],
            projectDescription: "Smart Contract Development Project",
          },
        ];

        setEscrows(mockEscrows);
      } else {
        setEscrows(userEscrows);
      }
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
    const released = Number.parseFloat(escrow.releasedAmount);
    const total = Number.parseFloat(escrow.totalAmount);
    return (released / total) * 100;
  };

  const filterEscrows = (filter: string) => {
    if (filter === "all") return escrows;
    return escrows.filter((e) => e.status === filter);
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
    .reduce((sum, e) => sum + Number.parseFloat(e.totalAmount), 0)
    .toFixed(0);

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
                                  {escrow.totalAmount}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Released: {escrow.releasedAmount}
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
                                        {milestone.amount}
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
