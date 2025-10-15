"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, Calendar, CheckCircle } from "lucide-react";

interface Application {
  freelancerAddress: string;
  coverLetter: string;
  proposedTimeline: number;
  appliedAt: number;
  status: "pending" | "accepted" | "rejected";
}

interface ApplicationCardProps {
  application: Application;
  index: number;
  onApprove: (freelancer: string) => void;
  approving: boolean;
}

export function ApplicationCard({
  application,
  index,
  onApprove,
  approving,
}: ApplicationCardProps) {
  return (
    <Card key={index} className="p-4 border-border/40">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {application.freelancerAddress.slice(0, 6)}...
              {application.freelancerAddress.slice(-4)}
            </span>
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {isNaN(application.proposedTimeline) ||
              application.proposedTimeline === 0
                ? "Not specified"
                : `${application.proposedTimeline} days`}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Cover Letter:</Label>
            <div className="bg-muted/20 rounded-lg p-3 text-sm break-words">
              {application.coverLetter || "No cover letter provided"}
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-2">
            Applied:{" "}
            {application.appliedAt && application.appliedAt > 0
              ? new Date(application.appliedAt).toLocaleString()
              : "Unknown date"}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <Button
            onClick={() => onApprove(application.freelancerAddress)}
            disabled={approving}
            className="w-full lg:w-auto"
            size="sm"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {approving ? "Approving..." : "Approve"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
