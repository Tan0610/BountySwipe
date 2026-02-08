"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { BountyCard } from "~~/components/bountyswipe/BountyCard";
import Link from "next/link";

type FilterTab = "all" | "created" | "participating";

const MyBountiesPage = () => {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const { data: activeBountyIds } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getActiveBounties",
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.06] bg-[#0E091C]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#DDD7FE]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Wallet not connected</h2>
          <p className="text-sm text-[#DDD7FE]/40">
            Connect your wallet to view your bounties
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "created", label: "Created" },
    { key: "participating", label: "Participating" },
  ];

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-8">My Bounties</h1>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-1.5 font-mono text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-[#6E54FF] text-white"
                  : "border border-white/10 bg-transparent text-[#DDD7FE]/50 hover:border-white/20 hover:text-[#DDD7FE]/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {activeBountyIds && activeBountyIds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeBountyIds.map((id: bigint) => (
              <MyBountyCardWrapper
                key={id.toString()}
                bountyId={id}
                userAddress={address!}
                filter={activeTab}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-[#DDD7FE]/40 text-base mb-6">No bounties found</p>
            <Link href="/create" className="btn-monad px-6 py-2.5 text-sm">
              Create your first bounty
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Card wrapper with filtering ---------- */

const MyBountyCardWrapper = ({
  bountyId,
  userAddress,
  filter,
}: {
  bountyId: bigint;
  userAddress: string;
  filter: FilterTab;
}) => {
  const { data: bounty } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getBounty",
    args: [bountyId],
  });

  const { data: creators } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getBountyCreators",
    args: [bountyId],
  });

  if (!bounty) return null;

  // getBounty returns: [id, company, name, description, deadline, rewardPool, isFinalized, companyJudged, winner]
  const [, bCompany, bName, , bDeadline, bRewardPool, bIsFinalized] = bounty;
  const company = bCompany.toLowerCase();
  const isCompany = company === userAddress.toLowerCase();
  const isCreator = creators?.some((c: string) => c.toLowerCase() === userAddress.toLowerCase());

  // Only show bounties user is involved in
  if (!isCompany && !isCreator) return null;

  // Apply filter
  if (filter === "created" && !isCompany) return null;
  if (filter === "participating" && !isCreator) return null;

  return (
    <div className="relative">
      {/* Role badge */}
      {isCompany && (
        <span className="absolute -top-2 -right-2 z-10 rounded-full bg-[#6E54FF] px-2.5 py-0.5 text-[10px] font-mono font-medium text-white uppercase tracking-wider">
          Owner
        </span>
      )}
      {isCreator && !isCompany && (
        <span className="absolute -top-2 -right-2 z-10 rounded-full bg-[#85E6FF] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[#05050B] uppercase tracking-wider">
          Creator
        </span>
      )}
      <BountyCard
        id={bountyId}
        name={bName}
        rewardPool={bRewardPool}
        deadline={bDeadline}
        creatorCount={creators ? creators.length : 0}
        isFinalized={bIsFinalized}
      />
    </div>
  );
};

export default MyBountiesPage;
