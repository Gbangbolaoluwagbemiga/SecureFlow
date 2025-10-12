const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Test Token to Monad Testnet...");

  // Deploy a test ERC20 token for Monad testnet
  const TestToken = await hre.ethers.getContractFactory("MockERC20");
  const testToken = await TestToken.deploy(
    "SecureFlow Test Token",
    "SFTT",
    hre.ethers.parseEther("1000000"), // 1 million tokens
  );

  await testToken.waitForDeployment();

  const tokenAddress = await testToken.getAddress();
  console.log("✅ Test Token deployed to:", tokenAddress);
  console.log("📊 Token Details:");
  console.log("  Name: SecureFlow Test Token");
  console.log("  Symbol: SFTT");
  console.log("  Total Supply: 1,000,000 SFTT");
  console.log("  Decimals: 18");

  // Deploy SecureFlow contract
  console.log("\n🚀 Deploying SecureFlow...");
  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");
  const secureFlow = await SecureFlow.deploy();

  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  console.log("\n🎯 Deployment Summary:");
  console.log("  Test Token:", tokenAddress);
  console.log("  SecureFlow:", secureFlowAddress);
  console.log("  Network: Monad Testnet");

  console.log("\n💡 Next Steps:");
  console.log("1. Get MON tokens from faucet: https://testnet-monad.xyz");
  console.log("2. Use Test Token address in your frontend");
  console.log("3. Start testing your escrow platform!");

  // Save addresses to file for frontend use
  const addresses = {
    testToken: tokenAddress,
    secureFlow: secureFlowAddress,
    network: "monad-testnet",
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
