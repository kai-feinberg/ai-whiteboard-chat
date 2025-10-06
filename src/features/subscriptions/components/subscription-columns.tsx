"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DataTableColumnHeader } from "@/components/table/data-table-column-header";
import { Subscription } from "../types";

export const createSubscriptionColumns = (
  onDelete: (id: string) => void
): ColumnDef<Subscription>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const sub = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {sub.searchTerm || sub.company}
          </span>
          <span className="text-xs text-muted-foreground">
            {sub.searchTerm ? "Search Term" : "Company"}
          </span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const sub = row.original;
      const searchValue = value.toLowerCase();
      return (
        (sub.searchTerm?.toLowerCase().includes(searchValue) ?? false) ||
        (sub.company?.toLowerCase().includes(searchValue) ?? false)
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
    accessorKey: "frequency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Frequency" />
    ),
    cell: ({ row }) => {
      const frequency = row.getValue("frequency") as string;
      return (
        <Badge variant="outline" className="capitalize">
          {frequency}
        </Badge>
      );
    },
  },
  {
    accessorKey: "isActive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean;
      return (
        <Badge variant={isActive ? "default" : "destructive"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "_creationTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("_creationTime"));
      return (
        <div className="text-sm">
          {date.toLocaleDateString()}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const sub = row.original;
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(sub._id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];
