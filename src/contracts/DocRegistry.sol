// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ChainLens Documentation Registry
/// @author ChainLens Team
/// @notice Onchain registry for AI-generated smart contract documentation stored on IPFS
/// @dev Stores documentation metadata with full version history, search, and pagination
contract DocRegistry is Ownable, ReentrancyGuard, Pausable {
    // ============================================================
    //                          STRUCTS
    // ============================================================

    /// @notice Full documentation record for a contract
    struct Documentation {
        address contractAddress;
        string contractName;
        string ipfsHash;
        address generator;
        uint256 timestamp;
        uint256 version;
        uint256 chainId;
        bytes32 contentHash;
        uint256 functionCount;
        uint256 stateVarCount;
        bool hasPlayground;
        bool hasDiff;
    }

    // ============================================================
    //                      STATE VARIABLES
    // ============================================================

    /// @notice Latest documentation for each contract address
    mapping(address => Documentation) private _latestDocs;

    /// @notice Version history: contractAddress => version => Documentation
    mapping(address => mapping(uint256 => Documentation)) private _versionHistory;

    /// @notice Number of versions for each contract address
    mapping(address => uint256) private _versionCounts;

    /// @notice All documented contract addresses (for pagination)
    address[] private _allContracts;

    /// @notice Whether a contract has any documentation
    mapping(address => bool) private _hasDocumentation;

    /// @notice Docs published by each generator: generator => contractAddress[]
    mapping(address => address[]) private _generatorDocs;

    /// @notice Tracks which contracts a generator has documented (dedup)
    mapping(address => mapping(address => bool)) private _generatorHasDoc;

    /// @notice Contract name registry for search: nameHash => contractAddress[]
    mapping(bytes32 => address[]) private _nameIndex;

    /// @notice Prevent duplicate IPFS hashes per contract: contractAddr => ipfsHash => bool
    mapping(address => mapping(bytes32 => bool)) private _usedHashes;

    /// @notice Total number of documented contracts
    uint256 public totalDocumented;

    /// @notice Total number of documentation versions across all contracts
    uint256 public totalVersions;

    /// @notice Fee for publishing documentation (can be 0)
    uint256 public publishFee;

    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Emitted when new documentation is published for a contract
    /// @param contractAddr The documented contract address
    /// @param version The version number assigned
    /// @param ipfsHash The IPFS CID of the documentation content
    /// @param generator The address that published the docs
    /// @param chainId The chain the documented contract lives on
    event DocumentationPublished(
        address indexed contractAddr,
        uint256 version,
        string ipfsHash,
        address indexed generator,
        uint256 chainId
    );

    /// @notice Emitted when existing documentation is updated with a new version
    /// @param contractAddr The documented contract address
    /// @param version The new version number
    /// @param ipfsHash The new IPFS CID
    /// @param updater The address that performed the update
    event DocumentationUpdated(
        address indexed contractAddr,
        uint256 version,
        string ipfsHash,
        address indexed updater
    );

    /// @notice Emitted when playground/diff metadata flags are toggled
    /// @param contractAddr The documented contract address
    /// @param hasPlayground Whether interactive playground is available
    /// @param hasDiff Whether version comparison is available
    event MetadataUpdated(
        address indexed contractAddr,
        bool hasPlayground,
        bool hasDiff
    );

    /// @notice Emitted when the publish fee is changed by the owner
    /// @param oldFee The previous fee
    /// @param newFee The new fee
    event PublishFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============================================================
    //                          ERRORS
    // ============================================================

    error InvalidContractAddress();
    error EmptyIPFSHash();
    error EmptyContractName();
    error InvalidContentHash();
    error InsufficientFee(uint256 required, uint256 sent);
    error DuplicateIPFSHash(string ipfsHash);
    error NotAuthorized(address caller, address required);
    error DocumentationNotFound(address contractAddr);
    error VersionNotFound(address contractAddr, uint256 version);
    error InvalidPagination();
    error WithdrawFailed();
    error NothingToWithdraw();

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /// @notice Initializes the registry with the deployer as owner
    constructor() Ownable(msg.sender) {
        publishFee = 0;
    }

    // ============================================================
    //                      CORE FUNCTIONS
    // ============================================================

    /// @notice Publish documentation for a contract (creates new or increments version)
    /// @param contractAddr The address of the contract being documented
    /// @param contractName Human-readable name of the contract
    /// @param ipfsHash IPFS CID where the full documentation is stored
    /// @param chainId The chain ID the documented contract lives on (56, 97, 204)
    /// @param contentHash keccak256 hash of the documentation content for integrity
    /// @param functionCount Number of functions documented
    /// @param stateVarCount Number of state variables documented
    function publishDocumentation(
        address contractAddr,
        string calldata contractName,
        string calldata ipfsHash,
        uint256 chainId,
        bytes32 contentHash,
        uint256 functionCount,
        uint256 stateVarCount
    ) external payable nonReentrant whenNotPaused {
        // Input validation
        if (contractAddr == address(0)) revert InvalidContractAddress();
        if (bytes(ipfsHash).length == 0) revert EmptyIPFSHash();
        if (bytes(contractName).length == 0) revert EmptyContractName();
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (msg.value < publishFee) revert InsufficientFee(publishFee, msg.value);

        // Prevent duplicate IPFS hashes for the same contract
        bytes32 hashKey = keccak256(bytes(ipfsHash));
        if (_usedHashes[contractAddr][hashKey]) revert DuplicateIPFSHash(ipfsHash);
        _usedHashes[contractAddr][hashKey] = true;

        uint256 newVersion = _versionCounts[contractAddr] + 1;

        // If updating, verify caller is original generator or contract owner
        if (_hasDocumentation[contractAddr]) {
            address originalGenerator = _latestDocs[contractAddr].generator;
            if (msg.sender != originalGenerator && msg.sender != owner()) {
                revert NotAuthorized(msg.sender, originalGenerator);
            }
        }

        Documentation memory doc = Documentation({
            contractAddress: contractAddr,
            contractName: contractName,
            ipfsHash: ipfsHash,
            generator: msg.sender,
            timestamp: block.timestamp,
            version: newVersion,
            chainId: chainId,
            contentHash: contentHash,
            functionCount: functionCount,
            stateVarCount: stateVarCount,
            hasPlayground: false,
            hasDiff: newVersion > 1
        });

        // Store version
        _versionHistory[contractAddr][newVersion] = doc;
        _versionCounts[contractAddr] = newVersion;
        _latestDocs[contractAddr] = doc;
        totalVersions++;

        // First-time setup for this contract
        if (!_hasDocumentation[contractAddr]) {
            _hasDocumentation[contractAddr] = true;
            _allContracts.push(contractAddr);
            totalDocumented++;

            // Index by name for search
            bytes32 nameHash = keccak256(abi.encodePacked(_toLower(contractName)));
            _nameIndex[nameHash].push(contractAddr);

            emit DocumentationPublished(contractAddr, newVersion, ipfsHash, msg.sender, chainId);
        } else {
            emit DocumentationUpdated(contractAddr, newVersion, ipfsHash, msg.sender);
        }

        // Track generator's docs
        if (!_generatorHasDoc[msg.sender][contractAddr]) {
            _generatorHasDoc[msg.sender][contractAddr] = true;
            _generatorDocs[msg.sender].push(contractAddr);
        }
    }

    /// @notice Update playground and diff metadata flags for a contract
    /// @param contractAddr The documented contract address
    /// @param hasPlayground Whether interactive playground is available
    /// @param hasDiff Whether version comparison is available
    function updateMetadata(
        address contractAddr,
        bool hasPlayground,
        bool hasDiff
    ) external whenNotPaused {
        if (!_hasDocumentation[contractAddr]) revert DocumentationNotFound(contractAddr);

        address originalGenerator = _latestDocs[contractAddr].generator;
        if (msg.sender != originalGenerator && msg.sender != owner()) {
            revert NotAuthorized(msg.sender, originalGenerator);
        }

        _latestDocs[contractAddr].hasPlayground = hasPlayground;
        _latestDocs[contractAddr].hasDiff = hasDiff;

        // Also update the latest version record
        uint256 latestVersion = _versionCounts[contractAddr];
        _versionHistory[contractAddr][latestVersion].hasPlayground = hasPlayground;
        _versionHistory[contractAddr][latestVersion].hasDiff = hasDiff;

        emit MetadataUpdated(contractAddr, hasPlayground, hasDiff);
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the latest documentation for a contract
    /// @param contractAddr The contract address to look up
    /// @return doc The full Documentation struct
    function getLatestDocumentation(address contractAddr)
        external
        view
        returns (Documentation memory doc)
    {
        if (!_hasDocumentation[contractAddr]) revert DocumentationNotFound(contractAddr);
        return _latestDocs[contractAddr];
    }

    /// @notice Get a specific version of documentation for a contract
    /// @param contractAddr The contract address to look up
    /// @param version The version number to retrieve
    /// @return doc The Documentation struct for that version
    function getDocumentationVersion(address contractAddr, uint256 version)
        external
        view
        returns (Documentation memory doc)
    {
        if (version == 0 || version > _versionCounts[contractAddr]) {
            revert VersionNotFound(contractAddr, version);
        }
        return _versionHistory[contractAddr][version];
    }

    /// @notice Get the total number of versions for a contract
    /// @param contractAddr The contract address to check
    /// @return count The number of documentation versions
    function getVersionCount(address contractAddr) external view returns (uint256 count) {
        return _versionCounts[contractAddr];
    }

    /// @notice Check if documentation exists for a contract
    /// @param contractAddr The contract address to check
    /// @return exists Whether documentation has been published
    function hasDocumentation(address contractAddr) external view returns (bool exists) {
        return _hasDocumentation[contractAddr];
    }

    /// @notice Get a paginated list of all documented contracts
    /// @param offset The starting index (0-based)
    /// @param limit Maximum number of results to return
    /// @return docs Array of Documentation structs
    /// @return total Total number of documented contracts
    function getAllDocumentations(uint256 offset, uint256 limit)
        external
        view
        returns (Documentation[] memory docs, uint256 total)
    {
        total = _allContracts.length;
        if (offset >= total) {
            return (new Documentation[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 resultCount = end - offset;

        docs = new Documentation[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            docs[i] = _latestDocs[_allContracts[offset + i]];
        }

        return (docs, total);
    }

    /// @notice Get all documentations published by a specific generator
    /// @param generator The generator address to look up
    /// @return docs Array of Documentation structs
    function getDocumentationsByGenerator(address generator)
        external
        view
        returns (Documentation[] memory docs)
    {
        address[] storage contracts = _generatorDocs[generator];
        docs = new Documentation[](contracts.length);

        for (uint256 i = 0; i < contracts.length; i++) {
            docs[i] = _latestDocs[contracts[i]];
        }

        return docs;
    }

    /// @notice Search for documented contracts by name (case-insensitive)
    /// @param name The contract name to search for
    /// @return docs Array of matching Documentation structs
    function searchByName(string calldata name)
        external
        view
        returns (Documentation[] memory docs)
    {
        bytes32 nameHash = keccak256(abi.encodePacked(_toLower(name)));
        address[] storage matches = _nameIndex[nameHash];

        docs = new Documentation[](matches.length);
        for (uint256 i = 0; i < matches.length; i++) {
            docs[i] = _latestDocs[matches[i]];
        }

        return docs;
    }

    /// @notice Get the full version history for a contract
    /// @param contractAddr The contract address
    /// @return docs Array of all Documentation versions
    function getFullHistory(address contractAddr)
        external
        view
        returns (Documentation[] memory docs)
    {
        uint256 count = _versionCounts[contractAddr];
        docs = new Documentation[](count);

        for (uint256 i = 0; i < count; i++) {
            docs[i] = _versionHistory[contractAddr][i + 1];
        }

        return docs;
    }

    // ============================================================
    //                      ADMIN FUNCTIONS
    // ============================================================

    /// @notice Update the fee required to publish documentation
    /// @param newFee The new fee amount in wei
    function setPublishFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = publishFee;
        publishFee = newFee;
        emit PublishFeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraw accumulated fees to the owner
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    /// @notice Pause the contract (emergency stop)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================================
    //                    INTERNAL FUNCTIONS
    // ============================================================

    /// @dev Convert a string to lowercase for case-insensitive search
    /// @param str The input string
    /// @return The lowercase version
    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            if ((uint8(bStr[i]) >= 65) && (uint8(bStr[i]) <= 90)) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }
}
