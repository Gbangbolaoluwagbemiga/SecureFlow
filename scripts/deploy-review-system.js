const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();

  // Get the SecureFlow address from deployed.json or use provided address
  let secureFlowAddress;
  try {
    const deployedInfo = require("../deployed.json");
    secureFlowAddress = deployedInfo.contracts.SecureFlow;
    console.log(
      "Using SecureFlow address from deployed.json:",
      secureFlowAddress
    );
  } catch (error) {
    // If deployed.json doesn't exist, use the Base mainnet address
    secureFlowAddress = "0x8084cDAfEB15D0C8D7F14dd88cfC3d123804A4d7";
    console.log("Using default SecureFlow address:", secureFlowAddress);
  }

  // Deploy ReviewSystem (use fully qualified name to avoid conflict with modules/ReviewSystem.sol)
  const ReviewSystem = await hre.ethers.getContractFactory(
    "contracts/ReviewSystem.sol:ReviewSystem"
  );
  const reviewSystem = await ReviewSystem.deploy(secureFlowAddress);
  await reviewSystem.waitForDeployment();

  const reviewSystemAddress = await reviewSystem.getAddress();

  console.log("\n=== ReviewSystem Deployment Summary ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("SecureFlow Address:", secureFlowAddress);
  console.log("ReviewSystem Address:", reviewSystemAddress);

  // Verify contract on BaseScan if deploying to Base
  if (hre.network.name === "base") {
    console.log("\n=== Verifying ReviewSystem Contract ===");

    try {
      console.log("Verifying ReviewSystem...");
      await hre.run("verify:verify", {
        address: reviewSystemAddress,
        constructorArguments: [secureFlowAddress],
      });
      console.log("✅ ReviewSystem verified successfully!");
      console.log(
        `View on BaseScan: https://basescan.org/address/${reviewSystemAddress}#code`
      );
    } catch (error) {
      console.log("⚠️ ReviewSystem verification failed:", error.message);
    }
  }

  // Update deployed.json with ReviewSystem address
  let deploymentInfo = {};
  try {
    deploymentInfo = require("../deployed.json");
  } catch (error) {
    // If file doesn't exist, create basic structure
    deploymentInfo = {
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      contracts: {},
    };
  }

  // Add ReviewSystem to contracts
  if (!deploymentInfo.contracts) {
    deploymentInfo.contracts = {};
  }
  deploymentInfo.contracts.ReviewSystem = reviewSystemAddress;
  deploymentInfo.reviewSystemDeploymentTime = new Date().toISOString();

  // Save deployment info
  const updatedDeploymentInfo = {
    ...deploymentInfo,
    reviewSystemAbi: reviewSystem.interface.format("json"),
  };

  fs.writeFileSync(
    "deployed.json",
    JSON.stringify(
      updatedDeploymentInfo,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );

  console.log("\n✅ Deployment info saved to deployed.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
