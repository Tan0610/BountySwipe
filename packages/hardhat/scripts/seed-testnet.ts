import { ethers } from "hardhat";

/**
 * Seed script for BountyPlatform on Monad Testnet
 *
 * Creates a promotional video bounty and has 5 temporary wallets join it.
 * Uses the deployer wallet from hardhat config to fund temp wallets and create the bounty.
 *
 * Run:  npx hardhat run scripts/seed-testnet.ts --network monadTestnet
 */

const CONTRACT_ADDRESS = "0x52D036553ca07ad49B7a1B2B1934809609b46240";
const BOUNTY_REWARD = ethers.parseEther("0.5");
const GAS_FUNDING = ethers.parseEther("0.05");
const DEADLINE_OFFSET = 86400; // 24 hours in seconds

const MOCK_CREATORS = [
  {
    label: "Creator 1 — Monad Speed Demo",
    contentURI: "/videos/promo-1.mp4",
  },
  {
    label: "Creator 2 — Parallel EVM Explainer",
    contentURI: "/videos/promo-2.mp4",
  },
  {
    label: "Creator 3 — Monad vs Solana Comparison",
    contentURI: "/videos/promo-3.mp4",
  },
  {
    label: "Creator 4 — Monad DeFi Showcase",
    contentURI: "/videos/promo-4.mp4",
  },
  {
    label: "Creator 5 — Monad Ecosystem Tour",
    contentURI: "/videos/promo-5.mp4",
  },
];

async function main() {
  console.log("=".repeat(60));
  console.log("  BountyPlatform — Monad Testnet Seed Script");
  console.log("=".repeat(60));

  // ── Connect deployer ──────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer: ${deployer.address}`);

  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} MON`);

  const totalNeeded = BOUNTY_REWARD + GAS_FUNDING * BigInt(MOCK_CREATORS.length);
  if (deployerBalance < totalNeeded) {
    throw new Error(
      `Insufficient balance. Need at least ${ethers.formatEther(totalNeeded)} MON ` +
        `(${ethers.formatEther(BOUNTY_REWARD)} reward + ${ethers.formatEther(GAS_FUNDING * BigInt(MOCK_CREATORS.length))} gas funding). ` +
        `Current balance: ${ethers.formatEther(deployerBalance)} MON`,
    );
  }

  // ── Attach to deployed contract ───────────────────────────────────────
  const contract = await ethers.getContractAt("BountyPlatform", CONTRACT_ADDRESS);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);

  const currentBountyCount = await contract.bountyCount();
  console.log(`Existing bounties on-chain: ${currentBountyCount}`);

  // ── Step 1: Create the bounty ─────────────────────────────────────────
  console.log("\n--- Step 1: Creating bounty ---");

  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) throw new Error("Could not fetch latest block");

  const deadline = latestBlock.timestamp + DEADLINE_OFFSET;
  console.log(`  Block timestamp : ${latestBlock.timestamp}`);
  console.log(`  Deadline        : ${deadline} (+24h)`);

  const createTx = await contract.connect(deployer).createBounty(
    "Best Monad Promotion Video",
    "Create a short promotional video showcasing Monad's speed and parallel execution. Most creative video wins!",
    deadline,
    { value: BOUNTY_REWARD },
  );
  console.log(`  Tx sent: ${createTx.hash}`);
  const createReceipt = await createTx.wait();
  console.log(`  Tx mined in block ${createReceipt?.blockNumber}`);

  const bountyId = currentBountyCount; // bountyCount was N before, so new ID = N
  console.log(`  Bounty ID: ${bountyId}`);

  // ── Step 2: Generate temporary wallets ────────────────────────────────
  console.log("\n--- Step 2: Generating temporary wallets ---");

  const tempWallets = MOCK_CREATORS.map((c, i) => {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    console.log(`  Wallet ${i + 1}: ${wallet.address}`);
    return wallet;
  });

  // ── Step 3: Fund temporary wallets ────────────────────────────────────
  console.log("\n--- Step 3: Funding temporary wallets with gas ---");

  for (let i = 0; i < tempWallets.length; i++) {
    const fundTx = await deployer.sendTransaction({
      to: tempWallets[i].address,
      value: GAS_FUNDING,
    });
    console.log(`  Funding wallet ${i + 1} (${ethers.formatEther(GAS_FUNDING)} MON) — tx: ${fundTx.hash}`);
    await fundTx.wait();
    console.log(`    Confirmed.`);
  }

  // ── Step 4: Each temp wallet joins the bounty ─────────────────────────
  console.log("\n--- Step 4: Creators joining the bounty ---");

  const creatorAddresses: string[] = [];

  for (let i = 0; i < tempWallets.length; i++) {
    const wallet = tempWallets[i];
    const creator = MOCK_CREATORS[i];

    console.log(`\n  ${creator.label}`);
    console.log(`    Address    : ${wallet.address}`);
    console.log(`    Content URI: ${creator.contentURI}`);

    try {
      const contractAsCreator = contract.connect(wallet);
      const joinTx = await contractAsCreator.joinBounty(bountyId, creator.contentURI);
      console.log(`    Tx sent: ${joinTx.hash}`);
      const joinReceipt = await joinTx.wait();
      console.log(`    Tx mined in block ${joinReceipt?.blockNumber}`);
      creatorAddresses.push(wallet.address);
    } catch (err: any) {
      console.error(`    ERROR joining bounty: ${err.message?.slice(0, 120)}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  SEED COMPLETE");
  console.log("=".repeat(60));

  console.log(`\n  Bounty ID    : ${bountyId}`);
  console.log(`  Title        : Best Monad Promotion Video`);
  console.log(`  Reward       : ${ethers.formatEther(BOUNTY_REWARD)} MON`);
  console.log(`  Deadline     : ${new Date(deadline * 1000).toISOString()}`);
  console.log(`  Contract     : ${CONTRACT_ADDRESS}`);
  console.log(`  Deployer     : ${deployer.address}`);

  console.log(`\n  Creators (${creatorAddresses.length}):`);
  creatorAddresses.forEach((addr, i) => {
    console.log(`    ${i + 1}. ${addr}`);
  });

  console.log(`\n  Temporary Wallet Private Keys (save these if needed):`);
  tempWallets.forEach((w, i) => {
    console.log(`    Wallet ${i + 1}: ${w.privateKey}`);
  });

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed script failed:", error);
    process.exit(1);
  });
