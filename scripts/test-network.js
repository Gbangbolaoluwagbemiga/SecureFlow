const hre = require("hardhat");

async function main() {
  console.log("🔍 Testing Monad Testnet Connection...");

  try {
    // Test network connection
    const network = await hre.ethers.provider.getNetwork();
    console.log(
      "✅ Network connected:",
      network.name,
      "Chain ID:",
      network.chainId.toString(),
    );

    // Test account access
    const accounts = await hre.ethers.getSigners();
    console.log("✅ Accounts found:", accounts.length);

    if (accounts.length > 0) {
      const deployer = accounts[0];
      console.log("✅ Deployer address:", deployer.address);

      // Check balance
      const balance = await hre.ethers.provider.getBalance(deployer.address);
      console.log("💰 Balance:", hre.ethers.formatEther(balance), "MON");

      if (balance === 0n) {
        console.log(
          "❌ No MON tokens! Get testnet tokens from: https://testnet-monad.xyz",
        );
      } else {
        console.log("✅ Ready to deploy!");
      }
    } else {
      console.log("❌ No accounts found. Check your private key in .env");
    }
  } catch (error) {
    console.error("❌ Network connection failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
