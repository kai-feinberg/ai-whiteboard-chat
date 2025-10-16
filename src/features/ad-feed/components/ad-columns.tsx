"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { Ad } from "../types";
import { useState } from "react";
import {
  generateAdLibraryUrl,
  formatDuration,
  formatFollowerCount,
  PLATFORM_INFO,
  getStatusBadge,
} from "../utils";

function AdTitleCell({ ad }: { ad: Ad }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {ad.thumbnailUrl && (
        <img
          src={ad.thumbnailUrl}
          alt={ad.title}
          className="w-12 h-12 rounded object-cover"
        />
      )}
      <div className="flex flex-col">
        <span className="font-medium max-w-[400px] truncate">
          {ad.title}
        </span>
        <span
          className={`text-xs text-muted-foreground max-w-[400px] ${
            isExpanded ? "" : "truncate cursor-pointer"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {ad.description}
        </span>
        {ad.description.length > 60 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary hover:underline text-left w-fit"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

export const adColumns: ColumnDef<Ad>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ad Title" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
      return <AdTitleCell ad={ad} />;
    },
  },
  {
    id: "advertiser",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Advertiser" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
      if (!ad.advertiser) return <span className="text-muted-foreground">-</span>;

      return (
        <div className="flex items-center gap-2">
          {ad.advertiser.pageProfilePictureUrl && (
            <img
              src={ad.advertiser.pageProfilePictureUrl}
              alt={ad.advertiser.pageName}
              className="w-6 h-6 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate max-w-[150px]">
              {ad.advertiser.pageName}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {formatFollowerCount(ad.advertiser.pageLikeCount)} followers
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "status",
    accessorKey: "isActive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
      const statusBadge = getStatusBadge(ad.isActive);
      return <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>;
    },
    filterFn: (row, id, value) => {
      const ad = row.original;
      if (ad.isActive === undefined) return false;
      return value.includes(ad.isActive ? "active" : "ended");
    },
  },
  {
    id: "duration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
      if (!ad.startDate && !ad.totalActiveTime) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }

      const duration = formatDuration(
        ad.startDate,
        ad.endDate,
        ad.totalActiveTime,
        ad.isActive
      );
      return <div className="text-sm">{duration}</div>;
    },
  },
  {
    id: "platforms",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Platforms" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
      if (!ad.publisherPlatforms || ad.publisherPlatforms.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }

      return (
        <div className="flex gap-1 flex-wrap">
          {ad.publisherPlatforms.slice(0, 3).map((platform) => {
            const info = PLATFORM_INFO[platform] || {
              name: platform,
              emoji: "📱",
              color: "bg-gray-100 text-gray-800",
            };
            return (
              <Badge
                key={platform}
                variant="outline"
                className="text-xs"
                title={info.name}
              >
                {info.emoji}
              </Badge>
            );
          })}
          {ad.publisherPlatforms.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{ad.publisherPlatforms.length - 3}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start Date" />
    ),
    cell: ({ row }) => {
      const startDate = row.getValue("startDate") as number | undefined;
      if (!startDate) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }
      const date = new Date(startDate);
      return <div className="text-sm">{date.toLocaleDateString()}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const ad = row.original;
      const adLibraryUrl = generateAdLibraryUrl(ad.adId, ad.platform);

      return (
        <div className="flex gap-2">
          {adLibraryUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={adLibraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View in Ad Library"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      );
    },
  },
];
