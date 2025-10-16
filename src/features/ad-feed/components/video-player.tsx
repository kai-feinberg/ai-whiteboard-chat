import { Play } from "lucide-react";
import { useState } from "react";

interface VideoPlayerProps {
  url: string;
  thumbnail?: string;
  className?: string;
  showPlayOverlay?: boolean;
}

export function VideoPlayer({
  url,
  thumbnail,
  className = "w-full h-full object-cover",
  showPlayOverlay = false,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full h-full">
      <video
        src={url}
        poster={thumbnail}
        controls
        preload="metadata"
        className={className}
        onPlay={handlePlay}
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
