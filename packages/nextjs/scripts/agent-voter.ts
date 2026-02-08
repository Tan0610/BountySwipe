import { createWalletClient, http, parseEther, createPublicClient, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Monad Testnet chain definition
const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});

// Configuration from environment
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const CONTRACT_ADDRESS = process.env.BOUNTY_CONTRACT_ADDRESS as `0x${string}`;
const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || "http://localhost:3000/api/premium/analyze-content";

if (!AGENT_PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error("Missing AGENT_PRIVATE_KEY or BOUNTY_CONTRACT_ADDRESS");
  process.exit(1);
}

const account = privateKeyToAccount(AGENT_PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// Minimal ABI for the functions we need
const BOUNTY_ABI = [
  {
    name: "getActiveBounties",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "getBountyCreators",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getCreatorEntry",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "creator", type: "address" },
    ],
    outputs: [
      { name: "creator", type: "address" },
      { name: "contentURI", type: "string" },
      { name: "upvotes", type: "uint256" },
      { name: "downvotes", type: "uint256" },
      { name: "companyScore", type: "uint256" },
      { name: "totalScore", type: "uint256" },
      { name: "rewardClaimed", type: "bool" },
    ],
  },
  {
    name: "getVoteInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "votedFor", type: "address" },
      { name: "isUpvote", type: "bool" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    name: "vote",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "creator", type: "address" },
      { name: "isUpvote", type: "bool" },
    ],
    outputs: [],
  },
] as const;

async function analyzeContent(contentURI: string, bountyId: string): Promise<{ score: number; recommendation: string; reason: string }> {
  try {
    // For hackathon demo: call the API directly (without x402 payment wrapper for simplicity)
    // In production, use wrapFetchWithPayment from @x402/fetch
    const response = await fetch(ANALYSIS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentURI, bountyId }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return data.analysis;
  } catch (error) {
    console.error(`Analysis failed for ${contentURI}:`, error);
    return { score: 0, recommendation: "downvote", reason: "Analysis failed" };
  }
}

async function runAgentVoter() {
  console.log("=== BountySwipe Agent Voter ===");
  console.log(`Wallet: ${account.address}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Analysis API: ${ANALYSIS_API_URL}`);
  console.log("");

  // Step 1: Get active bounties
  const activeBounties = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_ABI,
    functionName: "getActiveBounties",
  });

  console.log(`Found ${activeBounties.length} active bounties`);

  for (const bountyId of activeBounties) {
    console.log(`\n--- Processing Bounty ${bountyId} ---`);

    // Check if already voted
    const existingVote = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BOUNTY_ABI,
      functionName: "getVoteInfo",
      args: [bountyId, account.address],
    });

    if (existingVote[3]) {
      console.log(`Already voted on bounty ${bountyId}, skipping`);
      continue;
    }

    // Step 2: Get creators
    const creators = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BOUNTY_ABI,
      functionName: "getBountyCreators",
      args: [bountyId],
    });

    if (creators.length === 0) {
      console.log("No creators in this bounty, skipping");
      continue;
    }

    console.log(`Found ${creators.length} creators`);

    let bestCreator = { address: "0x" as `0x${string}`, score: 0, shouldUpvote: false };

    for (const creatorAddr of creators) {
      // Skip self
      if (creatorAddr.toLowerCase() === account.address.toLowerCase()) continue;

      // Step 3: Get content URI
      const entry = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: BOUNTY_ABI,
        functionName: "getCreatorEntry",
        args: [bountyId, creatorAddr],
      });

      const contentURI = entry[1]; // contentURI field

      // Step 4: Analyze with Claude
      console.log(`Analyzing ${creatorAddr.slice(0, 8)}... content: ${contentURI}`);
      const analysis = await analyzeContent(contentURI, bountyId.toString());
      console.log(`  Score: ${analysis.score} | Recommendation: ${analysis.recommendation} | ${analysis.reason}`);

      if (analysis.score > bestCreator.score) {
        bestCreator = {
          address: creatorAddr as `0x${string}`,
          score: analysis.score,
          shouldUpvote: analysis.recommendation === "upvote",
        };
      }
    }

    // Step 5: Vote for best creator
    if (bestCreator.address && bestCreator.shouldUpvote) {
      console.log(`\nVoting for ${bestCreator.address.slice(0, 8)}... (score: ${bestCreator.score})`);

      try {
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: BOUNTY_ABI,
          functionName: "vote",
          args: [bountyId, bestCreator.address, true],
          value: parseEther("0.01"),
        });

        console.log(`Vote TX: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Vote confirmed! Block: ${receipt.blockNumber}`);
      } catch (error) {
        console.error("Vote transaction failed:", error);
      }
    } else {
      console.log("No suitable creator to vote for");
    }
  }

  console.log("\n=== Agent Voter Complete ===");
}

// Run
runAgentVoter().catch(console.error);
