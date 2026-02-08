"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { JudgePanel } from "~~/components/bountyswipe/JudgePanel";

const JudgePage = () => {
  const params = useParams();
  const bountyId = BigInt(params.id as string);
  const { address } = useAccount();

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

  if (!bounty) {
    return (
      <div className="flex justify-center py-20">
        <svg className="h-6 w-6 animate-spin text-[#6E54FF]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // getBounty returns: [id, company, name, description, deadline, rewardPool, isFinalized, companyJudged, winner]
  const [, company, , , , , , companyJudged] = bounty;
  const isCompany = address?.toLowerCase() === company.toLowerCase();

  // getLeaderboard returns: [creators_, contentURIs, upvotes_, downvotes_, companyScores, totalScores]
  const creatorEntries = leaderboardData ? (() => {
    const [addrs, uris, ups, downs] = leaderboardData;
    return addrs.map((addr: string, i: number) => ({
      address: addr,
      contentURI: uris[i] || "",
      upvotes: ups[i] || 0n,
      downvotes: downs[i] || 0n,
    }));
  })() : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href={`/bounty/${params.id}`}
        className="mb-8 inline-flex items-center gap-1.5 font-mono text-sm text-white/40 transition-colors hover:text-white/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Bounty
      </Link>

      <h1 className="mb-8 text-2xl font-semibold text-white">Judge Panel</h1>

      <JudgePanel
        bountyId={bountyId}
        creators={creatorEntries}
        isCompany={isCompany}
        alreadyJudged={companyJudged}
      />
    </div>
  );
};

export default JudgePage;
