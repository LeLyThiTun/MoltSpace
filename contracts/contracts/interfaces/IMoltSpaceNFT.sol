// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMoltSpaceNFT {
    enum TokenType { NONE, SCOUT_SHIP, EXPLORER }

    struct TokenStats {
        TokenType tokenType;
        uint8 rarity;       // 1-5 stars
        uint256 miningPower; // MP (explorers only, 0 for ships)
        uint256 mintedAt;
        uint256 mothershipId; // 0 = unassigned
    }

    function mintScoutShip(address to, uint256 randomSeed) external returns (uint256 tokenId);
    function mintExplorer(address to, uint256 randomSeed) external returns (uint256 tokenId);
    function burn(uint256 tokenId) external;

    function getTokenStats(uint256 tokenId) external view returns (TokenStats memory);
    function setMothership(uint256 tokenId, uint256 mothershipId) external;
    function ownerOfToken(uint256 tokenId) external view returns (address);
    function maxExplorersForRarity(uint8 rarity) external pure returns (uint8);

    event ScoutShipMinted(uint256 indexed tokenId, uint8 rarity, address indexed owner);
    event ExplorerMinted(uint256 indexed tokenId, uint8 rarity, uint256 miningPower, address indexed owner);
    event NFTBurned(uint256 indexed tokenId, uint256 refundAmount, address indexed owner);
}
