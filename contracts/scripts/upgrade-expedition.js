const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════
// Existing contracts (DO NOT redeploy)
// ═══════════════════════════════════════════
const NFT = "0xb861D6955A4664f9303F65341A5ddD589f10b229";
const MOTHERSHIP = "0x94F304c3aed04bf698687C9bA35a6e5d92Bbc4CD";

// Old contracts (to revoke permissions)
const OLD_EXPEDITION = "0x1766E24Fb6dbB0495a33748C1D8762c0C11e4db2";
const OLD_GAME = "0x05b175FacFd42cbE63C485afE02F189b4732c92b";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║   MoltSpace — Upgrade ExpeditionManager       ║");
  console.log("║   Redeploy: ExpeditionManager + GameManager   ║");
  console.log("║   Keep: MoltSpaceNFT + MothershipManager      ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "MON\n");

  // ═══════════════════════════════════════════
  // Step 1: Deploy new ExpeditionManager (with withdraw)
  // ═══════════════════════════════════════════
  console.log("[1/2] Deploying NEW ExpeditionManager...");
  const ExpeditionManager = await hre.ethers.getContractFactory("ExpeditionManager");
  const expeditionMgr = await ExpeditionManager.deploy(MOTHERSHIP);
  await expeditionMgr.waitForDeployment();
  const newExpedition = await expeditionMgr.getAddress();
  console.log("  ✓ NEW ExpeditionManager:", newExpedition);

  // ═══════════════════════════════════════════
  // Step 2: Deploy new GameManager (references new ExpeditionManager)
  // ═══════════════════════════════════════════
  console.log("\n[2/2] Deploying NEW GameManager...");
  const treasury = deployer.address;
  const GameManager = await hre.ethers.getContractFactory("GameManager");
  const gameMgr = await GameManager.deploy(NFT, MOTHERSHIP, newExpedition, treasury);
  await gameMgr.waitForDeployment();
  const newGame = await gameMgr.getAddress();
  console.log("  ✓ NEW GameManager:", newGame);

  // ═══════════════════════════════════════════
  // Step 3: Update permissions on existing contracts
  // ═══════════════════════════════════════════
  console.log("\n[Config] Updating permissions...");

  // Connect to existing contracts
  const nft = await hre.ethers.getContractAt("MoltSpaceNFT", NFT);
  const mothershipMgr = await hre.ethers.getContractAt("MothershipManager", MOTHERSHIP);

  let tx;

  // Revoke old GameManager from NFT
  tx = await nft.setAuthorized(OLD_GAME, false);
  await tx.wait();
  console.log("  ✓ NFT → revoked old GameManager");

  // Authorize new GameManager on NFT
  tx = await nft.setAuthorized(newGame, true);
  await tx.wait();
  console.log("  ✓ NFT → authorized NEW GameManager");

  // Update MothershipManager → new GameManager
  tx = await mothershipMgr.setGameManager(newGame);
  await tx.wait();
  console.log("  ✓ MothershipManager → setGameManager (new)");

  // Update MothershipManager → new ExpeditionManager
  tx = await mothershipMgr.setExpeditionManager(newExpedition);
  await tx.wait();
  console.log("  ✓ MothershipManager → setExpeditionManager (new)");

  // Set GameManager on new ExpeditionManager
  tx = await expeditionMgr.setGameManager(newGame);
  await tx.wait();
  console.log("  ✓ NEW ExpeditionManager → setGameManager");

  // ═══════════════════════════════════════════
  // Step 4: Fund new ExpeditionManager reward pool
  // ═══════════════════════════════════════════
  const fundAmount = hre.ethers.parseEther("1");
  console.log("\n[Fund] Sending 1 MON to NEW ExpeditionManager...");
  tx = await deployer.sendTransaction({ to: newExpedition, value: fundAmount });
  await tx.wait();
  const expBalance = await hre.ethers.provider.getBalance(newExpedition);
  console.log("  ✓ NEW ExpeditionManager balance:", hre.ethers.formatEther(expBalance), "MON");

  // Check old ExpeditionManager balance (stuck — old contract has no withdraw)
  const oldExpBalance = await hre.ethers.provider.getBalance(OLD_EXPEDITION);
  console.log("  ⚠ OLD ExpeditionManager balance:", hre.ethers.formatEther(oldExpBalance), "MON (not recoverable)");

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║       Upgrade Complete!                        ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║  MoltSpaceNFT:       ", NFT, " (unchanged)");
  console.log("║  MothershipManager:  ", MOTHERSHIP, " (unchanged)");
  console.log("║  ExpeditionManager:  ", newExpedition, " (NEW)");
  console.log("║  GameManager:        ", newGame, " (NEW)");
  console.log("║  Treasury:           ", treasury);
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║  Gas used:          ", hre.ethers.formatEther(balance - finalBalance), "MON");
  console.log("║  Deployer balance:  ", hre.ethers.formatEther(finalBalance), "MON");
  console.log("╚═══════════════════════════════════════════════╝");

  // Auto-write frontend/.env.local
  const envContent = `# MoltSpace Frontend - Environment Variables
# Auto-generated by upgrade-expedition script on ${new Date().toISOString()}
# Network: Monad Mainnet (chainId: 143)
# Upgrade: ExpeditionManager + GameManager redeployed with withdraw()

NEXT_PUBLIC_GAME_MANAGER=${newGame}
NEXT_PUBLIC_MOTHERSHIP_MANAGER=${MOTHERSHIP}
NEXT_PUBLIC_NFT=${NFT}
NEXT_PUBLIC_EXPEDITION_MANAGER=${newExpedition}
NEXT_PUBLIC_RPC_URL=https://rpc.monad.xyz
`;

  const envPath = path.join(__dirname, "../../frontend/.env.local");
  fs.writeFileSync(envPath, envContent);
  console.log("\n✓ Auto-saved frontend/.env.local");

  // Print new addresses for verify script
  console.log("\n═══ Update verify-mainnet.js with: ═══");
  console.log(`const EXPEDITION = "${newExpedition}";`);
  console.log(`const GAME = "${newGame}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Upgrade FAILED:", error);
    process.exit(1);
  });
