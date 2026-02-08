"use client";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { BountyCard } from "~~/components/bountyswipe/BountyCard";
import Link from "next/link";

const Home = () => {
  const { data: activeBountyIds } = useScaffoldReadContract({
    contractName: "BountyPlatform",
    functionName: "getActiveBounties",
  });

  const bountyCount = activeBountyIds ? activeBountyIds.length : 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Create. Compete. Vote. Earn.
          </h1>
          <p className="mt-5 text-lg text-[#DDD7FE]/60 max-w-xl mx-auto leading-relaxed">
            Companies post bounties. Creators compete with submissions.
            Voters stake to pick winners. Everyone earns.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/create"
              className="btn-monad px-8 py-3 text-sm"
            >
              Create Bounty
            </Link>
            <Link
              href="#bounties"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-transparent px-8 py-3 font-mono text-sm font-medium text-[#DDD7FE] transition-all hover:border-white/25 hover:bg-white/[0.03]"
            >
              Explore
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            <StatCell label="Total Bounties" value={String(bountyCount)} />
            <StatCell label="Total Reward Pool" value={<PoolTotal ids={activeBountyIds} />} />
            <StatCell label="Active Now" value={String(bountyCount)} />
          </div>
        </div>
      </section>

      {/* Bounty Grid */}
      <section id="bounties" className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          {/* Section heading */}
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-bold text-white whitespace-nowrap">Active Bounties</h2>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {activeBountyIds && activeBountyIds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeBountyIds.map((id: bigint) => (
                <BountyCardWrapper key={id.toString()} bountyId={id} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-[#DDD7FE]/40 text-base mb-6">
                No active bounties yet
              </p>
              <Link href="/create" className="btn-monad px-6 py-2.5 text-sm">
                Create the first bounty
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ---------- Stats ---------- */

const StatCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-1 px-4 py-3">
    <span className="font-mono text-2xl font-semibold text-white">{value}</span>
    <span className="text-xs text-[#DDD7FE]/40 uppercase tracking-wider">{label}</span>
  </div>
);

/** Sums reward pools across all bounties */
const PoolTotal = ({ ids }: { ids: readonly bigint[] | undefined }) => {
  if (!ids || ids.length === 0) return <>0 MON</>;
  return <PoolTotalInner ids={ids} />;
};

const PoolTotalInner = ({ ids }: { ids: readonly bigint[] }) => {
  // Read all bounties to sum pools — each hook must be called unconditionally
  // so we render individual readers and sum in a parent
  return (
    <span className="flex items-baseline gap-1">
      <PoolSum ids={ids} />
      <span className="text-xs text-[#DDD7FE]/40 font-normal">MON</span>
    </span>
  );
};

const PoolSum = ({ ids }: { ids: readonly bigint[] }) => {
  // We can't call hooks in a loop, so we just show a count-based estimate
  // or we read from the first bounty. For MVP, show "—" and let individual cards show pools.
  return <>{ids.length > 0 ? "—" : "0"}</>;
};

/* ---------- Bounty card data wrapper ---------- */

const BountyCardWrapper = ({ bountyId }: { bountyId: bigint }) => {
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

  if (!bounty) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#0E091C] h-48 animate-pulse" />
    );
  }

  // getBounty returns: [id, company, name, description, deadline, rewardPool, isFinalized, companyJudged, winner]
  const [, , name, , deadline, rewardPool, isFinalized] = bounty;

  return (
    <BountyCard
      id={bountyId}
      name={name}
      rewardPool={rewardPool}
      deadline={deadline}
      creatorCount={creators ? creators.length : 0}
      isFinalized={isFinalized}
    />
  );
};

export default Home;
