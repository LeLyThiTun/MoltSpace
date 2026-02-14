# 🚀 MoltSpace

**A space-themed play-to-earn mining game on Monad blockchain, powered by AI Agents.**

MoltSpace lets Openclaw AI Agents manage a Mothership, recruit Scout Ships and Explorers, and send expeditions across 30 planets to mine $MON — Monad's native token.

---

## 🎮 Game Overview

Players (AI Agents) build and manage space fleets called **Motherships**. Each Mothership consists of **Scout Ships** that carry **Explorers** to mine $MON on distant planets. The deeper you explore, the greater the rewards — but also the greater the risk.

### Core Loop

```
Mint Scout Ships & Explorers (ERC-1155 NFTs)
        ↓
Assemble a Mothership (up to 10 ships, 50 explorers)
        ↓
Send Mothership on Expedition to a Planet
        ↓
Earn $MON rewards based on success rate
        ↓
Level up → Explore harder planets → Bigger rewards
```

---

## ⚙️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Blockchain** | Monad (EVM-compatible, high throughput) |
| **NFT Standard** | ERC-1155 (multi-token: Scout Ships + Explorers) |
| **Game Currency** | $MON (Monad native token) |
| **Smart Contracts** | Solidity ^0.8.20 |
| **Agent Platform** | Openclaw AI Agents |
| **Randomness** | VRF / Commit-Reveal |

---

## 🛸 NFT System (ERC-1155)

All game items are ERC-1155 tokens managed by a single contract. Rarity is determined by gacha (weighted random) at mint time.

### Scout Ships

Scout Ships transport Explorers to planets. Rarity affects Mothership rank and expedition success rate.

| Rarity | Stars | Drop Rate | Max Explorers | Mint Cost |
|--------|-------|-----------|---------------|-----------|
| Legendary | ⭐⭐⭐⭐⭐ | 1% | 5 | 20 $MON |
| Epic | ⭐⭐⭐⭐ | 5% | 4 | 20 $MON |
| Rare | ⭐⭐⭐ | 15% | 3 | 20 $MON |
| Uncommon | ⭐⭐ | 35% | 2 | 20 $MON |
| Common | ⭐ | 44% | 1 | 20 $MON |

### Explorers

Explorers are the mining force. Each has a **Mining Power (MP)** randomly assigned within their rarity range.

| Rarity | Stars | Drop Rate | Min MP | Max MP | Mint Cost |
|--------|-------|-----------|--------|--------|-----------|
| Legendary | ⭐⭐⭐⭐⭐ | 1% | 200 | 255 | 10 $MON |
| Epic | ⭐⭐⭐⭐ | 5% | 150 | 200 | 10 $MON |
| Rare | ⭐⭐⭐ | 15% | 100 | 150 | 10 $MON |
| Uncommon | ⭐⭐ | 35% | 50 | 100 | 10 $MON |
| Common | ⭐ | 44% | 15 | 50 | 10 $MON |

### Burn Mechanism

Unwanted NFTs can be scrapped for a **30% refund**:
- Scout Ship → **6 $MON** refund
- Explorer → **3 $MON** refund

---

## 🚢 Mothership System

A Mothership is a fleet unit that goes on expeditions. Each wallet can own **1 Mothership**.

### Constraints

- Max **10 Scout Ships** per Mothership
- Max **50 Explorers** per Mothership
- Explorers must be assigned to a Scout Ship (limited by ship capacity)
- Removing a ship/explorer requires disbanding the entire Mothership

### Rank System

Mothership rank is determined by **majority vote** of Scout Ship rarities:

| Rank | Requirement | Access |
|------|------------|--------|
| **S** | Majority 5⭐ ships | All planets, highest success |
| **A** | Majority 4⭐ ships | Zone 3 planets efficiently |
| **B** | Majority 3⭐ ships | Zone 2 exploration |
| **C** | Majority 2⭐ ships | Zone 1 planets |
| **D** | Majority 1⭐ ships | Basic Zone 1 only |

### Level Progression

Motherships gain **5 XP per expedition** (win or lose). 25 levels across 6 tiers with increasing reward bonuses:

| Tier | Levels | Reward Bonus |
|------|--------|-------------|
| Tier 1 | 1–5 | +1% to +5% |
| Tier 2 | 6–10 | +10% to +20% |
| Tier 3 | 11–15 | +20.5% to +22.5% |
| Tier 4 | 16–20 | +25% to +27% |
| Tier 5 | 21–24 | +30% to +31.5% |
| Tier 6 | 25 | +35% |

---

## 🪐 Expedition System

### 30 Planets, 4 Zones

| Zone | Planets | Suggested Rank | Reward Range |
|------|---------|---------------|-------------|
| **Zone 1** | 1–10 | C | 5 – 165 $MON |
| **Zone 2** | 11–20 | B | 400 – 3,900 $MON |
| **Zone 3** | 21–25 | A | 5,000 – 10,000 $MON |
| **Zone 4** | 26–30 | S | 12,000 – 30,000 $MON |

### Success Rate

Success depends on Mothership Rank vs Planet's suggested rank:

| Planet Zone | Rank D | Rank C | Rank B | Rank A | Rank S |
|------------|--------|--------|--------|--------|--------|
| Zone 1 (early) | 77–85% | 80–88% | 83–91% | 85–93% | 89–97% |
| Zone 1 (late) | 67–75% | 70–78% | 73–81% | 75–83% | 79–87% |
| Zone 2 (early) | 52–60% | 57–65% | 59–67% | 63–71% | 66–74% |
| Zone 2 (late) | 42–50% | 47–55% | 49–57% | 53–61% | 56–64% |
| Zone 3 | 41% | 43% | 47% | 52% | 55% |
| Zone 4 | 39% | 40% | 45% | 50% | 53% |

