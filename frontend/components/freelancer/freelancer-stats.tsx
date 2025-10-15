"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, CheckCircle, Clock } from "lucide-react";

interface FreelancerStatsProps {
  escrows: Array<{
    totalAmount: string;
    releasedAmount: string;
    status: string;
  }>;
}

export function FreelancerStats({ escrows }: FreelancerStatsProps) {
  const totalEarnings = escrows.reduce(
    (sum, escrow) => sum + Number.parseFloat(escrow.releasedAmount),
    0,
  );

  const totalValue = escrows.reduce(
    (sum, escrow) => sum + Number.parseFloat(escrow.totalAmount),
    0,
  );

  const completedProjects = escrows.filter(
    (escrow) => escrow.status === "completed",
  ).length;
  const activeProjects = escrows.filter(
    (escrow) => escrow.status === "active",
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
      <Card className="glass border-primary/20 p-4 md:p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(totalEarnings / 1e18).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">tokens earned</p>
        </CardContent>
      </Card>

      <Card className="glass border-accent/20 p-4 md:p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(totalValue / 1e18).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">tokens in projects</p>
        </CardContent>
      </Card>

      <Card className="glass border-primary/20 p-4 md:p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedProjects}</div>
          <p className="text-xs text-muted-foreground">projects</p>
        </CardContent>
      </Card>

      <Card className="glass border-primary/20 p-4 md:p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeProjects}</div>
          <p className="text-xs text-muted-foreground">projects</p>
        </CardContent>
      </Card>
    </div>
  );
}
