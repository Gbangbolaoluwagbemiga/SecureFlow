"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI } from "@/lib/web3/abis";
import type { Escrow } from "@/lib/web3/types";
import { Briefcase } from "lucide-react";
import { JobsHeader } from "@/components/jobs/jobs-header";
import { JobsStats } from "@/components/jobs/jobs-stats";
import { JobCard } from "@/components/jobs/job-card";
import { ApplicationDialog } from "@/components/jobs/application-dialog";
import { JobsLoading } from "@/components/jobs/jobs-loading";

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
  const [isContractPaused, setIsContractPaused] = useState(false);

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
    checkContractPauseStatus();
  }, []);

  const checkContractPauseStatus = async () => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      const paused = await contract.call("paused");
      console.log("Contract pause status:", paused, "type:", typeof paused);

      let isPaused = false;

      // Use the same robust parsing logic as admin page
      if (paused === true || paused === "true" || paused === 1) {
        isPaused = true;
      } else if (paused === false || paused === "false" || paused === 0) {
        isPaused = false;
      } else if (paused && typeof paused === "object") {
        try {
          const pausedValue = paused.toString();
          console.log("Paused proxy toString():", pausedValue);
          isPaused = pausedValue === "true" || pausedValue === "1";
        } catch (e) {
          console.warn("Could not parse paused proxy object:", e);
          isPaused = false; // Default to not paused
        }
      }

      console.log("Is paused (jobs page):", isPaused);
      setIsContractPaused(isPaused);
    } catch (error) {
      console.error("Error checking contract pause status:", error);
      setIsContractPaused(false);
    }
  };

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

              // Fetch application count for this job
              let applicationCount = 0;
              try {
                const applications = await contract.call("getApplications", i);
                applicationCount = applications ? applications.length : 0;
                console.log(`Job ${i} has ${applicationCount} applications`);
              } catch (error) {
                console.warn(
                  `Could not fetch applications for job ${i}:`,
                  error,
                );
                applicationCount = 0;
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
                applicationCount: applicationCount, // Add real application count
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

  if (!wallet.isConnected || loading) {
    return <JobsLoading isConnected={wallet.isConnected} />;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <JobsHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <JobsStats jobs={jobs} />

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
              <JobCard
                key={job.id}
                job={job}
                index={index}
                hasApplied={hasApplied[job.id] || false}
                isContractPaused={isContractPaused}
                onApply={setSelectedJob}
              />
            ))
          )}
        </div>

        <ApplicationDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
          onApply={handleApply}
          applying={applying}
        />
      </div>
    </div>
  );
}
