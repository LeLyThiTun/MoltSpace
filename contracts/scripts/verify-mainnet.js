const hre = require("hardhat");

// Derive deployer address from private key for treasury arg
const deployerWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
const DEPLOYER_ADDRESS = deployerWallet.address;

// Mainnet contract addresses (from deploy)
const NFT = "0xb861D6955A4664f9303F65341A5ddD589f10b229";
const MOTHERSHIP = "0x94F304c3aed04bf698687C9bA35a6e5d92Bbc4CD";
const EXPEDITION = "0x0BA11A99F2dE0aC7ecFAd6A0Dc812b6256E39ADb";
const GAME = "0x7F5DbF2F20d00f36150d5CC94be0032B9E259c46";

const CONTRACTS = {
  MoltSpaceNFT: {
    address: NFT,
    fqn: "contracts/MoltSpaceNFT.sol:MoltSpaceNFT",
    constructorArgs: ["https://api.monadai.space/metadata/{id}.json"],
    constructorTypes: ["string"],
  },
  MothershipManager: {
    address: MOTHERSHIP,
    fqn: "contracts/MothershipManager.sol:MothershipManager",
    constructorArgs: [NFT],
    constructorTypes: ["address"],
  },
  ExpeditionManager: {
    address: EXPEDITION,
    fqn: "contracts/ExpeditionManager.sol:ExpeditionManager",
    constructorArgs: [MOTHERSHIP],
    constructorTypes: ["address"],
  },
  GameManager: {
    address: GAME,
    fqn: "contracts/GameManager.sol:GameManager",
    constructorArgs: [NFT, MOTHERSHIP, EXPEDITION, DEPLOYER_ADDRESS],
    constructorTypes: ["address", "address", "address", "address"],
  },
};

async function verifyContract(name, info) {
  console.log(`\n[${name}] Verifying ${info.address}...`);

  // Get build info from Hardhat artifacts
  const buildInfo = await hre.artifacts.getBuildInfo(info.fqn);
  if (!buildInfo) {
    console.error(`  ✗ Build info not found for ${info.fqn}`);
    return false;
  }

  // ABI-encode constructor arguments (without 0x prefix)
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  const encodedArgs = abiCoder
    .encode(info.constructorTypes, info.constructorArgs)
    .slice(2); // remove 0x prefix

  // Prepare verification payload
  const payload = {
    chainId: 143,
    contractAddress: info.address,
    contractName: info.fqn,
    compilerVersion: `v${buildInfo.solcLongVersion}`,
    standardJsonInput: buildInfo.input,
    constructorArgs: encodedArgs,
  };

  console.log(`  Compiler: v${buildInfo.solcLongVersion}`);
  console.log(`  Constructor args: ${encodedArgs.slice(0, 40)}...`);

  // Send to agents.devnads.com
  try {
    const response = await fetch("https://agents.devnads.com/v1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    if (response.ok) {
      console.log(`  ✓ ${name} verified!`);
      console.log(`  Response: ${result.slice(0, 200)}`);
      return true;
    } else {
      console.error(`  ✗ Verification failed (${response.status}): ${result.slice(0, 300)}`);
      return false;
    }
  } catch (err) {
    console.error(`  ✗ Request failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  MoltSpace — Verify on Monad Mainnet          ║");
  console.log("║  API: agents.devnads.com/v1/verify            ║");
  console.log("╚═══════════════════════════════════════════════╝");

  const results = {};
  for (const [name, info] of Object.entries(CONTRACTS)) {
    results[name] = await verifyContract(name, info);
  }

  console.log("\n═══ Verification Summary ═══");
  for (const [name, ok] of Object.entries(results)) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}: ${CONTRACTS[name].address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification FAILED:", error);
    process.exit(1);
  });
