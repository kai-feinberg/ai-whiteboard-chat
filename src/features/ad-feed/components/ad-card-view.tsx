import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Ad } from "./ad-columns";

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
      {ads.map((ad) => (
        <Card key={ad._id} className="overflow-hidden">
          {ad.thumbnailUrl && (
            <div className="aspect-video w-full overflow-hidden bg-muted">
              <img
                src={ad.thumbnailUrl}
                alt={ad.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardHeader>
            <div className="flex justify-between items-start gap-2">
              <CardTitle className="text-lg line-clamp-2">{ad.title}</CardTitle>
              {ad.link && (
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <a href={ad.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            <CardDescription
              className={expandedAds.has(ad._id) ? "" : "line-clamp-3 cursor-pointer"}
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
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize">
                  {ad.platform}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(ad.scrapedAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
