// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMoltSpaceNFT.sol";

/**
 * @title MoltSpaceNFT
 * @notice ERC-1155 NFT contract for MoltSpace game.
 *         Manages Scout Ships and Explorers with gacha-based rarity minting.
 *         $MON is Monad's native token — mint costs are paid via msg.value.
 *
 *  Mint costs:  Scout Ship = 20 MON, Explorer = 10 MON  (fixed, rarity is random)
 *  Burn refund: 20% of mint cost (4 MON / 2 MON)
 */
contract MoltSpaceNFT is ERC1155, Ownable, ReentrancyGuard, IMoltSpaceNFT {

    // ═══════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════

    uint256 public constant SCOUT_SHIP_COST = 20 ether; // 20 MON
    uint256 public constant EXPLORER_COST   = 10 ether; // 10 MON
    uint256 public constant BURN_REFUND_BPS = 2000;      // 20% in basis points

    // Drop rate thresholds (cumulative, out of 100)
    // 5★=1%, 4★=5%, 3★=15%, 2★=35%, 1★=44%  → cumulative: 1, 6, 21, 56, 100
    uint8[5] private DROP_THRESHOLDS = [1, 6, 21, 56, 100];

    // Explorer Mining Power ranges per rarity [min, max] (scaled by 1e18)
    uint256[2][5] private MP_RANGES = [
        [uint256(200 ether), uint256(255 ether)], // 5★
        [uint256(150 ether), uint256(200 ether)], // 4★
        [uint256(100 ether), uint256(150 ether)], // 3★
        [uint256( 50 ether), uint256(100 ether)], // 2★
        [uint256( 15 ether), uint256( 50 ether)]  // 1★
    ];

    // Max explorers a scout ship can carry, by rarity
    uint8[5] private MAX_EXPLORERS = [5, 4, 3, 2, 1]; // 5★..1★

    // ═══════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════

    uint256 private _nextTokenId = 1;

    mapping(uint256 => TokenStats) private _stats;
    mapping(uint256 => address)    private _tokenOwners; // track owners for burn refund

    mapping(address => bool) public authorizedCallers; // game contracts allowed to call

    // ═══════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "MoltSpaceNFT: caller is not authorized");
        _;
    }

    // ═══════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════

    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}

    // ═══════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════

    function setAuthorized(address _caller, bool _authorized) external onlyOwner {
        require(_caller != address(0), "MoltSpaceNFT: zero address");
        authorizedCallers[_caller] = _authorized;
    }

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    // ═══════════════════════════════════════════
    //  Minting (called by GameManager)
    // ═══════════════════════════════════════════

    /**
     * @notice Mint a Scout Ship. Rarity determined by randomSeed.
     * @param to      Recipient address
     * @param randomSeed  Random value (from VRF or commit-reveal)
     * @return tokenId The minted token ID
     */
    function mintScoutShip(address to, uint256 randomSeed)
        external
        onlyAuthorized
        nonReentrant
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId++;
        uint8 rarity = _rollRarity(randomSeed);

        _stats[tokenId] = TokenStats({
            tokenType: TokenType.SCOUT_SHIP,
            rarity: rarity,
            miningPower: 0,
            mintedAt: block.timestamp,
            mothershipId: 0
        });

        _tokenOwners[tokenId] = to;
        _mint(to, tokenId, 1, "");

        emit ScoutShipMinted(tokenId, rarity, to);
    }

    /**
     * @notice Mint an Explorer. Rarity and MP determined by randomSeed.
     * @param to      Recipient address
     * @param randomSeed  Random value (from VRF or commit-reveal)
     * @return tokenId The minted token ID
     */
    function mintExplorer(address to, uint256 randomSeed)
        external
        onlyAuthorized
        nonReentrant
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId++;
        uint8 rarity = _rollRarity(randomSeed);
        uint256 mp = _rollMiningPower(rarity, randomSeed);

        _stats[tokenId] = TokenStats({
            tokenType: TokenType.EXPLORER,
            rarity: rarity,
            miningPower: mp,
            mintedAt: block.timestamp,
            mothershipId: 0
        });

        _tokenOwners[tokenId] = to;
        _mint(to, tokenId, 1, "");

        emit ExplorerMinted(tokenId, rarity, mp, to);
    }

    // ═══════════════════════════════════════════
    //  Burn (20% refund)
    // ═══════════════════════════════════════════

    /**
     * @notice Burn an NFT and receive 20% of mint cost back in $MON.
     *         Scout Ship refund: 4 MON, Explorer refund: 2 MON.
     * @param tokenId The token to burn
     */
    function burn(uint256 tokenId) external nonReentrant {
        require(_tokenOwners[tokenId] == msg.sender, "MoltSpaceNFT: not token owner");
        require(_stats[tokenId].mothershipId == 0, "MoltSpaceNFT: assigned to mothership");
        require(_stats[tokenId].tokenType != TokenType.NONE, "MoltSpaceNFT: invalid token");

        uint256 refund;
        if (_stats[tokenId].tokenType == TokenType.SCOUT_SHIP) {
            refund = (SCOUT_SHIP_COST * BURN_REFUND_BPS) / 10000; // 4 MON
        } else {
            refund = (EXPLORER_COST * BURN_REFUND_BPS) / 10000;   // 2 MON
        }

        // Burn the token
        _burn(msg.sender, tokenId, 1);
        delete _stats[tokenId];
        delete _tokenOwners[tokenId];

        // Refund native $MON
        (bool success, ) = payable(msg.sender).call{value: refund}("");
        require(success, "MoltSpaceNFT: refund transfer failed");

        emit NFTBurned(tokenId, refund, msg.sender);
    }

    // ═══════════════════════════════════════════
    //  Game Manager Hooks
    // ═══════════════════════════════════════════

    /**
     * @notice Assign or unassign a token to a mothership. Called by GameManager.
     */
    function setMothership(uint256 tokenId, uint256 mothershipId) external onlyAuthorized {
        require(_stats[tokenId].tokenType != TokenType.NONE, "MoltSpaceNFT: invalid token");
        _stats[tokenId].mothershipId = mothershipId;
    }

    // ═══════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════

    function getTokenStats(uint256 tokenId) external view returns (TokenStats memory) {
        require(_stats[tokenId].tokenType != TokenType.NONE, "MoltSpaceNFT: token does not exist");
        return _stats[tokenId];
    }

    function ownerOfToken(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }

    function maxExplorersForRarity(uint8 rarity) external pure returns (uint8) {
        require(rarity >= 1 && rarity <= 5, "MoltSpaceNFT: invalid rarity");
        // 5★=5, 4★=4, 3★=3, 2★=2, 1★=1
        return uint8(rarity);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ═══════════════════════════════════════════
    //  Internal: Gacha Logic
    // ═══════════════════════════════════════════

    /**
     * @dev Roll rarity from random seed. Returns 1-5 (stars).
     *      Drop rates: 5★=1%, 4★=5%, 3★=15%, 2★=35%, 1★=44%
     */
    function _rollRarity(uint256 seed) internal view returns (uint8) {
        uint256 roll = seed % 100; // 0-99
        for (uint8 i = 0; i < 5; i++) {
            if (roll < DROP_THRESHOLDS[i]) {
                return 5 - i; // 5★, 4★, 3★, 2★, 1★
            }
        }
        return 1; // fallback: 1★
    }

    /**
     * @dev Roll Mining Power for an explorer within rarity range.
     */
    function _rollMiningPower(uint8 rarity, uint256 seed) internal view returns (uint256) {
        uint8 idx = 5 - rarity; // rarity 5 -> index 0, rarity 1 -> index 4
        uint256 minMP = MP_RANGES[idx][0];
        uint256 maxMP = MP_RANGES[idx][1];
        uint256 range = maxMP - minMP;

        // Use a different portion of the seed for MP
        uint256 mpSeed = uint256(keccak256(abi.encodePacked(seed, "MP")));
        return minMP + (mpSeed % (range + 1));
    }

    // ═══════════════════════════════════════════
    //  Transfer Hooks
    // ═══════════════════════════════════════════

    /**
     * @dev Override to track ownership and prevent transfer of assigned tokens.
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        for (uint256 i = 0; i < ids.length; i++) {
            if (from != address(0) && to != address(0)) {
                // Regular transfer (not mint/burn) — block if assigned to mothership
                require(
                    _stats[ids[i]].mothershipId == 0,
                    "MoltSpaceNFT: cannot transfer assigned token"
                );
            }
            // Update ownership tracking
            if (to != address(0)) {
                _tokenOwners[ids[i]] = to;
            }
        }
        super._update(from, to, ids, values);
    }

    // ═══════════════════════════════════════════
    //  Admin: Emergency Withdraw
    // ═══════════════════════════════════════════

    /**
     * @notice Emergency withdraw MON from this contract (admin only).
     * @param to      Recipient address
     * @param amount  Amount to withdraw (in wei). Use 0 to withdraw all.
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "MoltSpaceNFT: zero address");
        uint256 toSend = amount == 0 ? address(this).balance : amount;
        require(toSend <= address(this).balance, "MoltSpaceNFT: insufficient balance");
        (bool sent, ) = payable(to).call{value: toSend}("");
        require(sent, "MoltSpaceNFT: withdraw failed");
        emit EmergencyWithdrawn(to, toSend);
    }

    event EmergencyWithdrawn(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════
    //  Receive $MON
    // ═══════════════════════════════════════════

    receive() external payable {}
}
