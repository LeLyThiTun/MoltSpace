const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * MintCost Test Suite — Direct Batch Mint (no commit-reveal)
 * Tests the mint costs and batch mint functionality:
 *   - Scout Ship: 20 $MON
 *   - Explorer:   10 $MON
 *   - Batch sizes: 1, 5, 10, 20
 * Verifies payment splits, refund amounts, and error cases.
 */
describe("MintCost — 20 / 10 MON (Batch Mint)", function () {
  let nft, mothershipMgr, expeditionMgr, gameMgr;
  let owner, player1, player2, treasury;

  const SCOUT_SHIP_COST = ethers.parseEther("20");
  const EXPLORER_COST = ethers.parseEther("10");

  // 30% of mint cost → NFT (burn reserve)
  const SCOUT_REFUND = ethers.parseEther("6");
  const EXPLORER_REFUND = ethers.parseEther("3");

  // 50% of mint cost → Expedition Pool
  const SCOUT_EXPEDITION = ethers.parseEther("10");
  const EXPLORER_EXPEDITION = ethers.parseEther("5");

  // 20% of mint cost → Treasury
  const SCOUT_TREASURY = ethers.parseEther("4");
  const EXPLORER_TREASURY = ethers.parseEther("2");

  beforeEach(async function () {
    [owner, player1, player2, treasury] = await ethers.getSigners();

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

    // Authorize
    await nft.setAuthorized(await gameMgr.getAddress(), true);
    await nft.setAuthorized(await mothershipMgr.getAddress(), true);
    await mothershipMgr.setGameManager(await gameMgr.getAddress());
    await mothershipMgr.setExpeditionManager(await expeditionMgr.getAddress());
    await expeditionMgr.setGameManager(await gameMgr.getAddress());

    // Fund expedition reward pool
    await owner.sendTransaction({
      to: await expeditionMgr.getAddress(),
      value: ethers.parseEther("50000"),
    });
  });

  // ═══════════════════════════════════════════
  //  Contract Constants Verification
  // ═══════════════════════════════════════════

  describe("Contract Constants", function () {
    it("GameManager SCOUT_SHIP_COST should be 20 ether", async function () {
      const cost = await gameMgr.SCOUT_SHIP_COST();
      expect(cost).to.equal(SCOUT_SHIP_COST);
    });

    it("GameManager EXPLORER_COST should be 10 ether", async function () {
      const cost = await gameMgr.EXPLORER_COST();
      expect(cost).to.equal(EXPLORER_COST);
    });

    it("GameManager MAX_BATCH_SIZE should be 20", async function () {
      const maxBatch = await gameMgr.MAX_BATCH_SIZE();
      expect(maxBatch).to.equal(20);
    });

    it("MoltSpaceNFT SCOUT_SHIP_COST should be 20 ether", async function () {
      const cost = await nft.SCOUT_SHIP_COST();
      expect(cost).to.equal(SCOUT_SHIP_COST);
    });

    it("MoltSpaceNFT EXPLORER_COST should be 10 ether", async function () {
      const cost = await nft.EXPLORER_COST();
      expect(cost).to.equal(EXPLORER_COST);
    });
  });

  // ═══════════════════════════════════════════
  //  Scout Ship Mint — Single (20 MON)
  // ═══════════════════════════════════════════

  describe("Scout Ship Mint — 20 MON (Single)", function () {
    it("should mint a scout ship for exactly 20 MON", async function () {
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(1); // SCOUT_SHIP
      expect(await nft.ownerOfToken(1)).to.equal(player1.address);
    });

    it("should split: 30% NFT, 50% expedition, 20% treasury", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      expect(nftBalAfter - nftBalBefore).to.equal(SCOUT_REFUND);
      expect(expBalAfter - expBalBefore).to.equal(SCOUT_EXPEDITION);
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(SCOUT_TREASURY);
    });

    it("should reject payment of 10 MON (too low)", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: EXPLORER_COST })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject payment of 30 MON (too high)", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: ethers.parseEther("30") })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject payment of 0.02 MON (old cost)", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: ethers.parseEther("0.02") })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject zero payment", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(1, { value: 0 })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });
  });

  // ═══════════════════════════════════════════
  //  Explorer Mint — Single (10 MON)
  // ═══════════════════════════════════════════

  describe("Explorer Mint — 10 MON (Single)", function () {
    it("should mint an explorer for exactly 10 MON", async function () {
      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(2); // EXPLORER
      expect(stats.miningPower).to.be.gt(0);
      expect(await nft.ownerOfToken(1)).to.equal(player1.address);
    });

    it("should split: 30% NFT, 50% expedition, 20% treasury", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      expect(nftBalAfter - nftBalBefore).to.equal(EXPLORER_REFUND);
      expect(expBalAfter - expBalBefore).to.equal(EXPLORER_EXPEDITION);
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(EXPLORER_TREASURY);
    });

    it("should reject payment of 20 MON (too high)", async function () {
      await expect(
        gameMgr.connect(player1).mintExplorers(1, { value: SCOUT_SHIP_COST })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject payment of 0.01 MON (old cost)", async function () {
      await expect(
        gameMgr.connect(player1).mintExplorers(1, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should reject zero payment", async function () {
      await expect(
        gameMgr.connect(player1).mintExplorers(1, { value: 0 })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });
  });

  // ═══════════════════════════════════════════
  //  Batch Mint (1, 5, 10, 20)
  // ═══════════════════════════════════════════

  describe("Batch Mint — Quantity Options", function () {
    for (const amount of [1, 5, 10, 20]) {
      it(`should mint ${amount} scout ships in one tx for ${(20 * amount)} MON`, async function () {
        const cost = SCOUT_SHIP_COST * BigInt(amount);
        await gameMgr.connect(player1).mintScoutShips(amount, { value: cost });

        const nextId = await nft.nextTokenId();
        expect(nextId).to.equal(amount + 1);

        for (let i = 1; i <= amount; i++) {
          const stats = await nft.getTokenStats(i);
          expect(stats.tokenType).to.equal(1);
        }
      });

      it(`should mint ${amount} explorers in one tx for ${(10 * amount)} MON`, async function () {
        const cost = EXPLORER_COST * BigInt(amount);
        await gameMgr.connect(player1).mintExplorers(amount, { value: cost });

        const nextId = await nft.nextTokenId();
        expect(nextId).to.equal(amount + 1);

        for (let i = 1; i <= amount; i++) {
          const stats = await nft.getTokenStats(i);
          expect(stats.tokenType).to.equal(2);
          expect(stats.miningPower).to.be.gt(0);
        }
      });
    }

    it("should reject amount = 0", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(0, { value: 0 })
      ).to.be.revertedWith("GameMgr: invalid amount (1-20)");
    });

    it("should reject amount = 21", async function () {
      await expect(
        gameMgr.connect(player1).mintScoutShips(21, { value: SCOUT_SHIP_COST * 21n })
      ).to.be.revertedWith("GameMgr: invalid amount (1-20)");
    });

    it("should reject mismatched payment for batch of 5 ships", async function () {
      // Pay for 4 but request 5
      await expect(
        gameMgr.connect(player1).mintScoutShips(5, { value: SCOUT_SHIP_COST * 4n })
      ).to.be.revertedWith("GameMgr: incorrect payment");
    });

    it("should correctly split batch payment (5 ships)", async function () {
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

    it("should correctly split batch payment (20 explorers)", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      const totalCost = EXPLORER_COST * 20n;
      await gameMgr.connect(player1).mintExplorers(20, { value: totalCost });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // 200 MON: 30%=60 NFT, 50%=100 expedition, 20%=40 treasury
      expect(nftBalAfter - nftBalBefore).to.equal(ethers.parseEther("60"));
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("100"));
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("40"));
    });
  });

  // ═══════════════════════════════════════════
  //  Burn Refund with New Costs
  // ═══════════════════════════════════════════

  describe("Burn Refund — 30% of Costs", function () {
    it("should refund 6 MON when burning a scout ship", async function () {
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });

      const balBefore = await ethers.provider.getBalance(player1.address);
      const tx = await nft.connect(player1).burn(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      expect(balAfter - balBefore + gasCost).to.equal(SCOUT_REFUND);
    });

    it("should refund 3 MON when burning an explorer", async function () {
      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });

      const balBefore = await ethers.provider.getBalance(player1.address);
      const tx = await nft.connect(player1).burn(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      expect(balAfter - balBefore + gasCost).to.equal(EXPLORER_REFUND);
    });
  });

  // ═══════════════════════════════════════════
  //  Full Flow with Batch Mint
  // ═══════════════════════════════════════════

  describe("Full Game Flow with Batch Mint", function () {
    it("should complete: batch mint ship (20) → batch mint explorer (10) → assemble → ready", async function () {
      // 1. Mint 1 Scout Ship for 20 MON
      await gameMgr.connect(player1).mintScoutShips(1, { value: SCOUT_SHIP_COST });
      const shipId = 1n;

      // 2. Mint 1 Explorer for 10 MON
      await gameMgr.connect(player1).mintExplorers(1, { value: EXPLORER_COST });
      const explorerId = 2n;

      // 3. Create Mothership (free, gas only)
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
      expect(msView.rank).to.be.gte(1);
    });

    it("total cost for 5 ships + 10 explorers batch = 200 MON", async function () {
      const nftBalBefore = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const expBalBefore = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // Batch mint 5 ships (100 MON)
      await gameMgr.connect(player1).mintScoutShips(5, { value: SCOUT_SHIP_COST * 5n });
      // Batch mint 10 explorers (100 MON)
      await gameMgr.connect(player1).mintExplorers(10, { value: EXPLORER_COST * 10n });

      const nftBalAfter = await ethers.provider.getBalance(await nft.getAddress());
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const expBalAfter = await ethers.provider.getBalance(await expeditionMgr.getAddress());

      // 200 MON total: 30%=60 NFT, 50%=100 expedition, 20%=40 treasury
      expect(nftBalAfter - nftBalBefore).to.equal(ethers.parseEther("60"));
      expect(expBalAfter - expBalBefore).to.equal(ethers.parseEther("100"));
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("40"));
    });
  });
});
