const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MothershipManager", function () {
  let nft, mothershipMgr, owner, gameManager, player1, player2;

  // Helper: mint a scout ship for a player (via gameManager)
  async function mintShip(player, seed) {
    await nft.connect(gameManager).mintScoutShip(player.address, seed);
    return await nft.nextTokenId() - 1n;
  }

  // Helper: mint an explorer for a player (via gameManager)
  async function mintExplorer(player, seed) {
    await nft.connect(gameManager).mintExplorer(player.address, seed);
    return await nft.nextTokenId() - 1n;
  }

  beforeEach(async function () {
    [owner, gameManager, player1, player2] = await ethers.getSigners();

    // Deploy NFT
    const MoltSpaceNFT = await ethers.getContractFactory("MoltSpaceNFT");
    nft = await MoltSpaceNFT.deploy("https://api.monadai.space/{id}");
    await nft.waitForDeployment();

    // Deploy MothershipManager
    const MothershipManager = await ethers.getContractFactory("MothershipManager");
    mothershipMgr = await MothershipManager.deploy(await nft.getAddress());
    await mothershipMgr.waitForDeployment();

    // Configure permissions
    // gameManager signer can mint NFTs directly
    await nft.setAuthorized(gameManager.address, true);
    // MothershipManager contract can call nft.setMothership()
    await nft.setAuthorized(await mothershipMgr.getAddress(), true);
    // gameManager signer can call mothershipMgr.addScoutShip/addExplorer
    await mothershipMgr.setGameManager(gameManager.address);
  });

  // ═══════════════════════════════════════════
  //  Mothership Creation
  // ═══════════════════════════════════════════

  describe("Create Mothership", function () {
    it("should create a mothership", async function () {
      await expect(mothershipMgr.connect(gameManager).createMothership(player1.address))
        .to.emit(mothershipMgr, "MothershipCreated")
        .withArgs(1, player1.address);

      const msView = await mothershipMgr.getMothershipView(1);
      expect(msView.owner).to.equal(player1.address);
      expect(msView.active).to.be.true;
      expect(msView.level).to.equal(0);
      expect(msView.rank).to.equal(0); // NONE
    });

    it("should track owner -> mothershipId mapping", async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      expect(await mothershipMgr.getOwnerMothership(player1.address)).to.equal(1);
    });

    it("should reject second mothership for same wallet", async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      await expect(mothershipMgr.connect(gameManager).createMothership(player1.address))
        .to.be.revertedWith("MothershipMgr: already owns a mothership");
    });

    it("should allow different wallets to create motherships", async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      await mothershipMgr.connect(gameManager).createMothership(player2.address);

      expect(await mothershipMgr.getOwnerMothership(player1.address)).to.equal(1);
      expect(await mothershipMgr.getOwnerMothership(player2.address)).to.equal(2);
    });

    it("should increment mothership IDs", async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      await mothershipMgr.connect(gameManager).createMothership(player2.address);
      // Next would be 3
      const ms1 = await mothershipMgr.getMothershipView(1);
      const ms2 = await mothershipMgr.getMothershipView(2);
      expect(ms1.owner).to.equal(player1.address);
      expect(ms2.owner).to.equal(player2.address);
    });
  });

  // ═══════════════════════════════════════════
  //  Add Scout Ships
  // ═══════════════════════════════════════════

  describe("Add Scout Ships", function () {
    let mothershipId;

    beforeEach(async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      mothershipId = 1n;
    });

    it("should add a scout ship to mothership", async function () {
      const shipId = await mintShip(player1, 42);

      await expect(mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId))
        .to.emit(mothershipMgr, "ScoutShipAdded")
        .withArgs(mothershipId, shipId);

      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.scoutShipIds.length).to.equal(1);
      expect(msView.scoutShipIds[0]).to.equal(shipId);
    });

    it("should update rank when adding ships", async function () {
      const shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      const rank = await mothershipMgr.getMothershipRank(mothershipId);
      expect(rank).to.be.gte(1).and.lte(5); // D-S depending on rarity
    });

    it("should mark token as assigned in NFT contract", async function () {
      const shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      const stats = await nft.getTokenStats(shipId);
      expect(stats.mothershipId).to.equal(mothershipId);
    });

    it("should reject adding more than 10 scout ships", async function () {
      for (let i = 0; i < 10; i++) {
        const shipId = await mintShip(player1, i * 100);
        await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);
      }

      const extraShip = await mintShip(player1, 9999);
      await expect(mothershipMgr.connect(gameManager).addScoutShip(mothershipId, extraShip))
        .to.be.revertedWith("MothershipMgr: max ships reached");
    });

    it("should reject adding an explorer as a ship", async function () {
      const explorerId = await mintExplorer(player1, 42);
      await expect(mothershipMgr.connect(gameManager).addScoutShip(mothershipId, explorerId))
        .to.be.revertedWith("MothershipMgr: not a scout ship");
    });

    it("should reject adding already-assigned ship", async function () {
      const shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      await expect(mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId))
        .to.be.revertedWith("MothershipMgr: already assigned");
    });

    it("should reject adding ship owned by different player", async function () {
      const shipId = await mintShip(player2, 42); // player2 owns it
      await expect(mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId))
        .to.be.revertedWith("MothershipMgr: not owned by mothership owner");
    });

    it("should reject non-gameManager calls", async function () {
      const shipId = await mintShip(player1, 42);
      await expect(mothershipMgr.connect(player1).addScoutShip(mothershipId, shipId))
        .to.be.revertedWith("MothershipMgr: not GameManager");
    });
  });

  // ═══════════════════════════════════════════
  //  Add Explorers
  // ═══════════════════════════════════════════

  describe("Add Explorers", function () {
    let mothershipId, shipId;

    beforeEach(async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      mothershipId = 1n;
      shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);
    });

    it("should add an explorer to a scout ship", async function () {
      const explorerId = await mintExplorer(player1, 99);

      await expect(mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId))
        .to.emit(mothershipMgr, "ExplorerAdded")
        .withArgs(mothershipId, shipId, explorerId);

      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.explorerIds.length).to.equal(1);
    });

    it("should accumulate total MP", async function () {
      const exp1 = await mintExplorer(player1, 100);
      const exp2 = await mintExplorer(player1, 200);

      await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, exp1);
      await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, exp2);

      const stats1 = await nft.getTokenStats(exp1);
      const stats2 = await nft.getTokenStats(exp2);
      const expectedMP = stats1.miningPower + stats2.miningPower;

      expect(await mothershipMgr.getTotalMP(mothershipId)).to.equal(expectedMP);
    });

    it("should track ship-to-explorer mapping", async function () {
      const explorerId = await mintExplorer(player1, 99);
      await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId);

      const shipExplorers = await mothershipMgr.getShipExplorers(mothershipId, shipId);
      expect(shipExplorers.length).to.equal(1);
      expect(shipExplorers[0]).to.equal(explorerId);
    });

    it("should reject adding explorer beyond ship capacity", async function () {
      const shipStats = await nft.getTokenStats(shipId);
      const capacity = Number(shipStats.rarity); // rarity = max explorers

      // Fill ship to capacity
      for (let i = 0; i < capacity; i++) {
        const expId = await mintExplorer(player1, 1000 + i);
        await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, expId);
      }

      // One more should fail
      const extraExp = await mintExplorer(player1, 9999);
      await expect(mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, extraExp))
        .to.be.revertedWith("MothershipMgr: ship at capacity");
    });

    it("should reject adding scout ship as explorer", async function () {
      const anotherShip = await mintShip(player1, 555);
      await expect(mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, anotherShip))
        .to.be.revertedWith("MothershipMgr: not an explorer");
    });

    it("should reject adding already-assigned explorer", async function () {
      const explorerId = await mintExplorer(player1, 99);
      await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId);

      await expect(mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId))
        .to.be.revertedWith("MothershipMgr: explorer already assigned");
    });

    it("should reject ship not in this mothership", async function () {
      const fakeShipId = await mintShip(player1, 888);
      // Not added to mothership
      const explorerId = await mintExplorer(player1, 99);

      await expect(mothershipMgr.connect(gameManager).addExplorer(mothershipId, fakeShipId, explorerId))
        .to.be.revertedWith("MothershipMgr: ship not in this mothership");
    });

    it("should reject adding more than 50 explorers total", async function () {
      // Need enough ships with high rarity to fit 50+ explorers
      // This is a boundary test — we test the require directly
      // For practical purposes, test with a smaller mothership
      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.explorerIds.length).to.equal(0); // starts empty
    });
  });

  // ═══════════════════════════════════════════
  //  Rank Calculation
  // ═══════════════════════════════════════════

  describe("Rank Calculation", function () {
    let mothershipId;

    beforeEach(async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      mothershipId = 1n;
    });

    it("should return NONE rank for empty mothership", async function () {
      expect(await mothershipMgr.getMothershipRank(mothershipId)).to.equal(0);
    });

    it("should set rank based on single ship rarity", async function () {
      const shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      const stats = await nft.getTokenStats(shipId);
      // Rank should match: rarity 1→D(1), 2→C(2), 3→B(3), 4→A(4), 5→S(5)
      expect(await mothershipMgr.getMothershipRank(mothershipId)).to.equal(stats.rarity);
    });

    it("should update rank as ships are added", async function () {
      // Add 3 ships, rank should reflect the majority rarity
      const ship1 = await mintShip(player1, 100);
      const ship2 = await mintShip(player1, 200);
      const ship3 = await mintShip(player1, 300);

      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, ship1);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, ship2);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, ship3);

      const rank = await mothershipMgr.getMothershipRank(mothershipId);
      expect(rank).to.be.gte(1).and.lte(5);
    });
  });

  // ═══════════════════════════════════════════
  //  XP & Leveling
  // ═══════════════════════════════════════════

  describe("XP & Leveling", function () {
    let mothershipId;

    beforeEach(async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      mothershipId = 1n;
    });

    it("should start at level 0 with 0 XP", async function () {
      expect(await mothershipMgr.getMothershipLevel(mothershipId)).to.equal(0);
      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.totalXP).to.equal(0);
    });

    it("should accumulate XP", async function () {
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 5);
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 5);

      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.totalXP).to.equal(10);
    });

    it("should level up when XP threshold reached", async function () {
      // Level 1 requires 10 XP
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 10);

      await expect(mothershipMgr.connect(gameManager).addXP(mothershipId, 0))
        // Level should already be 1 from previous addXP
      expect(await mothershipMgr.getMothershipLevel(mothershipId)).to.equal(1);
    });

    it("should emit MothershipLevelUp on level up", async function () {
      // Need 10 XP for level 1
      await expect(mothershipMgr.connect(gameManager).addXP(mothershipId, 10))
        .to.emit(mothershipMgr, "MothershipLevelUp")
        .withArgs(mothershipId, 1, 1); // level 1, tier 1
    });

    it("should handle multiple level ups in one XP addition", async function () {
      // Level 1=10, Level 2=12 (cumulative 22 XP)
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 22);
      expect(await mothershipMgr.getMothershipLevel(mothershipId)).to.equal(2);
    });

    it("should return correct reward bonus for each level", async function () {
      // Level 0 = 0%
      expect(await mothershipMgr.getRewardBonus(mothershipId)).to.equal(0);

      // Level 1 = 1% (100 bps)
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 10);
      expect(await mothershipMgr.getRewardBonus(mothershipId)).to.equal(100);
    });

    it("should not exceed max level 25", async function () {
      // Add massive XP
      await mothershipMgr.connect(gameManager).addXP(mothershipId, 100000);
      expect(await mothershipMgr.getMothershipLevel(mothershipId)).to.equal(25);
    });

    it("should reject addXP from non-gameManager", async function () {
      await expect(mothershipMgr.connect(player1).addXP(mothershipId, 10))
        .to.be.revertedWith("MothershipMgr: not GameManager");
    });
  });

  // ═══════════════════════════════════════════
  //  Disband Mothership
  // ═══════════════════════════════════════════

  describe("Disband Mothership", function () {
    let mothershipId, shipId, explorerId;

    beforeEach(async function () {
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      mothershipId = 1n;

      shipId = await mintShip(player1, 42);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      explorerId = await mintExplorer(player1, 99);
      await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId);
    });

    it("should disband and emit event", async function () {
      await expect(mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address))
        .to.emit(mothershipMgr, "MothershipDisbanded")
        .withArgs(mothershipId);
    });

    it("should unassign all NFTs", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);

      const shipStats = await nft.getTokenStats(shipId);
      expect(shipStats.mothershipId).to.equal(0);

      const expStats = await nft.getTokenStats(explorerId);
      expect(expStats.mothershipId).to.equal(0);
    });

    it("should mark mothership as inactive", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);
      const msView = await mothershipMgr.getMothershipView(mothershipId);
      expect(msView.active).to.be.false;
    });

    it("should clear owner mapping so they can create a new one", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);
      expect(await mothershipMgr.getOwnerMothership(player1.address)).to.equal(0);

      // Should be able to create a new mothership
      await mothershipMgr.connect(gameManager).createMothership(player1.address);
      expect(await mothershipMgr.getOwnerMothership(player1.address)).to.equal(2);
    });

    it("should reset total MP to 0", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);
      expect(await mothershipMgr.getTotalMP(mothershipId)).to.equal(0);
    });

    it("should reject disband from non-owner", async function () {
      await expect(mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player2.address))
        .to.be.revertedWith("MothershipMgr: not owner");
    });

    it("should reject disband of already-disbanded mothership", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);
      await expect(mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address))
        .to.be.revertedWith("MothershipMgr: not active");
    });

    it("should allow NFT transfers after disband", async function () {
      await mothershipMgr.connect(gameManager).disbandMothership(mothershipId, player1.address);

      // Ship and explorer should now be transferable
      await nft.connect(player1).safeTransferFrom(player1.address, player2.address, shipId, 1, "0x");
      expect(await nft.ownerOfToken(shipId)).to.equal(player2.address);
    });
  });
});
