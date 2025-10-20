"use client";

import { useSmartAccount } from "@/contexts/smart-account-context";
import { useDelegation } from "@/contexts/delegation-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
} from "lucide-react";
import { useState } from "react";

export function SmartAccountStatus() {
  const { smartAccount, deploySmartAccount, isSmartAccountReady } =
    useSmartAccount();
  const { getActiveDelegations } = useDelegation();
  const [isDeploying, setIsDeploying] = useState(false);

  const activeDelegations = getActiveDelegations();

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      await deploySmartAccount();
    } catch (error) {
      console.error("Deployment failed:", error);
    } finally {
      setIsDeploying(false);
    }
  };

  if (!smartAccount.isInitialized) {
    return (
      <Card className="glass border-muted/20 p-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Smart Account not initialized
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Smart Account Status */}
      <Card className="glass border-primary/20 p-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-medium">Smart Account</span>
            <div className="flex items-center gap-1">
              {isSmartAccountReady ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Delegations Status */}
      {activeDelegations.length > 0 && (
        <Card className="glass border-accent/20 p-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <div className="flex flex-col">
              <span className="text-xs font-medium">Delegations</span>
              <Badge variant="outline" className="text-xs">
                {activeDelegations.length} Active
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Deploy Button */}
      {!smartAccount.isDeployed && (
        <Button
          size="sm"
          onClick={handleDeploy}
          disabled={isDeploying}
          className="text-xs"
        >
          {isDeploying ? "Deploying..." : "Deploy Smart Account"}
        </Button>
      )}
    </div>
  );
}

