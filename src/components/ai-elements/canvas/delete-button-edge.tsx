import { memo, useState, useId } from "react";
import {
  type EdgeProps,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  Position,
} from "@xyflow/react";
import { Trash, TrashIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Id } from "../../../../convex/_generated/dataModel";

// Helper functions from original Animated edge
const getHandleCoordsByPosition = (node: any, handlePosition: Position) => {
  const handleType = handlePosition === Position.Left ? "target" : "source";
  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h: any) => h.position === handlePosition
  );

  if (!handle) return [0, 0] as const;

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

const getEdgeParams = (source: any, target: any) => {
  const sourcePos = Position.Right;
  const [sx, sy] = getHandleCoordsByPosition(source, sourcePos);
  const targetPos = Position.Left;
  const [tx, ty] = getHandleCoordsByPosition(target, targetPos);

  return { sx, sy, tx, ty, sourcePos, targetPos };
};

export const DeleteButtonEdge = memo((props: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const { id, data, source, target, markerEnd, style } = props;
  const gradientId = useId();

  // Get hover state from data prop (passed from parent)
  const isHovered = data?.isHovered || false;

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  const onDelete = async () => {
    if (data?.deleteEdge) {
      try {
        await data.deleteEdge({ edgeId: id as Id<"canvas_edges"> });
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
      } catch (error) {
        console.error("[DeleteButtonEdge] Error deleting edge:", error);
      }
    }
  };

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--chart-1)" />
          <stop offset="50%" stopColor="var(--chart-2)" />
          <stop offset="100%" stopColor="var(--chart-4)" />
        </linearGradient>
      </defs>

      {/* DEBUG: Visible wide path for larger hitbox */}
      <path
        d={edgePath}
        fill="none"
        // stroke="rgba(255, 0, 0, 0.3)"
        stroke="transparent"
        strokeWidth={40}
        style={{ cursor: "pointer" }}
      />

      {/* Visible styled edge with gradient and animation */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 8,
          stroke: `url(#${gradientId})`,
          strokeDasharray: "12, 8",
        }}
      />

      {/* Animated circle */}
      <circle fill="var(--chart-3)" r="6" opacity="0.4">
        <animateMotion dur="4s" path={edgePath} repeatCount="indefinite" />
      </circle>

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <Button
            onClick={onDelete}
            variant="destructive"
            className="h-12 w-12 p-2 transition-opacity flex items-center justify-center"
            style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? "auto" : "none" }}
          >
            <TrashIcon className="h-12 w-12"/>
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

DeleteButtonEdge.displayName = "DeleteButtonEdge";
