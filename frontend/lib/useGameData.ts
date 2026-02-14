"use client";

import { useState, useEffect, useCallback } from "react";
import { useMonitor } from "./web3";
import { formatEther } from "ethers";

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface TokenStats {
  tokenId: number;
  tokenType: number; // 1 = SCOUT_SHIP, 2 = EXPLORER
  rarity: number;    // 1-5
  miningPower: bigint;
  mintedAt: number;
  mothershipId: number;
}

export interface MothershipData {
  id: number;
  owner: string;
  scoutShipIds: number[];
  explorerIds: number[];
  rank: number;
  level: number;
  totalXP: number;
  totalMP: bigint;
  active: boolean;
  lastExpeditionTime: number;
  rewardBonus: number;
}

export interface ShipWithExplorers {
  ship: TokenStats;
  explorers: TokenStats[];
}

export interface AgentInfo {
  address: string;
  mothershipId: number;
  rank: number;
  level: number;
  totalMP: string;     // formatted
  totalXP: number;
  active: boolean;
  lastExpeditionTime: number;
  totalEarned: string; // formatted MON
  shipsCount: number;
  explorersCount: number;
}

export interface AgentLog {
  type: "mint_ships" | "mint_explorers" | "expedition_started" | "expedition_resolved" | "reward_claimed" | "mothership_created";
  timestamp: number;
  blockNumber: number;
  data: Record<string, string | number | boolean>;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  mothershipId: number;
  level: number;
  mothershipRank: number;
  totalEarned: string;
  lastActive: number;
}

// ═══════════════════════════════════════════
//  XP Table
// ═══════════════════════════════════════════
const XP_TABLE = [0, 10, 22, 37, 55, 76, 100, 128, 160, 197, 240, 290, 348, 416, 496, 590, 700, 830, 985, 1170, 1395, 1670, 2010, 2435, 2975, 3770];

export function getXPForNextLevel(level: number, totalXP: number): { current: number; required: number } {
  if (level >= 25) return { current: totalXP, required: totalXP };
  const nextRequired = XP_TABLE[level + 1] || Infinity;
  const currentRequired = XP_TABLE[level] || 0;
  return {
    current: totalXP - currentRequired,
    required: nextRequired - currentRequired,
  };
}

