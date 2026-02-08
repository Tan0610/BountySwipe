"use client";

interface LeaderboardEntry {
  creator: string;
  contentURI: string;
  upvotes: bigint;
  downvotes: bigint;
  companyScore: bigint;
  totalScore: bigint;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  winner?: string;
  isFinalized: boolean;
}

/**
 * Ranked leaderboard table for bounty creators.
 * Sorts by totalScore when finalized, by upvotes otherwise.
 * Highlights the winner row with a gold accent.
 */
export const Leaderboard = ({ entries, winner, isFinalized }: LeaderboardProps) => {
  const sorted = [...entries].sort((a, b) => {
    if (isFinalized) return Number(b.totalScore - a.totalScore);
    return Number(b.upvotes - a.upvotes);
  });

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-sm text-white/30">No creators have joined yet</p>
        <p className="mt-1 text-xs text-white/20">Be the first to submit content</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left font-mono text-xs font-medium uppercase tracking-wider text-white/40">
              Rank
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs font-medium uppercase tracking-wider text-white/40">
              Creator
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs font-medium uppercase tracking-wider text-white/40">
              Content
            </th>
            <th className="px-4 py-3 text-right font-mono text-xs font-medium uppercase tracking-wider text-white/40">
              Up
            </th>
            <th className="px-4 py-3 text-right font-mono text-xs font-medium uppercase tracking-wider text-white/40">
              Down
            </th>
            {isFinalized && (
              <th className="px-4 py-3 text-right font-mono text-xs font-medium uppercase tracking-wider text-white/40">
                Score
              </th>
            )}
            {isFinalized && (
              <th className="px-4 py-3 text-right font-mono text-xs font-medium uppercase tracking-wider text-white/40">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const isWinner = winner && entry.creator.toLowerCase() === winner.toLowerCase();
            return (
              <tr
                key={entry.creator}
                className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                  isWinner ? "border-l-2 border-l-[#FFAE45]" : ""
                }`}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white/60">{i + 1}</span>
                    {isWinner && <span className="text-sm">🏆</span>}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-sm text-white/80">
                    {entry.creator.slice(0, 6)}...{entry.creator.slice(-4)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <a
                    href={entry.contentURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-[#85E6FF] transition-colors hover:text-[#DDD7FE]"
                  >
                    View
                  </a>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="font-mono text-sm text-green-400">{entry.upvotes.toString()}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="font-mono text-sm text-red-400">{entry.downvotes.toString()}</span>
                </td>
                {isFinalized && (
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono text-sm text-white/60">{entry.companyScore.toString()}/100</span>
                  </td>
                )}
                {isFinalized && (
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono text-base font-semibold text-[#DDD7FE]">
                      {entry.totalScore.toString()}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
