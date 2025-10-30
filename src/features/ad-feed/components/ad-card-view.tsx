import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Clock, Calendar } from "lucide-react";
import { useState } from "react";
import type { Ad } from "../types";
import {
  generateAdLibraryUrl,
  formatDuration,
  formatTimeline,
  formatFollowerCount,
  PLATFORM_INFO,
  getAdFormatInfo,
  getStatusBadge,
} from "../utils";
import { VideoPlayer } from "./video-player";

interface AdCardViewProps {
  ads: Ad[];
}

export function AdCardView({ ads }: AdCardViewProps) {
  const [expandedAds, setExpandedAds] = useState<Set<string>>(new Set());
  if (ads.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No ads found. Create a subscription to start tracking ads!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {ads.map((ad) => {
        const adLibraryUrl = generateAdLibraryUrl(ad.adId, ad.platform);
        const timeline = formatTimeline(ad.startDate, ad.endDate, ad.isActive);
        const duration = formatDuration(
          ad.startDate,
          ad.endDate,
          ad.totalActiveTime,
          ad.isActive
        );
        const statusBadge = getStatusBadge(ad.isActive);
        const formatInfo = getAdFormatInfo(ad);

        // Check if this ad has video
        const hasVideo = ad.hasVideo || ad.displayFormat === "VIDEO" || (ad.videoCount && ad.videoCount > 0);

        return (
          <Card key={ad._id} className="group overflow-hidden hover:shadow-lg transition-shadow duration-200">
            {/* Header: Advertiser Info and Title */}
            <CardHeader className="pb-3">
              {/* Advertiser Info */}
              {ad.advertiser && (
                <div className="flex items-center gap-2 mb-3">
                  {ad.advertiser.pageProfilePictureUrl && (
                    <img
                      src={ad.advertiser.pageProfilePictureUrl}
                      alt={ad.advertiser.pageName}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-muted"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {ad.advertiser.pageName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {ad.advertiser.pageCategories[0]} •{" "}
                      {formatFollowerCount(ad.advertiser.pageLikeCount)} followers
                    </div>
                  </div>
                  {adLibraryUrl && (
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                      <a
                        href={adLibraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {/* Title/Caption */}
              <div className="space-y-1">
                <CardTitle className="text-base line-clamp-2 leading-snug">
                  {ad.title}
                </CardTitle>
                {ad.caption && ad.caption !== ad.title && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {ad.caption}
                  </p>
                )}
              </div>
            </CardHeader>

            {/* Media Preview with Overlays */}
            {ad.thumbnailUrl && (
              <div className="relative w-full aspect-video overflow-hidden bg-black">
                {hasVideo ? (
                  <VideoPlayer
                    storageId={ad.mediaItems?.[0]?.storageId || ad.mediaStorageIds?.[0]}
                    adId={ad._id}
                    url={ad.mediaItems?.[0]?.url || undefined}
                    thumbnail={ad.thumbnailUrl}
                    className="w-full h-full object-contain"
                    showPlayOverlay={true}
                  />
                ) : (
                  <img
                    src={ad.thumbnailUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                {/* Status Badge Overlay */}
                {ad.isActive !== undefined && (
                  <div className="absolute top-3 left-3">
                    <Badge
                      variant={statusBadge.variant}
                      className="shadow-md backdrop-blur-sm bg-opacity-90"
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>
                )}

                {/* Platform Badges Overlay */}
                {ad.publisherPlatforms && ad.publisherPlatforms.length > 0 && (
                  <div className="absolute top-3 right-3 flex gap-1">
                    {ad.publisherPlatforms.slice(0, 3).map((platform) => {
                      const info = PLATFORM_INFO[platform] || {
                        name: platform,
                        emoji: "📱",
                        color: "bg-gray-100 text-gray-800",
                      };
                      return (
                        <div
                          key={platform}
                          className="bg-white/90 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow-md text-sm"
                          title={info.name}
                        >
                          {info.emoji}
                        </div>
                      );
                    })}
                    {ad.publisherPlatforms.length > 3 && (
                      <div className="bg-white/90 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow-md text-xs font-medium">
                        +{ad.publisherPlatforms.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {/* Format Info Overlay */}
                {formatInfo && (
                  <div className="absolute bottom-3 left-3">
                    <Badge
                      variant="secondary"
                      className="shadow-md backdrop-blur-sm bg-black/60 text-white border-0"
                    >
                      {formatInfo.emoji} {formatInfo.label}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Description Section */}
            <div className="px-6 py-3">
              <CardDescription
                className={
                  expandedAds.has(ad._id) ? "" : "line-clamp-3 cursor-pointer"
                }
                onClick={() => {
                  const newExpanded = new Set(expandedAds);
                  if (newExpanded.has(ad._id)) {
                    newExpanded.delete(ad._id);
                  } else {
                    newExpanded.add(ad._id);
                  }
                  setExpandedAds(newExpanded);
                }}
              >
                {ad.description}
              </CardDescription>
              {ad.description.length > 150 && (
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedAds);
                    if (newExpanded.has(ad._id)) {
                      newExpanded.delete(ad._id);
                    } else {
                      newExpanded.add(ad._id);
                    }
                    setExpandedAds(newExpanded);
                  }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {expandedAds.has(ad._id) ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {/* Footer Content */}
            <CardContent className="space-y-3 pt-0">
              {/* Timeline and Duration */}
              <div className="flex items-center gap-3 text-sm flex-wrap">
                {timeline && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{timeline}</span>
                  </div>
                )}
                {ad.totalActiveTime !== undefined && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{duration}</span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {ad.ctaText && ad.ctaText !== "No button" && (
                <div className="pt-1">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    {ad.ctaText}
                  </Badge>
                </div>
              )}

              {/* Performance Metrics */}
              {(ad.reachEstimate || ad.spend) && (
                <div className="flex gap-3 text-xs text-muted-foreground pt-2 border-t">
                  {ad.reachEstimate && (
                    <div>
                      <span className="font-medium">Reach:</span>{" "}
                      {ad.reachEstimate.lower.toLocaleString()}-
                      {ad.reachEstimate.upper.toLocaleString()}
                    </div>
                  )}
                  {ad.spend && (
                    <div>
                      <span className="font-medium">Spend:</span>{" "}
                      {ad.spend.currency}
                      {ad.spend.lower}-{ad.spend.upper}
                    </div>
                  )}
                </div>
              )}

              {/* Footer with Scraped Date */}
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                <span>Scraped {new Date(ad.scrapedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
