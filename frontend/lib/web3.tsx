"use client";

import React, { createContext, useContext, useMemo } from "react";
import { JsonRpcProvider, Contract, Network } from "ethers";

// ═══════════════════════════════════════════
//  Contract ABIs (read-only view functions + events for scanning)
// ═══════════════════════════════════════════

const GAME_MANAGER_ABI = [
  "function SCOUT_SHIP_COST() external view returns (uint256)",
  "function EXPLORER_COST() external view returns (uint256)",
  "function MAX_BATCH_SIZE() external view returns (uint256)",
  "function treasury() external view returns (address)",
  "event ScoutShipsMinted(address indexed player, uint256 amount, uint256[] tokenIds)",
  "event ExplorersMinted(address indexed player, uint256 amount, uint256[] tokenIds)",
];

const MOTHERSHIP_MANAGER_ABI = [
  "function getMothershipView(uint256 mothershipId) external view returns (tuple(address owner, uint256[] scoutShipIds, uint256[] explorerIds, uint8 rank, uint8 level, uint256 totalXP, uint256 totalMP, bool active, uint256 lastExpeditionTime))",
  "function getOwnerMothership(address owner) external view returns (uint256)",
  "function getMothershipRank(uint256 mothershipId) external view returns (uint8)",
  "function getMothershipLevel(uint256 mothershipId) external view returns (uint8)",
  "function getTotalMP(uint256 mothershipId) external view returns (uint256)",
  "function getRewardBonus(uint256 mothershipId) external view returns (uint256)",
  "function getShipExplorers(uint256 mothershipId, uint256 shipId) external view returns (uint256[])",
  "event MothershipCreated(uint256 indexed mothershipId, address indexed owner)",
  "event MothershipDisbanded(uint256 indexed mothershipId)",
  "event ScoutShipAdded(uint256 indexed mothershipId, uint256 indexed tokenId)",
  "event ExplorerAdded(uint256 indexed mothershipId, uint256 indexed shipTokenId, uint256 indexed explorerTokenId)",
  "event MothershipLevelUp(uint256 indexed mothershipId, uint8 newLevel, uint8 tier)",
];

const NFT_ABI = [
  "function getTokenStats(uint256 tokenId) external view returns (tuple(uint8 tokenType, uint8 rarity, uint256 miningPower, uint256 mintedAt, uint256 mothershipId))",
  "function ownerOfToken(uint256 tokenId) external view returns (address)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function nextTokenId() external view returns (uint256)",
  "event ScoutShipMinted(uint256 indexed tokenId, uint8 rarity, address indexed owner)",
  "event ExplorerMinted(uint256 indexed tokenId, uint8 rarity, uint256 miningPower, address indexed owner)",
  "event NFTBurned(uint256 indexed tokenId, uint256 refund, address indexed owner)",
];

const EXPEDITION_MANAGER_ABI = [
  "function getExpedition(uint256 expeditionId) external view returns (tuple(uint256 mothershipId, uint8 planetId, address player, uint8 status, uint256 reward, uint256 startedAt, uint256 resolvedAt))",
  "function getPlanetConfig(uint8 planetId) external view returns (tuple(uint8 tier, uint8 suggestedRank, uint256 requiredMP, uint256 baseReward))",
  "function getSuccessRate(uint8 mothershipRank, uint8 planetId) external view returns (uint256)",
  "function nextExpeditionId() external view returns (uint256)",
  "function getPendingReward(address player) external view returns (uint256)",
  "function COOLDOWN() external view returns (uint256)",
  "event ExpeditionStarted(uint256 indexed expeditionId, uint256 indexed mothershipId, uint8 planetId, address indexed player)",
  "event ExpeditionResolved(uint256 indexed expeditionId, bool success, uint256 reward)",
  "event RewardClaimed(address indexed player, uint256 amount)",
];

// Contract addresses
const CONTRACTS = {
  gameManager: process.env.NEXT_PUBLIC_GAME_MANAGER || "",
  mothershipManager: process.env.NEXT_PUBLIC_MOTHERSHIP_MANAGER || "",
  nft: process.env.NEXT_PUBLIC_NFT || "",
  expeditionManager: process.env.NEXT_PUBLIC_EXPEDITION_MANAGER || "",
};

// Monad RPC (defaults to mainnet)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.monad.xyz";

// ═══════════════════════════════════════════
//  Monitor Context (read-only)
// ═══════════════════════════════════════════

interface MonitorContextType {
  provider: JsonRpcProvider;
  contracts: {
    gameManager: Contract;
    mothershipManager: Contract;
    nft: Contract;
    expeditionManager: Contract;
  };
  addresses: typeof CONTRACTS;
}

const MonitorContext = createContext<MonitorContextType | null>(null);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    // Monad network — disable ENS (not supported on chainId 143)
    const monadNetwork = new Network("monad", 143);
    const provider = new JsonRpcProvider(RPC_URL, monadNetwork, { staticNetwork: true });

    const contracts = {
      gameManager: new Contract(CONTRACTS.gameManager, GAME_MANAGER_ABI, provider),
      mothershipManager: new Contract(CONTRACTS.mothershipManager, MOTHERSHIP_MANAGER_ABI, provider),
      nft: new Contract(CONTRACTS.nft, NFT_ABI, provider),
      expeditionManager: new Contract(CONTRACTS.expeditionManager, EXPEDITION_MANAGER_ABI, provider),
    };

    return { provider, contracts, addresses: CONTRACTS };
  }, []);

  return (
    <MonitorContext.Provider value={value}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor() {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error("useMonitor must be used within MonitorProvider");
  return ctx;
}
