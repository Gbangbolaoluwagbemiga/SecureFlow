const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Test Token to Monad Testnet...");

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

  // Deploy Test Token only
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
  console.log("  Test Token:", tokenAddress);
  console.log("  Network: Monad Testnet");
  console.log("  Explorer: https://testnet-monad.xyz");

  // Save address
  const addresses = {
    testToken: tokenAddress,
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
  console.log("1. Use both contract addresses in your frontend");
  console.log("2. Start testing your escrow platform!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
