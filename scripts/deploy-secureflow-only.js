const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SecureFlow to Monad Testnet...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MON");

  if (balance === 0n) {
    console.log(
      "❌ No MON tokens found! Please get testnet tokens from: https://testnet-monad.xyz",
    );
    return;
  }

  // Deploy SecureFlow only
  console.log("\n🚀 Deploying SecureFlow...");
  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");
  const secureFlow = await SecureFlow.deploy();

  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  console.log("\n🎯 Deployment Summary:");
  console.log("  SecureFlow:", secureFlowAddress);
  console.log("  Network: Monad Testnet");
  console.log("  Explorer: https://testnet-monad.xyz");

  // Save address
  const addresses = {
    secureFlow: secureFlowAddress,
    network: "monad-testnet",
    explorer: "https://testnet-monad.xyz",
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(addresses, null, 2),
  );
  console.log("\n📄 Address saved to: deployed-addresses.json");

  console.log("\n💡 Next Steps:");
  console.log("1. Get more MON tokens from faucet: https://testnet-monad.xyz");
  console.log("2. Deploy test token separately");
  console.log("3. Start testing your escrow platform!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
