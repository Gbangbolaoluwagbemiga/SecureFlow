const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();

  console.log("🚀 Deploying SecureFlow Token to", hre.network.name);
  console.log("📝 Deployer address:", deployer.address);
  console.log("💰 Initial supply: 1,000,000,000 STK (1 billion)");

  // Deploy SecureFlowToken
  console.log("\n📦 Deploying SecureFlowToken...");
  const SecureFlowToken = await hre.ethers.getContractFactory(
    "SecureFlowToken"
  );
  const token = await SecureFlowToken.deploy(deployer.address);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  // Wait for deployment confirmation
  console.log("⏳ Waiting for deployment confirmation...");
  await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

  // Get contract info
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const totalSupply = await token.totalSupply();

  console.log("\n🎉 Token deployment completed successfully!");
  console.log("📄 Token deployed to:", tokenAddress);
  console.log("🏷️  Name:", tokenName);
  console.log("🔤 Symbol:", tokenSymbol);
  console.log(
    "💰 Total Supply:",
    hre.ethers.formatEther(totalSupply),
    tokenSymbol
  );
  console.log("📊 Network:", hre.network.name);
  console.log("🔗 Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    token: {
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      totalSupply: totalSupply.toString(),
    },
    deploymentTime: new Date().toISOString(),
  };

  // Read existing deployed.json if it exists
  let existingData = {};
  if (fs.existsSync("deployed.json")) {
    try {
      existingData = JSON.parse(fs.readFileSync("deployed.json", "utf8"));
    } catch (e) {
      console.log("⚠️ Could not read existing deployed.json");
    }
  }

  // Merge token info into existing deployment data
  const updatedData = {
    ...existingData,
    SecureFlowToken: deploymentInfo.token,
  };

  fs.writeFileSync(
    "deployed.json",
    JSON.stringify(
      updatedData,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );

  console.log("📝 Token deployment info saved to deployed.json");

  // Wait for block confirmations before verification
  console.log("\n⏳ Waiting for block confirmations before verification...");
  await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

  // Verify token contract
  console.log("\n🔍 Verifying SecureFlowToken contract...");
  try {
    await hre.run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [deployer.address],
    });
    console.log("✅ SecureFlowToken contract verified!");
  } catch (error) {
    console.log("⚠️ SecureFlowToken verification failed:", error.message);
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️ Contract is already verified");
    }
  }

  // Display explorer links
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  let explorerUrl = "";
  if (chainId === 8453) {
    explorerUrl = "https://basescan.org/address/";
  } else if (chainId === 84532) {
    explorerUrl = "https://sepolia.basescan.org/address/";
  }

  if (explorerUrl) {
    console.log("\n🔗 Explorer Link:");
    console.log(`   SecureFlowToken: ${explorerUrl}${tokenAddress}`);
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Whitelist this token in SecureFlow contract:");
  console.log(`      secureFlow.whitelistToken("${tokenAddress}")`);
  console.log("   2. Update frontend config with token address");
}

main()
  .then(() => {
    console.log("\n✅ Token deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Token deployment failed:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  });
