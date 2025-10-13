const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecureFlow", function () {
  let secureFlow;
  let mockToken;
  let owner,
    depositor,
    beneficiary,
    freelancer,
    arbiter1,
    arbiter2,
    feeCollector;
  let addrs;

  const PLATFORM_FEE_BP = 0; // 0% for hackathon demo
  const MILESTONE_AMOUNTS = [ethers.parseEther("10"), ethers.parseEther("15")];
  const ESCROW_AMOUNT = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
  const MILESTONE_DESCRIPTIONS = ["Phase 1: Design", "Phase 2: Implementation"];
  const PROJECT_TITLE = "Web3 DApp Development";
  const PROJECT_DESCRIPTION =
    "Build a decentralized application with smart contracts";

  beforeEach(async function () {
    [
      owner,
      depositor,
      beneficiary,
      freelancer,
      arbiter1,
      arbiter2,
      feeCollector,
      ...addrs
    ] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy(
      "Mock Token",
      "MTK",
      ethers.parseEther("1000000"),
    );
    await mockToken.waitForDeployment();

    // Deploy SecureFlow
    const SecureFlow = await ethers.getContractFactory("SecureFlow");
    secureFlow = await SecureFlow.deploy(
      await mockToken.getAddress(),
      feeCollector.address,
      PLATFORM_FEE_BP,
    );
    await secureFlow.waitForDeployment();

    // Authorize arbiters
    await secureFlow.authorizeArbiter(arbiter1.address);
    await secureFlow.authorizeArbiter(arbiter2.address);

    // Fund depositor with tokens
    await mockToken.transfer(depositor.address, ethers.parseEther("1000"));
    await mockToken
      .connect(depositor)
      .approve(await secureFlow.getAddress(), ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await secureFlow.owner()).to.equal(owner.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await secureFlow.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set the right platform fee", async function () {
      expect(await secureFlow.platformFeeBP()).to.equal(PLATFORM_FEE_BP);
    });

    it("Should whitelist the monad token", async function () {
      expect(await secureFlow.whitelistedTokens(await mockToken.getAddress()))
        .to.be.true;
    });
  });

  describe("Escrow Creation", function () {
    it("Should create escrow with ERC20 token", async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await expect(
        secureFlow.connect(depositor).createEscrow(
          beneficiary.address,
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60, // 7 days
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        ),
      )
        .to.emit(secureFlow, "EscrowCreated")
        .withArgs(
          1,
          depositor.address,
          beneficiary.address,
          arbiters,
          ESCROW_AMOUNT,
          0, // platform fee
          await mockToken.getAddress(),
          (await time.latest()) + 7 * 24 * 60 * 60,
          false, // not open job
        );
    });

    it("Should create escrow with native token", async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await expect(
        secureFlow.connect(depositor).createEscrowNative(
          beneficiary.address,
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          7 * 24 * 60 * 60, // 7 days
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
          { value: ESCROW_AMOUNT },
        ),
      ).to.emit(secureFlow, "EscrowCreated");
    });

    it("Should create open job (marketplace)", async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await expect(
        secureFlow.connect(depositor).createEscrow(
          ethers.ZeroAddress, // beneficiary = 0 for open job
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60,
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        ),
      ).to.emit(secureFlow, "EscrowCreated");
    });

    it("Should reject escrow with too many arbiters", async function () {
      const arbiters = [
        arbiter1.address,
        arbiter2.address,
        addrs[0].address,
        addrs[1].address,
        addrs[2].address,
        addrs[3].address,
      ]; // 6 arbiters
      const requiredConfirmations = 1;

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiters,
            requiredConfirmations,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            7 * 24 * 60 * 60,
            PROJECT_TITLE,
            PROJECT_DESCRIPTION,
          ),
      ).to.be.revertedWith("Too many arbiters");
    });

    it("Should reject escrow with too many milestones", async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;
      const tooManyMilestones = new Array(21).fill(ethers.parseEther("1")); // 21 milestones
      const tooManyDescriptions = new Array(21).fill("Milestone");

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiters,
            requiredConfirmations,
            tooManyMilestones,
            tooManyDescriptions,
            await mockToken.getAddress(),
            7 * 24 * 60 * 60,
            PROJECT_TITLE,
            PROJECT_DESCRIPTION,
          ),
      ).to.be.revertedWith("Too many milestones");
    });
  });

  describe("Marketplace Functions", function () {
    let escrowId;

    beforeEach(async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await secureFlow.connect(depositor).createEscrow(
        ethers.ZeroAddress, // open job
        arbiters,
        requiredConfirmations,
        MILESTONE_AMOUNTS,
        MILESTONE_DESCRIPTIONS,
        await mockToken.getAddress(),
        7 * 24 * 60 * 60,
        PROJECT_TITLE,
        PROJECT_DESCRIPTION,
      );
      escrowId = 1;
    });

    it("Should allow freelancer to apply to job", async function () {
      const coverLetter = "I have 5 years of experience in Web3 development";
      const proposedTimeline = 14; // 14 days

      await expect(
        secureFlow
          .connect(freelancer)
          .applyToJob(escrowId, coverLetter, proposedTimeline),
      )
        .to.emit(secureFlow, "ApplicationSubmitted")
        .withArgs(escrowId, freelancer.address, coverLetter, proposedTimeline);
    });

    it("Should allow depositor to accept freelancer", async function () {
      const coverLetter = "I have 5 years of experience in Web3 development";
      const proposedTimeline = 14;

      await secureFlow
        .connect(freelancer)
        .applyToJob(escrowId, coverLetter, proposedTimeline);

      await expect(
        secureFlow
          .connect(depositor)
          .acceptFreelancer(escrowId, freelancer.address),
      )
        .to.emit(secureFlow, "FreelancerAccepted")
        .withArgs(escrowId, freelancer.address);
    });

    it("Should reject application to closed job", async function () {
      const coverLetter = "I have 5 years of experience in Web3 development";
      const proposedTimeline = 14;

      // Accept freelancer first to close the job
      await secureFlow
        .connect(freelancer)
        .applyToJob(escrowId, coverLetter, proposedTimeline);

      await secureFlow
        .connect(depositor)
        .acceptFreelancer(escrowId, freelancer.address);

      // Try to apply again
      await expect(
        secureFlow
          .connect(addrs[0])
          .applyToJob(escrowId, coverLetter, proposedTimeline),
      ).to.be.revertedWith("Not an open job");
    });

    it("Should reject duplicate applications", async function () {
      const coverLetter = "I have 5 years of experience in Web3 development";
      const proposedTimeline = 14;

      await secureFlow
        .connect(freelancer)
        .applyToJob(escrowId, coverLetter, proposedTimeline);

      await expect(
        secureFlow
          .connect(freelancer)
          .applyToJob(escrowId, coverLetter, proposedTimeline),
      ).to.be.revertedWith("Already applied");
    });
  });

  describe("Work Lifecycle", function () {
    let escrowId;

    beforeEach(async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60,
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        );
      escrowId = 1;
    });

    it("Should allow beneficiary to start work", async function () {
      await expect(secureFlow.connect(beneficiary).startWork(escrowId))
        .to.emit(secureFlow, "WorkStarted")
        .withArgs(escrowId, beneficiary.address, (await time.latest()) + 1);
    });

    it("Should allow milestone submission", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      const description = "Updated milestone description";
      await expect(
        secureFlow
          .connect(beneficiary)
          .submitMilestone(escrowId, 0, description),
      )
        .to.emit(secureFlow, "MilestoneSubmitted")
        .withArgs(
          escrowId,
          0,
          beneficiary.address,
          description,
          (await time.latest()) + 1,
        );
    });

    it("Should allow milestone approval", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Milestone 1");

      await expect(secureFlow.connect(depositor).approveMilestone(escrowId, 0))
        .to.emit(secureFlow, "MilestoneApproved")
        .withArgs(
          escrowId,
          0,
          depositor.address,
          MILESTONE_AMOUNTS[0],
          (await time.latest()) + 1,
        );
    });

    it("Should complete escrow when all milestones approved", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Milestone 1");
      await secureFlow.connect(depositor).approveMilestone(escrowId, 0);

      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 1, "Milestone 2");

      await expect(secureFlow.connect(depositor).approveMilestone(escrowId, 1))
        .to.emit(secureFlow, "EscrowCompleted")
        .withArgs(escrowId, beneficiary.address, ESCROW_AMOUNT);
    });
  });

  describe("Reputation System", function () {
    let escrowId;

    beforeEach(async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60,
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        );
      escrowId = 1;
    });

    it("Should update reputation on milestone approval", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Milestone 1");

      await expect(secureFlow.connect(depositor).approveMilestone(escrowId, 0))
        .to.emit(secureFlow, "ReputationUpdated")
        .withArgs(beneficiary.address, 10, "Milestone approved");
    });

    it("Should update reputation on escrow completion", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Milestone 1");
      await secureFlow.connect(depositor).approveMilestone(escrowId, 0);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 1, "Milestone 2");

      await expect(secureFlow.connect(depositor).approveMilestone(escrowId, 1))
        .to.emit(secureFlow, "ReputationUpdated")
        .withArgs(beneficiary.address, 45, "Escrow completed"); // 10 + 25 + 10
    });
  });

  describe("Refunds", function () {
    let escrowId;

    beforeEach(async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60,
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        );
      escrowId = 1;
    });

    it("Should allow refund before work starts", async function () {
      await expect(secureFlow.connect(depositor).refundEscrow(escrowId))
        .to.emit(secureFlow, "FundsRefunded")
        .withArgs(escrowId, depositor.address, ESCROW_AMOUNT);
    });

    it("Should reject refund after work starts", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      await expect(
        secureFlow.connect(depositor).refundEscrow(escrowId),
      ).to.be.revertedWith("Invalid status");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause job creation", async function () {
      await expect(secureFlow.pauseJobCreation()).to.emit(
        secureFlow,
        "JobCreationPaused",
      );
    });

    it("Should allow owner to update platform fee", async function () {
      const newFee = 100; // 1%
      await expect(secureFlow.setPlatformFeeBP(newFee))
        .to.emit(secureFlow, "PlatformFeeUpdated")
        .withArgs(newFee);
    });
  });

  describe("Edge Cases", function () {
    it("Should reject escrow to self", async function () {
      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await expect(
        secureFlow.connect(depositor).createEscrow(
          depositor.address, // escrow to self
          arbiters,
          requiredConfirmations,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          7 * 24 * 60 * 60,
          PROJECT_TITLE,
          PROJECT_DESCRIPTION,
        ),
      ).to.be.revertedWith("Cannot escrow to self");
    });

    it("Should reject unauthorized arbiter", async function () {
      const arbiters = [addrs[0].address]; // unauthorized arbiter
      const requiredConfirmations = 1;

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiters,
            requiredConfirmations,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            7 * 24 * 60 * 60,
            PROJECT_TITLE,
            PROJECT_DESCRIPTION,
          ),
      ).to.be.revertedWith("Arbiter not authorized");
    });

    it("Should reject when job creation is paused", async function () {
      await secureFlow.pauseJobCreation();

      const arbiters = [arbiter1.address];
      const requiredConfirmations = 1;

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiters,
            requiredConfirmations,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            7 * 24 * 60 * 60,
            PROJECT_TITLE,
            PROJECT_DESCRIPTION,
          ),
      ).to.be.revertedWith("Job creation paused");
    });
  });
});
