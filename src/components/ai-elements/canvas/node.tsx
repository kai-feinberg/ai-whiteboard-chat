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
      "node-container relative size-full h-auto gap-0 rounded-2xl p-0 border-2",
      "shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]",
      "hover:shadow-[0_8px_24px_rgba(0,0,0,0.08),0_4px_8px_rgba(0,0,0,0.06)]",
      "hover:-translate-y-1",
      "transition-all duration-300 ease-out",
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
  youtube: "bg-gradient-to-br from-orange-50 to-orange-100/70 text-orange-800 border-orange-200/60",
  website: "bg-gradient-to-br from-sky-50 to-cyan-100/70 text-cyan-900 border-cyan-200/60",
  chat: "bg-gradient-to-br from-rose-50 to-rose-100/70 text-rose-900 border-rose-200/60",
  tiktok: "bg-gradient-to-br from-fuchsia-50 to-pink-100/70 text-fuchsia-900 border-fuchsia-200/60",
  facebook: "bg-gradient-to-br from-indigo-50 to-indigo-100/70 text-indigo-900 border-indigo-200/60",
  text: "bg-gradient-to-br from-stone-50 to-stone-100/70 text-stone-800 border-stone-200/60",
  group: "bg-gradient-to-br from-amber-50 to-yellow-100/70 text-amber-900 border-amber-200/60",
};

export const NodeHeader = ({ className, variant = "default", ...props }: NodeHeaderProps) => (
  <CardHeader
    className={cn("gap-0.5 rounded-t-2xl border-b p-4!", headerVariants[variant], className)}
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
  <CardContent className={cn("p-4", className)} {...props} />
);

export type NodeFooterProps = ComponentProps<typeof CardFooter>;

export const NodeFooter = ({ className, ...props }: NodeFooterProps) => (
  <CardFooter
    className={cn("rounded-b-2xl border-t bg-secondary/50 p-4!", className)}
    {...props}
  />
);
