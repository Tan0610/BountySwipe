import { ethers } from "hardhat";
import { Contract } from "ethers";

/**
 * Seed script for BountyPlatform — populates the contract with mock data
 * covering all UI flow states:
 *
 *   Bounty 0 — Active, open for voting (24 h deadline)
 *   Bounty 1 — Past deadline, awaiting company judgment
 *   Bounty 2 — Judged, ready to finalize
 *   Bounty 3 — Fully finalized (rewards claimable)
 *
 * FIX: All bounties are created with a 300-second deadline so that joining
 * and voting transactions have plenty of time to land. After all interactions
 * are complete, `evm_increaseTime` fast-forwards past the deadline for
 * bounties that need post-deadline operations (judging, finalizing).
 *
 * Run:  npx hardhat run scripts/seed.ts --network localhost
 */

const DEADLINE_BUFFER = 300; // 5 minutes — plenty of room for txs

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length < 6) {
    throw new Error("Need at least 6 signers — start a local node with enough accounts");
  }

  const [company, creator1, creator2, creator3, voter1, voter2] = signers;

  // --- Get deployed contract (hardhat-deploy) ---
  const bountyPlatform = (await ethers.getContract("BountyPlatform")) as Contract;
  const address = await bountyPlatform.getAddress();
  console.log(`\nBountyPlatform at ${address}`);
  console.log(`Company  (accounts[0]): ${company.address}`);
  console.log(`Creator1 (accounts[1]): ${creator1.address}`);
  console.log(`Creator2 (accounts[2]): ${creator2.address}`);
  console.log(`Creator3 (accounts[3]): ${creator3.address}`);
  console.log(`Voter1   (accounts[4]): ${voter1.address}`);
  console.log(`Voter2   (accounts[5]): ${voter2.address}`);

  const MIN_STAKE = ethers.parseEther("0.01");

  // =====================================================================
  //  Helpers
  // =====================================================================

  /** Get current block timestamp */
  async function currentTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  /** Fast-forward the local node clock by `seconds` */
  async function fastForward(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  // =====================================================================
  //  BOUNTY 0 — "Best Monad Meme" (Active, open for voting)
  //  This bounty stays active — NO time fast-forward.
  // =====================================================================
  console.log("\n--- Bounty 0: Best Monad Meme (Active) ---");
  {
    const now = await currentTimestamp();
    const deadline = now + 24 * 60 * 60; // 24 hours — stays active

    const tx = await bountyPlatform.connect(company).createBounty(
      "Best Monad Meme",
      "Create the funniest, most viral Monad meme. Must be original content. Bonus points for community engagement potential.",
      deadline,
      { value: ethers.parseEther("1") },
    );
    await tx.wait();
    console.log("  Created (reward: 1 MON, deadline: +24h)");

    // Creators join
    const join1 = await bountyPlatform
      .connect(creator1)
      .joinBounty(0, "ipfs://QmMeme1_pepe_monad_rocket_to_the_moon");
    await join1.wait();
    console.log("  Creator1 joined — pepe monad rocket meme");

    const join2 = await bountyPlatform
      .connect(creator2)
      .joinBounty(0, "ipfs://QmMeme2_monad_speed_demon_go_fast");
    await join2.wait();
    console.log("  Creator2 joined — monad speed demon meme");

    const join3 = await bountyPlatform
      .connect(creator3)
      .joinBounty(0, "ipfs://QmMeme3_giga_chad_validator_node");
    await join3.wait();
    console.log("  Creator3 joined — giga chad validator meme");

    // Votes
    const v1 = await bountyPlatform.connect(voter1).vote(0, creator1.address, true, { value: MIN_STAKE });
    await v1.wait();
    console.log("  Voter1 upvoted Creator1 (0.01 MON stake)");

    const v2 = await bountyPlatform.connect(voter2).vote(0, creator2.address, true, { value: MIN_STAKE });
    await v2.wait();
    console.log("  Voter2 upvoted Creator2 (0.01 MON stake)");

    // Bounty 0 stays active — no fast-forward
    console.log("  [Bounty 0 remains active]");
  }

  // =====================================================================
  //  BOUNTY 1 — "DeFi Dashboard UI Design" (Past deadline, awaiting judgment)
  //  Created with 300s buffer, then fast-forwarded AFTER joining/voting.
  // =====================================================================
  console.log("\n--- Bounty 1: DeFi Dashboard UI Design (Expired, awaiting judgment) ---");
  {
    const now = await currentTimestamp();
    const deadline = now + DEADLINE_BUFFER;

    const tx = await bountyPlatform.connect(company).createBounty(
      "DeFi Dashboard UI Design",
      "Design a clean, modern DeFi dashboard for Monad. Must include portfolio view, swap interface, and liquidity pool management.",
      deadline,
      { value: ethers.parseEther("2") },
    );
    await tx.wait();
    console.log(`  Created (reward: 2 MON, deadline: +${DEADLINE_BUFFER}s)`);

    const join1 = await bountyPlatform
      .connect(creator1)
      .joinBounty(1, "ipfs://QmDeFiUI_dark_mode_glassmorphism_dashboard");
    await join1.wait();
    console.log("  Creator1 joined — dark glassmorphism dashboard");

    const join2 = await bountyPlatform
      .connect(creator2)
      .joinBounty(1, "ipfs://QmDeFiUI_minimal_clean_portfolio_tracker");
    await join2.wait();
    console.log("  Creator2 joined — minimal clean portfolio tracker");

    // Votes (while deadline is still active)
    const v1 = await bountyPlatform.connect(voter1).vote(1, creator1.address, true, { value: MIN_STAKE });
    await v1.wait();
    console.log("  Voter1 upvoted Creator1");

    const v2 = await bountyPlatform.connect(voter2).vote(1, creator2.address, true, { value: ethers.parseEther("0.02") });
    await v2.wait();
    console.log("  Voter2 upvoted Creator2 (0.02 MON stake)");

    // NOW fast-forward past the deadline
    await fastForward(DEADLINE_BUFFER + 10);
    console.log("  Time fast-forwarded — deadline passed");
    // Bounty 1 is now expired, waiting for company to judge
  }

  // =====================================================================
  //  BOUNTY 2 — "Monad Developer Tutorial" (Judged, ready to finalize)
  //  Created with 300s buffer, fast-forwarded, then company judges.
  // =====================================================================
  console.log("\n--- Bounty 2: Monad Developer Tutorial (Judged, ready to finalize) ---");
  {
    const now = await currentTimestamp();
    const deadline = now + DEADLINE_BUFFER;

    const tx = await bountyPlatform.connect(company).createBounty(
      "Monad Developer Tutorial",
      "Write a beginner-friendly tutorial for building on Monad. Cover smart contract deployment, front-end integration, and testing.",
      deadline,
      { value: ethers.parseEther("0.5") },
    );
    await tx.wait();
    console.log(`  Created (reward: 0.5 MON, deadline: +${DEADLINE_BUFFER}s)`);

    const join1 = await bountyPlatform
      .connect(creator1)
      .joinBounty(2, "ipfs://QmTutorial_full_stack_dapp_monad_nextjs");
    await join1.wait();
    console.log("  Creator1 joined — full-stack dApp tutorial");

    const join2 = await bountyPlatform
      .connect(creator2)
      .joinBounty(2, "ipfs://QmTutorial_smart_contract_101_solidity_monad");
    await join2.wait();
    console.log("  Creator2 joined — smart contract 101 tutorial");

    // Votes (while deadline is still active)
    const v1 = await bountyPlatform.connect(voter1).vote(2, creator1.address, true, { value: MIN_STAKE });
    await v1.wait();
    console.log("  Voter1 upvoted Creator1");

    const v2 = await bountyPlatform.connect(voter2).vote(2, creator1.address, false, { value: MIN_STAKE });
    await v2.wait();
    console.log("  Voter2 downvoted Creator1");

    // Fast-forward past the deadline BEFORE judging
    await fastForward(DEADLINE_BUFFER + 10);
    console.log("  Time fast-forwarded — deadline passed");

    // Company judges (post-deadline operation)
    const judge = await bountyPlatform
      .connect(company)
      .companyJudge(2, [creator1.address, creator2.address], [80, 60]);
    await judge.wait();
    console.log("  Company judged — Creator1: 80, Creator2: 60");
    // Bounty 2 is now judged, ready to finalize
  }

  // =====================================================================
  //  BOUNTY 3 — "NFT Collection Art" (Fully finalized)
  //  Created with 300s buffer, fast-forwarded, judged, finalized, claimed.
  // =====================================================================
  console.log("\n--- Bounty 3: NFT Collection Art (Finalized) ---");
  {
    const now = await currentTimestamp();
    const deadline = now + DEADLINE_BUFFER;

    const tx = await bountyPlatform.connect(company).createBounty(
      "NFT Collection Art",
      "Design a 10-piece generative NFT collection inspired by Monad's speed and parallel execution. Include traits system and rarity tiers.",
      deadline,
      { value: ethers.parseEther("1.5") },
    );
    await tx.wait();
    console.log(`  Created (reward: 1.5 MON, deadline: +${DEADLINE_BUFFER}s)`);

    const join1 = await bountyPlatform
      .connect(creator1)
      .joinBounty(3, "ipfs://QmNFT_cyberpunk_monad_warriors_collection");
    await join1.wait();
    console.log("  Creator1 joined — cyberpunk monad warriors");

    const join2 = await bountyPlatform
      .connect(creator2)
      .joinBounty(3, "ipfs://QmNFT_abstract_parallel_execution_art");
    await join2.wait();
    console.log("  Creator2 joined — abstract parallel execution art");

    // Votes (while deadline is still active — voter1 backs creator1 who will win)
    const v1 = await bountyPlatform.connect(voter1).vote(3, creator1.address, true, { value: ethers.parseEther("0.05") });
    await v1.wait();
    console.log("  Voter1 upvoted Creator1 (0.05 MON stake)");

    const v2 = await bountyPlatform.connect(voter2).vote(3, creator2.address, true, { value: MIN_STAKE });
    await v2.wait();
    console.log("  Voter2 upvoted Creator2 (0.01 MON stake)");

    // Fast-forward past the deadline BEFORE judging/finalizing
    await fastForward(DEADLINE_BUFFER + 10);
    console.log("  Time fast-forwarded — deadline passed");

    // Company judges — creator1 wins (post-deadline operation)
    const judge = await bountyPlatform
      .connect(company)
      .companyJudge(3, [creator1.address, creator2.address], [90, 70]);
    await judge.wait();
    console.log("  Company judged — Creator1: 90, Creator2: 70");

    // Finalize (post-deadline operation)
    const fin = await bountyPlatform.connect(company).finalizeBounty(3);
    await fin.wait();
    console.log("  Bounty finalized!");

    // Winner claims reward
    try {
      const claim = await bountyPlatform.connect(creator1).claimCreatorReward(3);
      await claim.wait();
      console.log("  Creator1 (winner) claimed creator reward");
    } catch (e: any) {
      console.log("  Creator reward claim skipped:", e.message?.slice(0, 80));
    }

    // Winning voter claims
    try {
      const vClaim = await bountyPlatform.connect(voter1).claimVoterReward(3);
      await vClaim.wait();
      console.log("  Voter1 (backed winner) claimed voter reward");
    } catch (e: any) {
      console.log("  Voter reward claim skipped:", e.message?.slice(0, 80));
    }
  }

  // =====================================================================
  //  Summary
  // =====================================================================
  console.log("\n========================================");
  console.log("  Seed complete! 4 bounties created:");
  console.log("  0 - Best Monad Meme         -> Active (open for voting)");
  console.log("  1 - DeFi Dashboard UI Design -> Expired (awaiting judgment)");
  console.log("  2 - Monad Developer Tutorial -> Judged (ready to finalize)");
  console.log("  3 - NFT Collection Art       -> Finalized (rewards claimed)");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
