const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecureFlow", function () {
  let secureFlow;
  let mockToken;
  let owner;
  let depositor;
  let beneficiary;
  let arbiter;
  let feeCollector;
  let addr1, addr2, addr3;

  const PLATFORM_FEE_BP = 250; // 2.5%
  const MILESTONE_AMOUNTS = [ethers.parseEther("1"), ethers.parseEther("2")];
  const MILESTONE_DESCRIPTIONS = ["Milestone 1", "Milestone 2"];
  const DURATION = 7 * 24 * 60 * 60; // 7 days

  beforeEach(async function () {
    [
      owner,
      depositor,
      beneficiary,
      arbiter,
      feeCollector,
      addr1,
      addr2,
      addr3,
    ] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy(
      "Test Token",
      "TT",
      ethers.parseEther("1000000"),
    );
    await mockToken.waitForDeployment();

    // Deploy SecureFlow
    const SecureFlow = await ethers.getContractFactory("SecureFlow");
    secureFlow = await SecureFlow.deploy(
      await mockToken.getAddress(), // monadToken
      feeCollector.address, // feeCollector
      PLATFORM_FEE_BP, // platformFeeBP
    );
    await secureFlow.waitForDeployment();

    // Authorize arbiter
    await secureFlow.authorizeArbiter(arbiter.address);

    // Whitelist token
    await secureFlow.whitelistToken(await mockToken.getAddress());

    // Transfer tokens to depositor
    await mockToken.transfer(depositor.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await secureFlow.monadToken()).to.equal(
        await mockToken.getAddress(),
      );
      expect(await secureFlow.feeCollector()).to.equal(feeCollector.address);
      expect(await secureFlow.platformFeeBP()).to.equal(PLATFORM_FEE_BP);
      expect(await secureFlow.nextEscrowId()).to.equal(1);
    });

    it("Should whitelist the monad token", async function () {
      expect(await secureFlow.whitelistedTokens(await mockToken.getAddress()))
        .to.be.true;
    });

    it("Should authorize the arbiter", async function () {
      expect(await secureFlow.authorizedArbiters(arbiter.address)).to.be.true;
    });
  });

  describe("ERC20 Escrow Creation", function () {
    beforeEach(async function () {
      // Approve tokens
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
    });

    it("Should create an ERC20 escrow successfully", async function () {
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const expectedFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);
      const expectedTotal = totalAmount + expectedFee;

      const tx = await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );

      await expect(tx)
        .to.emit(secureFlow, "EscrowCreated")
        .withArgs(
          1,
          depositor.address,
          beneficiary.address,
          arbiter.address,
          totalAmount,
          expectedFee,
          await mockToken.getAddress(),
          (await time.latest()) + DURATION,
        );

      // Check escrow data
      const escrow = await secureFlow.escrows(1);
      expect(escrow.depositor).to.equal(depositor.address);
      expect(escrow.beneficiary).to.equal(beneficiary.address);
      expect(escrow.arbiter).to.equal(arbiter.address);
      expect(escrow.token).to.equal(await mockToken.getAddress());
      expect(escrow.totalAmount).to.equal(totalAmount);
      expect(escrow.platformFee).to.equal(expectedFee);
      expect(escrow.status).to.equal(0); // Pending

      // Check token balances
      expect(await mockToken.balanceOf(await secureFlow.getAddress())).to.equal(
        expectedTotal,
      );
      expect(
        await secureFlow.escrowedAmount(await mockToken.getAddress()),
      ).to.equal(totalAmount);
      expect(
        await secureFlow.totalFeesByToken(await mockToken.getAddress()),
      ).to.equal(expectedFee);
    });

    it("Should fail with invalid parameters", async function () {
      // Invalid beneficiary
      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            ethers.ZeroAddress,
            arbiter.address,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            DURATION,
          ),
      ).to.be.revertedWith("SecureFlow: Invalid beneficiary");

      // Invalid arbiter
      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            ethers.ZeroAddress,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            DURATION,
          ),
      ).to.be.revertedWith("SecureFlow: Arbiter not authorized");

      // Self escrow
      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            depositor.address,
            arbiter.address,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            DURATION,
          ),
      ).to.be.revertedWith("SecureFlow: Cannot escrow to self");

      // Invalid duration
      await expect(
        secureFlow.connect(depositor).createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          30, // Too short
        ),
      ).to.be.revertedWith("SecureFlow: Invalid duration");

      // No milestones
      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiter.address,
            [],
            [],
            await mockToken.getAddress(),
            DURATION,
          ),
      ).to.be.revertedWith("SecureFlow: No milestones");
    });
  });

  describe("Native MON Escrow Creation", function () {
    it("Should create a native escrow successfully", async function () {
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const expectedFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);
      const expectedTotal = totalAmount + expectedFee;

      const tx = await secureFlow
        .connect(depositor)
        .createEscrowNative(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          DURATION,
          { value: expectedTotal },
        );

      await expect(tx)
        .to.emit(secureFlow, "EscrowCreated")
        .withArgs(
          1,
          depositor.address,
          beneficiary.address,
          arbiter.address,
          totalAmount,
          expectedFee,
          ethers.ZeroAddress,
          (await time.latest()) + DURATION,
        );

      // Check escrow data
      const escrow = await secureFlow.escrows(1);
      expect(escrow.token).to.equal(ethers.ZeroAddress);
      expect(escrow.totalAmount).to.equal(totalAmount);
      expect(escrow.platformFee).to.equal(expectedFee);

      // Check native balances
      expect(await secureFlow.escrowedAmount(ethers.ZeroAddress)).to.equal(
        totalAmount,
      );
      expect(await secureFlow.totalFeesByToken(ethers.ZeroAddress)).to.equal(
        expectedFee,
      );
    });

    it("Should fail with incorrect native amount", async function () {
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const expectedFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);
      const expectedTotal = totalAmount + expectedFee;

      await expect(
        secureFlow.connect(depositor).createEscrowNative(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          DURATION,
          { value: expectedTotal - BigInt(1) }, // Wrong amount
        ),
      ).to.be.revertedWith("SecureFlow: Incorrect native amount");
    });
  });

  describe("Work Lifecycle", function () {
    let escrowId;

    beforeEach(async function () {
      // Create escrow
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
      const tx = await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );
      const receipt = await tx.wait();
      escrowId = 1;
    });

    it("Should start work successfully", async function () {
      const tx = await secureFlow.connect(beneficiary).startWork(escrowId);

      await expect(tx)
        .to.emit(secureFlow, "WorkStarted")
        .withArgs(escrowId, beneficiary.address, await time.latest());

      const escrow = await secureFlow.escrows(escrowId);
      expect(escrow.workStarted).to.be.true;
      expect(escrow.status).to.equal(1); // InProgress
    });

    it("Should submit milestone successfully", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      const tx = await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Updated description");

      await expect(tx)
        .to.emit(secureFlow, "MilestoneSubmitted")
        .withArgs(
          escrowId,
          0,
          beneficiary.address,
          "Updated description",
          await time.latest(),
        );

      const milestone = await secureFlow.milestones(escrowId, 0);
      expect(milestone.status).to.equal(1); // Submitted
      expect(milestone.submittedAt).to.be.gt(0);
    });

    it("Should approve milestone successfully", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Updated description");

      const tx = await secureFlow
        .connect(depositor)
        .approveMilestone(escrowId, 0);

      await expect(tx)
        .to.emit(secureFlow, "MilestoneApproved")
        .withArgs(
          escrowId,
          0,
          depositor.address,
          MILESTONE_AMOUNTS[0],
          await time.latest(),
        );

      const milestone = await secureFlow.milestones(escrowId, 0);
      expect(milestone.status).to.equal(2); // Approved
      expect(milestone.approvedAt).to.be.gt(0);

      // Check beneficiary received tokens
      expect(await mockToken.balanceOf(beneficiary.address)).to.equal(
        MILESTONE_AMOUNTS[0],
      );
    });

    it("Should complete escrow when all milestones approved", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      // Submit and approve first milestone
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Updated description");
      await secureFlow.connect(depositor).approveMilestone(escrowId, 0);

      // Submit and approve second milestone
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 1, "Updated description 2");
      const tx = await secureFlow
        .connect(depositor)
        .approveMilestone(escrowId, 1);

      await expect(tx)
        .to.emit(secureFlow, "EscrowCompleted")
        .withArgs(
          escrowId,
          beneficiary.address,
          MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1],
        );

      const escrow = await secureFlow.escrows(escrowId);
      expect(escrow.status).to.equal(2); // Released
    });
  });

  describe("Dispute Resolution", function () {
    let escrowId;

    beforeEach(async function () {
      // Create escrow
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );
      escrowId = 1;

      // Start work and submit milestone
      await secureFlow.connect(beneficiary).startWork(escrowId);
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Updated description");
    });

    it("Should dispute milestone successfully", async function () {
      const tx = await secureFlow
        .connect(depositor)
        .disputeMilestone(escrowId, 0, "Quality issues");

      await expect(tx)
        .to.emit(secureFlow, "MilestoneDisputed")
        .withArgs(
          escrowId,
          0,
          depositor.address,
          "Quality issues",
          await time.latest(),
        );

      const milestone = await secureFlow.milestones(escrowId, 0);
      expect(milestone.status).to.equal(3); // Disputed
      expect(milestone.disputedBy).to.equal(depositor.address);
      expect(milestone.disputeReason).to.equal("Quality issues");

      const escrow = await secureFlow.escrows(escrowId);
      expect(escrow.status).to.equal(4); // Disputed
    });

    it("Should resolve dispute successfully", async function () {
      await secureFlow
        .connect(depositor)
        .disputeMilestone(escrowId, 0, "Quality issues");

      const beneficiaryAmount = MILESTONE_AMOUNTS[0] / BigInt(2); // 50% to beneficiary
      const refundAmount = MILESTONE_AMOUNTS[0] - beneficiaryAmount;

      const tx = await secureFlow
        .connect(arbiter)
        .resolveDispute(escrowId, 0, beneficiaryAmount);

      await expect(tx)
        .to.emit(secureFlow, "DisputeResolved")
        .withArgs(
          escrowId,
          0,
          arbiter.address,
          beneficiaryAmount,
          refundAmount,
          await time.latest(),
        );

      const milestone = await secureFlow.milestones(escrowId, 0);
      expect(milestone.status).to.equal(4); // Resolved

      // Check balances (accounting for platform fees)
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const platformFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);
      const totalWithFee = totalAmount + platformFee;

      expect(await mockToken.balanceOf(beneficiary.address)).to.equal(
        beneficiaryAmount,
      );
      expect(await mockToken.balanceOf(depositor.address)).to.equal(
        ethers.parseEther("1000") - totalWithFee + refundAmount,
      );
    });
  });

  describe("Refund Mechanisms", function () {
    let escrowId;

    beforeEach(async function () {
      // Create escrow
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );
      escrowId = 1;
    });

    it("Should refund before work starts", async function () {
      const tx = await secureFlow.connect(depositor).refundEscrow(escrowId);

      await expect(tx)
        .to.emit(secureFlow, "FundsRefunded")
        .withArgs(
          escrowId,
          depositor.address,
          MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1],
        );

      const escrow = await secureFlow.escrows(escrowId);
      expect(escrow.status).to.equal(3); // Refunded

      // Check depositor got refund (platform fee retained)
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const platformFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);
      const totalWithFee = totalAmount + platformFee;
      expect(await mockToken.balanceOf(depositor.address)).to.equal(
        ethers.parseEther("1000") - totalWithFee + totalAmount,
      );
    });

    it("Should fail refund after work starts", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      await expect(
        secureFlow.connect(depositor).refundEscrow(escrowId),
      ).to.be.revertedWith("SecureFlow: Invalid status");
    });
  });

  describe("Admin Functions", function () {
    it("Should update platform fee", async function () {
      const newFee = 500; // 5%
      const tx = await secureFlow.setPlatformFeeBP(newFee);

      await expect(tx)
        .to.emit(secureFlow, "PlatformFeeUpdated")
        .withArgs(newFee);

      expect(await secureFlow.platformFeeBP()).to.equal(newFee);
    });

    it("Should update fee collector", async function () {
      const tx = await secureFlow.setFeeCollector(addr1.address);

      await expect(tx)
        .to.emit(secureFlow, "FeeCollectorUpdated")
        .withArgs(addr1.address);

      expect(await secureFlow.feeCollector()).to.equal(addr1.address);
    });

    it("Should whitelist/blacklist tokens", async function () {
      // Whitelist
      const tx1 = await secureFlow.whitelistToken(addr2.address);
      await expect(tx1)
        .to.emit(secureFlow, "TokenWhitelisted")
        .withArgs(addr2.address);
      expect(await secureFlow.whitelistedTokens(addr2.address)).to.be.true;

      // Blacklist
      const tx2 = await secureFlow.blacklistToken(addr2.address);
      await expect(tx2)
        .to.emit(secureFlow, "TokenBlacklisted")
        .withArgs(addr2.address);
      expect(await secureFlow.whitelistedTokens(addr2.address)).to.be.false;
    });

    it("Should authorize/revoke arbiters", async function () {
      // Authorize
      const tx1 = await secureFlow.authorizeArbiter(addr3.address);
      await expect(tx1)
        .to.emit(secureFlow, "ArbiterAuthorized")
        .withArgs(addr3.address);
      expect(await secureFlow.authorizedArbiters(addr3.address)).to.be.true;

      // Revoke
      const tx2 = await secureFlow.revokeArbiter(addr3.address);
      await expect(tx2)
        .to.emit(secureFlow, "ArbiterRevoked")
        .withArgs(addr3.address);
      expect(await secureFlow.authorizedArbiters(addr3.address)).to.be.false;
    });
  });

  describe("Fee Withdrawal", function () {
    let escrowId;

    beforeEach(async function () {
      // Create escrow to generate fees
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );
      escrowId = 1;
    });

    it("Should withdraw fees successfully", async function () {
      const totalAmount = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1];
      const expectedFee =
        (totalAmount * BigInt(PLATFORM_FEE_BP)) / BigInt(10000);

      const tx = await secureFlow
        .connect(feeCollector)
        .withdrawFees(await mockToken.getAddress());

      await expect(tx)
        .to.emit(secureFlow, "FeesWithdrawn")
        .withArgs(
          await mockToken.getAddress(),
          expectedFee,
          feeCollector.address,
        );

      expect(await mockToken.balanceOf(feeCollector.address)).to.equal(
        expectedFee,
      );
      expect(
        await secureFlow.totalFeesByToken(await mockToken.getAddress()),
      ).to.equal(0);
    });

    it("Should fail withdrawal with no fees", async function () {
      await secureFlow
        .connect(feeCollector)
        .withdrawFees(await mockToken.getAddress());

      await expect(
        secureFlow
          .connect(feeCollector)
          .withdrawFees(await mockToken.getAddress()),
      ).to.be.revertedWith("SecureFlow: No fees");
    });
  });

  describe("Emergency Functions", function () {
    it("Should emergency withdraw non-escrowed tokens", async function () {
      // Send some tokens to contract
      await mockToken.transfer(
        await secureFlow.getAddress(),
        ethers.parseEther("100"),
      );

      const tx = await secureFlow.emergencyWithdraw(
        await mockToken.getAddress(),
        ethers.parseEther("50"),
      );

      await expect(tx)
        .to.emit(secureFlow, "EmergencyWithdrawn")
        .withArgs(
          await mockToken.getAddress(),
          ethers.parseEther("50"),
          owner.address,
        );

      // Check that owner received the emergency withdrawal
      const ownerBalance = await mockToken.balanceOf(owner.address);
      expect(ownerBalance).to.be.gt(ethers.parseEther("0"));
    });

    it("Should fail emergency withdraw of escrowed tokens", async function () {
      // Create escrow to lock tokens
      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));
      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          MILESTONE_AMOUNTS,
          MILESTONE_DESCRIPTIONS,
          await mockToken.getAddress(),
          DURATION,
        );

      await expect(
        secureFlow.emergencyWithdraw(
          await mockToken.getAddress(),
          ethers.parseEther("1"),
        ),
      ).to.be.revertedWith("SecureFlow: Insufficient non-escrow balance");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to call admin functions", async function () {
      await expect(
        secureFlow.connect(addr1).setPlatformFeeBP(500),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        secureFlow.connect(addr1).setFeeCollector(addr2.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        secureFlow.connect(addr1).authorizeArbiter(addr3.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should only allow authorized users to withdraw fees", async function () {
      await expect(
        secureFlow.connect(addr1).withdrawFees(await mockToken.getAddress()),
      ).to.be.revertedWith("SecureFlow: Not authorized");
    });
  });

  describe("Pausable", function () {
    it("Should pause and unpause contract", async function () {
      await secureFlow.connect(owner).pause();
      expect(await secureFlow.paused()).to.be.true;

      await secureFlow.connect(owner).unpause();
      expect(await secureFlow.paused()).to.be.false;
    });

    it("Should not allow operations when paused", async function () {
      await secureFlow.connect(owner).pause();

      await mockToken
        .connect(depositor)
        .approve(await secureFlow.getAddress(), ethers.parseEther("10"));

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            beneficiary.address,
            arbiter.address,
            MILESTONE_AMOUNTS,
            MILESTONE_DESCRIPTIONS,
            await mockToken.getAddress(),
            DURATION,
          ),
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});
