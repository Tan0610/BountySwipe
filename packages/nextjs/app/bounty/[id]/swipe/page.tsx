"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { SwipeDeck } from "~~/components/bountyswipe/SwipeDeck";

const SwipePage = () => {
  const params = useParams();
  const router = useRouter();
  const bountyId = BigInt(params.id as string);
  const { address } = useAccount();
  const [showStakeInfo, setShowStakeInfo] = useState(false);

  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getLeaderboard",
    args: [bountyId],
  });

  const { data: voteInfo, isLoading: isVoteInfoLoading } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getVoteInfo",
    args: [address, bountyId],
  });

  const { writeContractAsync: vote } = useScaffoldWriteContract("BountyPlatform");

  // getVoteInfo returns: [amount, votedFor, isUpvote, exists]
  const hasVoted = voteInfo ? voteInfo[3] : false;

  // Build creator list from leaderboard data
  // getLeaderboard returns: [creators_, contentURIs, upvotes_, downvotes_, companyScores, totalScores]
  const creatorList = leaderboardData
    ? (() => {
        const [addrs, uris, ups, downs] = leaderboardData;
        return addrs.map((addr: string, i: number) => ({
          address: addr,
          contentURI: uris[i] || "",
          upvotes: ups[i] || 0n,
          downvotes: downs[i] || 0n,
        }));
      })()
    : [];

  const handleVote = async (creatorAddress: string, isUpvote: boolean) => {
    await vote({
      functionName: "vote",
      args: [bountyId, creatorAddress, isUpvote],
      value: parseEther("0.01"),
    });
    setTimeout(() => router.push(`/bounty/${bountyId.toString()}`), 1500);
  };

  const handleSkip = () => {
    // No-op: skip just advances the card index inside SwipeDeck
  };

  // CRITICAL: SwipeDeck must NOT mount until creatorList is populated
  const isLoading = isLeaderboardLoading || isVoteInfoLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05050B] flex flex-col items-center justify-center px-4">
        <div className="w-8 h-8 border-2 border-[#6E54FF] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-mono text-sm">Loading creators...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050B] flex flex-col items-center px-4 pt-4 pb-6 gap-3">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <div className="flex items-center gap-3">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => router.push(`/bounty/${bountyId.toString()}`)}
            title="Back to bounty"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-white/70 font-mono text-sm">Swipe to Vote</span>
        </div>

        {/* Info tooltip */}
        <div className="relative">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
            onClick={() => setShowStakeInfo(!showStakeInfo)}
            title="Staking info"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
          {showStakeInfo && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-[#0E091C] border border-white/10 rounded-lg shadow-xl p-3 w-56">
              <p className="text-white/70 font-mono text-xs mb-1.5">Staking Info</p>
              <p className="text-white/30 text-xs leading-relaxed">
                0.01 MON per vote. One vote per bounty. If your pick wins, you share 20% of the reward pool.
              </p>
              <button
                className="mt-2 w-full text-center text-xs text-[#85E6FF] hover:text-white font-mono py-1 transition-colors"
                onClick={() => setShowStakeInfo(false)}
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card deck */}
      <SwipeDeck
        creators={creatorList}
        onVote={handleVote}
        onSkip={handleSkip}
        hasVoted={hasVoted}
      />
    </div>
  );
};

export default SwipePage;
