import type { Ad } from "./types";

/**
 * Generate Facebook Ad Library URL from ad ID
 */
export function generateAdLibraryUrl(
  adId: string,
  platform: string
): string | null {
  if (platform.toLowerCase() === "facebook") {
    return `https://www.facebook.com/ads/library?id=${adId}`;
  }
  // Add other platforms as needed
  return null;
}

/**
 * Format ad duration as human-readable string
 * Examples: "Active for 7 days", "Ran for 3 days", "Less than a day"
 */
export function formatDuration(
  startDate?: number,
  endDate?: number,
  totalActiveTime?: number,
  isActive?: boolean
): string {
  if (!startDate && !totalActiveTime) {
    return "Unknown duration";
  }

  const seconds = totalActiveTime || 0;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days === 0 && hours === 0) {
    return isActive ? "Active < 1 hour" : "Ran < 1 hour";
  }

  if (days === 0) {
    return isActive ? `Active for ${hours}h` : `Ran for ${hours}h`;
  }

  if (hours === 0) {
    return isActive
      ? `Active for ${days} day${days > 1 ? "s" : ""}`
      : `Ran for ${days} day${days > 1 ? "s" : ""}`;
  }

  return isActive
    ? `Active for ${days}d ${hours}h`
    : `Ran for ${days}d ${hours}h`;
}

/**
 * Format ad timeline with start/end dates
 * Examples: "Jan 15 → ongoing", "Jan 15 → Feb 10", "Started Jan 15"
 */
export function formatTimeline(
  startDate?: number,
  endDate?: number,
  isActive?: boolean
): string | null {
  if (!startDate) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const start = formatDate(startDate);

  if (isActive || !endDate) {
    return `${start} → ongoing`;
  }

  const end = formatDate(endDate);
  return `${start} → ${end}`;
}

/**
 * Format follower count with K/M suffix
 * Examples: "1.2K", "3.5M", "234"
 */
export function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Get platform display names and icons
 */
export const PLATFORM_INFO: Record<
  string,
  { name: string; emoji: string; color: string }
> = {
  FACEBOOK: { name: "Facebook", emoji: "📘", color: "bg-blue-100 text-blue-800" },
  INSTAGRAM: {
    name: "Instagram",
    emoji: "📷",
    color: "bg-pink-100 text-pink-800",
  },
  MESSENGER: {
    name: "Messenger",
    emoji: "💬",
    color: "bg-purple-100 text-purple-800",
  },
  AUDIENCE_NETWORK: {
    name: "Audience Network",
    emoji: "🌐",
    color: "bg-gray-100 text-gray-800",
  },
  THREADS: { name: "Threads", emoji: "🧵", color: "bg-black text-white" },
  WHATSAPP: { name: "WhatsApp", emoji: "📱", color: "bg-green-100 text-green-800" },
};

/**
 * Get ad format display info
 */
export function getAdFormatInfo(ad: Ad): {
  label: string;
  emoji: string;
} | null {
  if (!ad.displayFormat) return null;

  const format = ad.displayFormat.toUpperCase();

  if (format === "VIDEO" || ad.hasVideo) {
    const count = ad.videoCount || 1;
    return {
      label: count > 1 ? `Video (${count})` : "Video",
      emoji: "🎥",
    };
  }

  if (format === "MULTI_IMAGES" || (ad.imageCount && ad.imageCount > 1)) {
    return {
      label: `Multi-Image (${ad.imageCount || "multiple"})`,
      emoji: "📸",
    };
  }

  if (format === "DCO") {
    const cardCount = ad.cards?.length || 0;
    return {
      label: cardCount > 0 ? `Carousel (${cardCount})` : "Carousel",
      emoji: "🎠",
    };
  }

  if (format === "SINGLE_IMAGE" || ad.imageCount === 1) {
    return {
      label: "Image",
      emoji: "🖼️",
    };
  }

  return {
    label: format.replace(/_/g, " "),
    emoji: "📄",
  };
}

/**
 * Get status badge info
 */
export function getStatusBadge(
  isActive?: boolean
): { label: string; variant: "default" | "secondary" | "outline" } {
  if (isActive === undefined) {
    return { label: "Unknown", variant: "outline" };
  }

  return isActive
    ? { label: "Active", variant: "default" }
    : { label: "Ended", variant: "secondary" };
}
