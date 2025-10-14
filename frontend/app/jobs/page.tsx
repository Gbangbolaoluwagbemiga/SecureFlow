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
  const [hasApplied, setHasApplied] = useState<Record<string, boolean>>({});

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

  // Clear application status cache when wallet changes
  useEffect(() => {
    setHasApplied({});
  }, [wallet.address]);

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
              // Check if current user is the job creator (should not be able to apply to own job)
              const isJobCreator =
                escrowSummary[0].toLowerCase() ===
                wallet.address?.toLowerCase();

              // Check if current user has already applied to this job
              let userHasApplied = false;
              if (wallet.address && !isJobCreator) {
                try {
                  const hasAppliedResult = await contract.call(
                    "hasUserApplied",
                    i,
                    wallet.address,
                  );
                  console.log(
                    `hasUserApplied result for job ${i}:`,
                    hasAppliedResult,
                    "Type:",
                    typeof hasAppliedResult,
                  );

                  // Handle different possible return types - be more strict about what counts as "applied"
                  userHasApplied =
                    hasAppliedResult === true ||
                    hasAppliedResult === "true" ||
                    hasAppliedResult === 1;
                  console.log(`User has applied to job ${i}:`, userHasApplied);

                  // Double-check by looking at applications directly if hasUserApplied seems wrong
                  if (
                    hasAppliedResult &&
                    hasAppliedResult !== false &&
                    hasAppliedResult !== "false" &&
                    hasAppliedResult !== 0
                  ) {
                    try {
                      const applications = await contract.call(
                        "getApplications",
                        i,
                      );
                      console.log(`Applications for job ${i}:`, applications);
                      // Check if current user is in the applications list
                      const userInApplications = applications.some(
                        (app: any) =>
                          app.freelancer &&
                          app.freelancer.toLowerCase() ===
                            wallet.address?.toLowerCase(),
                      );
                      console.log(
                        `User found in applications for job ${i}:`,
                        userInApplications,
                      );

                      // If hasUserApplied says true but user is not in applications, trust applications
                      if (!userInApplications) {
                        console.log(
                          `hasUserApplied returned true but user not in applications - correcting to false`,
                        );
                        userHasApplied = false;
                      }
                    } catch (appError) {
                      console.warn(
                        `Could not fetch applications for job ${i}:`,
                        appError,
                      );
                    }
                  }
                } catch (error) {
                  console.error(
                    `Error checking application status for job ${i}:`,
                    error,
                  );
                  // If check fails, assume they haven't applied
                  userHasApplied = false;
                }
              } else {
                console.log(
                  `Skipping application check for job ${i} - isJobCreator: ${isJobCreator}, wallet: ${wallet.address}`,
                );
              }

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
                isJobCreator: isJobCreator, // Add flag to track if current user is the job creator
              };

              openJobs.push(job);

              // Store application status
              setHasApplied((prev) => ({
                ...prev,
                [job.id]: userHasApplied,
              }));
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual jobs from the contract
      setJobs(openJobs);
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
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      // Call the smart contract applyToJob function
      await contract.send(
        "applyToJob",
        "no-value",
        selectedJob.id,
        coverLetter,
        proposedTimeline,
      );

      toast({
        title: "Application Submitted!",
        description:
          "The client will review your application and get back to you.",
      });

      setCoverLetter("");
      setProposedTimeline("");
      setSelectedJob(null);

      // Update the application status for this specific job
      setHasApplied((prev) => ({
        ...prev,
        [selectedJob.id]: true,
      }));

      // Refresh the jobs list to update application counts
      await fetchOpenJobs();
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            <Card className="glass border-primary/20 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Available Jobs
                  </p>
                  <p className="text-2xl md:text-3xl font-bold break-all">
                    {jobs.length}
                  </p>
                </div>
                <Briefcase className="h-8 w-8 md:h-10 md:w-10 text-primary opacity-50 flex-shrink-0" />
              </div>
            </Card>

            <Card className="glass border-accent/20 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Value
                  </p>
                  <p className="text-2xl md:text-3xl font-bold break-all">
                    {jobs
                      .reduce(
                        (sum, job) =>
                          sum + Number.parseFloat(job.totalAmount) / 1e18,
                        0,
                      )
                      .toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 md:h-10 md:w-10 text-accent opacity-50 flex-shrink-0" />
              </div>
            </Card>

            <Card className="glass border-primary/20 p-4 md:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Avg. Duration
                  </p>
                  <p className="text-2xl md:text-3xl font-bold break-all">
                    {Math.round(
                      jobs.reduce(
                        (sum, job) => sum + job.duration / (24 * 60 * 60),
                        0,
                      ) / jobs.length,
                    )}{" "}
                    days
                  </p>
                </div>
                <Clock className="h-8 w-8 md:h-10 md:w-10 text-primary opacity-50 flex-shrink-0" />
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
                  <Card className="glass border-primary/20 p-4 md:p-6 hover:border-primary/40 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold">Job #{job.id}</h3>
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.round(job.duration / (24 * 60 * 60))} days
                          </Badge>
                        </div>

                        <p className="text-muted-foreground mb-4 break-words overflow-hidden">
                          {job.projectDescription}
                        </p>

                        <div className="space-y-2 mb-4">
                          <p className="text-sm font-medium">Milestones:</p>
                          {job.milestones.map((milestone, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <span className="text-primary flex-shrink-0">
                                •
                              </span>
                              <span className="break-words overflow-hidden">
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

                      <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                        <div className="text-right w-full md:w-auto">
                          <p className="text-sm text-muted-foreground mb-1">
                            Total Budget
                          </p>
                          <p className="text-2xl md:text-3xl font-bold text-primary break-all">
                            {(
                              Number.parseFloat(job.totalAmount) / 1e18
                            ).toFixed(2)}
                          </p>
                        </div>

                        {job.isJobCreator ? (
                          <Button
                            className="w-full md:w-auto min-w-[120px]"
                            disabled
                            variant="outline"
                          >
                            Your Job
                          </Button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                onClick={() => setSelectedJob(job)}
                                className="w-full md:w-auto min-w-[120px]"
                                disabled={hasApplied[job.id]}
                              >
                                {hasApplied[job.id] ? "Applied" : "Apply Now"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="glass">
                              <DialogHeader>
                                <DialogTitle>
                                  Apply to Job #{selectedJob?.id}
                                </DialogTitle>
                                <DialogDescription>
                                  Submit your application to work on this
                                  project. The client will review and may accept
                                  your proposal.
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
                                    Once the client accepts your application,
                                    the escrow will be assigned to you and you
                                    can start working on the milestones.
                                  </p>
                                </div>
                              </div>

                              <DialogFooter>
                                <Button
                                  onClick={handleApply}
                                  disabled={
                                    !coverLetter ||
                                    !proposedTimeline ||
                                    applying
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
                        )}
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
