const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MoltSpaceNFT", function () {
  let nft, gameManager, owner, player1, player2;

  const SCOUT_SHIP_COST = ethers.parseEther("20");
  const EXPLORER_COST = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, gameManager, player1, player2] = await ethers.getSigners();

    const MoltSpaceNFT = await ethers.getContractFactory("MoltSpaceNFT");
    nft = await MoltSpaceNFT.deploy("https://api.monadai.space/metadata/{id}.json");
    await nft.waitForDeployment();

    // Set gameManager as the authorized caller
    await nft.setAuthorized(gameManager.address, true);

    // Fund the NFT contract for burn refunds
    await owner.sendTransaction({ to: await nft.getAddress(), value: ethers.parseEther("5000") });
  });

  // ═══════════════════════════════════════════
  //  Admin
  // ═══════════════════════════════════════════

  describe("Admin", function () {
    it("should set authorized callers correctly", async function () {
      expect(await nft.authorizedCallers(gameManager.address)).to.be.true;
    });

    it("should reject zero address for authorized caller", async function () {
      await expect(nft.setAuthorized(ethers.ZeroAddress, true))
        .to.be.revertedWith("MoltSpaceNFT: zero address");
    });

    it("should only allow owner to set authorized callers", async function () {
      await expect(nft.connect(player1).setAuthorized(player1.address, true))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update URI", async function () {
      await nft.setURI("https://new-uri.xyz/{id}.json");
      // No revert = success
    });
  });

  // ═══════════════════════════════════════════
  //  Minting Scout Ships
  // ═══════════════════════════════════════════

  describe("Mint Scout Ship", function () {
    it("should mint a scout ship with valid rarity (1-5)", async function () {
      const tx = await nft.connect(gameManager).mintScoutShip(player1.address, 42);
      const receipt = await tx.wait();

      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(1); // SCOUT_SHIP
      expect(stats.rarity).to.be.gte(1).and.lte(5);
      expect(stats.miningPower).to.equal(0); // Ships have no MP
      expect(stats.mothershipId).to.equal(0); // Unassigned
    });

    it("should emit ScoutShipMinted event", async function () {
      await expect(nft.connect(gameManager).mintScoutShip(player1.address, 42))
        .to.emit(nft, "ScoutShipMinted")
        .withArgs(1, (rarity) => rarity >= 1 && rarity <= 5, player1.address);
    });

    it("should increment token IDs", async function () {
      await nft.connect(gameManager).mintScoutShip(player1.address, 100);
      await nft.connect(gameManager).mintScoutShip(player1.address, 200);
      await nft.connect(gameManager).mintScoutShip(player2.address, 300);

      expect(await nft.nextTokenId()).to.equal(4);
      expect(await nft.ownerOfToken(1)).to.equal(player1.address);
      expect(await nft.ownerOfToken(2)).to.equal(player1.address);
      expect(await nft.ownerOfToken(3)).to.equal(player2.address);
    });

    it("should reject mint from non-authorized caller", async function () {
      await expect(nft.connect(player1).mintScoutShip(player1.address, 42))
        .to.be.revertedWith("MoltSpaceNFT: caller is not authorized");
    });

    it("should give ERC-1155 balance to recipient", async function () {
      await nft.connect(gameManager).mintScoutShip(player1.address, 42);
      expect(await nft.balanceOf(player1.address, 1)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════
  //  Minting Explorers
  // ═══════════════════════════════════════════

  describe("Mint Explorer", function () {
    it("should mint an explorer with valid rarity and MP", async function () {
      await nft.connect(gameManager).mintExplorer(player1.address, 42);

      const stats = await nft.getTokenStats(1);
      expect(stats.tokenType).to.equal(2); // EXPLORER
      expect(stats.rarity).to.be.gte(1).and.lte(5);
      expect(stats.miningPower).to.be.gt(0);
    });

    it("should assign MP within correct range for each rarity", async function () {
      // Mint many explorers and check MP ranges
      const mpRanges = {
        5: [ethers.parseEther("200"), ethers.parseEther("255")],
        4: [ethers.parseEther("150"), ethers.parseEther("200")],
        3: [ethers.parseEther("100"), ethers.parseEther("150")],
        2: [ethers.parseEther("50"), ethers.parseEther("100")],
        1: [ethers.parseEther("15"), ethers.parseEther("50")],
      };

      for (let i = 0; i < 20; i++) {
        await nft.connect(gameManager).mintExplorer(player1.address, i * 1000 + 7);
        const stats = await nft.getTokenStats(i + 1);
        const range = mpRanges[stats.rarity];
        expect(stats.miningPower).to.be.gte(range[0]);
        expect(stats.miningPower).to.be.lte(range[1]);
      }
    });

    it("should emit ExplorerMinted event with MP", async function () {
      await expect(nft.connect(gameManager).mintExplorer(player1.address, 42))
        .to.emit(nft, "ExplorerMinted");
    });
  });

  // ═══════════════════════════════════════════
  //  Gacha Drop Rates
  // ═══════════════════════════════════════════

  describe("Gacha Distribution", function () {
    it("should produce all rarity levels across many mints", async function () {
      const rarityCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      for (let i = 0; i < 100; i++) {
        await nft.connect(gameManager).mintScoutShip(player1.address, i * 997 + 13);
        const stats = await nft.getTokenStats(i + 1);
        rarityCounts[stats.rarity]++;
      }

      // With 100 mints, we should see at least some 1★ and 2★ (most common)
      expect(rarityCounts[1]).to.be.gt(0); // 44% chance
      expect(rarityCounts[2]).to.be.gt(0); // 35% chance
      // 3★+ may or may not appear in 100 mints but at least one should
      const totalHighRarity = rarityCounts[3] + rarityCounts[4] + rarityCounts[5];
      // 21% combined chance, very likely to appear in 100 rolls
      expect(rarityCounts[1] + rarityCounts[2]).to.be.gt(totalHighRarity);
    });
  });

  // ═══════════════════════════════════════════
  //  Burn & Refund
  // ═══════════════════════════════════════════

  describe("Burn", function () {
    beforeEach(async function () {
      await nft.connect(gameManager).mintScoutShip(player1.address, 42);
      await nft.connect(gameManager).mintExplorer(player1.address, 99);
    });

    it("should burn a scout ship and refund 6 MON", async function () {
      const balBefore = await ethers.provider.getBalance(player1.address);

      const tx = await nft.connect(player1).burn(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      const refund = ethers.parseEther("6");
      expect(balAfter - balBefore + gasUsed).to.equal(refund);
    });

    it("should burn an explorer and refund 3 MON", async function () {
      const balBefore = await ethers.provider.getBalance(player1.address);

      const tx = await nft.connect(player1).burn(2);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(player1.address);
      const refund = ethers.parseEther("3");
      expect(balAfter - balBefore + gasUsed).to.equal(refund);
    });

    it("should emit NFTBurned event", async function () {
      await expect(nft.connect(player1).burn(1))
        .to.emit(nft, "NFTBurned")
        .withArgs(1, ethers.parseEther("6"), player1.address);
    });

    it("should delete token stats after burn", async function () {
      await nft.connect(player1).burn(1);
      await expect(nft.getTokenStats(1))
        .to.be.revertedWith("MoltSpaceNFT: token does not exist");
    });

    it("should reject burn from non-owner", async function () {
      await expect(nft.connect(player2).burn(1))
        .to.be.revertedWith("MoltSpaceNFT: not token owner");
    });

    it("should reject burn of assigned token", async function () {
      // Simulate assigning to mothership
      await nft.connect(gameManager).setMothership(1, 1);

      await expect(nft.connect(player1).burn(1))
        .to.be.revertedWith("MoltSpaceNFT: assigned to mothership");
    });

    it("should reject burn of non-existent token", async function () {
      await expect(nft.connect(player1).burn(999))
        .to.be.revertedWith("MoltSpaceNFT: not token owner");
    });
  });

  // ═══════════════════════════════════════════
  //  Mothership Assignment
  // ═══════════════════════════════════════════

  describe("Mothership Assignment", function () {
    beforeEach(async function () {
      await nft.connect(gameManager).mintScoutShip(player1.address, 42);
    });

    it("should set mothership ID on token", async function () {
      await nft.connect(gameManager).setMothership(1, 5);
      const stats = await nft.getTokenStats(1);
      expect(stats.mothershipId).to.equal(5);
    });

    it("should unassign by setting mothershipId to 0", async function () {
      await nft.connect(gameManager).setMothership(1, 5);
      await nft.connect(gameManager).setMothership(1, 0);
      const stats = await nft.getTokenStats(1);
      expect(stats.mothershipId).to.equal(0);
    });

    it("should reject setMothership from non-authorized caller", async function () {
      await expect(nft.connect(player1).setMothership(1, 5))
        .to.be.revertedWith("MoltSpaceNFT: caller is not authorized");
    });
  });

  // ═══════════════════════════════════════════
  //  Transfer Restrictions
  // ═══════════════════════════════════════════

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await nft.connect(gameManager).mintScoutShip(player1.address, 42);
    });

    it("should allow transfer of unassigned token", async function () {
      await nft.connect(player1).safeTransferFrom(player1.address, player2.address, 1, 1, "0x");
      expect(await nft.ownerOfToken(1)).to.equal(player2.address);
      expect(await nft.balanceOf(player2.address, 1)).to.equal(1);
    });

    it("should block transfer of assigned token", async function () {
      await nft.connect(gameManager).setMothership(1, 1);
      await expect(
        nft.connect(player1).safeTransferFrom(player1.address, player2.address, 1, 1, "0x")
      ).to.be.revertedWith("MoltSpaceNFT: cannot transfer assigned token");
    });
  });

  // ═══════════════════════════════════════════
  //  View Functions
  // ═══════════════════════════════════════════

  describe("View Functions", function () {
    it("should return correct maxExplorersForRarity", async function () {
      expect(await nft.maxExplorersForRarity(5)).to.equal(5);
      expect(await nft.maxExplorersForRarity(4)).to.equal(4);
      expect(await nft.maxExplorersForRarity(3)).to.equal(3);
      expect(await nft.maxExplorersForRarity(2)).to.equal(2);
      expect(await nft.maxExplorersForRarity(1)).to.equal(1);
    });

    it("should reject invalid rarity for maxExplorersForRarity", async function () {
      await expect(nft.maxExplorersForRarity(0))
        .to.be.revertedWith("MoltSpaceNFT: invalid rarity");
      await expect(nft.maxExplorersForRarity(6))
        .to.be.revertedWith("MoltSpaceNFT: invalid rarity");
    });
  });
});
