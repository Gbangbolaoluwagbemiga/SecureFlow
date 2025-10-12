const fs = require("fs");
const path = require("path");

async function extractABIs() {
  console.log("🔍 Extracting ABIs for frontend use...");

  try {
    // Read SecureFlow ABI
    const secureFlowArtifact = JSON.parse(
      fs.readFileSync(
        "./artifacts/contracts/SecureFlow.sol/SecureFlow.json",
        "utf8",
      ),
    );

    // Read MockERC20 ABI
    const mockERC20Artifact = JSON.parse(
      fs.readFileSync(
        "./artifacts/contracts/MockERC20.sol/MockERC20.json",
        "utf8",
      ),
    );

    // Read deployed addresses
    const deployedAddresses = JSON.parse(
      fs.readFileSync("./deployed-addresses.json", "utf8"),
    );

    // Create frontend-ready ABI file
    const frontendABI = {
      network: {
        name: "Monad Testnet",
        chainId: 10143,
        rpcUrl: "https://testnet-rpc.monad.xyz",
        explorer: "https://testnet-monad.xyz",
      },
      contracts: {
        SecureFlow: {
          address: deployedAddresses.secureFlow,
          abi: secureFlowArtifact.abi,
          bytecode: secureFlowArtifact.bytecode,
        },
        TestToken: {
          address: deployedAddresses.testToken,
          abi: mockERC20Artifact.abi,
          bytecode: mockERC20Artifact.bytecode,
        },
      },
    };

    // Save frontend ABI
    fs.writeFileSync(
      "./frontend-abi.json",
      JSON.stringify(frontendABI, null, 2),
    );

    // Save individual ABIs
    fs.writeFileSync(
      "./secureflow-abi.json",
      JSON.stringify(secureFlowArtifact.abi, null, 2),
    );
    fs.writeFileSync(
      "./mockerc20-abi.json",
      JSON.stringify(mockERC20Artifact.abi, null, 2),
    );

    console.log("✅ ABIs extracted successfully!");
    console.log("📄 Files created:");
    console.log("  - frontend-abi.json (complete frontend config)");
    console.log("  - secureflow-abi.json (SecureFlow ABI only)");
    console.log("  - mockerc20-abi.json (MockERC20 ABI only)");

    console.log("\n🎯 Frontend Integration:");
    console.log("SecureFlow Address:", deployedAddresses.secureFlow);
    console.log("Test Token Address:", deployedAddresses.testToken);
  } catch (error) {
    console.error("❌ Error extracting ABIs:", error.message);
  }
}

extractABIs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
