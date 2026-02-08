"use client";

interface BountyStatusBadgeProps {
  deadline: bigint;
  isFinalized: boolean;
  companyJudged: boolean;
}

type StatusConfig = {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  active: {
    label: "ACTIVE",
    dot: "bg-green-400",
    text: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  awaiting: {
    label: "AWAITING JUDGMENT",
    dot: "bg-[#85E6FF]",
    text: "text-[#85E6FF]",
    bg: "bg-[#85E6FF]/10",
    border: "border-[#85E6FF]/20",
  },
  ready: {
    label: "READY TO FINALIZE",
    dot: "bg-[#FFAE45]",
    text: "text-[#FFAE45]",
    bg: "bg-[#FFAE45]/10",
    border: "border-[#FFAE45]/20",
  },
  finalized: {
    label: "FINALIZED",
    dot: "bg-[#6E54FF]",
    text: "text-[#6E54FF]",
    bg: "bg-[#6E54FF]/10",
    border: "border-[#6E54FF]/20",
  },
};

/**
 * Minimal pill badge for bounty lifecycle status.
 * Derives state from on-chain data: Active -> Awaiting Judgment -> Ready to Finalize -> Finalized.
 */
export const BountyStatusBadge = ({ deadline, isFinalized, companyJudged }: BountyStatusBadgeProps) => {
  const now = Math.floor(Date.now() / 1000);
  const isPastDeadline = now > Number(deadline);

  let statusKey: string;
  if (isFinalized) {
    statusKey = "finalized";
  } else if (companyJudged) {
    statusKey = "ready";
  } else if (isPastDeadline) {
    statusKey = "awaiting";
  } else {
    statusKey = "active";
  }

  const config = STATUS_MAP[statusKey];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider leading-none ${config.text} ${config.bg} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
