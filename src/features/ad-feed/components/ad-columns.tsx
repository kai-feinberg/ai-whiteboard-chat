"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { Ad } from "../types";
import { useState } from "react";

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