// ═══════════════════════════════════════════
//  Hook: Agent List (all registered agents)
//  NOTE: Uses view-function iteration instead of events
//  because Monad mainnet limits eth_getLogs to 100-block range.
// ═══════════════════════════════════════════

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useAgentList() {
  const { contracts } = useMonitor();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const agentList: AgentInfo[] = [];

      // Iterate mothership IDs starting from 1 until we hit a non-existent one
      for (let msId = 1; ; msId++) {
        try {
          const msView = await contracts.mothershipManager.getMothershipView(msId);
          // Zero-address owner means this ID doesn't exist — we've found all agents
          if (msView.owner === ZERO_ADDRESS) break;
          if (!msView.active) continue;

          const address = msView.owner as string;

          // Get pending reward via view function (no events needed)
          let totalEarned = "0";
          try {
            const pending = await contracts.expeditionManager.getPendingReward(address);
            totalEarned = formatEther(BigInt(pending));
          } catch {
            // pending reward may fail if no interaction
          }

          agentList.push({
            address,
            mothershipId: msId,
            rank: Number(msView.rank),
            level: Number(msView.level),
            totalMP: formatEther(msView.totalMP),
            totalXP: Number(msView.totalXP),
            active: msView.active,
            lastExpeditionTime: Number(msView.lastExpeditionTime),
            totalEarned,
            shipsCount: msView.scoutShipIds.length,
            explorersCount: msView.explorerIds.length,
          });
        } catch {
          // RPC error or non-existent ID — stop scanning
          break;
        }
      }

      // Sort by totalEarned descending
      agentList.sort((a, b) => parseFloat(b.totalEarned) - parseFloat(a.totalEarned));
      setAgents(agentList);
    } catch (err: any) {
      console.error("Failed to load agents:", err);
      setError(err?.message || "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, [contracts]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return { agents, isLoading, error, refresh: loadAgents };
}

// ═══════════════════════════════════════════
//  Hook: Agent Detail (single agent)
// ═══════════════════════════════════════════

export function useAgentDetail(address: string | null) {
  const { contracts } = useMonitor();
  const [mothership, setMothership] = useState<MothershipData | null>(null);
  const [ships, setShips] = useState<TokenStats[]>([]);
  const [explorers, setExplorers] = useState<TokenStats[]>([]);
  const [fleetMap, setFleetMap] = useState<ShipWithExplorers[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      const msId = Number(await contracts.mothershipManager.getOwnerMothership(address));
      if (msId === 0) {
        setMothership(null);
        setShips([]);
        setExplorers([]);
        setFleetMap([]);
        setIsLoading(false);
        return;
      }

      const msView = await contracts.mothershipManager.getMothershipView(msId);
      const rewardBonus = Number(await contracts.mothershipManager.getRewardBonus(msId));

      const ms: MothershipData = {
        id: msId,
        owner: msView.owner,
        scoutShipIds: msView.scoutShipIds.map(Number),
        explorerIds: msView.explorerIds.map(Number),
        rank: Number(msView.rank),
        level: Number(msView.level),
        totalXP: Number(msView.totalXP),
        totalMP: msView.totalMP,
        active: msView.active,
        lastExpeditionTime: Number(msView.lastExpeditionTime),
        rewardBonus,
      };
      setMothership(ms);

      // Load token stats for ships and explorers in mothership
      const loadedShips: TokenStats[] = [];
      const loadedExplorers: TokenStats[] = [];

      for (const tokenId of ms.scoutShipIds) {
        try {
          const stats = await contracts.nft.getTokenStats(tokenId);
          loadedShips.push({
            tokenId,
            tokenType: Number(stats.tokenType),
            rarity: Number(stats.rarity),
            miningPower: stats.miningPower,
            mintedAt: Number(stats.mintedAt),
            mothershipId: Number(stats.mothershipId),
          });
        } catch { continue; }
      }

      for (const tokenId of ms.explorerIds) {
        try {
          const stats = await contracts.nft.getTokenStats(tokenId);
          loadedExplorers.push({
            tokenId,
            tokenType: Number(stats.tokenType),
            rarity: Number(stats.rarity),
            miningPower: stats.miningPower,
            mintedAt: Number(stats.mintedAt),
            mothershipId: Number(stats.mothershipId),
          });
        } catch { continue; }
      }

      setShips(loadedShips);
      setExplorers(loadedExplorers);

      // Build fleet map
      const fleet: ShipWithExplorers[] = [];
      for (const ship of loadedShips) {
        const expIds: number[] = (
          await contracts.mothershipManager.getShipExplorers(msId, ship.tokenId)
        ).map(Number);
        const shipExplorers = loadedExplorers.filter((e) => expIds.includes(e.tokenId));
        fleet.push({ ship, explorers: shipExplorers });
      }
      setFleetMap(fleet);
    } catch (err) {
      console.error("Failed to load agent detail:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address, contracts]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return { mothership, ships, explorers, fleetMap, isLoading, refresh: loadDetail };
}

// ═══════════════════════════════════════════
//  Hook: Agent Activity Logs (on-chain events)
// ═══════════════════════════════════════════

export function useAgentLogs(address: string | null) {
  const { contracts } = useMonitor();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      const allLogs: AgentLog[] = [];

      // Get mothership info for this address
      const msId = Number(await contracts.mothershipManager.getOwnerMothership(address));
      if (msId > 0) {
        // Add mothership creation as a log entry
        const msView = await contracts.mothershipManager.getMothershipView(msId);
        allLogs.push({
          type: "mothership_created",
          timestamp: 0, // unknown without events, but we sort by it
          blockNumber: 0,
          data: { mothershipId: msId },
        });

        // Infer fleet info from mothership view (ships & explorers count)
        if (msView.scoutShipIds.length > 0) {
          allLogs.push({
            type: "mint_ships",
            timestamp: 0,
            blockNumber: 0,
            data: { amount: msView.scoutShipIds.length },
          });
        }
        if (msView.explorerIds.length > 0) {
          allLogs.push({
            type: "mint_explorers",
            timestamp: 0,
            blockNumber: 0,
            data: { amount: msView.explorerIds.length },
          });
        }
      }

      // Iterate all expeditions to find those belonging to this address
      // Uses nextExpeditionId() view function instead of events
      const nextExpId = Number(await contracts.expeditionManager.nextExpeditionId());
      for (let expId = 1; expId < nextExpId; expId++) {
        try {
          const exp = await contracts.expeditionManager.getExpedition(expId);
          if (exp.player.toLowerCase() !== address.toLowerCase()) continue;

          // Expedition started
          allLogs.push({
            type: "expedition_started",
            timestamp: Number(exp.startedAt),
            blockNumber: 0,
            data: { expeditionId: expId, planetId: Number(exp.planetId) },
          });

          // Expedition resolved (status > 1 means resolved)
          if (Number(exp.resolvedAt) > 0) {
            allLogs.push({
              type: "expedition_resolved",
              timestamp: Number(exp.resolvedAt),
              blockNumber: 0,
              data: {
                expeditionId: expId,
                success: Number(exp.status) === 2,
                reward: formatEther(exp.reward),
                planetId: Number(exp.planetId),
              },
            });
          }
        } catch { continue; }
      }

      // Sort by timestamp descending (newest first), push 0-timestamp entries to end
      allLogs.sort((a, b) => {
        if (a.timestamp === 0 && b.timestamp === 0) return 0;
        if (a.timestamp === 0) return 1;
        if (b.timestamp === 0) return -1;
        return b.timestamp - a.timestamp;
      });
      setLogs(allLogs);
    } catch (err) {
      console.error("Failed to load agent logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address, contracts]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return { logs, isLoading, refresh: loadLogs };
}

// ═══════════════════════════════════════════
//  Hook: Hero Stats (lightweight — landing page)
// ═══════════════════════════════════════════

export interface HeroStats {
  agentCount: number;
  poolBalance: string; // formatted MON
  latestAgent: string | null; // address of most recent agent
}

export function useHeroStats() {
  const { contracts, provider } = useMonitor();
  const [stats, setStats] = useState<HeroStats>({ agentCount: 0, poolBalance: "0", latestAgent: null });
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // Count agents by iterating mothership IDs (no events — Monad 100-block limit)
      let agentCount = 0;
      let latestAgent: string | null = null;
      for (let msId = 1; ; msId++) {
        try {
          const msView = await contracts.mothershipManager.getMothershipView(msId);
          if (msView.owner === ZERO_ADDRESS) break;
          agentCount++;
          // Track the latest (highest ID) active agent
          if (msView.active) latestAgent = msView.owner as string;
        } catch {
          break;
        }
      }

      // Fetch ExpeditionManager pool balance
      let poolBalance = "0";
      try {
        const bal = await provider.getBalance(await contracts.expeditionManager.getAddress());
        poolBalance = formatEther(bal);
      } catch {
        // ignore
      }

      setStats({ agentCount, poolBalance, latestAgent });
    } catch {
      // keep defaults
    } finally {
      setIsLoading(false);
    }
  }, [contracts, provider]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, isLoading };
}
