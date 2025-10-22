const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();

  // Deploy MockERC20 token for testing
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy(
    "Mock Token",
    "MTK",
    hre.ethers.parseEther("1000000"),
  );
  await mockToken.waitForDeployment();

  // Deploy SecureFlow
  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");

  // Constructor parameters: monadToken, feeCollector, platformFeeBP
  const feeCollector = deployer.address; // Use deployer as fee collector for now
  const platformFeeBP = 0; // 0% fees for hackathon demo

  const secureFlow = await SecureFlow.deploy(
    await mockToken.getAddress(), // monadToken
    feeCollector, // feeCollector
    platformFeeBP, // platformFeeBP
  );
  await secureFlow.waitForDeployment();

  // Authorize some arbiters for testing
  const arbiters = [
    "0x3be7fbbdbc73fc4731d60ef09c4ba1a94dc58e41", // Your arbiter address
    "0xF1E430aa48c3110B2f223f278863A4c8E2548d8C", // Another arbiter address
  ];

  for (const arbiterAddress of arbiters) {
    await secureFlow.authorizeArbiter(arbiterAddress);
  }

  // Whitelist the mock token
  await secureFlow.whitelistToken(await mockToken.getAddress());

  // Get contract info
  const contractInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      SecureFlow: await secureFlow.getAddress(),
      MockERC20: await mockToken.getAddress(),
    },
    features: [
      "🚀 MODULAR ARCHITECTURE - Clean separation of concerns",
      "⚖️ MULTI-ARBITER CONSENSUS - Quorum-based voting",
      "🏆 REPUTATION SYSTEM - Anti-gaming guards",
      "📊 JOB APPLICATIONS - Pagination support",
      "🔒 ENTERPRISE SECURITY - Modular design",
      "💰 NATIVE & ERC20 SUPPORT - Permit integration",
      "⏰ AUTO-APPROVAL - Dispute window management",
      "🛡️ ANTI-GAMING - Minimum value thresholds",
      "📈 SCALABLE - Gas optimized modular design",
    ],
    deploymentTime: new Date().toISOString(),
  };

  // Save deployment info
  const deploymentInfo = {
    ...contractInfo,
    abi: secureFlow.interface.format("json"),
    mockTokenAbi: mockToken.interface.format("json"),
  };

  fs.writeFileSync(
    "deployed.json",
    JSON.stringify(
      deploymentInfo,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.exit(1);
  });
