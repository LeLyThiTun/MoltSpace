// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMoltSpaceNFT.sol";
import "./interfaces/IMothershipManager.sol";
import "./interfaces/IExpeditionManager.sol";

/**
 * @title GameManager
 * @notice Central coordinator for MoltSpace game.
 *         Routes player actions to sub-contracts, handles $MON payments,
 *         and generates on-chain randomness (blockhash-based).
 *
 *  Mint costs: Scout Ship = 20 MON, Explorer = 10 MON (native $MON)
 *  Batch mint: 1, 5, 10, or 20 in a single transaction
 *  Architecture:
 *    Player → GameManager → { MoltSpaceNFT, MothershipManager, ExpeditionManager }
 */
contract GameManager is Ownable, ReentrancyGuard, Pausable {

    // ═══════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════

    uint256 public constant SCOUT_SHIP_COST = 20 ether;
    uint256 public constant EXPLORER_COST   = 10 ether;
    uint256 public constant MAX_BATCH_SIZE  = 20;

    // ═══════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════

    IMoltSpaceNFT public nftContract;
    IMothershipManager public mothershipManager;
    IExpeditionManager public expeditionManager;

    address public treasury;

    // Nonce for randomness — incremented per mint
    uint256 private _randomNonce;

    // Pending expeditions awaiting resolution
    mapping(uint256 => bool) public pendingExpeditions;

    // ═══════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════

    event ScoutShipsMinted(address indexed player, uint256 amount, uint256[] tokenIds);
    event ExplorersMinted(address indexed player, uint256 amount, uint256[] tokenIds);
    event TreasuryUpdated(address indexed newTreasury);

    // ═══════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════

    constructor(
        address _nftContract,
        address _mothershipManager,
        address _expeditionManager,
        address _treasury
    ) Ownable(msg.sender) {
        require(_nftContract != address(0), "GameMgr: zero NFT address");
        require(_mothershipManager != address(0), "GameMgr: zero mothership address");
        require(_expeditionManager != address(0), "GameMgr: zero expedition address");
        require(_treasury != address(0), "GameMgr: zero treasury address");

        nftContract = IMoltSpaceNFT(_nftContract);
        mothershipManager = IMothershipManager(_mothershipManager);
        expeditionManager = IExpeditionManager(_expeditionManager);
        treasury = _treasury;
    }

    // ═══════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "GameMgr: zero address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ═══════════════════════════════════════════
    //  On-chain Randomness (blockhash-based)
    // ═══════════════════════════════════════════

    /**
     * @dev Generate a pseudo-random seed using on-chain data.
     *      Uses blockhash, sender, nonce, and timestamp for entropy.
     *      Each call produces a different seed due to incrementing nonce.
     */
    function _generateRandomSeed() internal returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            msg.sender,
            _randomNonce,
            block.timestamp,
            block.prevrandao
        )));
        _randomNonce++;
        return seed;
    }

    // ═══════════════════════════════════════════
    //  Minting — Direct, single-transaction
    // ═══════════════════════════════════════════

    /**
     * @notice Mint Scout Ships directly. No commit required.
     * @param amount  Number of Scout Ships to mint (1-20)
     */
    function mintScoutShips(uint256 amount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[] memory tokenIds)
    {
        require(amount > 0 && amount <= MAX_BATCH_SIZE, "GameMgr: invalid amount (1-20)");
        require(msg.value == SCOUT_SHIP_COST * amount, "GameMgr: incorrect payment");

        tokenIds = new uint256[](amount);

        for (uint256 i = 0; i < amount; i++) {
            uint256 randomSeed = _generateRandomSeed();
            tokenIds[i] = nftContract.mintScoutShip(msg.sender, randomSeed);
        }

        // Split payment: 30% NFT (burn reserve), 35% Treasury, 35% Expedition Pool
        _splitPayment(msg.value);

        emit ScoutShipsMinted(msg.sender, amount, tokenIds);
    }

    /**
     * @notice Mint Explorers directly. No commit required.
     * @param amount  Number of Explorers to mint (1-20)
     */
    function mintExplorers(uint256 amount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[] memory tokenIds)
    {
        require(amount > 0 && amount <= MAX_BATCH_SIZE, "GameMgr: invalid amount (1-20)");
        require(msg.value == EXPLORER_COST * amount, "GameMgr: incorrect payment");

        tokenIds = new uint256[](amount);

        for (uint256 i = 0; i < amount; i++) {
            uint256 randomSeed = _generateRandomSeed();
            tokenIds[i] = nftContract.mintExplorer(msg.sender, randomSeed);
        }

        // Split payment: 30% NFT (burn reserve), 35% Treasury, 35% Expedition Pool
        _splitPayment(msg.value);

        emit ExplorersMinted(msg.sender, amount, tokenIds);
    }

    /**
     * @dev Split mint payment: 30% NFT (burn reserve), 20% Treasury, 50% Expedition Pool
     */
    function _splitPayment(uint256 total) internal {
        uint256 toNFT = (total * 3000) / 10000;        // 30%
        uint256 toExpedition = (total * 5000) / 10000;  // 50%
        uint256 toTreasury = total - toNFT - toExpedition; // 20% (remainder)

        (bool s1, ) = address(nftContract).call{value: toNFT}("");
        require(s1, "GameMgr: NFT reserve transfer failed");

        (bool s2, ) = address(expeditionManager).call{value: toExpedition}("");
        require(s2, "GameMgr: expedition pool transfer failed");

        (bool s3, ) = treasury.call{value: toTreasury}("");
        require(s3, "GameMgr: treasury transfer failed");
    }

    // ═══════════════════════════════════════════
    //  Mothership Management
    // ═══════════════════════════════════════════

    /**
     * @notice Enter Space — initialize your Mothership. Required before minting NFTs.
     *         Each wallet can only enter space once (1 Mothership per wallet).
     */
    function enterSpace() external whenNotPaused returns (uint256) {
        return mothershipManager.createMothership(msg.sender);
    }

    /**
     * @notice Disband your Mothership. Unassigns all NFTs.
     */
    function disbandMothership(uint256 mothershipId) external whenNotPaused {
        mothershipManager.disbandMothership(mothershipId, msg.sender);
    }

    /**
     * @notice Add a Scout Ship to your Mothership.
     */
    function addScoutShip(uint256 mothershipId, uint256 tokenId) external whenNotPaused {
        mothershipManager.addScoutShip(mothershipId, tokenId);
    }

    /**
     * @notice Add multiple Scout Ships to your Mothership in a single transaction.
     * @param mothershipId  Your mothership ID
     * @param tokenIds      Array of scout ship token IDs to assign
     */
    function addScoutShips(uint256 mothershipId, uint256[] calldata tokenIds) external whenNotPaused {
        mothershipManager.addScoutShips(mothershipId, tokenIds);
    }

    /**
     * @notice Add an Explorer to a Scout Ship in your Mothership.
     */
    function addExplorer(uint256 mothershipId, uint256 shipTokenId, uint256 explorerTokenId)
        external
        whenNotPaused
    {
        mothershipManager.addExplorer(mothershipId, shipTokenId, explorerTokenId);
    }

    /**
     * @notice Add multiple Explorers to a Scout Ship in a single transaction.
     * @param mothershipId    Your mothership ID
     * @param shipTokenId     The scout ship to assign explorers to
     * @param explorerTokenIds Array of explorer token IDs to assign
     */
    function addExplorers(uint256 mothershipId, uint256 shipTokenId, uint256[] calldata explorerTokenIds)
        external
        whenNotPaused
    {
        mothershipManager.addExplorers(mothershipId, shipTokenId, explorerTokenIds);
    }

    // ═══════════════════════════════════════════
    //  Expeditions
    // ═══════════════════════════════════════════

    /**
     * @notice Start an expedition.
     * @param mothershipId  Your mothership ID
     * @param planetId      Target planet (1-30)
     */
    function startExpedition(uint256 mothershipId, uint8 planetId)
        external
        whenNotPaused
        returns (uint256 expeditionId)
    {
        expeditionId = expeditionManager.startExpedition(mothershipId, planetId, msg.sender);
        pendingExpeditions[expeditionId] = true;
    }

    /**
     * @notice Resolve a pending expedition with on-chain randomness.
     * @param expeditionId  The expedition to resolve
     */
    function resolveExpedition(uint256 expeditionId)
        external
        nonReentrant
        whenNotPaused
    {
        require(pendingExpeditions[expeditionId], "GameMgr: expedition not pending");

        uint256 randomSeed = _generateRandomSeed();
        expeditionManager.resolveExpedition(expeditionId, randomSeed);

        delete pendingExpeditions[expeditionId];
    }

    /**
     * @notice Claim accumulated pending expedition rewards.
     */
    function claimReward() external whenNotPaused {
        expeditionManager.claimReward(msg.sender);
    }

    // ═══════════════════════════════════════════
    //  Fund Management
    // ═══════════════════════════════════════════

    /**
     * @notice Fund the expedition reward pool by sending $MON to ExpeditionManager.
     */
    function fundRewardPool() external payable onlyOwner {
        require(msg.value > 0, "GameMgr: zero value");
        (bool sent, ) = address(expeditionManager).call{value: msg.value}("");
        require(sent, "GameMgr: fund transfer failed");
    }

    /**
     * @notice Emergency withdraw from this contract (admin only).
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "GameMgr: zero address");
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "GameMgr: withdraw failed");
    }

    // ═══════════════════════════════════════════
    //  Receive
    // ═══════════════════════════════════════════

    receive() external payable {}
}
