"use client";

import { useRef, useState } from "react";
import { SwipeCard } from "./SwipeCard";
import TinderCard from "react-tinder-card";

interface Creator {
  address: string;
  contentURI: string;
  upvotes: bigint;
  downvotes: bigint;
}

interface SwipeDeckProps {
  creators: Creator[];
  onVote: (creatorAddress: string, isUpvote: boolean) => Promise<void>;
  onSkip?: () => void;
  hasVoted: boolean;
}

/**
 * Monad-styled swipe deck with stacked cards, progress bar, and clean action buttons.
 */
export const SwipeDeck = ({ creators, onVote, onSkip, hasVoted }: SwipeDeckProps) => {
  const [currentIndex, setCurrentIndex] = useState(creators.length - 1);
  const [voting, setVoting] = useState(false);
  const [lastDirection, setLastDirection] = useState<string | null>(null);
  const currentIndexRef = useRef(currentIndex);

  currentIndexRef.current = currentIndex;

  const canSwipe = currentIndex >= 0 && !voting;
  const totalCards = creators.length;
  const cardsViewed = totalCards - currentIndex - 1;
  const progressPercent = totalCards > 0 ? Math.round((cardsViewed / totalCards) * 100) : 0;

  const onSwipe = async (direction: string, creator: Creator) => {
    if (voting) return;

    if (direction === "up") {
      setCurrentIndex(prev => prev - 1);
      onSkip?.();
      return;
    }

    const isUpvote = direction === "right";
    setVoting(true);
    setLastDirection(direction);

    try {
      await onVote(creator.address, isUpvote);
    } catch (err) {
      console.error("Vote failed:", err);
    } finally {
      setVoting(false);
      setLastDirection(null);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (!canSwipe) return;
    setCurrentIndex(prev => prev - 1);
    onSkip?.();
  };

  const onCardLeftScreen = () => {
    // Card has left the screen
  };

  // Vote recorded state
  if (hasVoted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white font-mono text-lg">Vote Recorded</p>
        <p className="text-white/40 text-sm text-center max-w-[280px]">
          Your vote and stake have been submitted on-chain.
        </p>
      </div>
    );
  }

  // No creators
  if (creators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-white/40 font-mono text-lg">No Creators Yet</p>
        <p className="text-white/20 text-sm">Check back once creators have submitted content</p>
      </div>
    );
  }

  // All cards viewed
  if (currentIndex < 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-white/40 font-mono text-lg">No More Cards</p>
        <p className="text-white/20 text-sm">You have seen all creators for this bounty</p>
      </div>
    );
  }

  const CardWrapper = TinderCard;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[400px] mx-auto">
      {/* Progress bar — thin line */}
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#6E54FF] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Card stack */}
      <div className="relative w-full" style={{ height: "70vh" }}>
        {creators.map((creator, index) => {
          if (index > currentIndex) return null;

          const depth = currentIndex - index;
          if (depth > 2) return null;

          const card = (
            <div
              key={creator.address}
              className="absolute inset-0 flex justify-center"
              style={{
                zIndex: totalCards - depth,
                transform: depth === 0 ? "none" : `scale(${1 - depth * 0.04}) translateY(${depth * -10}px)`,
                opacity: depth === 0 ? 1 : 0.4 - depth * 0.15,
                filter: depth > 0 ? `blur(${depth * 0.5}px)` : "none",
                transition: "transform 0.3s ease, opacity 0.3s ease, filter 0.3s ease",
              }}
            >
              {/* Direction overlay */}
              {lastDirection === "right" && index === currentIndex && (
                <div className="absolute inset-0 max-w-[400px] mx-auto rounded-2xl z-10 flex items-center justify-center pointer-events-none bg-green-500/10">
                  <span className="text-green-400 text-3xl font-mono font-bold tracking-widest rotate-[-12deg] backdrop-blur-[2px] px-6 py-2">
                    UPVOTE
                  </span>
                </div>
              )}
              {lastDirection === "left" && index === currentIndex && (
                <div className="absolute inset-0 max-w-[400px] mx-auto rounded-2xl z-10 flex items-center justify-center pointer-events-none bg-red-500/10">
                  <span className="text-red-400 text-3xl font-mono font-bold tracking-widest rotate-[12deg] backdrop-blur-[2px] px-6 py-2">
                    PASS
                  </span>
                </div>
              )}
              <SwipeCard
                creator={creator.address}
                contentURI={creator.contentURI}
                upvotes={creator.upvotes}
                downvotes={creator.downvotes}
              />
            </div>
          );

          // Wrap top card with TinderCard if available
          if (CardWrapper && index === currentIndex) {
            return (
              <div
                key={creator.address}
                className="absolute inset-0 flex justify-center"
                style={{ zIndex: totalCards + 1 }}
              >
                <CardWrapper
                  onSwipe={(dir: string) => onSwipe(dir, creator)}
                  onCardLeftScreen={() => onCardLeftScreen()}
                  preventSwipe={["down"]}
                  swipeRequirementType="position"
                  swipeThreshold={80}
                >
                  {lastDirection === "right" && (
                    <div className="absolute inset-0 max-w-[400px] mx-auto rounded-2xl z-10 flex items-center justify-center pointer-events-none bg-green-500/10">
                      <span className="text-green-400 text-3xl font-mono font-bold tracking-widest rotate-[-12deg] backdrop-blur-[2px] px-6 py-2">
                        UPVOTE
                      </span>
                    </div>
                  )}
                  {lastDirection === "left" && (
                    <div className="absolute inset-0 max-w-[400px] mx-auto rounded-2xl z-10 flex items-center justify-center pointer-events-none bg-red-500/10">
                      <span className="text-red-400 text-3xl font-mono font-bold tracking-widest rotate-[12deg] backdrop-blur-[2px] px-6 py-2">
                        PASS
                      </span>
                    </div>
                  )}
                  <SwipeCard
                    creator={creator.address}
                    contentURI={creator.contentURI}
                    upvotes={creator.upvotes}
                    downvotes={creator.downvotes}
                  />
                </CardWrapper>
              </div>
            );
          }

          return card;
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-center items-center gap-8 pb-2">
        {/* Downvote */}
        <button
          className="w-14 h-14 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          onClick={() => canSwipe && onSwipe("left", creators[currentIndex])}
          disabled={!canSwipe}
          title="Downvote"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Skip */}
        <button
          className="w-11 h-11 rounded-full border border-white/20 text-white/50 hover:bg-white/5 flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          onClick={handleSkip}
          disabled={!canSwipe}
          title="Skip"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8.689c0-.864.933-1.405 1.683-.974l7.108 4.086a1.125 1.125 0 010 1.953l-7.108 4.086A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.405 1.683-.974l7.108 4.086a1.125 1.125 0 010 1.953l-7.108 4.086a1.125 1.125 0 01-1.683-.974V8.69z"
            />
          </svg>
        </button>

        {/* Upvote */}
        <button
          className="w-14 h-14 rounded-full border border-green-500/30 text-green-400 hover:bg-green-500/10 flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          onClick={() => canSwipe && onSwipe("right", creators[currentIndex])}
          disabled={!canSwipe}
          title="Upvote"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Voting overlay */}
      {voting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#6E54FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-mono text-sm">Submitting vote...</p>
            <p className="text-white/30 text-xs font-mono">Staking 0.01 MON</p>
          </div>
        </div>
      )}
    </div>
  );
};
