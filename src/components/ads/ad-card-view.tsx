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
import type { Ad } from "./ad-columns";

interface AdCardViewProps {
  ads: Ad[];
}

export function AdCardView({ ads }: AdCardViewProps) {
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
            <CardDescription className="line-clamp-3">
              {ad.description}
            </CardDescription>
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
