import { Play } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface VideoPlayerProps {
  url?: string; // Optional: may be provided for backward compatibility
  storageId?: string; // Storage ID for lazy loading
  adId?: string; // Ad ID for authorization check
  thumbnail?: string;
  className?: string;
  showPlayOverlay?: boolean;
}

export function VideoPlayer({
  url: initialUrl,
  storageId,
  adId,
  thumbnail,
  className = "w-full h-full object-cover",
  showPlayOverlay = false,
}: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(initialUrl || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideo = useMutation(api.competitorAds.functions.getVideoUrl);

  const handlePlayClick = async () => {
    // If URL already loaded, just play
    if (videoUrl) {
      setIsPlaying(true);
      return;
    }

    // Lazy load video URL on first play
    if (storageId && adId) {
      setIsLoading(true);
      setError(null);
      try {
        const url = await loadVideo({
          adId: adId as Id<"competitorAds">,
          storageId: storageId as Id<"_storage">,
        });
        setVideoUrl(url);
        setIsPlaying(true);
      } catch (err) {
        console.error("Failed to load video:", err);
        setError("Failed to load video. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // If we have a video URL, show the video player
  if (videoUrl) {
    return (
      <div className="relative w-full h-full">
        <video
          src={videoUrl}
          poster={thumbnail}
          controls
          preload="none"
          className={className}
          onPlay={() => setIsPlaying(true)}
        >
          Your browser does not support video playback.
        </video>

        {/* Optional play overlay (only shown before playing) */}
        {showPlayOverlay && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="bg-white/90 rounded-full p-4 shadow-lg">
              <Play className="h-8 w-8 text-gray-900 fill-gray-900" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show thumbnail with click-to-load overlay
  return (
    <div
      className="relative w-full h-full cursor-pointer bg-black/5"
      onClick={handlePlayClick}
    >
      {thumbnail && (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className={className}
        />
      )}

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isLoading ? (
          <div className="bg-white/90 rounded-full p-4 shadow-lg">
            <div className="h-8 w-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/90 text-white rounded-lg p-4 shadow-lg max-w-xs text-center">
            <p className="text-sm">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayClick();
              }}
              className="mt-2 text-xs underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-white/90 rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-gray-900 fill-gray-900" />
          </div>
        )}
      </div>

    </div>
  );
}
