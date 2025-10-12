const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SecureFlow", function () {
  let secureFlow;
  let owner;
  let depositor;
  let beneficiary;
  let arbiter;
  let token;
  let otherAccounts;

  beforeEach(async function () {
    [owner, depositor, beneficiary, arbiter, ...otherAccounts] =
      await ethers.getSigners();

    // Deploy a mock ERC20 token for testing
    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy(
      "Test Token",
      "TT",
      ethers.parseEther("1000000"),
    );
    await token.waitForDeployment();

    // Deploy SecureFlow contract
    const SecureFlow = await ethers.getContractFactory("SecureFlow");
    secureFlow = await SecureFlow.deploy();
    await secureFlow.waitForDeployment();

    // Transfer tokens to depositor
    await token.transfer(depositor.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await secureFlow.owner()).to.equal(owner.address);
    });

    it("Should initialize with nextEscrowId as 1", async function () {
      expect(await secureFlow.nextEscrowId()).to.equal(1);
    });
  });

  describe("Creating Escrow", function () {
    it("Should create escrow successfully", async function () {
      const milestoneAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
      ];
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const duration = 7 * 24 * 60 * 60; // 7 days

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("300"));

      const tx = await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "EscrowCreated",
      );

      expect(event).to.not.be.undefined;
      expect(await secureFlow.nextEscrowId()).to.equal(2);
    });

    it("Should revert if beneficiary is zero address", async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            ethers.ZeroAddress,
            arbiter.address,
            milestoneAmounts,
            milestoneDescriptions,
            token.target,
            7 * 24 * 60 * 60,
          ),
      ).to.be.revertedWith("Invalid beneficiary");
    });

    it("Should revert if depositor tries to escrow to self", async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];

      await expect(
        secureFlow
          .connect(depositor)
          .createEscrow(
            depositor.address,
            arbiter.address,
            milestoneAmounts,
            milestoneDescriptions,
            token.target,
            7 * 24 * 60 * 60,
          ),
      ).to.be.revertedWith("Cannot escrow to self");
    });

    it("Should revert if duration is too short", async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];

      await expect(
        secureFlow.connect(depositor).createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          30 * 60, // 30 minutes (less than 1 hour)
        ),
      ).to.be.revertedWith("Invalid duration");
    });

    it("Should revert if duration is too long", async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];

      await expect(
        secureFlow.connect(depositor).createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          400 * 24 * 60 * 60, // 400 days (more than 365 days)
        ),
      ).to.be.revertedWith("Invalid duration");
    });
  });

  describe("Work Flow", function () {
    let escrowId;

    beforeEach(async function () {
      const milestoneAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
      ];
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const duration = 7 * 24 * 60 * 60;

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("300"));

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      escrowId = 1;
    });

    it("Should allow beneficiary to start work", async function () {
      const tx = await secureFlow.connect(beneficiary).startWork(escrowId);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "WorkStarted",
      );

      expect(event).to.not.be.undefined;

      const escrow = await secureFlow.getEscrow(escrowId);
      expect(escrow.workStarted).to.be.true;
      expect(escrow.status).to.equal(1); // InProgress
    });

    it("Should revert if non-beneficiary tries to start work", async function () {
      await expect(
        secureFlow.connect(depositor).startWork(escrowId),
      ).to.be.revertedWith("Only beneficiary");
    });

    it("Should revert if work already started", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      await expect(
        secureFlow.connect(beneficiary).startWork(escrowId),
      ).to.be.revertedWith("Invalid status");
    });
  });

  describe("Milestone Management", function () {
    let escrowId;

    beforeEach(async function () {
      const milestoneAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
      ];
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const duration = 7 * 24 * 60 * 60;

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("300"));

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      escrowId = 1;
      await secureFlow.connect(beneficiary).startWork(escrowId);
    });

    it("Should allow beneficiary to submit milestone", async function () {
      const tx = await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Updated description");

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "MilestoneSubmitted",
      );

      expect(event).to.not.be.undefined;

      const milestone = await secureFlow.getMilestone(escrowId, 0);
      expect(milestone.status).to.equal(1); // Submitted
    });

    it("Should allow depositor to approve milestone", async function () {
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Description");

      const initialBalance = await token.balanceOf(beneficiary.address);

      const tx = await secureFlow
        .connect(depositor)
        .approveMilestone(escrowId, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "MilestoneApproved",
      );

      expect(event).to.not.be.undefined;

      const finalBalance = await token.balanceOf(beneficiary.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("100"));
    });

    it("Should allow depositor to dispute milestone", async function () {
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Description");

      const tx = await secureFlow
        .connect(depositor)
        .disputeMilestone(escrowId, 0, "Quality issues");

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "MilestoneDisputed",
      );

      expect(event).to.not.be.undefined;

      const milestone = await secureFlow.getMilestone(escrowId, 0);
      expect(milestone.status).to.equal(3); // Disputed
    });

    it("Should allow arbiter to resolve dispute", async function () {
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Description");
      await secureFlow
        .connect(depositor)
        .disputeMilestone(escrowId, 0, "Quality issues");

      const tx = await secureFlow.connect(arbiter).resolveDispute(
        escrowId,
        0,
        ethers.parseEther("50"), // Pay 50% to beneficiary
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "DisputeResolved",
      );

      expect(event).to.not.be.undefined;

      const milestone = await secureFlow.getMilestone(escrowId, 0);
      expect(milestone.status).to.equal(2); // Approved
    });
  });

  describe("Refund Functionality", function () {
    let escrowId;

    beforeEach(async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];
      const duration = 7 * 24 * 60 * 60;

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("100"));

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      escrowId = 1;
    });

    it("Should allow depositor to refund before work starts", async function () {
      const initialBalance = await token.balanceOf(depositor.address);

      const tx = await secureFlow.connect(depositor).refundEscrow(escrowId);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "FundsRefunded",
      );

      expect(event).to.not.be.undefined;

      const finalBalance = await token.balanceOf(depositor.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("100"));

      const escrow = await secureFlow.getEscrow(escrowId);
      expect(escrow.status).to.equal(3); // Refunded
    });

    it("Should revert if beneficiary tries to refund", async function () {
      await expect(
        secureFlow.connect(beneficiary).refundEscrow(escrowId),
      ).to.be.revertedWith("Only depositor");
    });

    it("Should revert if work has started", async function () {
      await secureFlow.connect(beneficiary).startWork(escrowId);

      await expect(
        secureFlow.connect(depositor).refundEscrow(escrowId),
      ).to.be.revertedWith("Invalid status");
    });
  });

  describe("Access Control", function () {
    let escrowId;

    beforeEach(async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      const milestoneDescriptions = ["Milestone 1"];
      const duration = 7 * 24 * 60 * 60;

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("100"));

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      escrowId = 1;
    });

    it("Should allow only owner to pause", async function () {
      await secureFlow.pause();
      expect(await secureFlow.paused()).to.be.true;
    });

    it("Should revert if non-owner tries to pause", async function () {
      await expect(secureFlow.connect(depositor).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should revert operations when paused", async function () {
      await secureFlow.pause();

      await expect(
        secureFlow.connect(beneficiary).startWork(escrowId),
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple escrows correctly", async function () {
      const milestoneAmounts = [ethers.parseEther("50")];
      const milestoneDescriptions = ["Milestone 1"];

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("100"));

      // Create first escrow
      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          7 * 24 * 60 * 60,
        );

      // Create second escrow
      await secureFlow
        .connect(depositor)
        .createEscrow(
          otherAccounts[0].address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          7 * 24 * 60 * 60,
        );

      expect(await secureFlow.nextEscrowId()).to.equal(3);

      const userEscrows = await secureFlow.getUserEscrows(depositor.address);
      expect(userEscrows.length).to.equal(2);
    });

    it("Should complete escrow when all milestones are approved", async function () {
      const milestoneAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
      ];
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const duration = 7 * 24 * 60 * 60;

      await token
        .connect(depositor)
        .approve(secureFlow.target, ethers.parseEther("300"));

      await secureFlow
        .connect(depositor)
        .createEscrow(
          beneficiary.address,
          arbiter.address,
          milestoneAmounts,
          milestoneDescriptions,
          token.target,
          duration,
        );

      const escrowId = 1;
      await secureFlow.connect(beneficiary).startWork(escrowId);

      // Submit and approve first milestone
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 0, "Description 1");
      await secureFlow.connect(depositor).approveMilestone(escrowId, 0);

      // Submit and approve second milestone
      await secureFlow
        .connect(beneficiary)
        .submitMilestone(escrowId, 1, "Description 2");
      await secureFlow.connect(depositor).approveMilestone(escrowId, 1);

      const escrow = await secureFlow.getEscrow(escrowId);
      expect(escrow.status).to.equal(2); // Released
    });
  });
});

// Mock ERC20 token for testing
describe("MockERC20", function () {
  it("Should deploy successfully", async function () {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy(
      "Test Token",
      "TT",
      ethers.parseEther("1000000"),
    );
    await token.waitForDeployment();

    expect(await token.name()).to.equal("Test Token");
    expect(await token.symbol()).to.equal("TT");
    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));
  });
});
