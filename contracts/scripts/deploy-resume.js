const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Resume deployment — deploys only GameManager + configures permissions.
 * Use this after partial deployment when balance ran out.
 *
 * The 3 contracts below were already deployed successfully.
 * Only GameManager + permissions remain.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║   MoltSpace — Resume Deploy (GameManager)     ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  console.log("Deployer:", deployer.address);
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(deployerBalance), "MON\n");

  // Already deployed contracts
  const nftAddress = "0x495223b0a3112D33625A72f26b6B1182d77067FB";
  const mothershipAddress = "0xA281378B7528103dfDe314311d08A12A5a388713";
  const expeditionAddress = "0x076bE2fbc3AD30caEbE5e1Be978227F74a468603";

  console.log("[Already deployed]");
  console.log("  MoltSpaceNFT:", nftAddress);
  console.log("  MothershipManager:", mothershipAddress);
  console.log("  ExpeditionManager:", expeditionAddress);

  // ═══════════════════════════════════════════
  // Phase 4: Deploy GameManager
  // ═══════════════════════════════════════════
  console.log("\n[4/4] Deploying GameManager...");
  const treasury = deployer.address;
  const GameManager = await hre.ethers.getContractFactory("GameManager");
  const gameMgr = await GameManager.deploy(nftAddress, mothershipAddress, expeditionAddress, treasury);
  await gameMgr.waitForDeployment();
  const gameManagerAddress = await gameMgr.getAddress();
  console.log("  ✓ GameManager:", gameManagerAddress);

  // Verify costs
  const gmScoutCost = await gameMgr.SCOUT_SHIP_COST();
  const gmExplorerCost = await gameMgr.EXPLORER_COST();
  console.log("  → Scout Ship cost:", hre.ethers.formatEther(gmScoutCost), "MON");
  console.log("  → Explorer cost:", hre.ethers.formatEther(gmExplorerCost), "MON");

  // ═══════════════════════════════════════════
  // Phase 5: Configure Permissions
  // ═══════════════════════════════════════════
  console.log("\n[Config] Setting up permissions...");

  const nft = await hre.ethers.getContractAt("MoltSpaceNFT", nftAddress);
  const mothershipMgr = await hre.ethers.getContractAt("MothershipManager", mothershipAddress);
  const expeditionMgr = await hre.ethers.getContractAt("ExpeditionManager", expeditionAddress);

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

  tx = await expeditionMgr.setGameManager(gameManagerAddress);
  await tx.wait();
  console.log("  ✓ ExpeditionManager → setGameManager");

  // ═══════════════════════════════════════════
  // Phase 6: Fund Expedition Reward Pool (optional, small amount)
  // ═══════════════════════════════════════════
  const currentExpBalance = await hre.ethers.provider.getBalance(expeditionAddress);
  console.log("\n[Fund] ExpeditionManager balance:", hre.ethers.formatEther(currentExpBalance), "MON");

  const remainingBalance = await hre.ethers.provider.getBalance(deployer.address);
  // Fund with 0.05 MON if we have enough left (keep 0.1 MON for gas buffer)
  if (remainingBalance > hre.ethers.parseEther("0.15")) {
    const fundAmount = hre.ethers.parseEther("0.05");
    tx = await deployer.sendTransaction({ to: expeditionAddress, value: fundAmount });
    await tx.wait();
    const newExpBalance = await hre.ethers.provider.getBalance(expeditionAddress);
    console.log("  ✓ Funded. New balance:", hre.ethers.formatEther(newExpBalance), "MON");
  } else {
    console.log("  ⚠ Skipping fund (low balance). Fund manually later.");
  }

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║          Deployment Complete!                  ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("  MoltSpaceNFT:       ", nftAddress);
  console.log("  MothershipManager:  ", mothershipAddress);
  console.log("  ExpeditionManager:  ", expeditionAddress);
  console.log("  GameManager:        ", gameManagerAddress);
  console.log("  Treasury:           ", treasury);
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("  Scout Ship cost:    20 MON");
  console.log("  Explorer cost:      10 MON");
  console.log("  Burn refund:        30%");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("  Deployer balance:  ", hre.ethers.formatEther(finalBalance), "MON");
  console.log("╚═══════════════════════════════════════════════╝");

  // Output & auto-save .env.local
  const envContent = `# MoltSpace Frontend - Environment Variables
# Auto-generated by deploy script on ${new Date().toISOString()}
# Network: Monad Testnet (chainId: 10143)
# Mint costs: Scout Ship = 20 MON, Explorer = 10 MON

NEXT_PUBLIC_GAME_MANAGER=${gameManagerAddress}
NEXT_PUBLIC_MOTHERSHIP_MANAGER=${mothershipAddress}
NEXT_PUBLIC_NFT=${nftAddress}
NEXT_PUBLIC_EXPEDITION_MANAGER=${expeditionAddress}
`;

  console.log("\n── frontend/.env.local ──");
  console.log(envContent);

  const envPath = path.join(__dirname, "../../frontend/.env.local");
  fs.writeFileSync(envPath, envContent);
  console.log("✓ Auto-saved to", envPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment FAILED:", error);
    process.exit(1);
  });
