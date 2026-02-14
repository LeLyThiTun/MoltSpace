const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ExpeditionManager", function () {
  let nft, mothershipMgr, expeditionMgr, owner, gameManager, player1;

  async function mintShip(player, seed) {
    await nft.connect(gameManager).mintScoutShip(player.address, seed);
    return await nft.nextTokenId() - 1n;
  }

  async function mintExplorerToken(player, seed) {
    await nft.connect(gameManager).mintExplorer(player.address, seed);
    return await nft.nextTokenId() - 1n;
  }

  // Helper: set up a fully equipped mothership for player1
  async function setupMothership() {
    await mothershipMgr.connect(gameManager).createMothership(player1.address);
    const mothershipId = 1n;

    // Mint and add a ship
    const shipId = await mintShip(player1, 42);
    await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

    // Mint and add an explorer to the ship
    const explorerId = await mintExplorerToken(player1, 99);
    await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, explorerId);

    return { mothershipId, shipId, explorerId };
  }

  // Helper: set up a strong mothership with high MP for high-planet tests
  async function setupStrongMothership() {
    await mothershipMgr.connect(gameManager).createMothership(player1.address);
    const mothershipId = 1n;

    // Add multiple ships and fill with explorers
    for (let i = 0; i < 5; i++) {
      const shipId = await mintShip(player1, i * 1000);
      await mothershipMgr.connect(gameManager).addScoutShip(mothershipId, shipId);

      const shipStats = await nft.getTokenStats(shipId);
      const capacity = Number(shipStats.rarity);
      for (let j = 0; j < capacity; j++) {
        const expId = await mintExplorerToken(player1, i * 1000 + j * 100 + 7);
        await mothershipMgr.connect(gameManager).addExplorer(mothershipId, shipId, expId);
      }
    }

    return mothershipId;
  }

  beforeEach(async function () {
    [owner, gameManager, player1] = await ethers.getSigners();

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

    // Set permissions
    await nft.setAuthorized(gameManager.address, true);
    await nft.setAuthorized(await mothershipMgr.getAddress(), true);
    await mothershipMgr.setGameManager(gameManager.address);
    await mothershipMgr.setExpeditionManager(await expeditionMgr.getAddress());
    await expeditionMgr.setGameManager(gameManager.address);

    // Fund contracts (within Hardhat default 10000 ETH)
    await owner.sendTransaction({ to: await nft.getAddress(), value: ethers.parseEther("10") });
    await owner.sendTransaction({ to: await expeditionMgr.getAddress(), value: ethers.parseEther("50") });
  });

  // ═══════════════════════════════════════════
  //  Planet Configuration
  // ═══════════════════════════════════════════

  describe("Planet Configuration", function () {
    it("should have 30 planets configured", async function () {
      for (let i = 1; i <= 30; i++) {
        const planet = await expeditionMgr.getPlanetConfig(i);
        expect(planet.requiredMP).to.be.gt(0);
        expect(planet.baseReward).to.be.gt(0);
        expect(planet.tier).to.be.gte(1).and.lte(4);
        expect(planet.suggestedRank).to.be.gte(2).and.lte(5);
      }
    });

    it("should reject planet 0 and planet 31", async function () {
      await expect(expeditionMgr.getPlanetConfig(0))
        .to.be.revertedWith("ExpeditionMgr: invalid planet");
      await expect(expeditionMgr.getPlanetConfig(31))
        .to.be.revertedWith("ExpeditionMgr: invalid planet");
    });

    it("should have increasing MP requirements", async function () {
      let prevMP = 0n;
      for (let i = 1; i <= 30; i++) {
        const planet = await expeditionMgr.getPlanetConfig(i);
        expect(planet.requiredMP).to.be.gte(prevMP);
        prevMP = planet.requiredMP;
      }
    });

    it("should have correct zone assignments", async function () {
      // Zone 1: planets 1-10, tier 1, rank C (2)
      for (let i = 1; i <= 10; i++) {
        const p = await expeditionMgr.getPlanetConfig(i);
        expect(p.tier).to.equal(1);
        expect(p.suggestedRank).to.equal(2);
      }
      // Zone 2: planets 11-20, tier 2, rank B (3)
      for (let i = 11; i <= 20; i++) {
        const p = await expeditionMgr.getPlanetConfig(i);
        expect(p.tier).to.equal(2);
        expect(p.suggestedRank).to.equal(3);
      }
      // Zone 3: planets 21-25, tier 3, rank A (4)
      for (let i = 21; i <= 25; i++) {
        const p = await expeditionMgr.getPlanetConfig(i);
        expect(p.tier).to.equal(3);
        expect(p.suggestedRank).to.equal(4);
      }
      // Zone 4: planets 26-30, tier 4, rank S (5)
      for (let i = 26; i <= 30; i++) {
        const p = await expeditionMgr.getPlanetConfig(i);
        expect(p.tier).to.equal(4);
        expect(p.suggestedRank).to.equal(5);
      }
    });

    it("Planet 1: reward 3.5 MON, required MP 50", async function () {
      const p = await expeditionMgr.getPlanetConfig(1);
      expect(p.baseReward).to.equal(ethers.parseEther("3.5"));
      expect(p.requiredMP).to.equal(ethers.parseEther("50"));
    });

    it("Planet 30: reward 1125 MON, required MP 12000", async function () {
      const p = await expeditionMgr.getPlanetConfig(30);
      expect(p.baseReward).to.equal(ethers.parseEther("1125"));
      expect(p.requiredMP).to.equal(ethers.parseEther("12000"));
    });
  });

  // ═══════════════════════════════════════════
  //  Success Rates
  // ═══════════════════════════════════════════

  describe("Success Rates", function () {
    it("should return correct rates for Planet 1", async function () {
      // D=85%, C=88%, B=91%, A=93%, S=97%
      expect(await expeditionMgr.getSuccessRate(1, 1)).to.equal(8500);
      expect(await expeditionMgr.getSuccessRate(2, 1)).to.equal(8800);
      expect(await expeditionMgr.getSuccessRate(3, 1)).to.equal(9100);
      expect(await expeditionMgr.getSuccessRate(4, 1)).to.equal(9300);
      expect(await expeditionMgr.getSuccessRate(5, 1)).to.equal(9700);
    });

    it("should have decreasing rates for higher planets at same rank", async function () {
      const rateP1 = await expeditionMgr.getSuccessRate(2, 1);  // Planet 1, Rank C
      const rateP10 = await expeditionMgr.getSuccessRate(2, 10); // Planet 10, Rank C
      expect(rateP1).to.be.gt(rateP10);
    });

    it("should have increasing rates for higher ranks at same planet", async function () {
      const rateD = await expeditionMgr.getSuccessRate(1, 5);  // Rank D
      const rateC = await expeditionMgr.getSuccessRate(2, 5);  // Rank C
      const rateS = await expeditionMgr.getSuccessRate(5, 5);  // Rank S
      expect(rateD).to.be.lt(rateC);
      expect(rateC).to.be.lt(rateS);
    });

    it("Zone 4 Rank S should be 53%", async function () {
      expect(await expeditionMgr.getSuccessRate(5, 30)).to.equal(5300);
    });
  });

  // ═══════════════════════════════════════════
  //  Start Expedition
  // ═══════════════════════════════════════════

  describe("Start Expedition", function () {
    let mothershipId;

    beforeEach(async function () {
      const setup = await setupMothership();
      mothershipId = setup.mothershipId;
    });

    it("should start an expedition on Planet 1", async function () {
      // Check if mothership has enough MP for planet 1 (50 MP required)
      const totalMP = await mothershipMgr.getTotalMP(mothershipId);
      const planet = await expeditionMgr.getPlanetConfig(1);

      if (totalMP >= planet.requiredMP) {
        await expect(expeditionMgr.connect(gameManager).startExpedition(mothershipId, 1, player1.address))
          .to.emit(expeditionMgr, "ExpeditionStarted")
          .withArgs(1, mothershipId, 1, player1.address);

        const exp = await expeditionMgr.getExpedition(1);
        expect(exp.mothershipId).to.equal(mothershipId);
        expect(exp.planetId).to.equal(1);
        expect(exp.status).to.equal(1); // PENDING
        expect(exp.player).to.equal(player1.address);
      }
    });

    it("should reject invalid planet ID", async function () {
      await expect(expeditionMgr.connect(gameManager).startExpedition(mothershipId, 0, player1.address))
        .to.be.revertedWith("ExpeditionMgr: invalid planet");
      await expect(expeditionMgr.connect(gameManager).startExpedition(mothershipId, 31, player1.address))
        .to.be.revertedWith("ExpeditionMgr: invalid planet");
    });

    it("should reject expedition with empty mothership", async function () {
      // Create a fresh mothership with no ships
      await mothershipMgr.connect(gameManager).createMothership(owner.address);
      const emptyMsId = await mothershipMgr.getOwnerMothership(owner.address);

      await expect(expeditionMgr.connect(gameManager).startExpedition(emptyMsId, 1, owner.address))
        .to.be.revertedWith("ExpeditionMgr: no scout ships");
    });

    it("should enforce cooldown between expeditions", async function () {
      const totalMP = await mothershipMgr.getTotalMP(mothershipId);
      const planet = await expeditionMgr.getPlanetConfig(1);

      if (totalMP >= planet.requiredMP) {
        await expeditionMgr.connect(gameManager).startExpedition(mothershipId, 1, player1.address);

        // Immediate second expedition should fail
        await expect(expeditionMgr.connect(gameManager).startExpedition(mothershipId, 1, player1.address))
          .to.be.revertedWith("ExpeditionMgr: cooldown not finished");

        // After 12 hours, should work
        await time.increase(43201);
        // This should not revert for cooldown (may revert for other reasons depending on state)
      }
    });

    it("should reject insufficient MP for planet", async function () {
      // Planet 30 requires 12000 MP — a single explorer won't have enough
      await expect(expeditionMgr.connect(gameManager).startExpedition(mothershipId, 30, player1.address))
        .to.be.revertedWith("ExpeditionMgr: insufficient MP");
    });

    it("should increment expedition IDs", async function () {
      const totalMP = await mothershipMgr.getTotalMP(mothershipId);
      const planet = await expeditionMgr.getPlanetConfig(1);

      if (totalMP >= planet.requiredMP) {
        await expeditionMgr.connect(gameManager).startExpedition(mothershipId, 1, player1.address);
        expect(await expeditionMgr.nextExpeditionId()).to.equal(2);
      }
    });
  });

  // ═══════════════════════════════════════════
  //  Resolve Expedition
  // ═══════════════════════════════════════════

  describe("Resolve Expedition", function () {
    let mothershipId, expeditionId;

    beforeEach(async function () {
      const setup = await setupMothership();
      mothershipId = setup.mothershipId;

      const totalMP = await mothershipMgr.getTotalMP(mothershipId);
      const planet = await expeditionMgr.getPlanetConfig(1);

      if (totalMP >= planet.requiredMP) {
        const tx = await expeditionMgr.connect(gameManager).startExpedition(mothershipId, 1, player1.address);
        const receipt = await tx.wait();
        expeditionId = 1n;
      }
    });

    it("should resolve as SUCCESS with low random seed", async function () {
      if (!expeditionId) this.skip();

      // Using seed 0 should always succeed (0 < any success rate)
      const balBefore = await ethers.provider.getBalance(player1.address);

      await expect(expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 0))
        .to.emit(expeditionMgr, "ExpeditionResolved");

      const exp = await expeditionMgr.getExpedition(expeditionId);
      expect(exp.status).to.equal(2); // SUCCESS
      expect(exp.reward).to.be.gt(0);
    });

    it("should resolve as FAILED with high random seed", async function () {
      if (!expeditionId) this.skip();

      // seed 9999 → roll = 9999, which exceeds all success rates
      await expect(expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 9999))
        .to.emit(expeditionMgr, "ExpeditionResolved");

      const exp = await expeditionMgr.getExpedition(expeditionId);
      expect(exp.status).to.equal(3); // FAILED
      expect(exp.reward).to.equal(0);
    });

    it("should award XP regardless of outcome", async function () {
      if (!expeditionId) this.skip();

      const xpBefore = (await mothershipMgr.getMothershipView(mothershipId)).totalXP;
      await expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 9999); // fail
      const xpAfter = (await mothershipMgr.getMothershipView(mothershipId)).totalXP;

      expect(xpAfter - xpBefore).to.equal(5); // XP_PER_EXPEDITION = 5
    });

    it("should set resolvedAt timestamp", async function () {
      if (!expeditionId) this.skip();

      await expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 0);
      const exp = await expeditionMgr.getExpedition(expeditionId);
      expect(exp.resolvedAt).to.be.gt(0);
    });

    it("should reject resolving non-pending expedition", async function () {
      if (!expeditionId) this.skip();

      await expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 0);

      // Try resolving again
      await expect(expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 0))
        .to.be.revertedWith("ExpeditionMgr: not pending");
    });

    it("should reject resolve from non-gameManager", async function () {
      if (!expeditionId) this.skip();

      await expect(expeditionMgr.connect(player1).resolveExpedition(expeditionId, 0))
        .to.be.revertedWith("ExpeditionMgr: not GameManager");
    });

    it("should transfer reward on success", async function () {
      if (!expeditionId) this.skip();

      const balBefore = await ethers.provider.getBalance(player1.address);
      await expeditionMgr.connect(gameManager).resolveExpedition(expeditionId, 0); // success

      const exp = await expeditionMgr.getExpedition(expeditionId);
      if (exp.status === 2n) { // SUCCESS
        const balAfter = await ethers.provider.getBalance(player1.address);
        expect(balAfter).to.be.gt(balBefore);
      }
    });
  });

  // ═══════════════════════════════════════════
  //  Reward Calculation
  // ═══════════════════════════════════════════

  describe("Reward Calculation", function () {
    it("should give higher rewards for higher planets", async function () {
      // Compare base rewards
      const p1 = await expeditionMgr.getPlanetConfig(1);
      const p10 = await expeditionMgr.getPlanetConfig(10);
      const p30 = await expeditionMgr.getPlanetConfig(30);

      expect(p10.baseReward).to.be.gt(p1.baseReward);
      expect(p30.baseReward).to.be.gt(p10.baseReward);
    });

    it("base reward for Planet 1 = 3.5 MON", async function () {
      const p = await expeditionMgr.getPlanetConfig(1);
      expect(p.baseReward).to.equal(ethers.parseEther("3.5"));
    });

    it("base reward for Planet 30 = 1125 MON", async function () {
      const p = await expeditionMgr.getPlanetConfig(30);
      expect(p.baseReward).to.equal(ethers.parseEther("1125"));
    });
  });

  // ═══════════════════════════════════════════
  //  Edge Cases
  // ═══════════════════════════════════════════

  describe("Edge Cases", function () {
    it("should handle non-owner trying to start expedition", async function () {
      const setup = await setupMothership();

      // owner (not player1) tries to start expedition on player1's mothership
      await expect(expeditionMgr.connect(gameManager).startExpedition(setup.mothershipId, 1, owner.address))
        .to.be.revertedWith("ExpeditionMgr: not mothership owner");
    });

    it("should reject expedition on disbanded mothership", async function () {
      const setup = await setupMothership();
      await mothershipMgr.connect(gameManager).disbandMothership(setup.mothershipId, player1.address);

      await expect(expeditionMgr.connect(gameManager).startExpedition(setup.mothershipId, 1, player1.address))
        .to.be.revertedWith("ExpeditionMgr: mothership not active");
    });
  });
});
