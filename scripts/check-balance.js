const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Checking account balance...");

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  const balanceInEth = ethers.formatEther(balance);

  console.log("Balance:", balanceInEth, "MON");

  if (balance < ethers.parseEther("0.1")) {
    console.log("\n❌ Insufficient balance for deployment!");
    console.log(
      "🔗 Get more MON tokens from: https://testnet-faucet.monad.xyz/",
    );
    console.log("📍 Your address:", deployer.address);
  } else {
    console.log("✅ Sufficient balance for deployment!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
