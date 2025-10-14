"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { useJobCreatorStatus } from "@/hooks/use-job-creator-status";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import type { Escrow } from "@/lib/web3/types";
import { motion } from "framer-motion";
import {
  Briefcase,
  Clock,
  DollarSign,
  User,
  CheckCircle,
  XCircle,
  Calendar,
  MessageSquare,
} from "lucide-react";
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

interface Application {
  freelancer: string;
  coverLetter: string;
  proposedTimeline: number;
  appliedAt: number;
  exists: boolean;
}

interface JobWithApplications extends Escrow {
  applications: Application[];
  applicationCount: number;
}

export default function ApprovalsPage() {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const { isJobCreator, loading: jobCreatorLoading } = useJobCreatorStatus();
  const [jobs, setJobs] = useState<JobWithApplications[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobWithApplications | null>(
    null,
  );
  const [selectedFreelancer, setSelectedFreelancer] = useState<string | null>(
    null,
  );
  const [approving, setApproving] = useState(false);

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
    fetchMyJobs();
  }, [wallet.address]);

  const fetchMyJobs = async () => {
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      // Get total number of escrows
      const totalEscrows = await contract.call("nextEscrowId");
      const escrowCount = Number(totalEscrows);

      const myJobs: JobWithApplications[] = [];

      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            const escrowSummary = await contract.call("getEscrowSummary", i);

            // Check if current user is the depositor (job creator)
            const isMyJob =
              escrowSummary[0].toLowerCase() === wallet.address?.toLowerCase();

            console.log(
              `Checking job ${i}: depositor=${escrowSummary[0]}, myAddress=${wallet.address}, isMyJob=${isMyJob}`,
            );

            if (isMyJob) {
              // Check if it's still an open job
              const isOpenJob =
                escrowSummary[1] ===
                "0x0000000000000000000000000000000000000000";

              console.log(
                `Job ${i} open check: beneficiary=${escrowSummary[1]}, isOpenJob=${isOpenJob}`,
              );

              if (isOpenJob) {
                // Fetch applications for this job
                let applicationCount = 0;
                const applications: Application[] = [];

                try {
                  applicationCount = Number(
                    await contract.call("getApplicationCount", i),
                  );
                  console.log(`Job ${i} has ${applicationCount} applications`);

                  if (applicationCount > 0) {
                    const applicationsData = await contract.call(
                      "getApplicationsPage",
                      i,
                      0,
                      applicationCount,
                    );
                    console.log(
                      `Applications data for job ${i}:`,
                      applicationsData,
                    );

                    if (applicationsData && applicationsData.length > 0) {
                      for (const app of applicationsData) {
                        console.log(`Raw application data:`, app);

                        try {
                          // Handle different data structures
                          let freelancer = "";
                          let coverLetter = "";
                          let proposedTimeline = 0;
                          let appliedAt = 0;
                          let exists = false;

                          // Try to access fields safely
                          if (Array.isArray(app)) {
                            freelancer = app[0] || "";
                            coverLetter = app[1] || "";
                            proposedTimeline = Number(app[2]) || 0;
                            appliedAt = Number(app[3]) || 0;
                            exists = app[4] || false;
                          } else if (app && typeof app === "object") {
                            // Handle Proxy(Result) objects
                            freelancer = app.freelancer || app[0] || "";
                            coverLetter = app.coverLetter || app[1] || "";
                            proposedTimeline =
                              Number(app.proposedTimeline || app[2]) || 0;
                            appliedAt = Number(app.appliedAt || app[3]) || 0;
                            exists = app.exists || app[4] || false;
                          }

                          console.log(`Parsed application:`, {
                            freelancer,
                            coverLetter,
                            proposedTimeline,
                            appliedAt,
                            exists,
                          });

                          applications.push({
                            freelancer,
                            coverLetter,
                            proposedTimeline,
                            appliedAt: appliedAt * 1000, // Convert to milliseconds
                            exists,
                          });
                        } catch (parseError) {
                          console.error(
                            `Error parsing application data:`,
                            parseError,
                          );
                          console.log(`Problematic app data:`, app);
                          // Skip this application if parsing fails
                          continue;
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `Error fetching applications for job ${i}:`,
                    error,
                  );
                  applicationCount = 0;
                }

                const job: JobWithApplications = {
                  id: i.toString(),
                  payer: escrowSummary[0],
                  beneficiary: escrowSummary[1],
                  token: escrowSummary[7],
                  totalAmount: escrowSummary[4].toString(),
                  releasedAmount: escrowSummary[5].toString(),
                  status: getStatusFromNumber(Number(escrowSummary[3])),
                  createdAt: Number(escrowSummary[10]) * 1000,
                  duration:
                    Number(escrowSummary[8]) - Number(escrowSummary[10]),
                  milestones: [],
                  projectDescription: escrowSummary[13] || "",
                  isOpenJob: true,
                  applications,
                  applicationCount: Number(applicationCount),
                };

                myJobs.push(job);
              }
            }
          } catch (error) {
            continue;
          }
        }
      }

      console.log(`Found ${myJobs.length} jobs with applications`);
      setJobs(myJobs);
    } catch (error) {
      console.error("Error fetching my jobs:", error);
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch your job postings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveFreelancer = async () => {
    if (!selectedJob || !selectedFreelancer || !wallet.isConnected) return;

    setApproving(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      if (!contract) return;

      // Call acceptFreelancer function
      await contract.send(
        "acceptFreelancer",
        "no-value",
        selectedJob.id,
        selectedFreelancer,
      );

      toast({
        title: "Freelancer Approved!",
        description:
          "The freelancer has been assigned to this job and can now start working.",
      });

      // Refresh the jobs list
      await fetchMyJobs();
      setSelectedJob(null);
      setSelectedFreelancer(null);
    } catch (error) {
      console.error("Error approving freelancer:", error);
      toast({
        title: "Approval Failed",
        description: "Could not approve the freelancer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-primary/20 p-12 text-center max-w-md">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your job applications
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
          <p className="text-muted-foreground">Loading your job postings...</p>
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
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              Job Applications
            </h1>
            <p className="text-xl text-muted-foreground">
              Review and approve freelancer applications for your jobs
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            <Card className="glass border-primary/20 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Open Jobs
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
                    Total Applications
                  </p>
                  <p className="text-2xl md:text-3xl font-bold break-all">
                    {jobs.reduce((sum, job) => sum + job.applicationCount, 0)}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 md:h-10 md:w-10 text-accent opacity-50 flex-shrink-0" />
              </div>
            </Card>

            <Card className="glass border-primary/20 p-4 md:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Avg. Applications
                  </p>
                  <p className="text-2xl md:text-3xl font-bold break-all">
                    {jobs.length > 0
                      ? Math.round(
                          jobs.reduce(
                            (sum, job) => sum + job.applicationCount,
                            0,
                          ) / jobs.length,
                        )
                      : 0}
                  </p>
                </div>
                <User className="h-8 w-8 md:h-10 md:w-10 text-primary opacity-50 flex-shrink-0" />
              </div>
            </Card>
          </div>

          {/* Jobs List */}
          <div className="space-y-6">
            {jobs.length === 0 ? (
              <Card className="glass border-muted p-12 text-center">
                <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  You don't have any open jobs with applications yet
                </p>
              </Card>
            ) : (
              jobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="glass border-primary/20 p-4 md:p-6 hover:border-primary/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold">Job #{job.id}</h3>
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {job.duration} days
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {job.applicationCount} applications
                          </Badge>
                        </div>

                        <p className="text-muted-foreground mb-4 break-words overflow-hidden">
                          {job.projectDescription}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Posted{" "}
                            {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>
                            Budget:{" "}
                            {(
                              Number.parseFloat(job.totalAmount) / 1e18
                            ).toFixed(2)}{" "}
                            tokens
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4 w-full lg:w-auto">
                        <div className="text-right w-full lg:w-auto">
                          <p className="text-sm text-muted-foreground mb-1">
                            Total Budget
                          </p>
                          <p className="text-2xl md:text-3xl font-bold text-primary break-all">
                            {(
                              Number.parseFloat(job.totalAmount) / 1e18
                            ).toFixed(2)}
                          </p>
                        </div>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedJob(job)}
                              className="w-full lg:w-auto min-w-[140px]"
                              disabled={job.applicationCount === 0}
                            >
                              {job.applicationCount === 0
                                ? "No Applications"
                                : "Review Applications"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="glass max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>
                                Job #{job.id} Applications
                              </DialogTitle>
                              <DialogDescription>
                                Review and approve freelancer applications for
                                this job.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                              {job.applications.length === 0 ? (
                                <div className="text-center py-8">
                                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                  <p className="text-muted-foreground">
                                    No applications yet
                                  </p>
                                </div>
                              ) : (
                                job.applications.map((application, idx) => (
                                  <Card
                                    key={idx}
                                    className="p-4 border-border/40"
                                  >
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <User className="h-4 w-4 text-primary" />
                                          <span className="font-medium text-sm">
                                            {application.freelancer.slice(0, 6)}
                                            ...
                                            {application.freelancer.slice(-4)}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {isNaN(
                                              application.proposedTimeline,
                                            ) ||
                                            application.proposedTimeline === 0
                                              ? "Not specified"
                                              : `${application.proposedTimeline} days`}
                                          </Badge>
                                        </div>

                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium">
                                            Cover Letter:
                                          </Label>
                                          <div className="bg-muted/20 rounded-lg p-3 text-sm break-words">
                                            {application.coverLetter ||
                                              "No cover letter provided"}
                                          </div>
                                        </div>

                                        <div className="text-xs text-muted-foreground mt-2">
                                          Applied:{" "}
                                          {application.appliedAt &&
                                          application.appliedAt > 0
                                            ? new Date(
                                                application.appliedAt,
                                              ).toLocaleString()
                                            : "Unknown date"}
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2 w-full lg:w-auto">
                                        <Button
                                          onClick={() => {
                                            setSelectedFreelancer(
                                              application.freelancer,
                                            );
                                            handleApproveFreelancer();
                                          }}
                                          disabled={approving}
                                          className="w-full lg:w-auto"
                                          size="sm"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          {approving
                                            ? "Approving..."
                                            : "Approve"}
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                ))
                              )}
                            </div>

                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedJob(null);
                                  setSelectedFreelancer(null);
                                }}
                              >
                                Close
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
