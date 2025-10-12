const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying new SecureFlow contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  // Deploy MockERC20 first
  console.log("\n📦 Deploying MockERC20...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy(
    "SecureFlow Test Token",
    "SFTT",
    ethers.parseEther("1000000"), // 1M tokens
  );
  await mockToken.waitForDeployment();
  const tokenAddress = await mockToken.getAddress();
  console.log("✅ MockERC20 deployed to:", tokenAddress);

  // Deploy SecureFlow with new constructor
  console.log("\n🔒 Deploying SecureFlow...");
  const SecureFlow = await ethers.getContractFactory("SecureFlow");

  // Constructor parameters
  const monadToken = tokenAddress; // Use our test token as "monad token"
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

  // Whitelist the test token
  const whitelistTx = await secureFlow.whitelistToken(tokenAddress);
  await whitelistTx.wait();
  console.log("✅ Whitelisted test token");

  // Get contract info
  console.log("\n📊 Contract Information:");
  console.log("Monad Token:", await secureFlow.monadToken());
  console.log("Fee Collector:", await secureFlow.feeCollector());
  console.log("Platform Fee BP:", await secureFlow.platformFeeBP());
  console.log("Next Escrow ID:", await secureFlow.nextEscrowId());

  // Save deployment info
  const deploymentInfo = {
    secureFlow: secureFlowAddress,
    testToken: tokenAddress,
    network: "monad-testnet",
    chainId: 10143,
    explorer: "https://testnet-monad.xyz",
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
      TestToken: {
        address: tokenAddress,
        description: "SecureFlow Test Token (SFTT)",
        features: ["ERC20 standard", "1M token supply", "18 decimals"],
      },
    },
  };

  // Write deployment info to file
  const fs = require("fs");
  fs.writeFileSync(
    "deployed-addresses-new.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log("\n💾 Deployment info saved to deployed-addresses-new.json");

  // Extract ABI
  console.log("\n📋 Extracting ABI...");
  const secureFlowABI = await secureFlow.interface.format("json");
  const tokenABI = await mockToken.interface.format("json");

  const abiInfo = {
    SecureFlow: JSON.parse(secureFlowABI),
    TestToken: JSON.parse(tokenABI),
    deploymentInfo: deploymentInfo,
  };

  fs.writeFileSync("contracts-abi-new.json", JSON.stringify(abiInfo, null, 2));
  console.log("✅ ABI saved to contracts-abi-new.json");

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Verify contracts on Monad Explorer");
  console.log("2. Update frontend with new contract addresses");
  console.log("3. Test the new features (native MON, permits, etc.)");
  console.log("4. Run comprehensive tests");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });


