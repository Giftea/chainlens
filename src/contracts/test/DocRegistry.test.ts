import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

// Helper to generate a content hash
function contentHash(content: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

describe("DocRegistry", function () {
  // ============================================================
  //                        FIXTURES
  // ============================================================

  async function deployFixture() {
    const [owner, alice, bob, charlie] = await ethers.getSigners();

    const DocRegistry = await ethers.getContractFactory("DocRegistry");
    const registry = await DocRegistry.deploy();
    await registry.waitForDeployment();

    // Sample data
    const CONTRACT_A = "0x0000000000000000000000000000000000000001";
    const CONTRACT_B = "0x0000000000000000000000000000000000000002";
    const CONTRACT_C = "0x0000000000000000000000000000000000000003";

    const CID_1 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    const CID_2 = "QmRKs2ZfuwvmZA3QAWmCqrGUjV9pxtBUDP3wuc6iVGnjA2";
    const CID_3 = "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX";

    const HASH_1 = contentHash("documentation content v1");
    const HASH_2 = contentHash("documentation content v2");
    const HASH_3 = contentHash("documentation content v3");

    return {
      registry,
      owner,
      alice,
      bob,
      charlie,
      CONTRACT_A,
      CONTRACT_B,
      CONTRACT_C,
      CID_1,
      CID_2,
      CID_3,
      HASH_1,
      HASH_2,
      HASH_3,
    };
  }

  async function publishedFixture() {
    const data = await deployFixture();
    const { registry, alice, CONTRACT_A, CID_1, HASH_1 } = data;

    await registry
      .connect(alice)
      .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

    return data;
  }

  // ============================================================
  //                      DEPLOYMENT
  // ============================================================

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should initialize with zero publish fee", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.publishFee()).to.equal(0);
    });

    it("should initialize counters to zero", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.totalDocumented()).to.equal(0);
      expect(await registry.totalVersions()).to.equal(0);
    });

    it("should not be paused on deploy", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.paused()).to.equal(false);
    });
  });

  // ============================================================
  //                  PUBLISH DOCUMENTATION
  // ============================================================

  describe("publishDocumentation", function () {
    it("should publish documentation for the first time", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.contractAddress).to.equal(CONTRACT_A);
      expect(doc.contractName).to.equal("TokenA");
      expect(doc.ipfsHash).to.equal(CID_1);
      expect(doc.generator).to.equal(alice.address);
      expect(doc.version).to.equal(1);
      expect(doc.chainId).to.equal(56);
      expect(doc.contentHash).to.equal(HASH_1);
      expect(doc.functionCount).to.equal(10);
      expect(doc.stateVarCount).to.equal(5);
      expect(doc.hasPlayground).to.equal(false);
      expect(doc.hasDiff).to.equal(false);
    });

    it("should emit DocumentationPublished on first publish", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5)
      )
        .to.emit(registry, "DocumentationPublished")
        .withArgs(CONTRACT_A, 1, CID_1, alice.address, 56);
    });

    it("should increment totalDocumented and totalVersions", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(deployFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

      expect(await registry.totalDocumented()).to.equal(1);
      expect(await registry.totalVersions()).to.equal(1);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_B, "TokenB", CID_2, 97, HASH_2, 8, 3);

      expect(await registry.totalDocumented()).to.equal(2);
      expect(await registry.totalVersions()).to.equal(2);
    });

    it("should set hasDiff to true for version > 1", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.hasDiff).to.equal(true);
      expect(doc.version).to.equal(2);
    });

    it("should store the correct timestamp", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      const tx = await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);
      const block = await tx.getBlock();

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.timestamp).to.equal(block!.timestamp);
    });

    // --- Versioning ---

    it("should increment version on update by original generator", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      expect(await registry.getVersionCount(CONTRACT_A)).to.equal(2);

      const v1 = await registry.getDocumentationVersion(CONTRACT_A, 1);
      expect(v1.ipfsHash).to.equal(CID_1);

      const v2 = await registry.getDocumentationVersion(CONTRACT_A, 2);
      expect(v2.ipfsHash).to.equal(CID_2);
    });

    it("should emit DocumentationUpdated on subsequent publishes", async function () {
      const { registry, alice, CONTRACT_A, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6)
      )
        .to.emit(registry, "DocumentationUpdated")
        .withArgs(CONTRACT_A, 2, CID_2, alice.address);
    });

    it("should not increment totalDocumented on version update", async function () {
      const { registry, alice, CONTRACT_A, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      expect(await registry.totalDocumented()).to.equal(1);
      expect(await registry.totalVersions()).to.equal(2);
    });

    it("should allow contract owner to update docs from another generator", async function () {
      const { registry, owner, CONTRACT_A, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      // Owner (not alice who originally published) updates
      await expect(
        registry
          .connect(owner)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 15, 7)
      ).to.not.be.reverted;

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.version).to.equal(2);
      expect(doc.generator).to.equal(owner.address);
    });

    // --- Access Control ---

    it("should revert when unauthorized user updates existing docs", async function () {
      const { registry, bob, CONTRACT_A, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      await expect(
        registry
          .connect(bob)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    // --- Input Validation ---

    it("should revert on zero address", async function () {
      const { registry, alice, CID_1, HASH_1 } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(ethers.ZeroAddress, "Token", CID_1, 56, HASH_1, 10, 5)
      ).to.be.revertedWithCustomError(registry, "InvalidContractAddress");
    });

    it("should revert on empty IPFS hash", async function () {
      const { registry, alice, CONTRACT_A, HASH_1 } =
        await loadFixture(deployFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", "", 56, HASH_1, 10, 5)
      ).to.be.revertedWithCustomError(registry, "EmptyIPFSHash");
    });

    it("should revert on empty contract name", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "", CID_1, 56, HASH_1, 10, 5)
      ).to.be.revertedWithCustomError(registry, "EmptyContractName");
    });

    it("should revert on zero content hash", async function () {
      const { registry, alice, CONTRACT_A, CID_1 } =
        await loadFixture(deployFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(
            CONTRACT_A,
            "TokenA",
            CID_1,
            56,
            ethers.ZeroHash,
            10,
            5
          )
      ).to.be.revertedWithCustomError(registry, "InvalidContentHash");
    });

    it("should revert on duplicate IPFS hash for same contract", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1, HASH_2 } =
        await loadFixture(publishedFixture);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_2, 10, 5)
      ).to.be.revertedWithCustomError(registry, "DuplicateIPFSHash");
    });

    it("should allow same IPFS hash for different contracts", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

      // Same CID for a different contract should succeed
      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_B, "TokenB", CID_1, 56, HASH_1, 8, 3)
      ).to.not.be.reverted;
    });

    // --- Fee Logic ---

    it("should revert when fee is not paid", async function () {
      const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      const fee = ethers.parseEther("0.01");
      await registry.connect(owner).setPublishFee(fee);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5)
      ).to.be.revertedWithCustomError(registry, "InsufficientFee");
    });

    it("should accept exact fee payment", async function () {
      const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      const fee = ethers.parseEther("0.01");
      await registry.connect(owner).setPublishFee(fee);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5, {
            value: fee,
          })
      ).to.not.be.reverted;
    });

    it("should accept overpayment", async function () {
      const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      const fee = ethers.parseEther("0.01");
      await registry.connect(owner).setPublishFee(fee);

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5, {
            value: ethers.parseEther("0.05"),
          })
      ).to.not.be.reverted;
    });

    // --- Paused ---

    it("should revert when paused", async function () {
      const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry.connect(owner).pause();

      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  // ============================================================
  //                    UPDATE METADATA
  // ============================================================

  describe("updateMetadata", function () {
    it("should update playground and diff flags", async function () {
      const { registry, alice, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await registry.connect(alice).updateMetadata(CONTRACT_A, true, true);

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.hasPlayground).to.equal(true);
      expect(doc.hasDiff).to.equal(true);
    });

    it("should emit MetadataUpdated event", async function () {
      const { registry, alice, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await expect(registry.connect(alice).updateMetadata(CONTRACT_A, true, false))
        .to.emit(registry, "MetadataUpdated")
        .withArgs(CONTRACT_A, true, false);
    });

    it("should also update the version history record", async function () {
      const { registry, alice, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await registry.connect(alice).updateMetadata(CONTRACT_A, true, true);

      const v1 = await registry.getDocumentationVersion(CONTRACT_A, 1);
      expect(v1.hasPlayground).to.equal(true);
      expect(v1.hasDiff).to.equal(true);
    });

    it("should allow contract owner to update metadata", async function () {
      const { registry, owner, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await expect(
        registry.connect(owner).updateMetadata(CONTRACT_A, true, true)
      ).to.not.be.reverted;
    });

    it("should revert for unauthorized user", async function () {
      const { registry, bob, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await expect(
        registry.connect(bob).updateMetadata(CONTRACT_A, true, true)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("should revert for non-existent documentation", async function () {
      const { registry, alice, CONTRACT_B } =
        await loadFixture(publishedFixture);

      await expect(
        registry.connect(alice).updateMetadata(CONTRACT_B, true, true)
      ).to.be.revertedWithCustomError(registry, "DocumentationNotFound");
    });

    it("should revert when paused", async function () {
      const { registry, owner, alice, CONTRACT_A } =
        await loadFixture(publishedFixture);

      await registry.connect(owner).pause();

      await expect(
        registry.connect(alice).updateMetadata(CONTRACT_A, true, true)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  // ============================================================
  //                      VIEW FUNCTIONS
  // ============================================================

  describe("getLatestDocumentation", function () {
    it("should return the latest documentation", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.ipfsHash).to.equal(CID_2);
      expect(doc.version).to.equal(2);
    });

    it("should revert for non-existent contract", async function () {
      const { registry, CONTRACT_B } = await loadFixture(deployFixture);

      await expect(
        registry.getLatestDocumentation(CONTRACT_B)
      ).to.be.revertedWithCustomError(registry, "DocumentationNotFound");
    });
  });

  describe("getDocumentationVersion", function () {
    it("should return a specific version", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      const v1 = await registry.getDocumentationVersion(CONTRACT_A, 1);
      expect(v1.ipfsHash).to.equal(CID_1);
      expect(v1.version).to.equal(1);

      const v2 = await registry.getDocumentationVersion(CONTRACT_A, 2);
      expect(v2.ipfsHash).to.equal(CID_2);
      expect(v2.version).to.equal(2);
    });

    it("should revert for version 0", async function () {
      const { registry, CONTRACT_A } = await loadFixture(publishedFixture);

      await expect(
        registry.getDocumentationVersion(CONTRACT_A, 0)
      ).to.be.revertedWithCustomError(registry, "VersionNotFound");
    });

    it("should revert for version beyond latest", async function () {
      const { registry, CONTRACT_A } = await loadFixture(publishedFixture);

      await expect(
        registry.getDocumentationVersion(CONTRACT_A, 99)
      ).to.be.revertedWithCustomError(registry, "VersionNotFound");
    });
  });

  describe("getVersionCount", function () {
    it("should return 0 for undocumented contracts", async function () {
      const { registry, CONTRACT_B } = await loadFixture(deployFixture);
      expect(await registry.getVersionCount(CONTRACT_B)).to.equal(0);
    });

    it("should return correct count after multiple versions", async function () {
      const { registry, alice, CONTRACT_A, CID_2, CID_3, HASH_2, HASH_3 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);
      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_3, 56, HASH_3, 14, 7);

      expect(await registry.getVersionCount(CONTRACT_A)).to.equal(3);
    });
  });

  describe("hasDocumentation", function () {
    it("should return false for undocumented contracts", async function () {
      const { registry, CONTRACT_B } = await loadFixture(deployFixture);
      expect(await registry.hasDocumentation(CONTRACT_B)).to.equal(false);
    });

    it("should return true for documented contracts", async function () {
      const { registry, CONTRACT_A } = await loadFixture(publishedFixture);
      expect(await registry.hasDocumentation(CONTRACT_A)).to.equal(true);
    });
  });

  // ============================================================
  //                      PAGINATION
  // ============================================================

  describe("getAllDocumentations", function () {
    it("should return empty array when no docs exist", async function () {
      const { registry } = await loadFixture(deployFixture);

      const [docs, total] = await registry.getAllDocumentations(0, 10);
      expect(docs.length).to.equal(0);
      expect(total).to.equal(0);
    });

    it("should return all docs with enough limit", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CONTRACT_C, CID_1, CID_2, CID_3, HASH_1, HASH_2, HASH_3 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);
      await registry.connect(alice).publishDocumentation(CONTRACT_B, "TokenB", CID_2, 97, HASH_2, 8, 3);
      await registry.connect(alice).publishDocumentation(CONTRACT_C, "TokenC", CID_3, 204, HASH_3, 6, 2);

      const [docs, total] = await registry.getAllDocumentations(0, 100);
      expect(docs.length).to.equal(3);
      expect(total).to.equal(3);
    });

    it("should paginate correctly", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CONTRACT_C, CID_1, CID_2, CID_3, HASH_1, HASH_2, HASH_3 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);
      await registry.connect(alice).publishDocumentation(CONTRACT_B, "TokenB", CID_2, 97, HASH_2, 8, 3);
      await registry.connect(alice).publishDocumentation(CONTRACT_C, "TokenC", CID_3, 204, HASH_3, 6, 2);

      // Page 1: offset=0, limit=2
      const [page1, total1] = await registry.getAllDocumentations(0, 2);
      expect(page1.length).to.equal(2);
      expect(total1).to.equal(3);
      expect(page1[0].contractName).to.equal("TokenA");
      expect(page1[1].contractName).to.equal("TokenB");

      // Page 2: offset=2, limit=2
      const [page2, total2] = await registry.getAllDocumentations(2, 2);
      expect(page2.length).to.equal(1);
      expect(total2).to.equal(3);
      expect(page2[0].contractName).to.equal("TokenC");
    });

    it("should return empty when offset >= total", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

      const [docs, total] = await registry.getAllDocumentations(100, 10);
      expect(docs.length).to.equal(0);
      expect(total).to.equal(1);
    });

    it("should clamp limit to available items", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);

      const [docs, total] = await registry.getAllDocumentations(0, 1000);
      expect(docs.length).to.equal(1);
      expect(total).to.equal(1);
    });
  });

  // ============================================================
  //                   GENERATOR LOOKUP
  // ============================================================

  describe("getDocumentationsByGenerator", function () {
    it("should return empty for generator with no docs", async function () {
      const { registry, bob } = await loadFixture(deployFixture);
      const docs = await registry.getDocumentationsByGenerator(bob.address);
      expect(docs.length).to.equal(0);
    });

    it("should return all docs by a generator", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);
      await registry.connect(alice).publishDocumentation(CONTRACT_B, "TokenB", CID_2, 97, HASH_2, 8, 3);

      const docs = await registry.getDocumentationsByGenerator(alice.address);
      expect(docs.length).to.equal(2);
    });

    it("should not duplicate contracts when generator updates", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(publishedFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);

      const docs = await registry.getDocumentationsByGenerator(alice.address);
      expect(docs.length).to.equal(1);
    });
  });

  // ============================================================
  //                       SEARCH
  // ============================================================

  describe("searchByName", function () {
    it("should find contracts by exact name (case-insensitive)", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(publishedFixture);

      // Search with exact case
      let results = await registry.searchByName("TokenA");
      expect(results.length).to.equal(1);
      expect(results[0].contractAddress).to.equal(CONTRACT_A);

      // Search with different case
      results = await registry.searchByName("tokena");
      expect(results.length).to.equal(1);

      results = await registry.searchByName("TOKENA");
      expect(results.length).to.equal(1);
    });

    it("should return empty for non-matching name", async function () {
      const { registry } = await loadFixture(publishedFixture);

      const results = await registry.searchByName("NonExistentToken");
      expect(results.length).to.equal(0);
    });

    it("should return multiple contracts with same name", async function () {
      const { registry, alice, bob, CONTRACT_A, CONTRACT_B, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(deployFixture);

      // Two different contracts with the same name
      await registry.connect(alice).publishDocumentation(CONTRACT_A, "Token", CID_1, 56, HASH_1, 10, 5);
      await registry.connect(bob).publishDocumentation(CONTRACT_B, "Token", CID_2, 97, HASH_2, 8, 3);

      const results = await registry.searchByName("Token");
      expect(results.length).to.equal(2);
    });
  });

  // ============================================================
  //                    FULL HISTORY
  // ============================================================

  describe("getFullHistory", function () {
    it("should return empty for undocumented contracts", async function () {
      const { registry, CONTRACT_B } = await loadFixture(deployFixture);
      const history = await registry.getFullHistory(CONTRACT_B);
      expect(history.length).to.equal(0);
    });

    it("should return all versions in order", async function () {
      const { registry, alice, CONTRACT_A, CID_1, CID_2, CID_3, HASH_1, HASH_2, HASH_3 } =
        await loadFixture(publishedFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_2, 56, HASH_2, 12, 6);
      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_3, 56, HASH_3, 14, 7);

      const history = await registry.getFullHistory(CONTRACT_A);
      expect(history.length).to.equal(3);
      expect(history[0].version).to.equal(1);
      expect(history[0].ipfsHash).to.equal(CID_1);
      expect(history[1].version).to.equal(2);
      expect(history[1].ipfsHash).to.equal(CID_2);
      expect(history[2].version).to.equal(3);
      expect(history[2].ipfsHash).to.equal(CID_3);
    });
  });

  // ============================================================
  //                    ADMIN FUNCTIONS
  // ============================================================

  describe("Admin", function () {
    describe("setPublishFee", function () {
      it("should allow owner to set fee", async function () {
        const { registry, owner } = await loadFixture(deployFixture);

        const fee = ethers.parseEther("0.01");
        await registry.connect(owner).setPublishFee(fee);
        expect(await registry.publishFee()).to.equal(fee);
      });

      it("should emit PublishFeeUpdated event", async function () {
        const { registry, owner } = await loadFixture(deployFixture);

        const fee = ethers.parseEther("0.01");
        await expect(registry.connect(owner).setPublishFee(fee))
          .to.emit(registry, "PublishFeeUpdated")
          .withArgs(0, fee);
      });

      it("should revert when non-owner calls", async function () {
        const { registry, alice } = await loadFixture(deployFixture);

        await expect(
          registry.connect(alice).setPublishFee(ethers.parseEther("0.01"))
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });

    describe("withdraw", function () {
      it("should withdraw accumulated fees", async function () {
        const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
          await loadFixture(deployFixture);

        const fee = ethers.parseEther("0.01");
        await registry.connect(owner).setPublishFee(fee);

        await registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5, {
            value: fee,
          });

        const balanceBefore = await ethers.provider.getBalance(owner.address);
        const tx = await registry.connect(owner).withdraw();
        const receipt = await tx.wait();
        const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
        const balanceAfter = await ethers.provider.getBalance(owner.address);

        expect(balanceAfter + gasUsed - balanceBefore).to.equal(fee);
      });

      it("should revert when balance is zero", async function () {
        const { registry, owner } = await loadFixture(deployFixture);

        await expect(
          registry.connect(owner).withdraw()
        ).to.be.revertedWithCustomError(registry, "NothingToWithdraw");
      });

      it("should revert when non-owner calls", async function () {
        const { registry, alice } = await loadFixture(deployFixture);

        await expect(
          registry.connect(alice).withdraw()
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });

    describe("pause / unpause", function () {
      it("should allow owner to pause", async function () {
        const { registry, owner } = await loadFixture(deployFixture);
        await registry.connect(owner).pause();
        expect(await registry.paused()).to.equal(true);
      });

      it("should allow owner to unpause", async function () {
        const { registry, owner } = await loadFixture(deployFixture);
        await registry.connect(owner).pause();
        await registry.connect(owner).unpause();
        expect(await registry.paused()).to.equal(false);
      });

      it("should revert pause from non-owner", async function () {
        const { registry, alice } = await loadFixture(deployFixture);
        await expect(
          registry.connect(alice).pause()
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });

      it("should block publish when paused", async function () {
        const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
          await loadFixture(deployFixture);

        await registry.connect(owner).pause();

        await expect(
          registry
            .connect(alice)
            .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5)
        ).to.be.revertedWithCustomError(registry, "EnforcedPause");
      });

      it("should allow publish after unpause", async function () {
        const { registry, owner, alice, CONTRACT_A, CID_1, HASH_1 } =
          await loadFixture(deployFixture);

        await registry.connect(owner).pause();
        await registry.connect(owner).unpause();

        await expect(
          registry
            .connect(alice)
            .publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5)
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================================
  //                     EDGE CASES
  // ============================================================

  describe("Edge Cases", function () {
    it("should handle very long contract names", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      const longName = "A".repeat(256);
      await expect(
        registry
          .connect(alice)
          .publishDocumentation(CONTRACT_A, longName, CID_1, 56, HASH_1, 10, 5)
      ).to.not.be.reverted;

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.contractName).to.equal(longName);
    });

    it("should handle zero function and state var counts", async function () {
      const { registry, alice, CONTRACT_A, CID_1, HASH_1 } =
        await loadFixture(deployFixture);

      await registry
        .connect(alice)
        .publishDocumentation(CONTRACT_A, "EmptyContract", CID_1, 56, HASH_1, 0, 0);

      const doc = await registry.getLatestDocumentation(CONTRACT_A);
      expect(doc.functionCount).to.equal(0);
      expect(doc.stateVarCount).to.equal(0);
    });

    it("should track multiple generators across different contracts", async function () {
      const { registry, alice, bob, CONTRACT_A, CONTRACT_B, CID_1, CID_2, HASH_1, HASH_2 } =
        await loadFixture(deployFixture);

      await registry.connect(alice).publishDocumentation(CONTRACT_A, "TokenA", CID_1, 56, HASH_1, 10, 5);
      await registry.connect(bob).publishDocumentation(CONTRACT_B, "TokenB", CID_2, 97, HASH_2, 8, 3);

      const aliceDocs = await registry.getDocumentationsByGenerator(alice.address);
      expect(aliceDocs.length).to.equal(1);
      expect(aliceDocs[0].contractName).to.equal("TokenA");

      const bobDocs = await registry.getDocumentationsByGenerator(bob.address);
      expect(bobDocs.length).to.equal(1);
      expect(bobDocs[0].contractName).to.equal("TokenB");
    });

    it("should support all target chain IDs", async function () {
      const { registry, alice, CONTRACT_A, CONTRACT_B, CONTRACT_C, CID_1, CID_2, CID_3, HASH_1, HASH_2, HASH_3 } =
        await loadFixture(deployFixture);

      // BSC Mainnet (56)
      await registry.connect(alice).publishDocumentation(CONTRACT_A, "T1", CID_1, 56, HASH_1, 1, 1);
      // BSC Testnet (97)
      await registry.connect(alice).publishDocumentation(CONTRACT_B, "T2", CID_2, 97, HASH_2, 1, 1);
      // opBNB (204)
      await registry.connect(alice).publishDocumentation(CONTRACT_C, "T3", CID_3, 204, HASH_3, 1, 1);

      expect((await registry.getLatestDocumentation(CONTRACT_A)).chainId).to.equal(56);
      expect((await registry.getLatestDocumentation(CONTRACT_B)).chainId).to.equal(97);
      expect((await registry.getLatestDocumentation(CONTRACT_C)).chainId).to.equal(204);
    });
  });
});
