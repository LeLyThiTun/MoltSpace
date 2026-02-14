const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("GameManager", function () {
  let nft, mothershipMgr, expeditionMgr, gameMgr;
  let owner, player1, player2, treasury;

  const SCOUT_SHIP_COST = ethers.parseEther("20");
  const EXPLORER_COST = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, player1, player2, treasury] = await ethers.getSigners();

    // Deploy all contracts
    const MoltSpaceNFT = await ethers.getContractFactory("MoltSpaceNFT");
    nft = await MoltSpaceNFT.deploy("https://api.monadai.space/{id}");
    await nft.waitForDeployment();

    const MothershipManager = await ethers.getContractFactory("MothershipManager");
    mothershipMgr = await MothershipManager.deploy(await nft.getAddress());
    await mothershipMgr.waitForDeployment();

    const ExpeditionManager = await ethers.getContractFactory("ExpeditionManager");
    expeditionMgr = await ExpeditionManager.deploy(await mothershipMgr.getAddress());
    await expeditionMgr.waitForDeployment();

    const GameManager = await ethers.getContractFactory("GameManager");
    gameMgr = await GameManager.deploy(
      await nft.getAddress(),
      await mothershipMgr.getAddress(),
      await expeditionMgr.getAddress(),
      treasury.address
    );
    await gameMgr.waitForDeployment();

    // Set authorized callers on NFT: GameManager + MothershipManager
    await nft.setAuthorized(await gameMgr.getAddress(), true);
    await nft.setAuthorized(await mothershipMgr.getAddress(), true);

    // Set GameManager as authorized on sub-contracts
    await mothershipMgr.setGameManager(await gameMgr.getAddress());
    await mothershipMgr.setExpeditionManager(await expeditionMgr.getAddress());
    await expeditionMgr.setGameManager(await gameMgr.getAddress());

    // Fund expedition reward pool (within Hardhat default balance)
    await owner.sendTransaction({
      to: await expeditionMgr.getAddress(),
      value: ethers.parseEther("50000"),
    });
  });

  // ═══════════════════════════════════════════
  //  Mint Scout Ships (Direct, Batch)
  // ═══════════════════════════════════════════

  describe("Mint Scout Ships", function () {
    it("should mint 1 scout ship for 20 MON", async function () {
      const tx = await gameMgr.connect(player1).mintScoutShips(1, {
        value: SCOUT_SHIP_COST,
      });
      await tx.wait();

      // Verify NFT minted
      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(1); // SCOUT_SHIP
      expect(await nft.ownerOfToken(1)).to.equal(player1.address);
    });

    it("should mint 5 scout ships in one transaction", async function () {
      const cost = SCOUT_SHIP_COST * 5n;
      const tx = await gameMgr.connect(player1).mintScoutShips(5, { value: cost });
      const receipt = await tx.wait();

      // Verify all 5 minted
      const nextId = await nft.nextTokenId();
      expect(nextId).to.equal(6); // IDs 1-5 minted

      for (let i = 1; i <= 5; i++) {
        const stats = await nft.getTokenStats(i);
        expect(stats.tokenType).to.equal(1); // SCOUT_SHIP
        expect(await nft.ownerOfToken(i)).to.equal(player1.address);
      }
    });

    it("should mint 10 scout ships in one transaction", async function () {
      const cost = SCOUT_SHIP_COST * 10n;
      await gameMgr.connect(player1).mintScoutShips(10, { value: cost });

      const nextId = await nft.nextTokenId();
      expect(nextId).to.equal(11);
    });

    it("should mint 20 scout ships in one transaction (max batch)", async function () {
      const cost = SCOUT_SHIP_COST * 20n;
      await gameMgr.connect(player1).mintScoutShips(20, { value: cost });

      const nextId = await nft.nextTokenId();
      expect(nextId).to.equal(21);
    });

    it("should emit ScoutShipsMinted event with correct data", async function () {
      const tx = await gameMgr.connect(player1).mintScoutShips(3, {
        value: SCOUT_SHIP_COST * 3n,
      });
      const receipt = await tx.wait();

      // Check event emitted
      const event = receipt.logs.find(
        (log) => {
          try {
            return gameMgr.interface.parseLog(log)?.name === "ScoutShipsMinted";
          } catch { return false; }
        }
      );
      expect(event).to.not.be.undefined;
      const parsed = gameMgr.interface.parseLog(event);
      expect(parsed.args.player).to.equal(player1.address);
      expect(parsed.args.amount).to.equal(3n);
      expect(parsed.args.tokenIds.length).to.equal(3);
    });

    it("should split payment: 30% NFT, 50% expedition, 20% treasury", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // 20 MON: 30%=6 NFT, 50%=10 expedition, 20%=4 treasury
      expect(nftBalAfter - nftBalBefore).to.equal(ethers.parseEther("6"));
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("10"));
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("4"));
    });

    it("should split payment correctly for batch of 5", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      const totalCost = SCOUT_SHIP_COST * 5n;
      await gameMgr.connect(player1).mintScoutShips(5, { value: totalCost });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // 100 MON: 30%=30 NFT, 50%=50 expedition, 20%=20 treasury
      expect(nftBalAfter - nftBalBefore).to.equal(ethers.parseEther("30"));
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("50"));
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("20"));
    });

    it("should reject incorrect payment amount", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject amount = 0", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(0, { value: 0 })
      ).to.be.revertedWith("GameMgr: invalid amount (1-20)");
    });

    it("should reject amount > 20", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(21, { value: SCOUT_SHIP_COST * 21n })
      ).to.be.revertedWith("GameMgr: invalid amount (1-20)");
    });

    it("should produce different rarities across batch (randomness works)", async function () {
      // Mint 20 ships — statistically should produce various rarities
      const cost = SCOUT_SHIP_COST * 20n;
      await gameMgr.connect(player1).mintScoutShips(20, { value: cost });

      const rarities = new Set();
      for (let i = 1; i <= 20; i++) {
        const stats = await nft.getTokenStats(i);
        rarities.add(Number(stats.rarity));
      }
      // With 20 mints, should get at least 2 different rarities
      expect(rarities.size).to.be.gte(2);
    });
  });

  // ═══════════════════════════════════════════
  //  Mint Explorers (Direct, Batch)
  // ═══════════════════════════════════════════

  describe("Mint Explorers", function () {
    it("should mint 1 explorer for 10 MON", async function () {
      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(2); // EXPLORER
      expect(stats.miningPower).to.be.gt(0);
      expect(await nft.ownerOfToken(1)).to.equal(player1.address);
    });

    it("should mint 5 explorers in one transaction", async function () {
      const cost = EXPLORER_COST * 5n;
      await gameMgr.connect(player1).mintExplorers(5, { value: cost });

      const nextId = await nft.nextTokenId();
      expect(nextId).to.equal(6);

      for (let i = 1; i <= 5; i++) {
        const stats = await nft.getTokenStats(i);
        expect(stats.tokenType).to.equal(2);
        expect(stats.miningPower).to.be.gt(0);
      }
    });

    it("should mint 20 explorers in one transaction (max batch)", async function () {
      const cost = EXPLORER_COST * 20n;
      await gameMgr.connect(player1).mintExplorers(20, { value: cost });

      const nextId = await nft.nextTokenId();
      expect(nextId).to.equal(21);
    });

    it("should split payment: 30% NFT, 50% expedition, 20% treasury", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // 10 MON: 30%=3 NFT, 50%=5 expedition, 20%=2 treasury
      expect(nftBalAfter - nftBalBefore).to.equal(ethers.parseEther("3"));
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("5"));
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("2"));
    });

    it("should reject incorrect payment", async function () {
      await expect(
        gameMgr.connect(player1).mintExplorers(1, { value: ethers.parseEther("20") })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject amount > 20", async function () {
      await expect(
        gameMgr.connect(player1).mintExplorers(21, { value: EXPLORER_COST * 21n })
      ).to.be.revertedWith("GameMgr: invalid amount (1-20)");
    });
  });

  // ═══════════════════════════════════════════
  //  Mothership via GameManager
  // ═══════════════════════════════════════════

  describe("Mothership Management", function () {
    it("should enter space and create mothership", async function () {
      await gameMgr.connect(player1).enterSpace();
      const msId = await mothershipMgr.getOwnerMothership(player1.address);
      expect(msId).to.equal(1);
    });

    it("should reject entering space twice", async function () {
      await gameMgr.connect(player1).enterSpace();
      await expect(gameMgr.connect(player1).enterSpace())
        .to.be.revertedWith("MothershipMgr: already owns a mothership");
    });
  });

  // ═══════════════════════════════════════════
  //  Full Integration Flow
  // ═══════════════════════════════════════════

  describe("Full Game Flow", function () {
    it("should complete: batch mint → assemble → expedition → resolve", async function () {
      // 1. Mint 3 Scout Ships in one transaction
      await gameMgr.connect(player1).mintScoutShips(3, { value: SCOUT_SHIP_COST * 3n });
      const shipId = 1n;

      // 2. Mint 5 Explorers in one transaction
      await gameMgr.connect(player1).mintExplorers(5, { value: EXPLORER_COST * 5n });
      const explorerId = 4n; // first explorer (after 3 ships)

      // 3. Create Mothership
      await gameMgr.connect(player1).enterSpace();
      const msId = await mothershipMgr.getOwnerMothership(player1.address);

      // 4. Add Ship to Mothership
      await gameMgr.connect(player1).addScoutShip(msId, shipId);

      // 5. Add Explorer to Ship
      await gameMgr.connect(player1).addExplorer(msId, shipId, explorerId);

      // Verify mothership state
      const msView = await mothershipMgr.getMothershipView(msId);
      expect(msView.scoutShipIds.length).to.equal(1);
      expect(msView.explorerIds.length).to.equal(1);
      expect(msView.totalMP).to.be.gt(0);
      expect(msView.rank).to.be.gte(1); // Has at least rank D

      // 6. Check if we can go to Planet 1 (requires 50 MP)
      const planet1 = await expeditionMgr.getPlanetConfig(1);
      if (msView.totalMP >= planet1.requiredMP) {
        // Start expedition
        await gameMgr.connect(player1).startExpedition(msId, 1);
        const expId = 1n;

        // 7. Resolve with on-chain randomness (no commit needed!)
        const tx = await gameMgr.connect(player1).resolveExpedition(expId);
        await tx.wait();

        // Check result
        const exp = await expeditionMgr.getExpedition(expId);
        expect(exp.status).to.be.oneOf([2n, 3n]); // SUCCESS or FAILED (random)
        expect(exp.resolvedAt).to.be.gt(0);

        // XP should have been awarded
        const msAfter = await mothershipMgr.getMothershipView(msId);
        expect(msAfter.totalXP).to.equal(5); // 5 XP per expedition
      }
    });

    it("should handle batch mint then assemble fleet", async function () {
      // Batch mint 3 ships and 5 explorers
      await gameMgr.connect(player1).mintScoutShips(3, { value: SCOUT_SHIP_COST * 3n });
      await gameMgr.connect(player1).mintExplorers(5, { value: EXPLORER_COST * 5n });

      // Create mothership and assemble
      await gameMgr.connect(player1).enterSpace();
      const msId = await mothershipMgr.getOwnerMothership(player1.address);

      // Add all 3 ships
      for (let i = 1; i <= 3; i++) {
        await gameMgr.connect(player1).addScoutShip(msId, i);
      }

      // Add explorers to first ship (token IDs 4-8)
      const shipStats = await nft.getTokenStats(1);
      const capacity = Number(shipStats.rarity);
      let explorerIdx = 4;
      for (let i = 0; i < Math.min(capacity, 5); i++) {
        await gameMgr.connect(player1).addExplorer(msId, 1, explorerIdx);
        explorerIdx++;
      }

      const msView = await mothershipMgr.getMothershipView(msId);
      expect(msView.scoutShipIds.length).to.equal(3);
      expect(msView.explorerIds.length).to.be.gte(1);
    });
  });

  // ═══════════════════════════════════════════
  //  Pause / Admin
  // ═══════════════════════════════════════════

  describe("Admin & Pause", function () {
    it("should pause and unpause", async function () {
      await gameMgr.pause();

      // Minting should fail when paused
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST })
      ).to.be.revertedWithCustomError(gameMgr, "EnforcedPause");

      await gameMgr.unpause();

      // Now minting should work
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });
    });

    it("should only allow owner to pause", async function () {
      await expect(gameMgr.connect(player1).pause())
        .to.be.revertedWithCustomError(gameMgr, "OwnableUnauthorizedAccount");
    });

    it("should update treasury", async function () {
      await gameMgr.setTreasury(player2.address);
      expect(await gameMgr.treasury()).to.equal(player2.address);
    });

    it("should reject zero address for treasury", async function () {
      await expect(gameMgr.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("GameMgr: zero address");
    });

    it("should fund reward pool", async function () {
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());
      await gameMgr.fundRewardPool({ value: ethers.parseEther("100") });
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("100"));
    });

    it("should emergency withdraw", async function () {
      // Send some ETH to GameManager first
      await owner.sendTransaction({
        to: await gameMgr.getAddress(),
        value: ethers.parseEther("100"),
      });

      const balBefore = await ethers.provider.getBalance(player2.address);
      await gameMgr.emergencyWithdraw(player2.address, ethers.parseEther("50"));
      const balAfter = await ethers.provider.getBalance(player2.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("50"));
    });
  });

  // ═══════════════════════════════════════════
  //  Burn Flow
  // ═══════════════════════════════════════════

  describe("Burn via NFT Contract", function () {
    it("should burn unassigned ship and get 6 MON refund", async function () {
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      const balBefore = await ethers.provider.getBalance(player1.address);
      const tx = await nft.connect(player1).burn(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      expect(balAfter - balBefore + gasCost).to.equal(ethers.parseEther("6"));
    });

    it("should burn unassigned explorer and get 3 MON refund", async function () {
      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const balBefore = await ethers.provider.getBalance(player1.address);
      const tx = await nft.connect(player1).burn(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      expect(balAfter - balBefore + gasCost).to.equal(ethers.parseEther("3"));
    });

    it("should NOT allow burning assigned NFT", async function () {
      // Mint + assign
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      await gameMgr.connect(player1).enterSpace();
      const msId = await mothershipMgr.getOwnerMothership(player1.address);
      await gameMgr.connect(player1).addScoutShip(msId, 1);

      await expect(nft.connect(player1).burn(1))
        .to.be.revertedWith("MoltSpaceNFT: assigned to mothership");
    });
  });
});
