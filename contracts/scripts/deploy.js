const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║   MoltSpace — Deploy to Monad Testnet (v2)    ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  console.log("Deployer:", deployer.address);
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(deployerBalance), "MON\n");

  // ═══════════════════════════════════════════
  // Phase 1: Deploy MoltSpaceNFT (ERC-1155)
  // ═══════════════════════════════════════════
  console.log("[1/4] Deploying MoltSpaceNFT...");
  const MoltSpaceNFT = await hre.ethers.getContractFactory("MoltSpaceNFT");
  const nft = await MoltSpaceNFT.deploy("https://api.monadai.space/metadata/{id}.json");
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("  ✓ MoltSpaceNFT:", nftAddress);

  // Verify mint costs
  const scoutCost = await nft.SCOUT_SHIP_COST();
  const explorerCost = await nft.EXPLORER_COST();
  console.log("  → Scout Ship cost:", hre.ethers.formatEther(scoutCost), "MON");
  console.log("  → Explorer cost:", hre.ethers.formatEther(explorerCost), "MON");

  // ═══════════════════════════════════════════
  // Phase 2: Deploy MothershipManager
  // ═══════════════════════════════════════════
  console.log("\n[2/4] Deploying MothershipManager...");
  const MothershipManager = await hre.ethers.getContractFactory("MothershipManager");
  const mothershipMgr = await MothershipManager.deploy(nftAddress);
  await mothershipMgr.waitForDeployment();
  const mothershipAddress = await mothershipMgr.getAddress();
  console.log("  ✓ MothershipManager:", mothershipAddress);

  // ═══════════════════════════════════════════
  // Phase 3: Deploy ExpeditionManager
  // ═══════════════════════════════════════════
  console.log("\n[3/4] Deploying ExpeditionManager...");
  const ExpeditionManager = await hre.ethers.getContractFactory("ExpeditionManager");
  const expeditionMgr = await ExpeditionManager.deploy(mothershipAddress);
  await expeditionMgr.waitForDeployment();
  const expeditionAddress = await expeditionMgr.getAddress();
  console.log("  ✓ ExpeditionManager:", expeditionAddress);

  // ═══════════════════════════════════════════
  // Phase 4: Deploy GameManager
  // ═══════════════════════════════════════════
  console.log("\n[4/4] Deploying GameManager...");
  const treasury = deployer.address; // Use deployer as treasury for now
  const GameManager = await hre.ethers.getContractFactory("GameManager");
  const gameMgr = await GameManager.deploy(nftAddress, mothershipAddress, expeditionAddress, treasury);
  await gameMgr.waitForDeployment();
  const gameManagerAddress = await gameMgr.getAddress();
  console.log("  ✓ GameManager:", gameManagerAddress);

  // Verify GameManager mint costs & batch size
  const gmScoutCost = await gameMgr.SCOUT_SHIP_COST();
  const gmExplorerCost = await gameMgr.EXPLORER_COST();
  const gmMaxBatch = await gameMgr.MAX_BATCH_SIZE();
  console.log("  → Scout Ship cost:", hre.ethers.formatEther(gmScoutCost), "MON");
  console.log("  → Explorer cost:", hre.ethers.formatEther(gmExplorerCost), "MON");
  console.log("  → Max batch size:", gmMaxBatch.toString());

  // ═══════════════════════════════════════════
  // Phase 5: Configure Permissions
  // ═══════════════════════════════════════════
  console.log("\n[Config] Setting up permissions...");

  let tx;
  tx = await nft.setAuthorized(gameManagerAddress, true);
  await tx.wait();
  console.log("  ✓ NFT → authorized GameManager");

  tx = await nft.setAuthorized(mothershipAddress, true);
  await tx.wait();
  console.log("  ✓ NFT → authorized MothershipManager");

  tx = await mothershipMgr.setGameManager(gameManagerAddress);
  await tx.wait();
  console.log("  ✓ MothershipManager → setGameManager");

  tx = await mothershipMgr.setExpeditionManager(expeditionAddress);
  await tx.wait();
  console.log("  ✓ MothershipManager → setExpeditionManager");

  tx = await expeditionMgr.setGameManager(gameManagerAddress);
  await tx.wait();
  console.log("  ✓ ExpeditionManager → setGameManager");

  // ═══════════════════════════════════════════
  // Phase 6: Fund Expedition Reward Pool
  // ═══════════════════════════════════════════
  const fundAmount = hre.ethers.parseEther("0.1"); // 0.1 MON for testing
  console.log("\n[Fund] Sending 0.1 MON to ExpeditionManager reward pool...");
  tx = await deployer.sendTransaction({ to: expeditionAddress, value: fundAmount });
  await tx.wait();
  const expBalance = await hre.ethers.provider.getBalance(expeditionAddress);
  console.log("  ✓ ExpeditionManager balance:", hre.ethers.formatEther(expBalance), "MON");

  // ═══════════════════════════════════════════
  // Summary & .env output
  // ═══════════════════════════════════════════
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║          Deployment Complete!                  ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║  MoltSpaceNFT:       ", nftAddress, " ║");
  console.log("║  MothershipManager:  ", mothershipAddress, " ║");
  console.log("║  ExpeditionManager:  ", expeditionAddress, " ║");
  console.log("║  GameManager:        ", gameManagerAddress, " ║");
  console.log("║  Treasury:           ", treasury, " ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║  Scout Ship cost:    20 MON                    ║");
  console.log("║  Explorer cost:      10 MON                   ║");
  console.log("║  Burn refund:        30%                       ║");
  console.log("║  Max batch size:     20                        ║");
  console.log("║  Mint type:          Direct (no commit-reveal) ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║  Gas used:          ", hre.ethers.formatEther(deployerBalance - finalBalance), "MON");
  console.log("║  Deployer balance:  ", hre.ethers.formatEther(finalBalance), "MON");
  console.log("╚═══════════════════════════════════════════════╝");

  // Output .env.local content for frontend
  const envContent = `# MoltSpace Frontend - Environment Variables
# Auto-generated by deploy script on ${new Date().toISOString()}
# Network: Monad Testnet (chainId: 10143)
# Mint: Direct (no commit-reveal), batch 1/5/10/20
# Costs: Scout Ship = 20 MON, Explorer = 10 MON

NEXT_PUBLIC_GAME_MANAGER=${gameManagerAddress}
NEXT_PUBLIC_MOTHERSHIP_MANAGER=${mothershipAddress}
NEXT_PUBLIC_NFT=${nftAddress}
NEXT_PUBLIC_EXPEDITION_MANAGER=${expeditionAddress}
`;

  console.log("\n── Copy this to frontend/.env.local ──");
  console.log(envContent);

  // Auto-write to frontend/.env.local
  const envPath = path.join(__dirname, "../../frontend/.env.local");
  fs.writeFileSync(envPath, envContent);
  console.log("✓ Auto-saved to", envPath);

  return { nftAddress, mothershipAddress, expeditionAddress, gameManagerAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment FAILED:", error);
    process.exit(1);
  });
