"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { SECUREFLOW_ABI, ERC20_ABI } from "@/lib/web3/abis";

interface ProjectDetailsStepProps {
  formData: {
    projectTitle: string;
    projectDescription: string;
    duration: string;
    totalBudget: string;
    beneficiary: string;
    token: string;
    useNativeToken: boolean;
    isOpenJob: boolean;
  };
  onUpdate: (data: Partial<ProjectDetailsStepProps["formData"]>) => void;
  isContractPaused: boolean;
  errors?: {
    projectTitle?: string;
    projectDescription?: string;
    duration?: string;
    totalBudget?: string;
    beneficiary?: string;
    tokenAddress?: string;
  };
}

interface WhitelistedToken {
  address: string;
  name: string;
  symbol: string;
}

export function ProjectDetailsStep({
  formData,
  onUpdate,
  isContractPaused,
  errors = {},
}: ProjectDetailsStepProps) {
  const { getContract, wallet } = useWeb3();
  const [whitelistedTokens, setWhitelistedTokens] = useState<
    WhitelistedToken[]
  >([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>("");

  useEffect(() => {
    if (!formData.useNativeToken && wallet.isConnected) {
      fetchWhitelistedTokens();
    } else {
      setSelectedToken("");
      if (formData.useNativeToken) {
        setWhitelistedTokens([]);
      }
    }
  }, [formData.useNativeToken, wallet.isConnected]);

  // Sync selectedToken with formData.token
  useEffect(() => {
    if (formData.token && !selectedToken) {
      const matchingToken = whitelistedTokens.find(
        (t) => t.address.toLowerCase() === formData.token.toLowerCase()
      );
      if (matchingToken) {
        setSelectedToken(matchingToken.address);
      } else if (formData.token && formData.token !== "") {
        setSelectedToken("custom");
      }
    }
  }, [formData.token, whitelistedTokens]);

  const fetchWhitelistedTokens = async () => {
    if (!wallet.isConnected) {
      setWhitelistedTokens([]);
      return;
    }

    setLoadingTokens(true);
    try {
      const secureFlowContract = getContract(
        CONTRACTS.SECUREFLOW_ESCROW,
        SECUREFLOW_ABI
      );
      const tokens: WhitelistedToken[] = [];

      // Check known tokens (MockERC20)
      const knownTokens = [CONTRACTS.MOCK_ERC20];

      for (const tokenAddress of knownTokens) {
        try {
          // Check if token is whitelisted
          const isWhitelisted = await secureFlowContract.call(
            "whitelistedTokens",
            tokenAddress
          );

          if (isWhitelisted) {
            // Fetch token name and symbol
            try {
              const tokenContract = getContract(tokenAddress, ERC20_ABI);
              const [name, symbol] = await Promise.all([
                tokenContract.call("name"),
                tokenContract.call("symbol"),
              ]);

              tokens.push({
                address: tokenAddress,
                name: name || "Unknown Token",
                symbol: symbol || "UNKNOWN",
              });
            } catch (error) {
              // If we can't fetch name/symbol, still add it with address
              tokens.push({
                address: tokenAddress,
                name: `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(
                  -4
                )}`,
                symbol: "TOKEN",
              });
            }
          }
        } catch (error) {
          // Skip tokens that fail
          console.error(`Failed to check token ${tokenAddress}:`, error);
        }
      }

      setWhitelistedTokens(tokens);
    } catch (error) {
      console.error("Failed to fetch whitelisted tokens:", error);
      setWhitelistedTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleTokenSelect = (value: string) => {
    if (value === "custom") {
      setSelectedToken("custom");
      onUpdate({ token: "" });
    } else {
      setSelectedToken(value);
      onUpdate({ token: value });
    }
  };

  return (
    <Card className="glass border-primary/20 p-6">
      <CardHeader>
        <CardTitle>Project Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isContractPaused && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Contract is currently paused. Escrow creation is temporarily
              disabled.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="projectTitle">Project Title *</Label>
            <Input
              id="projectTitle"
              value={formData.projectTitle}
              onChange={(e) => onUpdate({ projectTitle: e.target.value })}
              placeholder="Enter project title"
              required
              minLength={3}
              className={
                errors.projectTitle ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors.projectTitle && (
              <p className="text-red-500 text-sm mt-1">{errors.projectTitle}</p>
            )}
          </div>

          <div>
            <Label htmlFor="duration">Duration (days) *</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration}
              onChange={(e) => onUpdate({ duration: e.target.value })}
              placeholder="e.g., 30"
              min="1"
              max="365"
              required
              className={
                errors.duration ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors.duration && (
              <p className="text-red-500 text-sm mt-1">{errors.duration}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="projectDescription">Project Description *</Label>
          <Textarea
            id="projectDescription"
            value={formData.projectDescription}
            onChange={(e) => onUpdate({ projectDescription: e.target.value })}
            placeholder="Describe the project requirements and deliverables..."
            className={`min-h-[120px] ${
              errors.projectDescription
                ? "border-red-500 focus:border-red-500"
                : ""
            }`}
            required
            minLength={50}
          />
          {errors.projectDescription ? (
            <p className="text-red-500 text-sm mt-1">
              {errors.projectDescription}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 50 characters required
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="totalBudget">Total Budget (tokens) *</Label>
            <Input
              id="totalBudget"
              type="number"
              value={formData.totalBudget}
              onChange={(e) => onUpdate({ totalBudget: e.target.value })}
              placeholder="e.g., 1000"
              min="0.01"
              step="0.01"
              required
              className={
                errors.totalBudget ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors.totalBudget ? (
              <p className="text-red-500 text-sm mt-1">{errors.totalBudget}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 0.01 tokens required
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="beneficiary">
              Beneficiary Address {!formData.isOpenJob && "*"}
            </Label>
            <Input
              id="beneficiary"
              value={formData.beneficiary}
              onChange={(e) => onUpdate({ beneficiary: e.target.value })}
              placeholder="0x..."
              disabled={formData.isOpenJob}
              required={!formData.isOpenJob}
              pattern="^0x[a-fA-F0-9]{40}$"
              className={
                errors.beneficiary ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors.beneficiary ? (
              <p className="text-red-500 text-sm mt-1">{errors.beneficiary}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {formData.isOpenJob
                  ? "Leave empty for open job applications"
                  : "Valid Ethereum address required for direct escrow"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useNativeToken"
              checked={formData.useNativeToken}
              onChange={(e) => onUpdate({ useNativeToken: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="useNativeToken">Use Native Token (MON)</Label>
          </div>

          {!formData.useNativeToken && (
            <div className="space-y-2">
              <Label htmlFor="tokenAddress">Token Address *</Label>
              {loadingTokens ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading whitelisted tokens...
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    value={
                      selectedToken ||
                      (whitelistedTokens.find(
                        (t) =>
                          t.address.toLowerCase() ===
                          formData.token.toLowerCase()
                      )
                        ? formData.token
                        : formData.token && formData.token !== ""
                        ? "custom"
                        : "")
                    }
                    onValueChange={handleTokenSelect}
                  >
                    <SelectTrigger
                      className={`w-full ${
                        errors.tokenAddress
                          ? "border-red-500 focus:border-red-500"
                          : ""
                      }`}
                    >
                      <SelectValue placeholder="Select a whitelisted token or enter custom" />
                    </SelectTrigger>
                    <SelectContent>
                      {whitelistedTokens.length > 0 ? (
                        <>
                          {whitelistedTokens.map((token) => (
                            <SelectItem
                              key={token.address}
                              value={token.address}
                            >
                              {token.name} ({token.symbol}) -{" "}
                              {token.address.slice(0, 6)}...
                              {token.address.slice(-4)}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">
                            Enter custom address
                          </SelectItem>
                        </>
                      ) : (
                        <SelectItem value="custom">
                          Enter custom address
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {(selectedToken === "custom" ||
                    (formData.token &&
                      !whitelistedTokens.find(
                        (t) =>
                          t.address.toLowerCase() ===
                          formData.token.toLowerCase()
                      ))) && (
                    <Input
                      id="tokenAddress"
                      value={formData.token}
                      onChange={(e) => {
                        onUpdate({ token: e.target.value });
                        if (
                          e.target.value &&
                          !whitelistedTokens.find(
                            (t) =>
                              t.address.toLowerCase() ===
                              e.target.value.toLowerCase()
                          )
                        ) {
                          setSelectedToken("custom");
                        }
                      }}
                      placeholder="0x..."
                      required={!formData.useNativeToken}
                      pattern="^0x[a-fA-F0-9]{40}$"
                      className={
                        errors.tokenAddress
                          ? "border-red-500 focus:border-red-500"
                          : ""
                      }
                    />
                  )}
                </div>
              )}
              {errors.tokenAddress ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.tokenAddress}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {whitelistedTokens.length > 0
                    ? "Select a whitelisted token or enter a custom address"
                    : wallet.isConnected
                    ? "Enter the contract address of your ERC20 token deployed on Base Mainnet"
                    : "Connect your wallet to see whitelisted tokens"}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isOpenJob"
              checked={formData.isOpenJob}
              onChange={(e) => onUpdate({ isOpenJob: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isOpenJob">Open Job (Allow Applications)</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
