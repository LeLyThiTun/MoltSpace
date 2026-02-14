// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IExpeditionManager {
    enum ExpeditionStatus { NONE, PENDING, SUCCESS, FAILED }

    struct Expedition {
        uint256 mothershipId;
        uint8 planetId;
        address player;
        ExpeditionStatus status;
        uint256 reward;
        uint256 startedAt;
        uint256 resolvedAt;
    }

    struct PlanetConfig {
        uint8 tier;
        uint8 suggestedRank; // Rank enum as uint8 (1=D,2=C,3=B,4=A,5=S)
        uint256 requiredMP;
        uint256 baseReward;  // in wei
    }

    function startExpedition(uint256 mothershipId, uint8 planetId, address player) external returns (uint256 expeditionId);
    function resolveExpedition(uint256 expeditionId, uint256 randomSeed) external;
    function claimReward(address player) external;

    function getExpedition(uint256 expeditionId) external view returns (Expedition memory);
    function getPlanetConfig(uint8 planetId) external view returns (PlanetConfig memory);
    function getSuccessRate(uint8 mothershipRank, uint8 planetId) external view returns (uint256);
    function getPendingReward(address player) external view returns (uint256);

    event ExpeditionStarted(uint256 indexed expeditionId, uint256 indexed mothershipId, uint8 planetId, address indexed player);
    event ExpeditionResolved(uint256 indexed expeditionId, bool success, uint256 reward);
    event RewardClaimed(address indexed player, uint256 amount);
}
