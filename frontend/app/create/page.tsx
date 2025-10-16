"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/web3/config";
import { SECUREFLOW_ABI, ERC20_ABI } from "@/lib/web3/abis";
import { useRouter } from "next/navigation";
import { ProjectDetailsStep } from "@/components/create/project-details-step";
import { MilestonesStep } from "@/components/create/milestones-step";
import { ReviewStep } from "@/components/create/review-step";

interface Milestone {
  description: string;
  amount: string;
}

export default function CreateEscrowPage() {
  const router = useRouter();
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState<
    number | null
  >(null);
  const [useNativeToken, setUseNativeToken] = useState(false);
  const [isOpenJob, setIsOpenJob] = useState(false);
  const [isContractPaused, setIsContractPaused] = useState(false);

  useEffect(() => {
    checkContractPauseStatus();
  }, []);

  const checkContractPauseStatus = async () => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW, SECUREFLOW_ABI);
      const paused = await contract.call("paused");
      console.log(
        "Contract pause status (create page):",
        paused,
        "type:",
        typeof paused,
      );

      let isPaused = false;

      // Use the same robust parsing logic as admin page
      if (paused === true || paused === "true" || paused === 1) {
        isPaused = true;
      } else if (paused === false || paused === "false" || paused === 0) {
        isPaused = false;
      } else if (paused && typeof paused === "object") {
        try {
          const pausedValue = paused.toString();
          console.log("Paused proxy toString() (create page):", pausedValue);
          isPaused = pausedValue === "true" || pausedValue === "1";
        } catch (e) {
          console.warn("Could not parse paused proxy object (create page):", e);
          isPaused = false; // Default to not paused
        }
      }

      console.log("Is paused (create page):", isPaused);
      setIsContractPaused(isPaused);
    } catch (error) {
      console.error(
        "Error checking contract pause status (create page):",
        error,
      );
      setIsContractPaused(false);
    }
  };

  const [formData, setFormData] = useState({
    projectTitle: "",
    projectDescription: "",
    duration: "",
    totalBudget: "",
    beneficiary: "",
    token: ZERO_ADDRESS,
    useNativeToken: false,
    isOpenJob: false,
    milestones: [
      { description: "", amount: "" },
      { description: "", amount: "" },
    ] as Milestone[],
  });

  const commonTokens = [
    { name: "Native MONAD", address: ZERO_ADDRESS, isNative: true },
    { name: "Custom ERC20", address: "", isNative: false },
  ];

  const addMilestone = () => {
    setFormData({
      ...formData,
      milestones: [...formData.milestones, { description: "", amount: "" }],
    });
  };

  const removeMilestone = (index: number) => {
    if (formData.milestones.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "At least one milestone is required",
        variant: "destructive",
      });
      return;
    }
    const newMilestones = formData.milestones.filter((_, i) => i !== index);
    setFormData({ ...formData, milestones: newMilestones });
  };

  const updateMilestone = (
    index: number,
    field: keyof Milestone,
    value: string,
  ) => {
    const newMilestones = [...formData.milestones];
    newMilestones[index][field] = value;
    setFormData({ ...formData, milestones: newMilestones });
  };

  const openAIWriter = (index: number) => {
    setCurrentMilestoneIndex(index);
    setShowAIWriter(true);
  };

  const handleAISelect = (description: string) => {
    if (currentMilestoneIndex !== null) {
      updateMilestone(currentMilestoneIndex, "description", description);
      setShowAIWriter(false);
      setCurrentMilestoneIndex(null);
    }
  };

  const calculateTotalMilestones = () => {
    return formData.milestones.reduce(
      (sum, m) => sum + (Number.parseFloat(m.amount) || 0),
      0,
    );
  };

  const validateStep = () => {
    if (step === 1) {
      // Validate all required fields for step 1
      const errors: string[] = [];
      
      if (!formData.projectTitle || formData.projectTitle.length < 3) {
        errors.push("Project title must be at least 3 characters");
      }
      
      if (!formData.projectDescription || formData.projectDescription.length < 50) {
        errors.push("Project description must be at least 50 characters");
      }
      
      if (!formData.duration || Number(formData.duration) < 1 || Number(formData.duration) > 365) {
        errors.push("Duration must be between 1 and 365 days");
      }
      
      if (!formData.totalBudget || Number(formData.totalBudget) < 0.01) {
        errors.push("Total budget must be at least 0.01 tokens");
      }
      
      if (!formData.isOpenJob && (!formData.beneficiary || !/^0x[a-fA-F0-9]{40}$/.test(formData.beneficiary))) {
        errors.push("Valid beneficiary address is required for direct escrow");
      }
      
      if (errors.length > 0) {
        toast({
          title: "Missing or invalid information",
          description: errors.join(", "),
          variant: "destructive",
        });
        return false;
      }
    } else if (step === 2) {
      const total = calculateTotalMilestones();
      const targetTotal = Number.parseFloat(formData.totalBudget) || 0;

      if (formData.milestones.some((m) => !m.description || !m.amount)) {
        toast({
          title: "Incomplete milestones",
          description: "Please fill in all milestone details",
          variant: "destructive",
        });
        return false;
      }

      if (Math.abs(total - targetTotal) > 0.01) {
        toast({
          title: "Amount mismatch",
          description: `Milestone amounts (${total}) must equal total amount (${targetTotal})`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Validate project title
    if (!formData.projectTitle || formData.projectTitle.length < 3) {
      errors.push("Project title must be at least 3 characters long");
    }

    // Validate project description
    if (
      !formData.projectDescription ||
      formData.projectDescription.length < 50
    ) {
      errors.push("Project description must be at least 50 characters long");
    }

    // Validate duration
    if (
      !formData.duration ||
      Number(formData.duration) < 1 ||
      Number(formData.duration) > 365
    ) {
      errors.push("Duration must be between 1 and 365 days");
    }

    // Validate total budget
    if (!formData.totalBudget || Number(formData.totalBudget) < 0.01) {
      errors.push("Total budget must be at least 0.01 tokens");
    }

    // Validate beneficiary (only if not open job)
    if (!formData.isOpenJob) {
      if (!formData.beneficiary) {
        errors.push("Beneficiary address is required for direct escrow");
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.beneficiary)) {
        errors.push("Beneficiary address must be a valid Ethereum address");
      }
    }

    // Validate milestones
    if (formData.milestones.length === 0) {
      errors.push("At least one milestone is required");
    }

    for (let i = 0; i < formData.milestones.length; i++) {
      const milestone = formData.milestones[i];
      if (!milestone.description || milestone.description.length < 10) {
        errors.push(
          `Milestone ${i + 1} description must be at least 10 characters long`,
        );
      }
      if (!milestone.amount || Number(milestone.amount) < 0.01) {
        errors.push(`Milestone ${i + 1} amount must be at least 0.01 tokens`);
      }
    }

    // Validate milestone amounts sum
    const totalMilestoneAmount = formData.milestones.reduce(
      (sum, milestone) => sum + Number(milestone.amount || 0),
      0,
    );
    if (Math.abs(totalMilestoneAmount - Number(formData.totalBudget)) > 0.01) {
      errors.push("Total milestone amounts must equal the total budget");
    }

    return errors;
  };

  const handleSubmit = async () => {
    if (!wallet.isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an escrow",
        variant: "destructive",
      });
      return;
    }

    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Form validation failed",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    // Allow both native tokens (ZERO_ADDRESS) and ERC20 tokens
    if (!formData.token) {
      toast({
        title: "Invalid token address",
        description: "Please select a token type",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (formData.token !== ZERO_ADDRESS) {
        const tokenContract = getContract(formData.token, ERC20_ABI);
        const totalAmountInWei = (
          BigInt(formData.totalBudget) * BigInt(10 ** 18)
        ).toString();
        const approvalTx = await tokenContract.send(
          "approve",
          "no-value", // No native value for ERC20 approval
          CONTRACTS.SECUREFLOW_ESCROW,
          totalAmountInWei,
        );

        toast({
          title: "Approval submitted",
          description: "Waiting for token approval confirmation...",
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const escrowContract = getContract(
        CONTRACTS.SECUREFLOW_ESCROW,
        SECUREFLOW_ABI,
      );
      const milestoneDescriptions = formData.milestones.map(
        (m) => m.description,
      );
      const milestoneAmounts = formData.milestones.map((m) => m.amount);

      const beneficiaryAddress = isOpenJob
        ? ZERO_ADDRESS
        : formData.beneficiary;

      let txHash;

      if (formData.token === ZERO_ADDRESS) {
        // Use createEscrowNative for native MON tokens
        const totalAmountInWei =
          "0x" + (BigInt(formData.totalBudget) * BigInt(10 ** 18)).toString(16);
        const arbiters = ["0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41"]; // Default arbiter
        const requiredConfirmations = 1;

        // Convert duration from days to seconds
        const durationInSeconds = Number(formData.duration) * 24 * 60 * 60;

        txHash = await escrowContract.send(
          "createEscrowNative",
          totalAmountInWei, // msg.value in wei (hex format)
          beneficiaryAddress, // beneficiary parameter
          arbiters, // arbiters parameter
          requiredConfirmations, // requiredConfirmations parameter
          milestoneAmounts, // milestoneAmounts parameter
          milestoneDescriptions, // milestoneDescriptions parameter
          durationInSeconds, // duration parameter (in seconds)
          formData.projectDescription, // projectTitle parameter
          formData.projectDescription, // projectDescription parameter
        );
      } else {
        // Use createEscrow for ERC20 tokens
        const arbiters = ["0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41"]; // Default arbiter
        const requiredConfirmations = 1;

        // Convert milestone amounts to wei for ERC20 tokens
        const milestoneAmountsInWei = formData.milestones.map((m) =>
          (BigInt(m.amount) * BigInt(10 ** 18)).toString(),
        );

        // Convert duration from days to seconds
        const durationInSeconds = Number(formData.duration) * 24 * 60 * 60;

        txHash = await escrowContract.send(
          "createEscrow",
          "no-value", // No msg.value for ERC20
          beneficiaryAddress, // beneficiary parameter
          arbiters, // arbiters parameter
          requiredConfirmations, // requiredConfirmations parameter
          milestoneAmountsInWei, // milestoneAmounts parameter (in wei)
          milestoneDescriptions, // milestoneDescriptions parameter
          formData.token, // token parameter
          durationInSeconds, // duration parameter (in seconds)
          formData.projectDescription, // projectTitle parameter
          formData.projectDescription, // projectDescription parameter
        );
      }

      toast({
        title: isOpenJob ? "Job posted!" : "Escrow created!",
        description: isOpenJob
          ? "Your job is now live. Freelancers can apply on the Browse Jobs page."
          : "Your escrow has been successfully created",
      });

      setTimeout(() => {
        router.push(isOpenJob ? "/jobs" : "/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error("Error creating escrow:", error);
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create escrow",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 gradient-mesh">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
            Create New Escrow
          </h1>
          <p className="text-xl text-muted-foreground text-center mb-12">
            Set up a secure escrow with milestone-based payments
          </p>

          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      s === step
                        ? "border-primary bg-primary text-primary-foreground"
                        : s < step
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-16 h-0.5 ${s < step ? "bg-primary" : "bg-muted-foreground/30"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProjectDetailsStep
                  formData={formData}
                  onUpdate={(data) => setFormData({ ...formData, ...data })}
                  isContractPaused={isContractPaused}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MilestonesStep
                  milestones={formData.milestones}
                  onUpdate={(milestones) =>
                    setFormData({ ...formData, milestones })
                  }
                  showAIWriter={showAIWriter}
                  onToggleAIWriter={setShowAIWriter}
                  currentMilestoneIndex={currentMilestoneIndex}
                  onSetCurrentMilestoneIndex={setCurrentMilestoneIndex}
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ReviewStep
                  formData={formData}
                  onConfirm={handleSubmit}
                  isSubmitting={isSubmitting}
                  isContractPaused={isContractPaused}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 3}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
