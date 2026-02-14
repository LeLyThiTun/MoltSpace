// ═══════════════════════════════════════════
//  Game Constants
// ═══════════════════════════════════════════

export const RARITY = {
  1: { name: "Common", stars: 1, color: "#6b7280", class: "rarity-common" },
  2: { name: "Uncommon", stars: 2, color: "#10B981", class: "rarity-uncommon" },
  3: { name: "Rare", stars: 3, color: "#3B82F6", class: "rarity-rare" },
  4: { name: "Epic", stars: 4, color: "#7C3AED", class: "rarity-epic" },
  5: { name: "Legendary", stars: 5, color: "#F59E0B", class: "rarity-legendary" },
} as const;

export const RANK_NAMES: Record<number, string> = {
  0: "—",
  1: "D",
  2: "C",
  3: "B",
  4: "A",
  5: "S",
};

export const RANK_COLORS: Record<number, string> = {
  0: "#6b7280",
  1: "#6b7280",
  2: "#10B981",
  3: "#3B82F6",
  4: "#7C3AED",
  5: "#F59E0B",
};

export const ZONES = [
  { id: 1, name: "Zone 1 — Frontier", planets: [1, 10], rank: "C", color: "#10B981" },
  { id: 2, name: "Zone 2 — Deep Space", planets: [11, 20], rank: "B", color: "#3B82F6" },
  { id: 3, name: "Zone 3 — Nebula Core", planets: [21, 25], rank: "A", color: "#7C3AED" },
  { id: 4, name: "Zone 4 — Void Rift", planets: [26, 30], rank: "S", color: "#F59E0B" },
];

export const MINT_COST = {
  SCOUT_SHIP: 20, // MON
  EXPLORER: 10,   // MON
};

export const BURN_REFUND = {
  SCOUT_SHIP: 4,  // MON (20%)
  EXPLORER: 2,    // MON (20%)
};

// ═══════════════════════════════════════════
//  Planet Data (from ExpeditionManager contract)
// ═══════════════════════════════════════════

export interface PlanetData {
  id: number;
  zone: number;
  suggestedRank: number; // 1=D, 2=C, 3=B, 4=A, 5=S
  requiredMP: number;    // in MON (ether units)
  baseReward: number;    // in MON (ether units)
  // Success rates per rank [D, C, B, A, S] in % (e.g. 85 = 85%)
  successRates: [number, number, number, number, number];
}

export const PLANETS: PlanetData[] = [
  // Zone 1: Planets 1-10, Suggested Rank C (ROI ~7+ days)
  { id: 1,  zone: 1, suggestedRank: 2, requiredMP: 50,    baseReward: 3.5,   successRates: [85.0, 88.0, 91.0, 93.0, 97.0] },
  { id: 2,  zone: 1, suggestedRank: 2, requiredMP: 80,    baseReward: 3.5,   successRates: [83.0, 86.0, 89.0, 91.0, 95.0] },
  { id: 3,  zone: 1, suggestedRank: 2, requiredMP: 120,   baseReward: 3.5,   successRates: [81.0, 84.0, 87.0, 89.0, 93.0] },
  { id: 4,  zone: 1, suggestedRank: 2, requiredMP: 170,   baseReward: 7,     successRates: [79.0, 82.0, 85.0, 87.0, 91.0] },
  { id: 5,  zone: 1, suggestedRank: 2, requiredMP: 230,   baseReward: 7,     successRates: [77.0, 80.0, 83.0, 85.0, 89.0] },
  { id: 6,  zone: 1, suggestedRank: 2, requiredMP: 300,   baseReward: 10,    successRates: [75.0, 78.0, 81.0, 83.0, 87.0] },
  { id: 7,  zone: 1, suggestedRank: 2, requiredMP: 380,   baseReward: 10,    successRates: [73.0, 76.0, 79.0, 81.0, 85.0] },
  { id: 8,  zone: 1, suggestedRank: 2, requiredMP: 480,   baseReward: 13.5,  successRates: [71.0, 74.0, 77.0, 79.0, 83.0] },
  { id: 9,  zone: 1, suggestedRank: 2, requiredMP: 600,   baseReward: 17,    successRates: [69.0, 72.0, 75.0, 77.0, 81.0] },
  { id: 10, zone: 1, suggestedRank: 2, requiredMP: 750,   baseReward: 20,    successRates: [67.0, 70.0, 73.0, 75.0, 79.0] },
  // Zone 2: Planets 11-20, Suggested Rank B (ROI ~7+ days)
  { id: 11, zone: 2, suggestedRank: 3, requiredMP: 950,   baseReward: 40,    successRates: [60.0, 65.0, 67.0, 71.0, 74.0] },
  { id: 12, zone: 2, suggestedRank: 3, requiredMP: 1200,  baseReward: 50,    successRates: [58.0, 63.0, 65.0, 69.0, 72.0] },
  { id: 13, zone: 2, suggestedRank: 3, requiredMP: 1500,  baseReward: 60,    successRates: [56.0, 61.0, 63.0, 67.0, 70.0] },
  { id: 14, zone: 2, suggestedRank: 3, requiredMP: 1900,  baseReward: 75,    successRates: [54.0, 59.0, 61.0, 65.0, 68.0] },
  { id: 15, zone: 2, suggestedRank: 3, requiredMP: 2400,  baseReward: 95,    successRates: [52.0, 57.0, 59.0, 63.0, 66.0] },
  { id: 16, zone: 2, suggestedRank: 3, requiredMP: 3000,  baseReward: 120,   successRates: [50.0, 55.0, 57.0, 61.0, 64.0] },
  { id: 17, zone: 2, suggestedRank: 3, requiredMP: 3700,  baseReward: 145,   successRates: [48.0, 53.0, 55.0, 59.0, 62.0] },
  { id: 18, zone: 2, suggestedRank: 3, requiredMP: 4500,  baseReward: 175,   successRates: [46.0, 51.0, 53.0, 57.0, 60.0] },
  { id: 19, zone: 2, suggestedRank: 3, requiredMP: 5400,  baseReward: 210,   successRates: [44.0, 49.0, 51.0, 55.0, 58.0] },
  { id: 20, zone: 2, suggestedRank: 3, requiredMP: 6400,  baseReward: 250,   successRates: [42.0, 47.0, 49.0, 53.0, 56.0] },
  // Zone 3: Planets 21-25, Suggested Rank A (ROI ~3 days)
  { id: 21, zone: 3, suggestedRank: 4, requiredMP: 7500,  baseReward: 715,   successRates: [41.0, 43.0, 47.0, 52.0, 55.0] },
  { id: 22, zone: 3, suggestedRank: 4, requiredMP: 8500,  baseReward: 810,   successRates: [41.0, 43.0, 47.0, 52.0, 55.0] },
  { id: 23, zone: 3, suggestedRank: 4, requiredMP: 9500,  baseReward: 910,   successRates: [41.0, 43.0, 47.0, 52.0, 55.0] },
  { id: 24, zone: 3, suggestedRank: 4, requiredMP: 10500, baseReward: 1010,  successRates: [41.0, 43.0, 47.0, 52.0, 55.0] },
  { id: 25, zone: 3, suggestedRank: 4, requiredMP: 11000, baseReward: 1060,  successRates: [41.0, 43.0, 47.0, 52.0, 55.0] },
  // Zone 4: Planets 26-30, Suggested Rank S (ROI ~3 days)
  { id: 26, zone: 4, suggestedRank: 5, requiredMP: 11300, baseReward: 1065,  successRates: [39.0, 40.0, 45.0, 50.0, 53.0] },
  { id: 27, zone: 4, suggestedRank: 5, requiredMP: 11600, baseReward: 1090,  successRates: [39.0, 40.0, 45.0, 50.0, 53.0] },
  { id: 28, zone: 4, suggestedRank: 5, requiredMP: 11800, baseReward: 1110,  successRates: [39.0, 40.0, 45.0, 50.0, 53.0] },
  { id: 29, zone: 4, suggestedRank: 5, requiredMP: 11900, baseReward: 1110,  successRates: [39.0, 40.0, 45.0, 50.0, 53.0] },
  { id: 30, zone: 4, suggestedRank: 5, requiredMP: 12000, baseReward: 1125,  successRates: [39.0, 40.0, 45.0, 50.0, 53.0] },
];

