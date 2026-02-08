"use client";

import { useState } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface ClaimButtonProps {
  bountyId: bigint;
  type: "creator" | "voter";
  isEligible: boolean;
  alreadyClaimed: boolean;
}

/**
 * Button for claiming rewards from a finalized bounty.
 * Handles both creator rewards (70% for winner) and voter rewards (stake back + share of 20%).
 * Shows loading state during transaction and "Claimed" badge after success.
 */
export const ClaimButton = ({ bountyId, type, isEligible, alreadyClaimed }: ClaimButtonProps) => {
  const [claimed, setClaimed] = useState(alreadyClaimed);
  const { writeContractAsync: claim, isPending } = useScaffoldWriteContract("BountyPlatform");

  const handleClaim = async () => {
    const functionName = type === "creator" ? "claimCreatorReward" : "claimVoterReward";
    try {
      await claim({ functionName, args: [bountyId] });
      setClaimed(true);
    } catch (err) {
      console.error("Claim failed:", err);
    }
  };

  if (claimed || alreadyClaimed) {
    return (
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="font-mono text-sm text-green-400">
          {type === "creator" ? "Creator Reward Claimed" : "Voter Reward Claimed"}
        </span>
      </div>
    );
  }

  if (!isEligible) return null;

  const isCreator = type === "creator";

  return (
    <button
      onClick={handleClaim}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${
        isCreator
          ? "bg-[#6E54FF] text-white"
          : "border border-[#6E54FF] text-[#6E54FF]"
      }`}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Claiming...
        </>
      ) : (
        isCreator ? "Claim Creator Reward" : "Claim Voter Reward"
      )}
    </button>
  );
};
