"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useRouter } from "next/navigation";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";

/**
 * Form to create a new bounty on BountyPlatform.
 * Fields: name, description, deadline (datetime picker), reward amount in MON.
 * Validates minimum reward of 0.1 MON.
 * On success, navigates to the homepage.
 */
export const CreateBountyForm = () => {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [error, setError] = useState("");

  const { writeContractAsync: createBounty, isPending } = useScaffoldWriteContract("BountyPlatform");

  const validate = (): boolean => {
    setError("");

    if (!name.trim()) {
      setError("Bounty name is required");
      return false;
    }
    if (!description.trim()) {
      setError("Description is required");
      return false;
    }
    if (!deadline) {
      setError("Deadline is required");
      return false;
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate.getTime() <= Date.now()) {
      setError("Deadline must be in the future");
      return false;
    }

    const reward = parseFloat(rewardAmount);
    if (isNaN(reward) || reward < 0.1) {
      setError("Minimum reward is 0.1 MON");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const deadlineTimestamp = BigInt(Math.floor(new Date(deadline).getTime() / 1000));

    try {
      await createBounty({
        functionName: "createBounty",
        args: [name, description, deadlineTimestamp],
        value: parseEther(rewardAmount),
      });
      router.push("/");
    } catch (err) {
      console.error("Failed to create bounty:", err);
      setError("Transaction failed. Please try again.");
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-white/60 mb-1">Wallet Required</h2>
        <p className="text-sm text-white/30 font-mono">Connect your wallet to create a bounty</p>
      </div>
    );
  }

  // Calculate minimum deadline (1 hour from now)
  const minDeadline = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  return (
    <div className="max-w-lg mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-[#0E091C] border border-white/10 rounded-xl p-8"
      >
        <h2 className="text-xl font-semibold text-white mb-1">Create Bounty</h2>
        <p className="text-sm text-white/30 mb-8">
          Post a bounty for creators to compete on. Your deposit becomes the reward pool.
        </p>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-6">{error}</p>
        )}

        {/* Bounty Name */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/60">
              Bounty Name
            </label>
            <span className="text-xs text-white/30">{name.length}/100</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#05050B] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 focus:border-[#6E54FF] focus:ring-1 focus:ring-[#6E54FF]/30 outline-none transition-colors"
            placeholder="e.g. Best Monad Meme"
            maxLength={100}
            required
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/60">
              Description
            </label>
            <span className="text-xs text-white/30">{description.length}/500</span>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-[#05050B] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 focus:border-[#6E54FF] focus:ring-1 focus:ring-[#6E54FF]/30 outline-none transition-colors resize-none h-28"
            placeholder="Describe what creators should submit, judging criteria, and any rules..."
            maxLength={500}
            required
          />
        </div>

        {/* Deadline */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/60">
              Deadline
            </label>
            <span className="text-xs text-white/30">Min 1 hour from now</span>
          </div>
          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full bg-[#05050B] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 focus:border-[#6E54FF] focus:ring-1 focus:ring-[#6E54FF]/30 outline-none transition-colors"
            min={minDeadline}
            required
          />
        </div>

        {/* Reward Amount */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#DDD7FE]/60">
              Reward Pool (MON)
            </label>
            <span className="text-xs text-white/30">Min 0.1 MON</span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={rewardAmount}
              onChange={e => setRewardAmount(e.target.value)}
              className="w-full bg-[#05050B] border border-white/10 rounded-lg px-4 py-3 pr-16 text-white text-sm placeholder-white/30 focus:border-[#6E54FF] focus:ring-1 focus:ring-[#6E54FF]/30 outline-none transition-colors"
              placeholder="0.1"
              min="0.1"
              step="0.01"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-white/30">MON</span>
          </div>
          <p className="text-xs text-white/20 mt-2">
            Split: 70% winner / 20% voters / 10% platform
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-full bg-[#6E54FF] hover:bg-[#5A42E0] py-3 font-mono text-sm text-white transition-colors disabled:opacity-40"
          disabled={isPending}
        >
          {isPending ? "Creating..." : `Create & Deposit ${rewardAmount || "0"} MON`}
        </button>
      </form>
    </div>
  );
};
