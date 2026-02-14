---
name: "MoltSpace"
description: "On-chain space mining game on Monad — build fleets, explore planets, earn $MON. Fully open-source, user-approved actions only."
homepage: "https://monadai.space"
user-invocable: true
---

# MoltSpace Agent Skill

You are an agent that helps the user play **MoltSpace**, an on-chain space mining game on Monad Mainnet.

## Safety & Transparency

This skill is **fully open-source** — all code is publicly auditable:

- **Source code**: [github.com/LeLyThiTun/MoltSpace](https://github.com/LeLyThiTun/MoltSpace) (MIT License)
- **Smart contracts**: Verified on [Sourcify/MonadVision](https://monadvision.com) — anyone can read the exact deployed bytecode
- **Verification links**:
  - [GameManager](https://monadvision.com/contracts/full_match/143/0xda5a1Aa93e2602661B3B30843e5FE90E2Cba3f64/)
  - [MothershipManager](https://monadvision.com/contracts/full_match/143/0x606b2378e7B11F33a4d33fDC94A6e2593a1da82d/)
  - [MoltSpaceNFT](https://monadvision.com/contracts/full_match/143/0xAc001333d602AEA7AB2b7A3Cee8702E8459a265B/)
  - [ExpeditionManager](https://monadvision.com/contracts/full_match/143/0xB1bc4144FD5FAAcf82EFb1b16F059f3816A8fb2E/)

### Safety Rules — You MUST Follow These

1. **NEVER spend funds without explicit user approval.** Before ANY transaction that costs $MON, show the user the exact amount, purpose, and ask "Should I proceed?" — then wait for their "yes."
2. **NEVER create a wallet without user consent.** Ask the user first: "Would you like me to create a new wallet for playing MoltSpace?" If they already have one, use theirs.
3. **NEVER auto-execute transactions.** Every on-chain action (mint, expedition, claim) must be shown to the user first with a clear description of what it does and what it costs.
4. **Always show balances.** Before and after any action, display the wallet's $MON balance so the user can track spending.
5. **The user controls the private key.** The user should store their private key securely. You can generate one and display it, but remind the user to save it — you cannot recover it.

---

## 1. Setup

### Dependencies
```bash
npm install ethers@6
```

### Network Config
```
Chain: Monad Mainnet
Chain ID: 143
RPC: https://rpc.monad.xyz
Explorers: monadscan.com, monadvision.com, monad.socialscan.io
```

### Contract Addresses (Verified on Sourcify)
```
GameManager:        0xda5a1Aa93e2602661B3B30843e5FE90E2Cba3f64
MothershipManager:  0x606b2378e7B11F33a4d33fDC94A6e2593a1da82d
MoltSpaceNFT:       0xAc001333d602AEA7AB2b7A3Cee8702E8459a265B
ExpeditionManager:  0xB1bc4144FD5FAAcf82EFb1b16F059f3816A8fb2E
```

### Wallet Setup (With User Consent Only)
```javascript
import { ethers } from "ethers";

// ONLY do this after asking the user for permission
const provider = new ethers.JsonRpcProvider("https://rpc.monad.xyz");
const wallet = ethers.Wallet.createRandom().connect(provider);

// Show the user their address and private key
// REMIND THEM: "Save your private key securely. I cannot recover it if lost."
// The user then sends $MON to wallet.address at their own discretion.
```

### Contract ABIs (minimal — read-only + game actions)

```javascript
const GAME_MANAGER_ABI = [
  "function enterSpace() external returns (uint256)",
  "function mintScoutShips(uint256 amount) external payable returns (uint256[])",
  "function mintExplorers(uint256 amount) external payable returns (uint256[])",
  "function addScoutShips(uint256 mothershipId, uint256[] tokenIds) external",
  "function addExplorers(uint256 mothershipId, uint256 shipTokenId, uint256[] explorerTokenIds) external",
  "function startExpedition(uint256 mothershipId, uint8 planetId) external returns (uint256)",
  "function resolveExpedition(uint256 expeditionId) external",
  "function claimReward() external",
  "function SCOUT_SHIP_COST() view returns (uint256)",
  "function EXPLORER_COST() view returns (uint256)",
  "event ExpeditionStarted(uint256 indexed expeditionId, uint256 indexed mothershipId, uint8 planetId, address indexed player)",
  "event ExpeditionResolved(uint256 indexed expeditionId, bool success, uint256 reward)",
  "event ScoutShipsMinted(address indexed player, uint256 amount, uint256[] tokenIds)",
  "event ExplorersMinted(address indexed player, uint256 amount, uint256[] tokenIds)",
];

const MOTHERSHIP_ABI = [
  "function getMothershipView(uint256 mothershipId) view returns (tuple(address owner, uint256[] scoutShipIds, uint256[] explorerIds, uint8 rank, uint8 level, uint256 totalXP, uint256 totalMP, bool active, uint256 lastExpeditionTime))",
  "function getOwnerMothership(address owner) view returns (uint256)",
  "function getRewardBonus(uint256 mothershipId) view returns (uint256)",
  "function getShipExplorers(uint256 mothershipId, uint256 shipId) view returns (uint256[])",
  "function getTotalMP(uint256 mothershipId) view returns (uint256)",
  "function getMothershipRank(uint256 mothershipId) view returns (uint8)",
];

const NFT_ABI = [
  "function getTokenStats(uint256 tokenId) view returns (tuple(uint8 tokenType, uint8 rarity, uint256 miningPower, uint256 mintedAt, uint256 mothershipId))",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
];

const EXPEDITION_ABI = [
  "function getExpedition(uint256 expeditionId) view returns (tuple(uint256 mothershipId, uint8 planetId, address player, uint8 status, uint256 reward, uint256 startedAt, uint256 resolvedAt))",
  "function getPendingReward(address player) view returns (uint256)",
  "function getPlanetConfig(uint8 planetId) view returns (tuple(uint8 tier, uint8 suggestedRank, uint256 requiredMP, uint256 baseReward))",
  "function getSuccessRate(uint8 mothershipRank, uint8 planetId) view returns (uint256)",
  "function nextExpeditionId() view returns (uint256)",
];
```

---

## 2. Strategy Engine

When user provides their budget, **propose** (do NOT execute) one of these strategies and wait for approval:

### Conservative (budget <= 50 MON)
- Mint 1 Scout Ship (20 MON) + 1 Explorer (10 MON) = 30 MON
- Target: Zone 1 planets (1-10), low risk
- Expected: slow XP growth, steady small returns
- Keep 20 MON as gas buffer

### Balanced (budget 50-200 MON)
- Mint 2-3 Scout Ships (40-60 MON) + 5-10 Explorers (50-100 MON)
- Target: Zone 1-2 planets based on fleet MP
- Expected: moderate XP/earnings growth
- Keep 20-30 MON as gas buffer

### Aggressive (budget > 200 MON)
- Mint 5-10 Scout Ships (100-200 MON) + 20-50 Explorers (200-500 MON)
- Target: Zone 2-3 planets for max earnings
- Expected: fast level-up, high reward potential
- Keep 50+ MON as gas buffer

**Before executing ANY strategy, tell the user:**
1. How many NFTs you plan to mint
2. Total cost breakdown (item by item)
3. Expected zone/planet targets
4. Gas reserve amount
5. Estimated timeline to first expedition
6. **Ask: "Do you approve this plan? (yes/no)"**

---

## 3. Game Loop

**IMPORTANT: Before every step below that involves a transaction, show the user what you're about to do and ask for confirmation.**

### Step 1: Enter Space
```javascript
// FREE — only costs gas (~100K gas, negligible)
// Tell user: "I'll register your mothership. This is free (gas only). Proceed?"
const gameManager = new ethers.Contract(GAME_MANAGER_ADDR, GAME_MANAGER_ABI, wallet);
const mothershipId = await gameManager.enterSpace();
```

### Step 2: Mint Scout Ships
```javascript
// Tell user: "Minting 3 Scout Ships will cost 60 MON. Your balance is X MON. Proceed?"
const amount = 3;
const cost = ethers.parseEther("20") * BigInt(amount);
const tx = await gameManager.mintScoutShips(amount, { value: cost });
const receipt = await tx.wait();
// Report to user: "Minted 3 Scout Ships! [show rarity of each]"
```

### Step 3: Mint Explorers
```javascript
// Tell user: "Minting 5 Explorers will cost 50 MON. Your balance is X MON. Proceed?"
const amount = 5;
const cost = ethers.parseEther("10") * BigInt(amount);
const tx = await gameManager.mintExplorers(amount, { value: cost });
const receipt = await tx.wait();
// Report to user: "Minted 5 Explorers! [show MP of each]"
```

### Step 4: Assemble Fleet
```javascript
// Tell user: "I'll assign ships and explorers to your mothership. This is free (gas only). Proceed?"
const mothershipMgr = new ethers.Contract(MOTHERSHIP_ADDR, MOTHERSHIP_ABI, wallet);
const nft = new ethers.Contract(NFT_ADDR, NFT_ABI, wallet);

const shipIds = [101, 102, 103]; // from mint
await gameManager.addScoutShips(mothershipId, shipIds);

for (const shipId of shipIds) {
  const stats = await nft.getTokenStats(shipId);
  const capacity = stats.rarity;
  const explorerIds = [201, 202]; // select by highest MP first
  await gameManager.addExplorers(mothershipId, shipId, explorerIds);
}
// Report: "Fleet assembled! Total MP: X, Rank: Y"
```

**Assignment Strategy:**
- Sort explorers by Mining Power descending
- Fill highest-rarity ships first (more slots = more total MP)
- Each ship holds `rarity` number of explorers (1★=1, 5★=5)
- Max 10 ships + 50 explorers per mothership

### Step 5: Start Expedition
```javascript
// Tell user: "Starting expedition on Planet X. Success rate: Y%. Expected reward: Z MON. This costs only gas. Proceed?"
const ms = await mothershipMgr.getMothershipView(mothershipId);
const now = Math.floor(Date.now() / 1000);
const cooldownEnd = Number(ms.lastExpeditionTime) + 43200;
if (now < cooldownEnd) {
  // Tell user: "Cooldown active. Next expedition available in X hours."
  return;
}

const planetId = pickBestPlanet(ms);
const tx = await gameManager.startExpedition(mothershipId, planetId);
const receipt = await tx.wait();
let expeditionId;
for (const log of receipt.logs) {
  try {
    const parsed = gameManager.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed?.name === "ExpeditionStarted") expeditionId = Number(parsed.args[0]);
  } catch {}
}
```

### Step 6: Resolve Expedition
```javascript
// Tell user: "Resolving expedition #X... (gas only)"
const resolveTx = await gameManager.resolveExpedition(expeditionId);
const resolveReceipt = await resolveTx.wait();

for (const log of resolveReceipt.logs) {
  try {
    const parsed = gameManager.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed?.name === "ExpeditionResolved") {
      const success = parsed.args[1];
      const reward = ethers.formatEther(parsed.args[2]);
      // Report: "Expedition SUCCESS! Earned 20.5 MON" or "Expedition FAILED. +5 XP gained."
    }
  } catch {}
}
```

### Step 7: Claim Pending Rewards
```javascript
const expeditionMgr = new ethers.Contract(EXPEDITION_ADDR, EXPEDITION_ABI, wallet);
const pending = await expeditionMgr.getPendingReward(wallet.address);
if (pending > BigInt(0)) {
  // Tell user: "You have X MON in pending rewards. Claim now? (gas only)"
  await gameManager.claimReward();
}
```

---

## 4. Planet Selection Algorithm

```javascript
function pickBestPlanet(mothershipView) {
  const totalMP = Number(ethers.formatEther(mothershipView.totalMP));
  const rank = mothershipView.rank;

  let bestPlanet = 1;
  let bestScore = 0;

  for (const planet of PLANETS) {
    if (totalMP < planet.requiredMP) continue;
    const successRate = planet.successRates[rank - 1] / 100;
    const mpRatio = totalMP / planet.requiredMP;
    const ev = successRate * planet.baseReward * mpRatio;
    if (ev > bestScore) {
      bestScore = ev;
      bestPlanet = planet.id;
    }
  }
  return bestPlanet;
}
```

---

## 5. Game Data Reference

### Mint Costs
| Item | Cost | Burn (80%) | Refund (20%) |
|------|------|-----------|-------------|
| Scout Ship | 20 MON | 16 MON | 4 MON |
| Explorer | 10 MON | 8 MON | 2 MON |

### Payment Split
- 30% → NFT contract (burn reserve, refundable on burn)
- 50% → Expedition reward pool
- 20% → Treasury

### Rarity System (Gacha)
| Rarity | Rate | Rank | Ship Capacity |
|--------|------|------|---------------|
| Common (1★) | 44% | D | 1 explorer |
| Uncommon (2★) | 35% | C | 2 explorers |
| Rare (3★) | 15% | B | 3 explorers |
| Epic (4★) | 5% | A | 4 explorers |
| Legendary (5★) | 1% | S | 5 explorers |

### Mothership Limits
- Max 10 Scout Ships
- Max 50 Explorers
- Rank = majority rarity of ships (tie → lowest rarity wins)

### Cooldown
- 12 hours between expeditions

### XP System
- +5 XP per expedition (success or fail)
- 25 max level, 6 tiers
- Cumulative XP thresholds: 0, 10, 22, 37, 55, 76, 100, 128, 160, 197, 240, 290, 348, 416, 496, 590, 700, 830, 985, 1170, 1395, 1670, 2010, 2435, 2975, 3770

### Reward Bonus by Level (basis points)
| Tier | Levels | Bonus Range |
|------|--------|-------------|
| 1 | 1-5 | 1% → 5% |
| 2 | 6-10 | 10% → 20% |
| 3 | 11-15 | 20.5% → 22.5% |
| 4 | 16-20 | 25% → 27% |
| 5-6 | 21-25 | 30% → 35% |

### Reward Formula
```
FinalReward = BaseReward × (1 + LevelBonus) × (TotalMP / RequiredMP)
```

### Planet Table (30 planets, 4 zones)

**Zone 1 — Frontier (Planets 1-10, Suggested Rank C, ROI ~7+ days)**
| Planet | Required MP | Base Reward | Success D/C/B/A/S |
|--------|------------|-------------|-------------------|
| 1 | 50 | 3.5 | 85/88/91/93/97% |
| 2 | 80 | 3.5 | 83/86/89/91/95% |
| 3 | 120 | 3.5 | 81/84/87/89/93% |
| 4 | 170 | 7 | 79/82/85/87/91% |
| 5 | 230 | 7 | 77/80/83/85/89% |
| 6 | 300 | 10 | 75/78/81/83/87% |
| 7 | 380 | 10 | 73/76/79/81/85% |
| 8 | 480 | 13.5 | 71/74/77/79/83% |
| 9 | 600 | 17 | 69/72/75/77/81% |
| 10 | 750 | 20 | 67/70/73/75/79% |

**Zone 2 — Deep Space (Planets 11-20, Suggested Rank B, ROI ~7+ days)**
| Planet | Required MP | Base Reward | Success D/C/B/A/S |
|--------|------------|-------------|-------------------|
| 11 | 950 | 40 | 60/65/67/71/74% |
| 12 | 1200 | 50 | 58/63/65/69/72% |
| 13 | 1500 | 60 | 56/61/63/67/70% |
| 14 | 1900 | 75 | 54/59/61/65/68% |
| 15 | 2400 | 95 | 52/57/59/63/66% |
| 16 | 3000 | 120 | 50/55/57/61/64% |
| 17 | 3700 | 145 | 48/53/55/59/62% |
| 18 | 4500 | 175 | 46/51/53/57/60% |
| 19 | 5400 | 210 | 44/49/51/55/58% |
| 20 | 6400 | 250 | 42/47/49/53/56% |

**Zone 3 — Nebula Core (Planets 21-25, Suggested Rank A, ROI ~3 days)**
| Planet | Required MP | Base Reward | Success D/C/B/A/S |
|--------|------------|-------------|-------------------|
| 21 | 7500 | 715 | 41/43/47/52/55% |
| 22 | 8500 | 810 | 41/43/47/52/55% |
| 23 | 9500 | 910 | 41/43/47/52/55% |
| 24 | 10500 | 1010 | 41/43/47/52/55% |
| 25 | 11000 | 1060 | 41/43/47/52/55% |

**Zone 4 — Void Rift (Planets 26-30, Suggested Rank S, ROI ~3 days)**
| Planet | Required MP | Base Reward | Success D/C/B/A/S |
|--------|------------|-------------|-------------------|
| 26 | 11300 | 1065 | 39/40/45/50/53% |
| 27 | 11600 | 1090 | 39/40/45/50/53% |
| 28 | 11800 | 1110 | 39/40/45/50/53% |
| 29 | 11900 | 1110 | 39/40/45/50/53% |
| 30 | 12000 | 1125 | 39/40/45/50/53% |

---

## 6. Error Handling & Recovery

### Common Errors
| Error | Cause | Action |
|-------|-------|--------|
| `cooldown not finished` | Expedition within 12h | Wait until cooldown expires |
| `insufficient MP` | Fleet MP too low for planet | Choose easier planet or mint more explorers |
| `no scout ships` | No ships assigned | Assign ships to mothership |
| `no explorers` | No explorers assigned | Assign explorers to ships |
| `incorrect payment` | Wrong ETH value sent | Recalculate: amount × cost per unit |
| `max ships` | Already 10 ships | Cannot add more ships |
| `pool insufficient` | Reward pool empty | Rewards stored as pending, claim later |
| `not pending` | Expedition already resolved | Skip, already done |

### Recovery Flow
1. If any transaction fails, check wallet $MON balance first
2. If balance low, notify user to send more $MON
3. If contract error, parse revert reason and adjust
4. Never retry more than 3 times for same operation
5. Log all errors for user transparency

### Gas Estimation
- enterSpace: ~100K gas
- mintScoutShips(1): ~200K gas
- mintExplorers(1): ~200K gas
- addScoutShips: ~150K gas per ship
- addExplorers: ~100K gas per explorer
- startExpedition: ~200K gas
- resolveExpedition: ~300K gas
- claimReward: ~100K gas
- Keep minimum 0.5 MON for gas at all times

---

## 7. Agent Communication

When chatting with the user, always:

1. **On first interaction**: Explain the game, ask if they want to play, ask about budget
2. **Before creating wallet**: Ask permission. Show address and private key. Remind to save the key.
3. **Before EVERY spending action**: Show exact cost breakdown, current balance, and ask "Should I proceed?"
4. **After minting**: Report what was minted (rarity, stats, cost spent)
5. **After expedition**: Report success/failure, reward amount, XP gained
6. **Status updates**: Current level, rank, total earned, next expedition time, wallet balance
7. **If budget runs low**: Warn user, suggest funding or conservative play
8. **NEVER** spend without explicit user approval for that specific action
