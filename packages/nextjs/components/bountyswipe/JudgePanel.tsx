"use client";

import { useState } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface CreatorEntry {
  address: string;
  contentURI: string;
  upvotes: bigint;
  downvotes: bigint;
}

interface JudgePanelProps {
  bountyId: bigint;
  creators: CreatorEntry[];
  isCompany: boolean;
  alreadyJudged: boolean;
}

/**
 * Company judging interface for scoring creators 0-100.
 * Shows all creators with content links, community vote stats, and a slider for scoring.
 * Submits all scores in a single companyJudge transaction.
 * Only visible/functional for the bounty owner (company).
 */
export const JudgePanel = ({ bountyId, creators, isCompany, alreadyJudged }: JudgePanelProps) => {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(creators.map(c => [c.address, 50]))
  );
  const [confirmed, setConfirmed] = useState(false);

  const { writeContractAsync: companyJudge, isPending } = useScaffoldWriteContract("BountyPlatform");

  const handleSubmit = async () => {
    if (!confirmed) return;

    const addresses = creators.map(c => c.address);
    const scoreValues = creators.map(c => BigInt(scores[c.address] || 50));

    try {
      await companyJudge({
        functionName: "companyJudge",
        args: [bountyId, addresses, scoreValues],
      });
    } catch (err) {
      console.error("Judging failed:", err);
    }
  };

  if (!isCompany) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-lg text-white/40">Access Restricted</p>
        <p className="mt-2 text-sm text-white/20">Only the bounty company can judge submissions</p>
      </div>
    );
  }

  if (alreadyJudged) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-lg text-green-400">Judging Complete</p>
        <p className="mt-2 text-sm text-white/40">All scores have been submitted on-chain.</p>
        <p className="mt-1 text-xs text-white/20">The bounty can now be finalized.</p>
      </div>
    );
  }

  if (creators.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-sm text-white/30">No creators to judge</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0E091C] p-6">
      <h2 className="text-xl font-semibold text-white">Judge Submissions</h2>
      <p className="mt-1 text-sm text-white/40">
        Score each creator 0-100. Company scores make up 60% of the final ranking. This action is irreversible.
      </p>

      <div className="mt-6 space-y-3">
        {creators.map((creator, idx) => {
          const totalVotes = Number(creator.upvotes) + Number(creator.downvotes);
          const approvalRate = totalVotes > 0 ? Math.round((Number(creator.upvotes) / totalVotes) * 100) : 0;
          const score = scores[creator.address] ?? 50;

          return (
            <div
              key={creator.address}
              className="rounded-lg border border-white/5 bg-[#05050B] p-4"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">#{idx + 1}</span>
                    <span className="font-mono text-sm text-white/80">
                      {creator.address.slice(0, 6)}...{creator.address.slice(-4)}
                    </span>
                  </div>
                  <a
                    href={creator.contentURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-sm text-[#85E6FF] transition-colors hover:text-[#DDD7FE]"
                  >
                    View Submission
                  </a>
                </div>
                <div className="text-right text-xs">
                  <div className="text-white/30">Community Votes</div>
                  <div className="mt-0.5 flex gap-2 justify-end">
                    <span className="text-green-400">{creator.upvotes.toString()} up</span>
                    <span className="text-red-400">{creator.downvotes.toString()} down</span>
                  </div>
                  {totalVotes > 0 && (
                    <div className="mt-0.5 text-white/20">{approvalRate}% approval</div>
                  )}
                </div>
              </div>

              {/* Score slider */}
              <div className="flex items-center gap-3">
                <span className="w-4 text-xs text-white/20">0</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={score}
                  onChange={e => setScores(prev => ({ ...prev, [creator.address]: parseInt(e.target.value) }))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#6E54FF]
                    [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#6E54FF]"
                />
                <span className="w-6 text-xs text-white/20">100</span>
                <span className="min-w-[3ch] text-right font-mono text-xl font-semibold text-white">
                  {score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation checkbox */}
      <label className="mt-6 flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-transparent accent-[#FFAE45]"
        />
        <span className="text-sm text-white/50">
          I confirm these scores are final and cannot be changed
        </span>
      </label>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#FFAE45] px-6 py-3 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={isPending || !confirmed}
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting Scores...
          </>
        ) : (
          "Submit All Scores"
        )}
      </button>
    </div>
  );
};
