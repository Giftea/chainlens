import { ethers, network } from "hardhat";

// UPDATE THIS after deployment
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET || "";

async function main() {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x_testnet_contract_address") {
    throw new Error(
      "Set NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET in .env first!\n" +
        "Run the deploy script first: npm run deploy:testnet"
    );
  }

  const [signer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  ChainLens DocRegistry - Interaction Script");
  console.log("=".repeat(60));
  console.log(`Network:  ${network.name}`);
  console.log(`Chain ID: ${network.config.chainId}`);
  console.log(`Signer:   ${signer.address}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log("");

  // Connect to deployed contract
  const DocRegistry = await ethers.getContractFactory("DocRegistry");
  const registry = DocRegistry.attach(CONTRACT_ADDRESS);

  // ─── 1. Read initial state ────────────────────────────────
  console.log("── Step 1: Read Contract State ──");
  const owner = await registry.owner();
  const fee = await registry.publishFee();
  const paused = await registry.paused();
  const totalDocs = await registry.totalDocumented();
  const totalVers = await registry.totalVersions();

  console.log(`  Owner:            ${owner}`);
  console.log(`  Publish Fee:      ${ethers.formatEther(fee)} BNB`);
  console.log(`  Paused:           ${paused}`);
  console.log(`  Total Documented: ${totalDocs}`);
  console.log(`  Total Versions:   ${totalVers}`);
  console.log("");

  // ─── 2. Publish sample documentation ──────────────────────
  console.log("── Step 2: Publish Sample Documentation ──");

  // Use a well-known BSC testnet contract as sample (WBNB on testnet)
  const sampleContractAddr = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const sampleName = "Wrapped BNB (WBNB)";
  const sampleIpfsHash = "QmSampleHash123456789abcdefghijklmnopqrstuvwxyz";
  const sampleChainId = 97; // BSC Testnet
  const sampleContentHash = ethers.keccak256(
    ethers.toUtf8Bytes("sample-documentation-content-v1")
  );
  const sampleFunctionCount = 8;
  const sampleStateVarCount = 3;

  console.log(`  Contract: ${sampleContractAddr}`);
  console.log(`  Name:     ${sampleName}`);
  console.log(`  IPFS:     ${sampleIpfsHash}`);
  console.log("");

  // Check if already documented
  const alreadyDocumented = await registry.hasDocumentation(sampleContractAddr);
  if (alreadyDocumented) {
    console.log("  This contract already has documentation. Skipping publish.");
    console.log("  (Use a different address or IPFS hash to test again)");
  } else {
    console.log("  Publishing...");
    const tx = await registry.publishDocumentation(
      sampleContractAddr,
      sampleName,
      sampleIpfsHash,
      sampleChainId,
      sampleContentHash,
      sampleFunctionCount,
      sampleStateVarCount,
      { value: fee } // Pay the publish fee (0 by default)
    );

    console.log(`  Tx Hash: ${tx.hash}`);
    console.log("  Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`  Confirmed in block: ${receipt?.blockNumber}`);
    console.log(`  Gas used: ${receipt?.gasUsed.toString()}`);

    // Parse events
    const events = receipt?.logs || [];
    console.log(`  Events emitted: ${events.length}`);
  }
  console.log("");

  // ─── 3. Query the documentation back ─────────────────────
  console.log("── Step 3: Query Documentation ──");

  const doc = await registry.getLatestDocumentation(sampleContractAddr);
  console.log("  Latest Documentation:");
  console.log(`    Contract:      ${doc.contractAddress}`);
  console.log(`    Name:          ${doc.contractName}`);
  console.log(`    IPFS Hash:     ${doc.ipfsHash}`);
  console.log(`    Generator:     ${doc.generator}`);
  console.log(`    Version:       ${doc.version}`);
  console.log(`    Chain ID:      ${doc.chainId}`);
  console.log(`    Functions:     ${doc.functionCount}`);
  console.log(`    State Vars:    ${doc.stateVarCount}`);
  console.log(`    Has Playground:${doc.hasPlayground}`);
  console.log(`    Has Diff:      ${doc.hasDiff}`);
  console.log(
    `    Timestamp:     ${new Date(Number(doc.timestamp) * 1000).toISOString()}`
  );
  console.log("");

  // ─── 4. Check version count ───────────────────────────────
  console.log("── Step 4: Version History ──");
  const versionCount = await registry.getVersionCount(sampleContractAddr);
  console.log(`  Version count: ${versionCount}`);

  if (versionCount > 0n) {
    const v1 = await registry.getDocumentationVersion(sampleContractAddr, 1);
    console.log(`  Version 1 IPFS: ${v1.ipfsHash}`);
  }
  console.log("");

  // ─── 5. Get all documentations (pagination) ───────────────
  console.log("── Step 5: Paginated Listing ──");
  const [allDocs, total] = await registry.getAllDocumentations(0, 10);
  console.log(`  Total documented contracts: ${total}`);
  console.log(`  Returned in this page: ${allDocs.length}`);
  for (let i = 0; i < allDocs.length; i++) {
    console.log(
      `    [${i}] ${allDocs[i].contractName} @ ${allDocs[i].contractAddress}`
    );
  }
  console.log("");

  // ─── 6. Get docs by generator ─────────────────────────────
  console.log("── Step 6: Docs by Generator ──");
  const myDocs = await registry.getDocumentationsByGenerator(signer.address);
  console.log(`  Your published docs: ${myDocs.length}`);
  for (let i = 0; i < myDocs.length; i++) {
    console.log(`    [${i}] ${myDocs[i].contractName} v${myDocs[i].version}`);
  }
  console.log("");

  // ─── 7. Search by name ────────────────────────────────────
  console.log("── Step 7: Search by Name ──");
  const searchResults = await registry.searchByName(sampleName);
  console.log(`  Search for "${sampleName}": ${searchResults.length} result(s)`);
  for (let i = 0; i < searchResults.length; i++) {
    console.log(`    [${i}] ${searchResults[i].contractAddress}`);
  }
  console.log("");

  // ─── 8. Summary ───────────────────────────────────────────
  const finalTotal = await registry.totalDocumented();
  const finalVersions = await registry.totalVersions();
  console.log("=".repeat(60));
  console.log("  Summary");
  console.log("=".repeat(60));
  console.log(`  Total Documented: ${finalTotal}`);
  console.log(`  Total Versions:   ${finalVersions}`);
  console.log(`  Contract:         ${CONTRACT_ADDRESS}`);
  console.log(
    `  Explorer:         https://testnet.bscscan.com/address/${CONTRACT_ADDRESS}`
  );
  console.log("");
  console.log("  All functions working correctly!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Interaction failed:", error);
    process.exit(1);
  });
