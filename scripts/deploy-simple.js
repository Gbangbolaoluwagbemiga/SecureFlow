const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying to Monad Testnet...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MON");

  if (balance === 0n) {
    console.log(
      "❌ No MON tokens found! Please get testnet tokens from: https://testnet-monad.xyz",
    );
    return;
  }

  // Deploy SecureFlow
  console.log("\n🚀 Deploying SecureFlow...");
  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");
  const secureFlow = await SecureFlow.deploy();

  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  // Deploy Test Token
  console.log("\n🚀 Deploying Test Token...");
  const TestToken = await hre.ethers.getContractFactory("MockERC20");
  const testToken = await TestToken.deploy(
    "SecureFlow Test Token",
    "SFTT",
    hre.ethers.parseEther("1000000"),
  );

  await testToken.waitForDeployment();

  const tokenAddress = await testToken.getAddress();
  console.log("✅ Test Token deployed to:", tokenAddress);

  console.log("\n🎯 Deployment Summary:");
  console.log("  SecureFlow:", secureFlowAddress);
  console.log("  Test Token:", tokenAddress);
  console.log("  Network: Monad Testnet");
  console.log("  Explorer: https://testnet-monad.xyz");

  // Save addresses
  const addresses = {
    secureFlow: secureFlowAddress,
    testToken: tokenAddress,
    network: "monad-testnet",
    explorer: "https://testnet-monad.xyz",
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(addresses, null, 2),
  );
  console.log("\n📄 Addresses saved to: deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
