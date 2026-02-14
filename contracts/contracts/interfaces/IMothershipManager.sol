// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMothershipManager {
    enum Rank { NONE, D, C, B, A, S } // 0-5

    struct Mothership {
        address owner;
        uint256[] scoutShipIds;
        uint256[] explorerIds;
        mapping(uint256 => uint256[]) shipToExplorers; // shipId => explorerIds
        Rank rank;
        uint8 level;
        uint256 totalXP;
        uint256 totalMP;
        bool active;
        uint256 lastExpeditionTime;
    }

    // Note: Solidity cannot return structs with mappings, so we use a view struct
    struct MothershipView {
        address owner;
        uint256[] scoutShipIds;
        uint256[] explorerIds;
        uint8 rank;    // Rank enum as uint8
        uint8 level;
        uint256 totalXP;
        uint256 totalMP;
        bool active;
        uint256 lastExpeditionTime;
    }

    function createMothership(address player) external returns (uint256 mothershipId);
    function disbandMothership(uint256 mothershipId, address player) external;
    function addScoutShip(uint256 mothershipId, uint256 tokenId) external;
    function addScoutShips(uint256 mothershipId, uint256[] calldata tokenIds) external;
    function addExplorer(uint256 mothershipId, uint256 shipTokenId, uint256 explorerTokenId) external;
    function addExplorers(uint256 mothershipId, uint256 shipTokenId, uint256[] calldata explorerTokenIds) external;

    function addXP(uint256 mothershipId, uint256 amount) external;
    function setLastExpeditionTime(uint256 mothershipId, uint256 timestamp) external;

    function getMothershipView(uint256 mothershipId) external view returns (MothershipView memory);
    function getMothershipRank(uint256 mothershipId) external view returns (uint8);
    function getMothershipLevel(uint256 mothershipId) external view returns (uint8);
    function getTotalMP(uint256 mothershipId) external view returns (uint256);
    function getRewardBonus(uint256 mothershipId) external view returns (uint256);
    function getOwnerMothership(address owner) external view returns (uint256);

    event MothershipCreated(uint256 indexed mothershipId, address indexed owner);
    event MothershipDisbanded(uint256 indexed mothershipId);
    event ScoutShipAdded(uint256 indexed mothershipId, uint256 indexed tokenId);
    event ExplorerAdded(uint256 indexed mothershipId, uint256 indexed shipTokenId, uint256 indexed explorerTokenId);
    event MothershipLevelUp(uint256 indexed mothershipId, uint8 newLevel, uint8 tier);
}
