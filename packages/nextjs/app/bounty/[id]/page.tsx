"use client";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { BountyStatusBadge } from "~~/components/bountyswipe/BountyStatusBadge";
import { Leaderboard } from "~~/components/bountyswipe/Leaderboard";
import { CountdownTimer } from "~~/components/bountyswipe/CountdownTimer";
import { ClaimButton } from "~~/components/bountyswipe/ClaimButton";
import { formatEther } from "viem";
import Link from "next/link";
import { useState } from "react";

const BountyDetailPage = () => {
  const params = useParams();
  const bountyId = BigInt(params.id as string);
  const { address } = useAccount();
  const [contentURI, setContentURI] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);

  const { data: bounty } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getBounty",
    args: [bountyId],
  });

  const { data: leaderboardData } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getLeaderboard",
    args: [bountyId],
  });

  const { data: creators } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getBountyCreators",
    args: [bountyId],
  });

  const { data: voteInfo } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getVoteInfo",
    args: [address, bountyId],
  });

  const { writeContractAsync: joinBounty, isPending: isJoining } = useScaffoldWriteContract("BountyPlatform");
  const { writeContractAsync: finalize, isPending: isFinalizing } = useScaffoldWriteContract("BountyPlatform");

  if (!bounty) return (
    <div className="flex justify-center items-center py-32">
      <div className="h-8 w-8 border-2 border-[#6E54FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // getBounty returns: [id, company, name, description, deadline, rewardPool, isFinalized, companyJudged, winner]
  const [, company, name, description, deadline, rewardPool, isFinalized, companyJudged, winner] = bounty;

  const isCompany = address?.toLowerCase() === company.toLowerCase();
  // getVoteInfo returns: [amount, votedFor, isUpvote, exists]
  const hasVoted = voteInfo ? voteInfo[3] : false;
  const isCreator = creators?.some((c: string) => c.toLowerCase() === address?.toLowerCase());
  const isWinner = winner.toLowerCase() === address?.toLowerCase();
  const isPastDeadline = Math.floor(Date.now() / 1000) > Number(deadline);

  // Build leaderboard entries
  // getLeaderboard returns: [creators_, contentURIs, upvotes_, downvotes_, companyScores, totalScores]
  const entries = leaderboardData ? (() => {
    const [addrs, uris, ups, downs, cScores, tScores] = leaderboardData;
    return addrs.map((addr: string, i: number) => ({
      creator: addr,
      contentURI: uris[i] || "",
      upvotes: ups[i] || 0n,
      downvotes: downs[i] || 0n,
      companyScore: cScores[i] || 0n,
      totalScore: tScores[i] || 0n,
    }));
  })() : [];

  const handleJoin = async () => {
    try {
      await joinBounty({ functionName: "joinBounty", args: [bountyId, contentURI] });
      setShowJoinModal(false);
      setContentURI("");
    } catch (err) {
      console.error("Join failed:", err);
    }
  };

  const handleFinalize = async () => {
    try {
      await finalize({ functionName: "finalizeBounty", args: [bountyId] });
    } catch (err) {
      console.error("Finalize failed:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-sm text-white/40 hover:text-[#85E6FF] transition-colors mb-8"
      >
        <span>&larr;</span> Back to Bounties
      </Link>

      {/* Main card */}
      <div className="bg-[#0E091C] border border-white/10 rounded-xl overflow-hidden">
        {/* Header section */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-white tracking-tight">{name}</h1>
              <div className="flex items-center gap-3 mt-3">
                <BountyStatusBadge deadline={deadline} isFinalized={isFinalized} companyJudged={companyJudged} />
                <span className="font-mono text-2xl text-[#85E6FF] font-semibold">
                  {formatEther(rewardPool)} MON
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          <div className="px-8 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-1">Company</p>
            <p className="font-mono text-sm text-white/80">
              {company.slice(0, 6)}...{company.slice(-4)}
            </p>
          </div>
          <div className="px-8 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-1">Deadline</p>
            <div className="text-sm text-white/80">
              <CountdownTimer deadline={deadline} />
            </div>
          </div>
          <div className="px-8 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-1">Creators</p>
            <p className="font-mono text-sm text-white/80">{creators?.length ?? 0}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Description */}
        <div className="px-8 py-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-3">Description</p>
          <p className="text-sm text-white/50 leading-relaxed">{description}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Action buttons */}
        <div className="px-8 py-6 flex flex-wrap gap-3">
          {!isPastDeadline && !isCreator && !isCompany && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="rounded-full bg-[#6E54FF] hover:bg-[#5A42E0] px-6 py-2.5 font-mono text-sm text-white transition-colors"
            >
              Join &amp; Submit
            </button>
          )}
          {!isPastDeadline && !hasVoted && !isCompany && (
            <Link
              href={`/bounty/${bountyId.toString()}/swipe`}
              className="rounded-full border border-white/10 hover:border-[#6E54FF]/50 bg-transparent px-6 py-2.5 font-mono text-sm text-white/70 hover:text-white transition-colors"
            >
              Start Voting
            </Link>
          )}
          {isPastDeadline && isCompany && !companyJudged && (
            <Link
              href={`/bounty/${bountyId.toString()}/judge`}
              className="rounded-full bg-[#6E54FF] hover:bg-[#5A42E0] px-6 py-2.5 font-mono text-sm text-white transition-colors"
            >
              Judge Creators
            </Link>
          )}
          {isPastDeadline && companyJudged && !isFinalized && (
            <button
              onClick={handleFinalize}
              className="rounded-full bg-[#6E54FF] hover:bg-[#5A42E0] px-6 py-2.5 font-mono text-sm text-white transition-colors disabled:opacity-40"
              disabled={isFinalizing}
            >
              {isFinalizing ? "Finalizing..." : "Finalize Bounty"}
            </button>
          )}
          {isFinalized && isWinner && (
            <ClaimButton bountyId={bountyId} type="creator" isEligible={true} alreadyClaimed={false} />
          )}
          {isFinalized && hasVoted && (
            <ClaimButton bountyId={bountyId} type="voter" isEligible={true} alreadyClaimed={false} />
          )}
        </div>
      </div>

      {/* Leaderboard section */}
      <div className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-4">Leaderboard</h2>
        <Leaderboard entries={entries} winner={winner} isFinalized={isFinalized} />
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowJoinModal(false)}
          />

          {/* Modal card */}
          <div className="relative w-full max-w-md mx-4 bg-[#0E091C] border border-white/10 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Submit Your Content</h3>
            <p className="text-sm text-white/30 mb-6">Provide a URL or IPFS link to your submission.</p>

            <div className="mb-6">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/40 mb-2">
                Content URI
              </label>
              <input
                type="text"
                value={contentURI}
                onChange={e => setContentURI(e.target.value)}
                className="w-full bg-[#05050B] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 focus:border-[#6E54FF] focus:ring-1 focus:ring-[#6E54FF]/30 outline-none transition-colors"
                placeholder="https://... or ipfs://..."
              />
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowJoinModal(false)}
                className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                className="rounded-full bg-[#6E54FF] hover:bg-[#5A42E0] px-6 py-2.5 font-mono text-sm text-white transition-colors disabled:opacity-40"
                disabled={isJoining || !contentURI}
              >
                {isJoining ? "Joining..." : "Join Bounty"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BountyDetailPage;
