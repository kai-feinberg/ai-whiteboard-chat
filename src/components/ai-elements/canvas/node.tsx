import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Handle, Position } from "@xyflow/react";
import type { ComponentProps } from "react";

export type NodeProps = ComponentProps<typeof Card> & {
  handles: {
    target: boolean;
    source: boolean;
  };
  width?: string;
  height?: string;
};

export const Node = ({ handles, className, width, height, ...props }: NodeProps) => (
  <Card
    className={cn(
      "node-container relative size-full h-auto gap-0 rounded-md p-0",
      !width && "w-sm",
      className
    )}
    style={{
      ...(width && { width }),
      ...(height && { height }),
    }}
    {...props}
  >
    {handles.target && <Handle position={Position.Left} type="target" />}
    {handles.source && <Handle position={Position.Right} type="source" />}
    {props.children}
  </Card>
);

export type NodeHeaderProps = ComponentProps<typeof CardHeader> & {
  variant?: "default" | "youtube" | "website" | "chat" | "tiktok" | "facebook" | "text" | "group";
};

const headerVariants = {
  default: "bg-secondary",
  youtube: "bg-gradient-to-r from-red-50 to-red-100/50 text-red-600 border-red-200",
  website: "bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-600 border-blue-200",
  chat: "bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-600 border-purple-200",
  tiktok: "bg-gradient-to-r from-cyan-50 to-pink-100/50 text-pink-600 border-pink-200",
  facebook: "bg-gradient-to-r from-blue-50 to-indigo-100/50 text-indigo-600 border-indigo-200",
  text: "bg-gradient-to-r from-slate-50 to-slate-100/50 text-slate-600 border-slate-200",
  group: "bg-gradient-to-r from-amber-50 to-orange-100/50 text-orange-600 border-orange-200",
};

export const NodeHeader = ({ className, variant = "default", ...props }: NodeHeaderProps) => (
  <CardHeader
    className={cn("gap-0.5 rounded-t-md border-b p-3!", headerVariants[variant], className)}
    {...props}
  />
);

export type NodeTitleProps = ComponentProps<typeof CardTitle>;

export const NodeTitle = (props: NodeTitleProps) => <CardTitle {...props} />;

export type NodeDescriptionProps = ComponentProps<typeof CardDescription>;

export const NodeDescription = (props: NodeDescriptionProps) => (
  <CardDescription {...props} />
);

export type NodeActionProps = ComponentProps<typeof CardAction>;

export const NodeAction = (props: NodeActionProps) => <CardAction {...props} />;

export type NodeContentProps = ComponentProps<typeof CardContent>;

export const NodeContent = ({ className, ...props }: NodeContentProps) => (
  <CardContent className={cn("p-3", className)} {...props} />
);

export type NodeFooterProps = ComponentProps<typeof CardFooter>;

export const NodeFooter = ({ className, ...props }: NodeFooterProps) => (
  <CardFooter
    className={cn("rounded-b-md border-t bg-secondary p-3!", className)}
    {...props}
  />
);
