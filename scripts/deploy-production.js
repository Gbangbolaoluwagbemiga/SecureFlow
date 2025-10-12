const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SecureFlow for production...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  // Deploy SecureFlow without MockERC20 (production deployment)
  console.log("\n🔒 Deploying SecureFlow...");
  const SecureFlow = await ethers.getContractFactory("SecureFlow");

  // Constructor parameters for production
  const monadToken = ethers.ZeroAddress; // No specific MON token wrapper
  const feeCollector = deployer.address; // Use deployer as fee collector
  const platformFeeBP = 250; // 2.5% platform fee

  const secureFlow = await SecureFlow.deploy(
    monadToken,
    feeCollector,
    platformFeeBP,
  );
  await secureFlow.waitForDeployment();
  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  // Setup the contract
  console.log("\n⚙️ Setting up SecureFlow...");

  // Authorize deployer as arbiter
  const authTx = await secureFlow.authorizeArbiter(deployer.address);
  await authTx.wait();
  console.log("✅ Authorized deployer as arbiter");

  // Get contract info
  console.log("\n📊 Contract Information:");
  console.log("Monad Token:", await secureFlow.monadToken());
  console.log("Fee Collector:", await secureFlow.feeCollector());
  console.log("Platform Fee BP:", await secureFlow.platformFeeBP());
  console.log("Next Escrow ID:", await secureFlow.nextEscrowId());

  // Save deployment info
  const deploymentInfo = {
    secureFlow: secureFlowAddress,
    network: "monad-testnet",
    chainId: 10143,
    explorer: "https://testnet-explorer.monad.xyz",
    deploymentDate: new Date().toISOString(),
    contracts: {
      SecureFlow: {
        address: secureFlowAddress,
        description:
          "Advanced milestone-based escrow platform with native MON support",
        features: [
          "Native MON support",
          "ERC20 permit support (EIP-2612)",
          "Platform fees with fee collector",
          "Arbiter authorization system",
          "Token whitelisting",
          "Emergency refund mechanisms",
          "Deadline extension",
          "Enhanced dispute resolution",
          "SafeERC20 transfers",
          "Pausable functionality",
        ],
      },
    },
  };

  // Write deployment info to file
  const fs = require("fs");
  fs.writeFileSync(
    "deployed-addresses-production.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log(
    "\n💾 Deployment info saved to deployed-addresses-production.json",
  );

  // Extract ABI
  console.log("\n📋 Extracting ABI...");
  const secureFlowABI = await secureFlow.interface.format("json");

  const abiInfo = {
    SecureFlow: JSON.parse(secureFlowABI),
    deploymentInfo: deploymentInfo,
  };

  fs.writeFileSync(
    "contracts-abi-production.json",
    JSON.stringify(abiInfo, null, 2),
  );
  console.log("✅ ABI saved to contracts-abi-production.json");

  console.log("\n🎉 Production deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Verify contracts on Monad Explorer");
  console.log("2. Update frontend with new contract addresses");
  console.log("3. Test the new features (native MON, permits, etc.)");
  console.log("4. Whitelist any ERC20 tokens you want to support");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

