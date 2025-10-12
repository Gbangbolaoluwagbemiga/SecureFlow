const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SecureFlow (minimal gas)...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  const SecureFlow = await ethers.getContractFactory("SecureFlow");

  const monadToken = ethers.ZeroAddress;
  const feeCollector = deployer.address;
  const platformFeeBP = 250;

  console.log("Deploying contract...");
  const secureFlow = await SecureFlow.deploy(
    monadToken,
    feeCollector,
    platformFeeBP,
  );
  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  const authTx = await secureFlow.authorizeArbiter(deployer.address);
  await authTx.wait();
  console.log("✅ Authorized deployer as arbiter");

  const deploymentInfo = {
    secureFlow: secureFlowAddress,
    network: "monad-testnet",
    chainId: 10143,
    explorer: "https://testnet-explorer.monad.xyz",
    deploymentDate: new Date().toISOString(),
    contracts: {
      SecureFlow: {
        address: secureFlowAddress,
        description:
          "Advanced milestone-based escrow platform with native MON support",
      },
    },
  };

  const fs = require("fs");
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log("💾 Deployment info saved to deployed-addresses.json");

  const secureFlowABI = await secureFlow.interface.format("json");
  const abiInfo = {
    SecureFlow: JSON.parse(secureFlowABI),
    deploymentInfo: deploymentInfo,
  };

  fs.writeFileSync("contracts-abi.json", JSON.stringify(abiInfo, null, 2));
  console.log("✅ ABI saved to contracts-abi.json");

  console.log("🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
