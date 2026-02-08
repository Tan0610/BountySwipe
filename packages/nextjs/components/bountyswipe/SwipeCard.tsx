"use client";

interface SwipeCardProps {
  creator: string;
  contentURI: string;
  upvotes: bigint;
  downvotes: bigint;
}

/**
 * Monad-styled fullscreen swipe card.
 * Video fills the entire card as background. Creator info overlaid at bottom.
 */
export const SwipeCard = ({ creator, contentURI, upvotes, downvotes }: SwipeCardProps) => {
  const addressColor = `#${creator.slice(2, 8)}`;

  const isVideo = /\.(mp4|webm|mov)$/i.test(contentURI);
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(contentURI) || contentURI.includes("ipfs");

  return (
    <div className="relative w-full max-w-[400px] h-[70vh] rounded-2xl overflow-hidden bg-[#05050B] select-none">
      {/* Hero media background */}
      {isVideo ? (
        <video
          src={contentURI}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isImage ? (
        <img
          src={contentURI}
          alt="Creator submission"
          className="absolute inset-0 w-full h-full object-cover"
          onError={e => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        /* Non-media: dark gradient with centered icon */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0E091C] to-[#05050B] gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span className="text-white/30 text-sm font-mono">External content</span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* External link button — top right */}
      <a
        href={contentURI}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        onClick={e => e.stopPropagation()}
        title="View full content"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
          />
        </svg>
      </a>

      {/* Bottom overlay content */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 flex items-end justify-between">
        {/* Creator info */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full shrink-0"
            style={{ backgroundColor: addressColor }}
          />
          <span className="font-mono text-sm text-white/80">
            {creator.slice(0, 6)}...{creator.slice(-4)}
          </span>
        </div>

        {/* Vote count pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-green-500/15 rounded-full px-2.5 py-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            <span className="text-green-400 text-xs font-mono">{upvotes.toString()}</span>
          </div>
          <div className="flex items-center gap-1 bg-red-500/15 rounded-full px-2.5 py-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
            </svg>
            <span className="text-red-400 text-xs font-mono">{downvotes.toString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
