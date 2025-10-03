"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { DataTableColumnHeader } from "../table/data-table-column-header";

export type Ad = {
  _id: string;
  _creationTime: number;
  userId: string;
  subscriptionId: string;
  platform: string;
  adId: string;
  title: string;
  description: string;
  link?: string;
  mediaUrls: string[];
  thumbnailUrl?: string;
  scrapedAt: number;
  rawData?: any;
};

export const adColumns: ColumnDef<Ad>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ad Title" />
    ),
    cell: ({ row }) => {
      const ad = row.original;
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
            <span className="text-xs text-muted-foreground max-w-[400px] truncate">
              {ad.description}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "platform",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Platform" />
    ),
    cell: ({ row }) => {
      const platform = row.getValue("platform") as string;
      return (
        <Badge variant="secondary" className="capitalize">
          {platform}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "scrapedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scraped" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("scrapedAt"));
      return (
        <div className="text-sm">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const ad = row.original;
      return (
        <div className="flex gap-2">
          {ad.link && (
            <Button variant="ghost" size="sm" asChild>
              <a href={ad.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      );
    },
  },
];
