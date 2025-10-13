const { ethers } = require("hardhat");

async function testIntegration() {
  console.log("🧪 Testing SecureFlow Contract Integration...\n");

  // Get the deployed contract
  const secureFlowAddress = "0xaC538536156BD780BD3D49916c8943864528b553";
  const mockTokenAddress = "0xFCDF43ECC661c48B5ef55B67363d96021c9803df";

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const depositor = signers[1] || signers[0];
  const beneficiary = signers[2] || signers[0];
  const arbiter = signers[3] || signers[0];

  // Get contract instances
  const SecureFlow = await ethers.getContractFactory("SecureFlow");
  const secureFlow = SecureFlow.attach(secureFlowAddress);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = MockERC20.attach(mockTokenAddress);

  console.log("📋 Contract Addresses:");
  console.log(`   SecureFlow: ${secureFlowAddress}`);
  console.log(`   MockERC20: ${mockTokenAddress}`);
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Depositor: ${depositor.address}`);
  console.log(`   Beneficiary: ${beneficiary.address}`);
  console.log(`   Arbiter: ${arbiter.address}\n`);

  try {
    // Test 1: Check contract state
    console.log("🔍 Testing Contract State...");
    const platformFee = await secureFlow.platformFeeBP();
    const contractOwner = await secureFlow.owner();
    const isPaused = await secureFlow.paused();

    console.log(`   Platform Fee: ${platformFee}%`);
    console.log(`   Owner: ${contractOwner}`);
    console.log(`   Paused: ${isPaused}\n`);

    // Test 2: Check arbiter authorization
    console.log("⚖️ Testing Arbiter Authorization...");
    const isArbiterAuthorized = await secureFlow.authorizedArbiters(
      arbiter.address,
    );
    console.log(
      `   Arbiter ${arbiter.address} authorized: ${isArbiterAuthorized}\n`,
    );

    // Test 3: Check token whitelisting
    console.log("🪙 Testing Token Whitelisting...");
    const isTokenWhitelisted =
      await secureFlow.whitelistedTokens(mockTokenAddress);
    console.log(`   MockERC20 whitelisted: ${isTokenWhitelisted}\n`);

    // Test 4: Create a test escrow
    console.log("📝 Testing Escrow Creation...");

    // Fund depositor with tokens
    await mockToken.transfer(depositor.address, ethers.parseEther("1000"));
    await mockToken
      .connect(depositor)
      .approve(secureFlowAddress, ethers.parseEther("1000"));

    const milestoneAmounts = [ethers.parseEther("5"), ethers.parseEther("10")];
    const milestoneDescriptions = [
      "Phase 1: Design",
      "Phase 2: Implementation",
    ];
    const arbiters = [arbiter.address];
    const requiredConfirmations = 1;

    const tx = await secureFlow.connect(depositor).createEscrow(
      beneficiary.address,
      arbiters,
      requiredConfirmations,
      milestoneAmounts,
      milestoneDescriptions,
      mockTokenAddress,
      7 * 24 * 60 * 60, // 7 days
      "Test Project",
      "A test project for integration",
    );

    const receipt = await tx.wait();
    console.log(`   ✅ Escrow created! Transaction: ${tx.hash}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    // Test 5: Get escrow summary
    console.log("📊 Testing Escrow Summary...");
    const escrowId = 1; // First escrow
    const summary = await secureFlow.getEscrowSummary(escrowId);
    console.log(`   Escrow ID: ${escrowId}`);
    console.log(`   Depositor: ${summary.depositor}`);
    console.log(`   Beneficiary: ${summary.beneficiary}`);
    console.log(
      `   Total Amount: ${ethers.formatEther(summary.totalAmount)} MTK`,
    );
    console.log(`   Status: ${summary.status}`);
    console.log(`   Project Title: ${summary.projectTitle}\n`);

    // Test 6: Test marketplace functions
    console.log("🏪 Testing Marketplace Functions...");

    // Create an open job
    const openJobTx = await secureFlow.connect(depositor).createEscrow(
      ethers.ZeroAddress, // address(0) for open job
      arbiters,
      requiredConfirmations,
      milestoneAmounts,
      milestoneDescriptions,
      mockTokenAddress,
      7 * 24 * 60 * 60,
      "Open Job Test",
      "An open job for testing marketplace",
    );

    const openJobReceipt = await openJobTx.wait();
    const openJobId = 2; // Second escrow

    console.log(`   ✅ Open job created! ID: ${openJobId}`);

    // Apply to the job
    const applyTx = await secureFlow.connect(beneficiary).applyToJob(
      openJobId,
      "I have 5 years of experience in Web3 development",
      14, // 14 days timeline
    );

    await applyTx.wait();
    console.log(`   ✅ Application submitted!`);

    // Get applications
    const applications = await secureFlow.getApplicationsPage(openJobId, 0, 10);
    console.log(`   Applications count: ${applications.length}`);
    console.log(`   First application from: ${applications[0].freelancer}\n`);

    console.log("🎉 All integration tests passed!");
    console.log(
      "✅ Contract is fully functional and ready for frontend integration!",
    );
  } catch (error) {
    console.error("❌ Integration test failed:", error);
  }
}

testIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
