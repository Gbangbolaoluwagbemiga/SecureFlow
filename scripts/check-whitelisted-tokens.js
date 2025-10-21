const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Checking whitelisted tokens...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get the contract addresses from deployed.json
  const deployedInfo = require("../deployed.json");
  const secureFlowAddress = deployedInfo.contracts.SecureFlow;
  const mockTokenAddress = deployedInfo.contracts.MockERC20;

  console.log("SecureFlow Address:", secureFlowAddress);
  console.log("MockERC20 Address:", mockTokenAddress);

  // Get the SecureFlow contract
  const SecureFlow = await hre.ethers.getContractFactory("SecureFlow");
  const secureFlow = SecureFlow.attach(secureFlowAddress);

  try {
    // Check if our MockERC20 is whitelisted
    const isMockTokenWhitelisted =
      await secureFlow.whitelistedTokens(mockTokenAddress);
    console.log("MockERC20 whitelisted:", isMockTokenWhitelisted);

    // Check if the old MockERC20 is whitelisted
    const oldMockTokenAddress = "0xFE0F1320a49C5Ec0A341fef1f1e38de2E05Ff628";
    const isOldMockTokenWhitelisted =
      await secureFlow.whitelistedTokens(oldMockTokenAddress);
    console.log("Old MockERC20 whitelisted:", isOldMockTokenWhitelisted);

    // Check if native token (address(0)) is whitelisted
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const isNativeTokenWhitelisted =
      await secureFlow.whitelistedTokens(zeroAddress);
    console.log(
      "Native token (address(0)) whitelisted:",
      isNativeTokenWhitelisted,
    );

    console.log("\n=== Summary ===");
    console.log(
      "✅ Use MockERC20:",
      mockTokenAddress,
      "- Whitelisted:",
      isMockTokenWhitelisted,
    );
    console.log(
      "❌ Old MockERC20:",
      oldMockTokenAddress,
      "- Whitelisted:",
      isOldMockTokenWhitelisted,
    );
    console.log(
      "❌ Native token:",
      zeroAddress,
      "- Whitelisted:",
      isNativeTokenWhitelisted,
    );

    if (!isMockTokenWhitelisted) {
      console.log("\n⚠️  MockERC20 is NOT whitelisted! This is the problem.");
    } else {
      console.log(
        "\n✅ MockERC20 is whitelisted. The issue might be that you're using a different token address.",
      );
    }
  } catch (error) {
    console.error("Error checking whitelisted tokens:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
