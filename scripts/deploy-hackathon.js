const { ethers } = require("hardhat");

async function main() {
  console.log("🏆 Deploying SecureFlow for Hackathon Demo...");
  console.log("💰 NO FEES - Pure value demonstration!");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");

  if (balance < ethers.parseEther("0.05")) {
    console.log("❌ Insufficient balance! Please get more MON tokens from:");
    console.log("🔗 https://testnet-faucet.monad.xyz/");
    console.log("📍 Your address:", deployer.address);
    return;
  }

  console.log("\n🔒 Deploying SecureFlow (Hackathon Optimized)...");
  const SecureFlow = await ethers.getContractFactory("SecureFlow");

  // Hackathon optimization: NO FEES!
  const monadToken = ethers.ZeroAddress;
  const feeCollector = deployer.address;
  const platformFeeBP = 0; // 0% fees for demo

  const secureFlow = await SecureFlow.deploy(
    monadToken,
    feeCollector,
    platformFeeBP,
  );
  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  console.log("\n⚙️ Setting up for hackathon demo...");

  // Authorize deployer as arbiter
  const authTx = await secureFlow.authorizeArbiter(deployer.address);
  await authTx.wait();
  console.log("✅ Authorized deployer as arbiter");

  // Whitelist a test ERC20 token (if you have one)
  // This is optional - native MON is always supported
  console.log("✅ Native MON support enabled (no whitelist needed)");

  const deploymentInfo = {
    secureFlow: secureFlowAddress,
    network: "monad-testnet",
    chainId: 10143,
    explorer: "https://testnet-explorer.monad.xyz",
    deploymentDate: new Date().toISOString(),
    hackathonOptimized: true,
    feesDisabled: true,
    contracts: {
      SecureFlow: {
        address: secureFlowAddress,
        description: "Hackathon-optimized escrow platform - NO FEES!",
        features: [
          "🚀 NO PLATFORM FEES - Pure value demo",
          "💰 Native MON support",
          "🔒 Advanced security features",
          "⚖️ Dispute resolution",
          "📊 Milestone tracking",
          "🛡️ Safe token handling",
          "⏰ Deadline management",
          "🔄 Emergency functions",
        ],
        hackathonNotes: [
          "Fees disabled for demo - focus on user experience",
          "All security features enabled",
          "Ready for production after hackathon",
          "Revenue model: 0.5-1% fees post-launch",
        ],
      },
    },
  };

  console.log("\n💾 Saving hackathon deployment info...");
  const fs = require("fs");
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log("✅ deployed-addresses.json updated");

  const secureFlowABI = await secureFlow.interface.format("json");
  const abiInfo = {
    SecureFlow: JSON.parse(secureFlowABI),
    deploymentInfo: deploymentInfo,
  };

  fs.writeFileSync("contracts-abi.json", JSON.stringify(abiInfo, null, 2));
  console.log("✅ contracts-abi.json updated");

  console.log("\n🔄 Updating frontend for hackathon demo...");

  // Update frontend config
  const frontendConfigPath = "Frontend/lib/web3/config.ts";
  if (fs.existsSync(frontendConfigPath)) {
    const configContent = `export const MONAD_TESTNET = {
  chainId: "0x279F", // 10143 in hex (Monad Testnet)
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet-explorer.monad.xyz"],
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  SECUREFLOW_ESCROW: "${secureFlowAddress}",
  MOCK_ERC20: "0x0000000000000000000000000000000000000000", // No mock token needed
};

// Hackathon Demo Configuration
export const HACKATHON_CONFIG = {
  feesDisabled: true,
  platformFeeBP: 0,
  demoMode: true,
  testnetOnly: true
};
`;
    fs.writeFileSync(frontendConfigPath, configContent);
    console.log("✅ Frontend config updated for hackathon");
  }

  console.log("\n📊 Contract Information:");
  console.log("Owner:", await secureFlow.owner());
  console.log("Fee Collector:", await secureFlow.feeCollector());
  console.log(
    "Platform Fee BP:",
    await secureFlow.platformFeeBP(),
    "(0% - NO FEES!)",
  );
  console.log("Next Escrow ID:", await secureFlow.nextEscrowId());
  console.log("Paused:", await secureFlow.paused());

  console.log("\n🎉 Hackathon deployment completed successfully!");
  console.log("\n🏆 HACKATHON DEMO READY!");
  console.log("\n📝 Demo Features:");
  console.log("✅ NO PLATFORM FEES - Pure value demonstration");
  console.log("✅ Native MON support - Use testnet MON tokens");
  console.log("✅ Advanced security - All production features");
  console.log("✅ Dispute resolution - Fair arbitration system");
  console.log("✅ Milestone tracking - Complete project lifecycle");

  console.log("\n🔗 Contract Explorer:");
  console.log(
    `https://testnet-explorer.monad.xyz/address/${secureFlowAddress}`,
  );

  console.log("\n💡 Hackathon Strategy:");
  console.log("🎯 Focus on user experience - no fee friction");
  console.log("📈 Show real TVL and usage - not revenue");
  console.log("🚀 Demonstrate value - monetization comes later");
  console.log("🏆 Win with features - not fees!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