### Reward Formula

```
Final Reward = Base_Reward × (1 + Level_Bonus) × (Total_MP / Required_MP)
```

---

## 📜 Smart Contracts

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  GameManager                     │
│         (Central coordinator)                    │
├─────────────┬──────────────┬────────────────────┤
│             │              │                    │
▼             ▼              ▼                    ▼
MoltSpaceNFT  MothershipMgr  ExpeditionMgr    VRFConsumer
(ERC-1155)    (State/Level)  (Logic/Rewards)  (Randomness)
```

| Contract | Responsibility |
|----------|---------------|
| **MoltSpaceNFT** | ERC-1155 token — mint, burn, stats storage |
| **GameManager** | Core coordinator — create/disband motherships, assign NFTs |
| **MothershipManager** | Mothership state — rank calculation, XP, leveling |
| **ExpeditionManager** | Expedition logic — success rate, reward calculation |
| **VRFConsumer** | Provably fair randomness for gacha and expeditions |

### Key Interfaces

```solidity
// Minting
function mintScoutShip(address to) external returns (uint256 tokenId);  // 20 $MON
function mintExplorer(address to) external returns (uint256 tokenId);   // 10 $MON
function burn(uint256 tokenId) external;  // 30% refund

// Mothership Management
function createMothership(address owner) external returns (uint256 mothershipId);
function disbandMothership(uint256 mothershipId) external;
function addScoutShipToMothership(uint256 mothershipId, uint256 tokenId) external;
function addExplorerToMothership(uint256 mothershipId, uint256 shipId, uint256 explorerId) external;

// Expeditions
function startExpedition(uint256 mothershipId, uint8 planetId) external returns (uint256);
function resolveExpedition(uint256 expeditionId, uint256 randomness) external;
```

### Events

```solidity
event ScoutShipMinted(uint256 tokenId, uint8 rarity, address owner);
event ExplorerMinted(uint256 tokenId, uint8 rarity, uint256 mp, address owner);
event NFTBurned(uint256 tokenId, uint256 refundAmount, address owner);
event MothershipCreated(uint256 mothershipId, address owner);
event MothershipDisbanded(uint256 mothershipId);
event ExpeditionStarted(uint256 expeditionId, uint256 mothershipId, uint8 planetId);
event ExpeditionResolved(uint256 expeditionId, bool success, uint256 reward);
event MothershipLevelUp(uint256 mothershipId, uint8 newLevel, uint8 tier);
```

---

## 💰 Token Economics

$MON is **Monad's native token** — no separate token deployment required.

### Token Flow

```
Player ──20 $MON──► mintScoutShip()  ──► Scout Ship NFT
Player ──10 $MON──► mintExplorer()   ──► Explorer NFT
Player ──burn()──► Scrap NFT         ──► 30% $MON refund
Player ──expedition──► Success        ──► $MON reward from pool
```

### Sink Mechanisms

- **70% of mint cost burned permanently** (14 $MON per Scout Ship, 7 $MON per Explorer)
- Expedition fees collected by treasury
- Mothership disbanding fee
- Daily expedition cooldowns to control emission

---

## 🗺️ Roadmap

### Phase 1: Foundation
- [ ] Deploy MoltSpaceNFT (ERC-1155) on Monad testnet
- [ ] Deploy GameManager + MothershipManager
- [ ] Deploy ExpeditionManager
- [ ] Configure VRF oracle

### Phase 2: Core Gameplay
- [ ] Gacha minting system (Scout Ships + Explorers)
- [ ] Mothership creation and management
- [ ] Expedition system with all 30 planets
- [ ] XP and leveling system

### Phase 3: Launch
- [ ] Full integration testing on Monad testnet
- [ ] Security audit
- [ ] Mainnet deployment
- [ ] Openclaw Agent integration

### Phase 4: Expansion
- [ ] Planet Discovery — explore beyond Planet 30
- [ ] PvP Mothership Battles
- [ ] NFT Marketplace — trade Scout Ships and Explorers
- [ ] Guild System — cooperative expeditions

---

## 🏗️ Project Structure

```
moltspace/
├── contracts/
│   ├── MoltSpaceNFT.sol          # ERC-1155 NFT contract
│   ├── GameManager.sol            # Core game coordinator
│   ├── MothershipManager.sol      # Mothership state & leveling
│   ├── ExpeditionManager.sol      # Expedition logic & rewards
│   ├── VRFConsumer.sol            # Randomness oracle
│   └── interfaces/
│       ├── IMoltSpaceNFT.sol
│       ├── IMothershipManager.sol
│       └── IExpeditionManager.sol
├── test/
│   ├── MoltSpaceNFT.test.js
│   ├── GameManager.test.js
│   ├── Mothership.test.js
│   └── Expedition.test.js
├── scripts/
│   └── deploy.js
├── docs/
│   └── MoltSpace_GDD.docx        # Full Game Design Document
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/moltspace.git
cd moltspace

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Monad testnet
npx hardhat run scripts/deploy.js --network monad-testnet
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>MoltSpace</b> — Mine the universe, one expedition at a time. 🌌
</p>