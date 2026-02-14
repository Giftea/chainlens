import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const networkName = network.name;
  console.log("=".repeat(60));
  console.log("  ChainLens DocRegistry Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${networkName}`);
  console.log(`Chain ID: ${network.config.chainId}`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "BNB");
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has zero balance. Fund the wallet first.");
  }

  // Deploy
  console.log("Deploying DocRegistry...");
  const DocRegistry = await ethers.getContractFactory("DocRegistry");
  const registry = await DocRegistry.deploy();
  const tx = registry.deploymentTransaction();

  console.log("Tx hash: ", tx?.hash);
  console.log("Waiting for confirmation...");

  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("");
  console.log("DocRegistry deployed to:", contractAddress);

  // Verify initial state
  const owner = await registry.owner();
  const fee = await registry.publishFee();
  const paused = await registry.paused();
  console.log("");
  console.log("Initial state:");
  console.log("  Owner:       ", owner);
  console.log("  Publish fee: ", ethers.formatEther(fee), "BNB");
  console.log("  Paused:      ", paused);

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: network.config.chainId,
    contractAddress,
    deployer: deployer.address,
    txHash: tx?.hash,
    blockNumber: tx?.blockNumber,
    timestamp: new Date().toISOString(),
    compiler: "0.8.24",
    optimizer: { enabled: true, runs: 200 },
  };

  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${networkName}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("");
  console.log("Deployment info saved to:", filepath);

  // Also save/update a latest deployment file
  const latestPath = path.join(deploymentsDir, `${networkName}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  // Verification instructions
  console.log("");
  console.log("=".repeat(60));
  console.log("  Next Steps");
  console.log("=".repeat(60));
  console.log("");
  console.log("1. Verify on BSCScan:");
  console.log(`   npx hardhat verify --network ${networkName} ${contractAddress}`);
  console.log("");
  console.log("2. Update .env:");
  if (networkName === "bscMainnet") {
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET=${contractAddress}`);
  } else if (networkName === "bscTestnet") {
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET=${contractAddress}`);
  } else {
    console.log(`   Contract address: ${contractAddress}`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