export function getPlanet(planetId: number): PlanetData | undefined {
  return PLANETS.find((p) => p.id === planetId);
}

/**
 * Calculate estimated reward range for a planet given mothership stats.
 * - Success: 70%-100% of calculated reward
 * - Failure: 25% of base reward
 * - Calculated reward = baseReward × (1 + levelBonus) × (totalMP / requiredMP)
 */
export function getRewardEstimate(
  planet: PlanetData,
  totalMP: number,
  levelBonusBps: number // e.g. 500 = 5%
): { failReward: number; successMin: number; successMax: number } {
  const calculated = planet.baseReward * (1 + levelBonusBps / 10000) * (totalMP / planet.requiredMP);
  return {
    failReward: planet.baseReward * 0.25,
    successMin: calculated * 0.70,
    successMax: calculated * 1.00,
  };
}

/**
 * Format large MON values with K/M suffix
 */
export function formatReward(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return val.toFixed(1);
  return val.toFixed(2);
}

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

export function starsString(rarity: number): string {
  return "★".repeat(rarity) + "☆".repeat(5 - rarity);
}

export function formatMON(weiStr: string | bigint): string {
  const val = Number(weiStr) / 1e18;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return val.toFixed(1);
  return val.toFixed(4);
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getRarityGlow(rarity: number): string {
  switch (rarity) {
    case 5: return "shadow-[0_0_20px_rgba(245,158,11,0.4)]";
    case 4: return "shadow-[0_0_15px_rgba(124,58,237,0.3)]";
    case 3: return "shadow-[0_0_12px_rgba(59,130,246,0.3)]";
    case 2: return "shadow-[0_0_10px_rgba(16,185,129,0.2)]";
    default: return "";
  }
}

// ═══════════════════════════════════════════
//  NFT Image Paths
// ═══════════════════════════════════════════

const RARITY_IMAGE_NAME: Record<number, string> = {
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "legendary",
};

export function getShipImage(rarity: number): string {
  return `/image/scout_ships/${RARITY_IMAGE_NAME[rarity] || "common"}.png`;
}

export function getExplorerImage(rarity: number): string {
  return `/image/explorer/${RARITY_IMAGE_NAME[rarity] || "common"}.png`;
}

export function getNFTImage(tokenType: number, rarity: number): string {
  return tokenType === 1 ? getShipImage(rarity) : getExplorerImage(rarity);
}

export function getZoneImage(zoneId: number): string {
  return `/image/zone/${zoneId}.png`;
}
