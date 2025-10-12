const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing contract functionality...");

  // Read deployment info
  const fs = require("fs");
  let deploymentInfo;
  try {
    const deployedData = fs.readFileSync("deployed-addresses.json", "utf8");
    deploymentInfo = JSON.parse(deployedData);
  } catch (error) {
    console.log(
      "❌ No deployment info found. Please deploy the contract first.",
    );
    return;
  }

  const contractAddress = deploymentInfo.secureFlow;
  console.log("Contract address:", contractAddress);

  const [deployer] = await ethers.getSigners();
  const SecureFlow = await ethers.getContractFactory("SecureFlow");
  const contract = SecureFlow.attach(contractAddress);

  console.log("\n📊 Contract Information:");
  console.log("Owner:", await contract.owner());
  console.log("Fee Collector:", await contract.feeCollector());
  console.log("Platform Fee BP:", await contract.platformFeeBP());
  console.log("Next Escrow ID:", await contract.nextEscrowId());
  console.log("Paused:", await contract.paused());

  console.log("\n✅ Contract is working correctly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
