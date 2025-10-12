const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying SecureFlow and updating all files...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");

  if (balance < ethers.parseEther("0.1")) {
    console.log("❌ Insufficient balance! Please get more MON tokens from:");
    console.log("🔗 https://testnet-faucet.monad.xyz/");
    console.log("📍 Your address:", deployer.address);
    return;
  }

  console.log("\n🔒 Deploying SecureFlow...");
  const SecureFlow = await ethers.getContractFactory("SecureFlow");

  const monadToken = ethers.ZeroAddress;
  const feeCollector = deployer.address;
  const platformFeeBP = 0; // 0% for hackathon demo - no fees!

  const secureFlow = await SecureFlow.deploy(
    monadToken,
    feeCollector,
    platformFeeBP,
  );
  await secureFlow.waitForDeployment();

  const secureFlowAddress = await secureFlow.getAddress();
  console.log("✅ SecureFlow deployed to:", secureFlowAddress);

  console.log("\n⚙️ Setting up contract...");
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
        features: [
          "Native MON support",
          "ERC20 permit support (EIP-2612)",
          "Platform fees with fee collector",
          "Arbiter authorization system",
          "Token whitelisting",
          "Emergency refund mechanisms",
          "Deadline extension",
          "Enhanced dispute resolution",
          "SafeERC20 transfers",
          "Pausable functionality",
        ],
      },
    },
  };

  console.log("\n💾 Saving deployment info...");
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log("✅ deployed-addresses.json updated");

  const secureFlowABI = secureFlow.interface.format("json");
  const abiInfo = {
    SecureFlow: JSON.parse(secureFlowABI),
    deploymentInfo: deploymentInfo,
  };

  fs.writeFileSync("contracts-abi.json", JSON.stringify(abiInfo, null, 2));
  console.log("✅ contracts-abi.json updated");

  console.log("\n🔄 Updating frontend files...");

  // Update frontend config
  const frontendConfigPath = "Frontend/lib/web3/config.ts";
  if (fs.existsSync(frontendConfigPath)) {
    const configContent = `export const MONAD_TESTNET = {
  chainId: "0x279F", // 10143 in hex (Monad Testnet)
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet-explorer.monad.xyz"],
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const CONTRACTS = {
  SECUREFLOW_ESCROW: "${secureFlowAddress}",
  MOCK_ERC20: "0x0000000000000000000000000000000000000000", // No mock token in production
};
`;
    fs.writeFileSync(frontendConfigPath, configContent);
    console.log("✅ Frontend config updated");
  }

  // Copy ABI to frontend
  const frontendAbiPath = "Frontend/lib/web3/abis.ts";
  if (fs.existsSync(frontendAbiPath)) {
    const abiContent = `export const SECUREFLOW_ABI = ${JSON.stringify(JSON.parse(secureFlowABI), null, 2)} as const;

export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
`;
    fs.writeFileSync(frontendAbiPath, abiContent);
    console.log("✅ Frontend ABI updated");
  }

  console.log("\n📋 Contract Information:");
  console.log("Monad Token:", await secureFlow.monadToken());
  console.log("Fee Collector:", await secureFlow.feeCollector());
  console.log("Platform Fee BP:", await secureFlow.platformFeeBP());
  console.log("Next Escrow ID:", await secureFlow.nextEscrowId());

  console.log("\n🎉 Deployment and updates completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Verify contract on Monad Explorer");
  console.log("2. Test the new features in your frontend");
  console.log("3. Whitelist any ERC20 tokens you want to support");
  console.log("4. Update your documentation with the new contract address");

  console.log("\n🔗 Contract Explorer:");
  console.log(
    `https://testnet-explorer.monad.xyz/address/${secureFlowAddress}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
