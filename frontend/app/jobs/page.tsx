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
import { Briefcase, Clock, DollarSign, Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function JobsPage() {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Escrow | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedTimeline, setProposedTimeline] = useState("");
  const [applying, setApplying] = useState(false);

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
    fetchOpenJobs();
  }, []);

  const fetchOpenJobs = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);

      // Get total number of escrows
      const totalEscrows = await contract.call("nextEscrowId");
      const escrowCount = Number(totalEscrows);
      console.log(
        "Jobs page - Total escrows from contract:",
        totalEscrows,
        "Count:",
        escrowCount,
      );

      const openJobs: Escrow[] = [];

      // Fetch open jobs from the contract
      // Check if there are any escrows created yet (nextEscrowId > 1 means at least one escrow exists)
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            const escrowSummary = await contract.call("getEscrowSummary", i);

            // Check if this is an open job (beneficiary is zero address)
            // getEscrowSummary returns indexed properties: [depositor, beneficiary, arbiters, status, totalAmount, paidAmount, remaining, token, deadline, workStarted, createdAt, milestoneCount, isOpenJob, projectTitle, projectDescription]
            const isOpenJob =
              escrowSummary[1] === "0x0000000000000000000000000000000000000000";

            if (isOpenJob) {
              // Convert contract data to our Escrow type
              const job: Escrow = {
                id: i.toString(),
                payer: escrowSummary[0], // depositor
                beneficiary: escrowSummary[1], // beneficiary
                token: escrowSummary[7], // token
                totalAmount: escrowSummary[4].toString(), // totalAmount
                releasedAmount: escrowSummary[5].toString(), // paidAmount
                status: getStatusFromNumber(Number(escrowSummary[3])), // status
                createdAt: Number(escrowSummary[10]) * 1000, // createdAt (convert to milliseconds)
                duration: Number(escrowSummary[8]) - Number(escrowSummary[10]), // deadline - createdAt (in seconds)
                milestones: [], // Would need to fetch milestones separately
                projectDescription: escrowSummary[13] || "", // projectTitle
                isOpenJob: true,
                applications: [], // Would need to fetch applications separately
              };

              openJobs.push(job);
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual jobs from the contract
      // if (openJobs.length === 0) {
      const mockJobs: Escrow[] = [
        {
          id: "10",
          payer: "0x1234567890123456789012345678901234567890",
          beneficiary: "0x0000000000000000000000000000000000000000", // No freelancer assigned
          token: CONTRACTS.MOCK_ERC20,
          totalAmount: "5000",
          releasedAmount: "0",
          status: "pending",
          createdAt: Date.now() - 86400000 * 2,
          duration: 30,
          projectDescription:
            "Build a modern e-commerce website with React and Node.js. Need full-stack developer with experience in payment integrations.",
          isOpenJob: true,
          milestones: [
            {
              description: "Frontend UI/UX design and implementation",
              amount: "2000",
              status: "pending",
            },
            {
              description: "Backend API and database setup",
              amount: "2000",
              status: "pending",
            },
            {
              description: "Payment integration and testing",
              amount: "1000",
              status: "pending",
            },
          ],
          applications: [],
        },
        {
          id: "11",
          payer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          beneficiary: "0x0000000000000000000000000000000000000000",
          token: CONTRACTS.MOCK_ERC20,
          totalAmount: "3000",
          releasedAmount: "0",
          status: "pending",
          createdAt: Date.now() - 86400000 * 1,
          duration: 20,
          projectDescription:
            "Smart contract audit for DeFi protocol. Looking for experienced Solidity auditor with proven track record.",
          isOpenJob: true,
          milestones: [
            {
              description: "Initial code review and vulnerability assessment",
              amount: "1500",
              status: "pending",
            },
            {
              description: "Detailed audit report and recommendations",
              amount: "1500",
              status: "pending",
            },
          ],
          applications: [],
        },
        {
          id: "12",
          payer: "0x9999999999999999999999999999999999999999",
          beneficiary: "0x0000000000000000000000000000000000000000",
          token: CONTRACTS.MOCK_ERC20,
          totalAmount: "8000",
          releasedAmount: "0",
          status: "pending",
          createdAt: Date.now() - 86400000 * 3,
          duration: 45,
          projectDescription:
            "Mobile app development for iOS and Android. Social media platform with real-time messaging and content sharing.",
          isOpenJob: true,
          milestones: [
            {
              description: "UI/UX design and prototyping",
              amount: "2000",
              status: "pending",
            },
            {
              description: "Core features development",
              amount: "4000",
              status: "pending",
            },
            {
              description: "Testing, deployment, and app store submission",
              amount: "2000",
              status: "pending",
            },
          ],
          applications: [],
        },
      ];

      // setJobs(mockJobs);
      // } else {
      setJobs(openJobs);
      // }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch available jobs from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedJob || !wallet.isConnected) return;

    setApplying(true);
    try {
      // In a real implementation, this would call the smart contract
      console.log("Applying to job:", {
        jobId: selectedJob.id,
        freelancer: wallet.address,
        coverLetter,
        proposedTimeline,
      });

      // Simulate blockchain transaction
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Application Submitted!",
        description:
          "The client will review your application and get back to you.",
      });

      setCoverLetter("");
      setProposedTimeline("");
      setSelectedJob(null);
    } catch (error) {
      console.error("Error applying to job:", error);
      toast({
        title: "Application Failed",
        description: "Could not submit your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.projectDescription
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      job.milestones.some((m) =>
        m.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-primary/20 p-12 text-center max-w-md">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to browse available jobs
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
          <p className="text-muted-foreground">Loading available jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">Browse Jobs</h1>
            <p className="text-xl text-muted-foreground">
              Find and apply to open escrow projects
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search jobs by description or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="glass border-primary/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Available Jobs
                  </p>
                  <p className="text-3xl font-bold">{jobs.length}</p>
                </div>
                <Briefcase className="h-10 w-10 text-primary opacity-50" />
              </div>
            </Card>

            <Card className="glass border-accent/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Value
                  </p>
                  <p className="text-3xl font-bold">
                    {jobs
                      .reduce(
                        (sum, job) => sum + Number.parseFloat(job.totalAmount),
                        0,
                      )
                      .toFixed(0)}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-accent opacity-50" />
              </div>
            </Card>

            <Card className="glass border-primary/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Avg. Duration
                  </p>
                  <p className="text-3xl font-bold">
                    {Math.round(
                      jobs.reduce((sum, job) => sum + job.duration, 0) /
                        jobs.length,
                    )}{" "}
                    days
                  </p>
                </div>
                <Clock className="h-10 w-10 text-primary opacity-50" />
              </div>
            </Card>
          </div>

          {/* Jobs List */}
          <div className="space-y-6">
            {filteredJobs.length === 0 ? (
              <Card className="glass border-muted p-12 text-center">
                <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  No jobs found matching your search
                </p>
              </Card>
            ) : (
              filteredJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="glass border-primary/20 p-6 hover:border-primary/40 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold">Job #{job.id}</h3>
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {job.duration} days
                          </Badge>
                        </div>

                        <p className="text-muted-foreground mb-4">
                          {job.projectDescription}
                        </p>

                        <div className="space-y-2 mb-4">
                          <p className="text-sm font-medium">Milestones:</p>
                          {job.milestones.map((milestone, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <span className="text-primary">•</span>
                              <span>
                                {milestone.description} -{" "}
                                <span className="font-semibold">
                                  {milestone.amount}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Posted{" "}
                            {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>
                            {job.applications?.length || 0} applications
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">
                            Total Budget
                          </p>
                          <p className="text-3xl font-bold text-primary">
                            {job.totalAmount}
                          </p>
                        </div>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedJob(job)}
                              className="w-full md:w-auto"
                            >
                              Apply Now
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="glass">
                            <DialogHeader>
                              <DialogTitle>
                                Apply to Job #{selectedJob?.id}
                              </DialogTitle>
                              <DialogDescription>
                                Submit your application to work on this project.
                                The client will review and may accept your
                                proposal.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="coverLetter">
                                  Cover Letter *
                                </Label>
                                <Textarea
                                  id="coverLetter"
                                  placeholder="Explain why you're the best fit for this project..."
                                  value={coverLetter}
                                  onChange={(e) =>
                                    setCoverLetter(e.target.value)
                                  }
                                  rows={5}
                                  className="glass"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="timeline">
                                  Proposed Timeline (days) *
                                </Label>
                                <Input
                                  id="timeline"
                                  type="number"
                                  placeholder="30"
                                  value={proposedTimeline}
                                  onChange={(e) =>
                                    setProposedTimeline(e.target.value)
                                  }
                                  className="glass"
                                />
                              </div>

                              <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-semibold">Note:</span>{" "}
                                  Once the client accepts your application, the
                                  escrow will be assigned to you and you can
                                  start working on the milestones.
                                </p>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button
                                onClick={handleApply}
                                disabled={
                                  !coverLetter || !proposedTimeline || applying
                                }
                                className="w-full"
                              >
                                {applying
                                  ? "Submitting..."
                                  : "Submit Application"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
