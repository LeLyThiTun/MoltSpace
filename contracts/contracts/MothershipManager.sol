// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMothershipManager.sol";
import "./interfaces/IMoltSpaceNFT.sol";

/**
 * @title MothershipManager
 * @notice Manages Mothership state: creation, NFT assignment, rank, XP, leveling.
 *         Each wallet can own exactly 1 Mothership.
 *         Max 10 Scout Ships and 50 Explorers per Mothership.
 *         Rank = majority rarity of Scout Ships.
 *         25 levels across 6 tiers with reward bonuses up to +35%.
 */
contract MothershipManager is Ownable, IMothershipManager {

    // ═══════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════

    uint8 public constant MAX_SCOUT_SHIPS = 10;
    uint8 public constant MAX_EXPLORERS = 50;
    uint8 public constant MAX_LEVEL = 25;

    // XP required per level (index 0 = level 1)
    uint256[25] private XP_TABLE = [
        10, 12, 15, 18, 21,           // Tier 1 (Levels 1-5)
        25, 30, 36, 43, 52,           // Tier 2 (Levels 6-10)
        62, 75, 90, 107, 129,         // Tier 3 (Levels 11-15)
        155, 185, 222, 267, 320,      // Tier 4 (Levels 16-20)
        384, 461, 553, 663, 795       // Tier 5-6 (Levels 21-25)
    ];

    // Reward bonus per level in basis points (index 0 = level 1)
    // e.g. 100 = 1%, 1000 = 10%, 3500 = 35%
    uint256[25] private REWARD_BONUS_BPS = [
        100, 200, 300, 400, 500,               // Tier 1
        1000, 1200, 1400, 1600, 2000,          // Tier 2
        2050, 2100, 2150, 2200, 2250,          // Tier 3
        2500, 2550, 2600, 2650, 2700,          // Tier 4
        3000, 3050, 3100, 3150, 3500           // Tier 5-6
    ];

    // Tier boundaries (level ranges, for XP reduction on lower planets)
    uint8[6] private TIER_THRESHOLDS = [1, 6, 11, 16, 21, 25];

    // ═══════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════

    uint256 private _nextMothership = 1;

    // mothershipId => Mothership data
    struct MothershipData {
        address owner;
        uint256[] scoutShipIds;
        uint256[] explorerIds;
        uint8 rank;       // Rank enum as uint8
        uint8 level;      // 0-25
        uint256 totalXP;
        uint256 totalMP;
        bool active;
        uint256 lastExpeditionTime;
    }

    mapping(uint256 => MothershipData) private _motherships;
    mapping(uint256 => mapping(uint256 => uint256[])) private _shipToExplorers; // mothershipId => shipId => explorerIds

    // owner => mothershipId (0 if none)
    mapping(address => uint256) private _ownerToMothership;

    // Rarity count tracking per mothership for rank calculation
    mapping(uint256 => mapping(uint8 => uint8)) private _rarityCount; // mothershipId => rarity => count

    IMoltSpaceNFT public nftContract;
    address public gameManager;
    address public expeditionManager;

    // ═══════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════

    modifier onlyGameManager() {
        require(
            msg.sender == gameManager || msg.sender == expeditionManager,
            "MothershipMgr: not GameManager"
        );
        _;
    }

    modifier onlyMothershipOwner(uint256 mothershipId) {
        require(_motherships[mothershipId].owner == msg.sender, "MothershipMgr: not owner");
        _;
    }

    modifier mothershipActive(uint256 mothershipId) {
        require(_motherships[mothershipId].active, "MothershipMgr: not active");
        _;
    }

    // ═══════════════════════════════════════════
    //  Constructor & Admin
    // ═══════════════════════════════════════════

    constructor(address _nftContract) Ownable(msg.sender) {
        nftContract = IMoltSpaceNFT(_nftContract);
    }

    function setGameManager(address _gameManager) external onlyOwner {
        require(_gameManager != address(0), "MothershipMgr: zero address");
        gameManager = _gameManager;
    }

    function setExpeditionManager(address _expeditionManager) external onlyOwner {
        require(_expeditionManager != address(0), "MothershipMgr: zero address");
        expeditionManager = _expeditionManager;
    }

    // ═══════════════════════════════════════════
    //  Mothership Lifecycle
    // ═══════════════════════════════════════════

    /**
     * @notice Create a new mothership. Each wallet can own exactly 1.
     * @param player The player address (passed by GameManager)
     */
    function createMothership(address player) external onlyGameManager returns (uint256 mothershipId) {
        require(_ownerToMothership[player] == 0, "MothershipMgr: already owns a mothership");

        mothershipId = _nextMothership++;
        MothershipData storage ms = _motherships[mothershipId];
        ms.owner = player;
        ms.active = true;
        ms.level = 0;

        _ownerToMothership[player] = mothershipId;

        emit MothershipCreated(mothershipId, player);
    }

    /**
     * @notice Disband a mothership. Unassigns all NFTs back to the owner.
     * @param player The player address (passed by GameManager)
     */
    function disbandMothership(uint256 mothershipId, address player)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        require(_motherships[mothershipId].owner == player, "MothershipMgr: not owner");
        MothershipData storage ms = _motherships[mothershipId];

        // Unassign all explorers
        for (uint256 i = 0; i < ms.explorerIds.length; i++) {
            nftContract.setMothership(ms.explorerIds[i], 0);
        }

        // Unassign all scout ships & clear ship-to-explorer mappings
        for (uint256 i = 0; i < ms.scoutShipIds.length; i++) {
            uint256 shipId = ms.scoutShipIds[i];
            nftContract.setMothership(shipId, 0);
            delete _shipToExplorers[mothershipId][shipId];

            // Clear rarity count
            IMoltSpaceNFT.TokenStats memory stats = nftContract.getTokenStats(shipId);
            _rarityCount[mothershipId][stats.rarity] = 0;
        }

        ms.active = false;
        delete ms.scoutShipIds;
        delete ms.explorerIds;
        ms.totalMP = 0;
        ms.rank = 0;

        _ownerToMothership[ms.owner] = 0;

        emit MothershipDisbanded(mothershipId);
    }

    // ═══════════════════════════════════════════
    //  NFT Assignment
    // ═══════════════════════════════════════════

    /**
     * @notice Add a Scout Ship to the mothership. Max 10 per mothership.
     */
    function addScoutShip(uint256 mothershipId, uint256 tokenId)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        MothershipData storage ms = _motherships[mothershipId];
        require(ms.scoutShipIds.length < MAX_SCOUT_SHIPS, "MothershipMgr: max ships reached");

        IMoltSpaceNFT.TokenStats memory stats = nftContract.getTokenStats(tokenId);
        require(stats.tokenType == IMoltSpaceNFT.TokenType.SCOUT_SHIP, "MothershipMgr: not a scout ship");
        require(stats.mothershipId == 0, "MothershipMgr: already assigned");
        require(nftContract.ownerOfToken(tokenId) == ms.owner, "MothershipMgr: not owned by mothership owner");

        ms.scoutShipIds.push(tokenId);
        _rarityCount[mothershipId][stats.rarity]++;
        nftContract.setMothership(tokenId, mothershipId);

        // Recalculate rank
        ms.rank = uint8(_calculateRank(mothershipId));

        emit ScoutShipAdded(mothershipId, tokenId);
    }

    /**
     * @notice Add multiple Scout Ships to the mothership in a single transaction.
     * @param mothershipId  The mothership to add ships to
     * @param tokenIds      Array of scout ship token IDs to assign
     */
    function addScoutShips(uint256 mothershipId, uint256[] calldata tokenIds)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        MothershipData storage ms = _motherships[mothershipId];
        require(ms.scoutShipIds.length + tokenIds.length <= MAX_SCOUT_SHIPS, "MothershipMgr: would exceed max ships");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            IMoltSpaceNFT.TokenStats memory stats = nftContract.getTokenStats(tokenId);
            require(stats.tokenType == IMoltSpaceNFT.TokenType.SCOUT_SHIP, "MothershipMgr: not a scout ship");
            require(stats.mothershipId == 0, "MothershipMgr: already assigned");
            require(nftContract.ownerOfToken(tokenId) == ms.owner, "MothershipMgr: not owned by mothership owner");

            ms.scoutShipIds.push(tokenId);
            _rarityCount[mothershipId][stats.rarity]++;
            nftContract.setMothership(tokenId, mothershipId);

            emit ScoutShipAdded(mothershipId, tokenId);
        }

        // Recalculate rank once after all ships added
        ms.rank = uint8(_calculateRank(mothershipId));
    }

    /**
     * @notice Add an Explorer to a specific Scout Ship in the mothership.
     *         Explorer capacity is limited by the ship's rarity.
     */
    function addExplorer(uint256 mothershipId, uint256 shipTokenId, uint256 explorerTokenId)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        MothershipData storage ms = _motherships[mothershipId];
        require(ms.explorerIds.length < MAX_EXPLORERS, "MothershipMgr: max explorers reached");

        // Validate scout ship belongs to this mothership
        IMoltSpaceNFT.TokenStats memory shipStats = nftContract.getTokenStats(shipTokenId);
        require(shipStats.mothershipId == mothershipId, "MothershipMgr: ship not in this mothership");

        // Validate explorer
        IMoltSpaceNFT.TokenStats memory expStats = nftContract.getTokenStats(explorerTokenId);
        require(expStats.tokenType == IMoltSpaceNFT.TokenType.EXPLORER, "MothershipMgr: not an explorer");
        require(expStats.mothershipId == 0, "MothershipMgr: explorer already assigned");
        require(nftContract.ownerOfToken(explorerTokenId) == ms.owner, "MothershipMgr: not owned by mothership owner");

        // Check ship capacity
        uint8 maxCap = nftContract.maxExplorersForRarity(shipStats.rarity);
        require(_shipToExplorers[mothershipId][shipTokenId].length < maxCap, "MothershipMgr: ship at capacity");

        ms.explorerIds.push(explorerTokenId);
        _shipToExplorers[mothershipId][shipTokenId].push(explorerTokenId);
        ms.totalMP += expStats.miningPower;
        nftContract.setMothership(explorerTokenId, mothershipId);

        emit ExplorerAdded(mothershipId, shipTokenId, explorerTokenId);
    }

    /**
     * @notice Add multiple Explorers to a specific Scout Ship in a single transaction.
     * @param mothershipId    The mothership ID
     * @param shipTokenId     The scout ship to assign explorers to
     * @param explorerTokenIds Array of explorer token IDs to assign
     */
    function addExplorers(uint256 mothershipId, uint256 shipTokenId, uint256[] calldata explorerTokenIds)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        MothershipData storage ms = _motherships[mothershipId];
        require(ms.explorerIds.length + explorerTokenIds.length <= MAX_EXPLORERS, "MothershipMgr: would exceed max explorers");

        // Validate scout ship belongs to this mothership
        IMoltSpaceNFT.TokenStats memory shipStats = nftContract.getTokenStats(shipTokenId);
        require(shipStats.mothershipId == mothershipId, "MothershipMgr: ship not in this mothership");

        // Check ship capacity
        uint8 maxCap = nftContract.maxExplorersForRarity(shipStats.rarity);
        require(_shipToExplorers[mothershipId][shipTokenId].length + explorerTokenIds.length <= maxCap, "MothershipMgr: would exceed ship capacity");

        for (uint256 i = 0; i < explorerTokenIds.length; i++) {
            uint256 explorerTokenId = explorerTokenIds[i];
            IMoltSpaceNFT.TokenStats memory expStats = nftContract.getTokenStats(explorerTokenId);
            require(expStats.tokenType == IMoltSpaceNFT.TokenType.EXPLORER, "MothershipMgr: not an explorer");
            require(expStats.mothershipId == 0, "MothershipMgr: explorer already assigned");
            require(nftContract.ownerOfToken(explorerTokenId) == ms.owner, "MothershipMgr: not owned by mothership owner");

            ms.explorerIds.push(explorerTokenId);
            _shipToExplorers[mothershipId][shipTokenId].push(explorerTokenId);
            ms.totalMP += expStats.miningPower;
            nftContract.setMothership(explorerTokenId, mothershipId);

            emit ExplorerAdded(mothershipId, shipTokenId, explorerTokenId);
        }
    }

    // ═══════════════════════════════════════════
    //  XP & Leveling (called by ExpeditionManager)
    // ═══════════════════════════════════════════

    /**
     * @notice Add XP to a mothership. Auto-levels up if threshold reached.
     */
    function addXP(uint256 mothershipId, uint256 amount)
        external
        onlyGameManager
        mothershipActive(mothershipId)
    {
        MothershipData storage ms = _motherships[mothershipId];
        ms.totalXP += amount;

        // Check for level ups
        while (ms.level < MAX_LEVEL) {
            uint256 xpNeeded = _cumulativeXP(ms.level + 1);
            if (ms.totalXP >= xpNeeded) {
                ms.level++;
                uint8 tier = _getTier(ms.level);
                emit MothershipLevelUp(mothershipId, ms.level, tier);
            } else {
                break;
            }
        }
    }

    function setLastExpeditionTime(uint256 mothershipId, uint256 timestamp)
        external
        onlyGameManager
    {
        _motherships[mothershipId].lastExpeditionTime = timestamp;
    }

    // ═══════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════

    function getMothershipView(uint256 mothershipId) external view returns (MothershipView memory) {
        MothershipData storage ms = _motherships[mothershipId];
        return MothershipView({
            owner: ms.owner,
            scoutShipIds: ms.scoutShipIds,
            explorerIds: ms.explorerIds,
            rank: ms.rank,
            level: ms.level,
            totalXP: ms.totalXP,
            totalMP: ms.totalMP,
            active: ms.active,
            lastExpeditionTime: ms.lastExpeditionTime
        });
    }

    function getMothershipRank(uint256 mothershipId) external view returns (uint8) {
        return _motherships[mothershipId].rank;
    }

    function getMothershipLevel(uint256 mothershipId) external view returns (uint8) {
        return _motherships[mothershipId].level;
    }

    function getTotalMP(uint256 mothershipId) external view returns (uint256) {
        return _motherships[mothershipId].totalMP;
    }

    function getRewardBonus(uint256 mothershipId) external view returns (uint256) {
        uint8 level = _motherships[mothershipId].level;
        if (level == 0) return 0;
        return REWARD_BONUS_BPS[level - 1];
    }

    function getOwnerMothership(address owner) external view returns (uint256) {
        return _ownerToMothership[owner];
    }

    function getShipExplorers(uint256 mothershipId, uint256 shipId)
        external view returns (uint256[] memory)
    {
        return _shipToExplorers[mothershipId][shipId];
    }

    // ═══════════════════════════════════════════
    //  Internal: Rank Calculation
    // ═══════════════════════════════════════════

    /**
     * @dev Calculate rank based on majority rarity of scout ships.
     *      If no clear majority, the lowest rarity with the most ships wins.
     *      Maps: 5★→S(5), 4★→A(4), 3★→B(3), 2★→C(2), 1★→D(1)
     */
    function _calculateRank(uint256 mothershipId) internal view returns (Rank) {
        uint8 maxCount = 0;
        uint8 dominantRarity = 1; // default to lowest

        // Find rarity with highest count (tie breaks to lower rarity = lower rank)
        for (uint8 r = 1; r <= 5; r++) {
            uint8 count = _rarityCount[mothershipId][r];
            if (count > maxCount) {
                maxCount = count;
                dominantRarity = r;
            }
        }

        if (maxCount == 0) return Rank.NONE;

        // Map rarity to Rank: 1★→D(1), 2★→C(2), 3★→B(3), 4★→A(4), 5★→S(5)
        return Rank(dominantRarity);
    }

    // ═══════════════════════════════════════════
    //  Internal: XP / Tier Helpers
    // ═══════════════════════════════════════════

    /**
     * @dev Cumulative XP needed to reach a given level.
     */
    function _cumulativeXP(uint8 level) internal view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 0; i < level; i++) {
            total += XP_TABLE[i];
        }
        return total;
    }

    /**
     * @dev Get tier (1-6) for a given level.
     */
    function _getTier(uint8 level) internal pure returns (uint8) {
        if (level <= 5)  return 1;
        if (level <= 10) return 2;
        if (level <= 15) return 3;
        if (level <= 20) return 4;
        if (level <= 24) return 5;
        return 6; // level 25
    }
}
