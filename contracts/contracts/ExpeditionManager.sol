// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IExpeditionManager.sol";
import "./interfaces/IMothershipManager.sol";
import "./interfaces/IMoltSpaceNFT.sol";

/**
 * @title ExpeditionManager
 * @notice Manages expeditions: validates requirements, calculates success rates,
 *         distributes $MON rewards. 30 planets across 4 zones.
 *
 *  Flow:  startExpedition() → VRF callback → resolveExpedition() → reward or fail
 *  XP:    +5 per expedition regardless of outcome
 *  Reward: Base × (1 + LevelBonus) × (TotalMP / RequiredMP)
 */
contract ExpeditionManager is Ownable, ReentrancyGuard, IExpeditionManager {

    // ═══════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════

    uint256 public constant XP_PER_EXPEDITION = 5;
    uint256 public constant COOLDOWN = 12 hours;
    uint8   public constant MAX_PLANET = 30;

    // ═══════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════

    IMothershipManager public mothershipManager;
    address public gameManager;

    uint256 private _nextExpeditionId = 1;
    mapping(uint256 => Expedition) private _expeditions;

    // Pending rewards: player => claimable amount (when pool was insufficient)
    mapping(address => uint256) private _pendingRewards;

    // Planet configs (planetId 1-30)
    mapping(uint8 => PlanetConfig) private _planets;

    // Success rate table: successRate[planetId][rank] = rate in basis points (e.g. 8500 = 85%)
    // Rank: 1=D, 2=C, 3=B, 4=A, 5=S
    mapping(uint8 => mapping(uint8 => uint256)) private _successRates;

    // ═══════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════

    modifier onlyGameManager() {
        require(msg.sender == gameManager, "ExpeditionMgr: not GameManager");
        _;
    }

    // ═══════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════

    constructor(address _mothershipManager) Ownable(msg.sender) {
        mothershipManager = IMothershipManager(_mothershipManager);
        _initPlanets();
        _initSuccessRates();
    }

    function setGameManager(address _gameManager) external onlyOwner {
        require(_gameManager != address(0), "ExpeditionMgr: zero address");
        gameManager = _gameManager;
    }

    // ═══════════════════════════════════════════
    //  Expedition Lifecycle
    // ═══════════════════════════════════════════

    /**
     * @notice Start an expedition. Validates MP requirements and cooldown.
     * @param mothershipId  The mothership to send
     * @param planetId      Target planet (1-30)
     * @return expeditionId The created expedition ID
     */
    function startExpedition(uint256 mothershipId, uint8 planetId, address player)
        external
        onlyGameManager
        nonReentrant
        returns (uint256 expeditionId)
    {
        require(planetId >= 1 && planetId <= MAX_PLANET, "ExpeditionMgr: invalid planet");

        IMothershipManager.MothershipView memory ms = mothershipManager.getMothershipView(mothershipId);
        require(ms.active, "ExpeditionMgr: mothership not active");
        require(ms.owner == player, "ExpeditionMgr: not mothership owner");
        require(ms.scoutShipIds.length > 0, "ExpeditionMgr: no scout ships");
        require(ms.explorerIds.length > 0, "ExpeditionMgr: no explorers");

        // Check cooldown
        require(
            block.timestamp >= ms.lastExpeditionTime + COOLDOWN,
            "ExpeditionMgr: cooldown not finished"
        );

        // Check MP requirement
        PlanetConfig memory planet = _planets[planetId];
        require(ms.totalMP >= planet.requiredMP, "ExpeditionMgr: insufficient MP");

        // Create expedition
        expeditionId = _nextExpeditionId++;
        _expeditions[expeditionId] = Expedition({
            mothershipId: mothershipId,
            planetId: planetId,
            player: player,
            status: ExpeditionStatus.PENDING,
            reward: 0,
            startedAt: block.timestamp,
            resolvedAt: 0
        });

        // Mark cooldown
        mothershipManager.setLastExpeditionTime(mothershipId, block.timestamp);

        emit ExpeditionStarted(expeditionId, mothershipId, planetId, player);
    }

    /**
     * @notice Resolve an expedition with a random seed (from VRF or GameManager).
     *         Determines success/failure and distributes rewards.
     * @param expeditionId  The expedition to resolve
     * @param randomSeed    Random value for outcome determination
     */
    function resolveExpedition(uint256 expeditionId, uint256 randomSeed)
        external
        onlyGameManager
        nonReentrant
    {
        Expedition storage exp = _expeditions[expeditionId];
        require(exp.status == ExpeditionStatus.PENDING, "ExpeditionMgr: not pending");

        uint8 mothershipRank = mothershipManager.getMothershipRank(exp.mothershipId);
        uint256 successRate = _successRates[exp.planetId][mothershipRank];

        // Roll for success (0-9999 basis points)
        uint256 roll = randomSeed % 10000;
        bool success = roll < successRate;

        uint256 reward = 0;
        if (success) {
            reward = _calculateReward(exp.mothershipId, exp.planetId);
            exp.status = ExpeditionStatus.SUCCESS;
            exp.reward = reward;

            // Try to transfer reward; if pool insufficient, store as pending
            if (address(this).balance >= reward) {
                (bool sent, ) = payable(exp.player).call{value: reward}("");
                if (!sent) {
                    _pendingRewards[exp.player] += reward;
                }
            } else {
                _pendingRewards[exp.player] += reward;
            }
        } else {
            exp.status = ExpeditionStatus.FAILED;
        }

        exp.resolvedAt = block.timestamp;

        // Award XP regardless of outcome
        mothershipManager.addXP(exp.mothershipId, XP_PER_EXPEDITION);

        emit ExpeditionResolved(expeditionId, success, reward);
    }

    // ═══════════════════════════════════════════
    //  Claim Pending Rewards
    // ═══════════════════════════════════════════

    /**
     * @notice Claim accumulated pending rewards (when pool was insufficient at resolve time).
     * @param player The player claiming rewards (passed by GameManager)
     */
    function claimReward(address player) external onlyGameManager nonReentrant {
        uint256 amount = _pendingRewards[player];
        require(amount > 0, "ExpeditionMgr: no pending reward");
        require(address(this).balance >= amount, "ExpeditionMgr: pool insufficient, try later");

        _pendingRewards[player] = 0;

        (bool sent, ) = payable(player).call{value: amount}("");
        require(sent, "ExpeditionMgr: transfer failed");

        emit RewardClaimed(player, amount);
    }

    // ═══════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════

    function getExpedition(uint256 expeditionId) external view returns (Expedition memory) {
        return _expeditions[expeditionId];
    }

    function getPendingReward(address player) external view returns (uint256) {
        return _pendingRewards[player];
    }

    function getPlanetConfig(uint8 planetId) external view returns (PlanetConfig memory) {
        require(planetId >= 1 && planetId <= MAX_PLANET, "ExpeditionMgr: invalid planet");
        return _planets[planetId];
    }

    function getSuccessRate(uint8 mothershipRank, uint8 planetId) external view returns (uint256) {
        return _successRates[planetId][mothershipRank];
    }

    function nextExpeditionId() external view returns (uint256) {
        return _nextExpeditionId;
    }

    // ═══════════════════════════════════════════
    //  Internal: Reward Calculation
    // ═══════════════════════════════════════════

    /**
     * @dev Final Reward = BaseReward × (1 + LevelBonus) × (TotalMP / RequiredMP)
     *      All calculations in basis points to avoid floating point.
     */
    function _calculateReward(uint256 mothershipId, uint8 planetId) internal view returns (uint256) {
        PlanetConfig memory planet = _planets[planetId];
        uint256 totalMP = mothershipManager.getTotalMP(mothershipId);
        uint256 levelBonus = mothershipManager.getRewardBonus(mothershipId); // in BPS

        // baseReward × (10000 + levelBonus) / 10000 × totalMP / requiredMP
        uint256 reward = planet.baseReward;
        reward = (reward * (10000 + levelBonus)) / 10000;
        reward = (reward * totalMP) / planet.requiredMP;

        return reward;
    }

    // ═══════════════════════════════════════════
    //  Internal: Planet Initialization
    // ═══════════════════════════════════════════

    function _initPlanets() internal {
        // Zone 1: Planets 1-10, Suggested Rank C (2) — Target ROI ≥ 7 days
        _setPlanet( 1, 1, 2,    50 ether,   3.5 ether);
        _setPlanet( 2, 1, 2,    80 ether,   3.5 ether);
        _setPlanet( 3, 1, 2,   120 ether,   3.5 ether);
        _setPlanet( 4, 1, 2,   170 ether,     7 ether);
        _setPlanet( 5, 1, 2,   230 ether,     7 ether);
        _setPlanet( 6, 1, 2,   300 ether,    10 ether);
        _setPlanet( 7, 1, 2,   380 ether,    10 ether);
        _setPlanet( 8, 1, 2,   480 ether,  13.5 ether);
        _setPlanet( 9, 1, 2,   600 ether,    17 ether);
        _setPlanet(10, 1, 2,   750 ether,    20 ether);

        // Zone 2: Planets 11-20, Suggested Rank B (3) — Target ROI ≥ 7 days
        _setPlanet(11, 2, 3,   950 ether,    40 ether);
        _setPlanet(12, 2, 3,  1200 ether,    50 ether);
        _setPlanet(13, 2, 3,  1500 ether,    60 ether);
        _setPlanet(14, 2, 3,  1900 ether,    75 ether);
        _setPlanet(15, 2, 3,  2400 ether,    95 ether);
        _setPlanet(16, 2, 3,  3000 ether,   120 ether);
        _setPlanet(17, 2, 3,  3700 ether,   145 ether);
        _setPlanet(18, 2, 3,  4500 ether,   175 ether);
        _setPlanet(19, 2, 3,  5400 ether,   210 ether);
        _setPlanet(20, 2, 3,  6400 ether,   250 ether);

        // Zone 3: Planets 21-25, Suggested Rank A (4) — Target ROI ~3 days
        _setPlanet(21, 3, 4,  7500 ether,   715 ether);
        _setPlanet(22, 3, 4,  8500 ether,   810 ether);
        _setPlanet(23, 3, 4,  9500 ether,   910 ether);
        _setPlanet(24, 3, 4, 10500 ether,  1010 ether);
        _setPlanet(25, 3, 4, 11000 ether,  1060 ether);

        // Zone 4: Planets 26-30, Suggested Rank S (5) — Target ROI ~3 days
        _setPlanet(26, 4, 5, 11300 ether,  1065 ether);
        _setPlanet(27, 4, 5, 11600 ether,  1090 ether);
        _setPlanet(28, 4, 5, 11800 ether,  1110 ether);
        _setPlanet(29, 4, 5, 11900 ether,  1110 ether);
        _setPlanet(30, 4, 5, 12000 ether,  1125 ether);
    }

    function _setPlanet(uint8 id, uint8 tier, uint8 suggestedRank, uint256 reqMP, uint256 baseReward) internal {
        _planets[id] = PlanetConfig({
            tier: tier,
            suggestedRank: suggestedRank,
            requiredMP: reqMP,
            baseReward: baseReward
        });
    }

    // ═══════════════════════════════════════════
    //  Internal: Success Rate Initialization
    // ═══════════════════════════════════════════

    /**
     * @dev Initialize success rates for all 30 planets × 5 ranks.
     *      Values from the GDD, stored in basis points (8500 = 85%).
     *      Rank: 1=D, 2=C, 3=B, 4=A, 5=S
     */
    function _initSuccessRates() internal {
        // Zone 1: Planets 1-10
        // Planet 1:  D=85%, C=88%, B=91%, A=93%, S=97%
        _setRates( 1, 8500, 8800, 9100, 9300, 9700);
        _setRates( 2, 8300, 8600, 8900, 9100, 9500);
        _setRates( 3, 8100, 8400, 8700, 8900, 9300);
        _setRates( 4, 7900, 8200, 8500, 8700, 9100);
        _setRates( 5, 7700, 8000, 8300, 8500, 8900);
        _setRates( 6, 7500, 7800, 8100, 8300, 8700);
        _setRates( 7, 7300, 7600, 7900, 8100, 8500);
        _setRates( 8, 7100, 7400, 7700, 7900, 8300);
        _setRates( 9, 6900, 7200, 7500, 7700, 8100);
        _setRates(10, 6700, 7000, 7300, 7500, 7900);

        // Zone 2: Planets 11-20
        _setRates(11, 6000, 6500, 6700, 7100, 7400);
        _setRates(12, 5800, 6300, 6500, 6900, 7200);
        _setRates(13, 5600, 6100, 6300, 6700, 7000);
        _setRates(14, 5400, 5900, 6100, 6500, 6800);
        _setRates(15, 5200, 5700, 5900, 6300, 6600);
        _setRates(16, 5000, 5500, 5700, 6100, 6400);
        _setRates(17, 4800, 5300, 5500, 5900, 6200);
        _setRates(18, 4600, 5100, 5300, 5700, 6000);
        _setRates(19, 4400, 4900, 5100, 5500, 5800);
        _setRates(20, 4200, 4700, 4900, 5300, 5600);

        // Zone 3: Planets 21-25
        _setRates(21, 4100, 4300, 4700, 5200, 5500);
        _setRates(22, 4100, 4300, 4700, 5200, 5500);
        _setRates(23, 4100, 4300, 4700, 5200, 5500);
        _setRates(24, 4100, 4300, 4700, 5200, 5500);
        _setRates(25, 4100, 4300, 4700, 5200, 5500);

        // Zone 4: Planets 26-30
        _setRates(26, 3900, 4000, 4500, 5000, 5300);
        _setRates(27, 3900, 4000, 4500, 5000, 5300);
        _setRates(28, 3900, 4000, 4500, 5000, 5300);
        _setRates(29, 3900, 4000, 4500, 5000, 5300);
        _setRates(30, 3900, 4000, 4500, 5000, 5300);
    }

    function _setRates(uint8 planetId, uint256 d, uint256 c, uint256 b, uint256 a, uint256 s) internal {
        _successRates[planetId][1] = d; // Rank D
        _successRates[planetId][2] = c; // Rank C
        _successRates[planetId][3] = b; // Rank B
        _successRates[planetId][4] = a; // Rank A
        _successRates[planetId][5] = s; // Rank S
    }

    // ═══════════════════════════════════════════
    //  Admin: Withdraw from reward pool
    // ═══════════════════════════════════════════

    /**
     * @notice Owner can withdraw MON from reward pool.
     * @param amount  Amount to withdraw (in wei). Use 0 to withdraw all.
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "ExpeditionMgr: pool empty");

        uint256 toSend = amount == 0 ? bal : amount;
        require(toSend <= bal, "ExpeditionMgr: amount exceeds pool");

        (bool sent, ) = payable(owner()).call{value: toSend}("");
        require(sent, "ExpeditionMgr: withdraw failed");

        emit PoolWithdrawn(owner(), toSend);
    }

    event PoolWithdrawn(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════
    //  Receive $MON (for reward pool)
    // ═══════════════════════════════════════════

    receive() external payable {}
}
