"use client";

import { useRouter } from "next/navigation";
import { formatEther } from "viem";
import { CountdownTimer } from "./CountdownTimer";

interface BountyCardProps {
  id: bigint;
  name: string;
  rewardPool: bigint;
  deadline: bigint;
  creatorCount: number;
  isFinalized: boolean;
}

/**
 * Clean bounty card with Monad-style aesthetics.
 * Dark navy background, subtle border, hover lift effect.
 */
export const BountyCard = ({ id, name, rewardPool, deadline, creatorCount, isFinalized }: BountyCardProps) => {
  const router = useRouter();

  const isPastDeadline = Math.floor(Date.now() / 1000) > Number(deadline);

  // Derive inline status for the card badge
  let statusLabel: string;
  let statusClasses: string;

  if (isFinalized) {
    statusLabel = "FINALIZED";
    statusClasses = "text-[#6E54FF] bg-[#6E54FF]/10 border-[#6E54FF]/20";
  } else if (isPastDeadline) {
    statusLabel = "JUDGING";
    statusClasses = "text-[#85E6FF] bg-[#85E6FF]/10 border-[#85E6FF]/20";
  } else {
    statusLabel = "ACTIVE";
    statusClasses = "text-green-400 bg-green-400/10 border-green-400/20";
  }

  return (
    <div
      onClick={() => router.push(`/bounty/${id.toString()}`)}
      className="group cursor-pointer bg-[#0E091C] rounded-xl border border-white/10 p-5 transition-all duration-200 hover:border-[#6E54FF]/30 hover:-translate-y-0.5"
    >
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-white font-medium text-base leading-snug line-clamp-2">
          {name}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase tracking-wider leading-none whitespace-nowrap flex-shrink-0 ${statusClasses}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isFinalized
                ? "bg-[#6E54FF]"
                : isPastDeadline
                  ? "bg-[#85E6FF]"
                  : "bg-green-400"
            }`}
          />
          {statusLabel}
        </span>
      </div>

      {/* Reward amount */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-mono font-semibold text-[#6E54FF]">
          {formatEther(rewardPool)}
        </span>
        <span className="text-xs font-mono text-[#DDD7FE]/50 uppercase tracking-wide">
          MON
        </span>
      </div>

      {/* Bottom row: creator count + countdown */}
      <div className="flex items-center justify-between text-sm text-[#DDD7FE]/50">
        <span className="font-mono">
          {creatorCount} creator{creatorCount !== 1 ? "s" : ""}
        </span>
        <span className="text-[#DDD7FE]/20 mx-2">|</span>
        <CountdownTimer deadline={deadline} />
      </div>
    </div>
  );
};
