"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface EscrowNFTBadgeProps {
  escrowId: string;
  completedAt: number;
  totalAmount: string;
  milestones: number;
}

export function EscrowNFTBadge({
  escrowId,
  completedAt,
  totalAmount,
  milestones,
}: EscrowNFTBadgeProps) {
  const handleMintNFT = () => {
    // In production, this would call the smart contract to mint an NFT
    console.log("Minting NFT for escrow:", escrowId);
  };

  const handleViewNFT = () => {
    // In production, this would open the NFT on a marketplace
    console.log("Viewing NFT for escrow:", escrowId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass border-accent/20 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/20 to-primary/20 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold">Completion Badge</h3>
            </div>
            <Badge variant="outline" className="gap-1">
              <span className="text-xs">NFT</span>
            </Badge>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-6 mb-4 border border-primary/20">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Award className="h-10 w-10 text-white" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h4 className="font-bold text-lg">Escrow #{escrowId}</h4>
              <p className="text-sm text-muted-foreground">
                Successfully Completed
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span>{milestones} Milestones</span>
                <span>•</span>
                <span>{totalAmount} Tokens</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(completedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleMintNFT} className="flex-1 gap-2" size="sm">
              <Download className="h-4 w-4" />
              Mint NFT
            </Button>
            <Button
              onClick={handleViewNFT}
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
            >
              <ExternalLink className="h-4 w-4" />
              View
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
