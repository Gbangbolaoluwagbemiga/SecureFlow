"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { useJobCreatorStatus } from "@/hooks/use-job-creator-status";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import type { Escrow, Application } from "@/lib/web3/types";
import { motion } from "framer-motion";
import { Briefcase, MessageSquare } from "lucide-react";
import { ApprovalsHeader } from "@/components/approvals/approvals-header";
import { ApprovalsStats } from "@/components/approvals/approvals-stats";
import { JobCard } from "@/components/approvals/job-card";
import { ApprovalsLoading } from "@/components/approvals/approvals-loading";

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
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStatusFromNumber = (
    status: number,
  ): "pending" | "active" | "completed" | "disputed" => {
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
        return "pending"; // Map cancelled to pending
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
                            freelancerAddress: freelancer,
                            coverLetter,
                            proposedTimeline,
                            appliedAt: appliedAt * 1000, // Convert to milliseconds
                            status: "pending" as const,
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
                  projectDescription: escrowSummary[13] || "No description",
                  isOpenJob: true,
                  applications,
                  applicationCount: Number(applicationCount),
                };

                console.log(`Job ${i} final data:`, {
                  applicationCount: Number(applicationCount),
                  applicationsLength: applications.length,
                  applications: applications,
                });

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

  if (!wallet.isConnected || loading) {
    return <ApprovalsLoading isConnected={wallet.isConnected} />;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <ApprovalsHeader />
        <ApprovalsStats jobs={jobs} />

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
              <JobCard
                key={job.id}
                job={job}
                index={index}
                dialogOpen={dialogOpen}
                selectedJob={selectedJob}
                approving={approving}
                onJobSelect={setSelectedJob}
                onDialogChange={setDialogOpen}
                onApprove={(freelancer) => {
                  setSelectedFreelancer(freelancer);
                  handleApproveFreelancer();
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
