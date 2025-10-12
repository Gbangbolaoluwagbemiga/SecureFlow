const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SecureFlow...");

  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");
  const secureFlow = await SecureFlow.deploy();

  await secureFlow.waitForDeployment();

  const address = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", address);

  console.log("🎯 Contract ready for hackathon demo!");
  console.log("📊 Features:");
  console.log("  - Milestone-based escrow");
  console.log("  - Dispute resolution");
  console.log("  - MetaMask Smart Accounts delegation");
  console.log("  - Envio indexing ready");

  // Verify contract on Monad testnet
  if (hre.network.name === "monad") {
    console.log("🔍 Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Monad testnet");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
