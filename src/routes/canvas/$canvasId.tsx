// src/routes/canvas/$canvasId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Canvas } from "@/components/ai-elements/canvas/canvas";
import { Panel } from "@/components/ai-elements/canvas/panel";
import { Button } from "@/components/ui/button";
import { TextNode } from "@/features/canvas/components/TextNode";
import { ChatNode } from "@/features/canvas/components/ChatNode";
import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";
import { FileText, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/canvas/$canvasId")({
  component: CanvasEditor,
});

const nodeTypes: NodeTypes = {
  text: TextNode,
  chat: ChatNode,
};

function CanvasEditor() {
  const { canvasId } = Route.useParams();
  const { orgId } = useAuth();
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false);

  // Queries and mutations
  const canvasData = useQuery(
    api.canvas.functions.getCanvasWithNodes,
    { canvasId: canvasId as Id<"canvases"> }
  );
  const createTextNode = useMutation(api.canvas.nodes.createTextNode);
  const createChatNode = useAction(api.canvas.nodes.createChatNode);
  const createEdge = useMutation(api.canvas.edges.createEdge);
  const deleteNode = useMutation(api.canvas.nodes.deleteNode);
  const deleteEdge = useMutation(api.canvas.edges.deleteEdge);
  const updateNodePosition = useMutation(api.canvas.nodes.updateNodePosition);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load canvas data from DB on mount
  useEffect(() => {
    if (!hasLoadedFromDB && canvasData?.nodes && canvasData?.edges) {
      // Map database nodes to ReactFlow nodes
      const flowNodes: Node[] = canvasData.nodes.map((dbNode) => {
        const nodeData = {
          canvasNodeId: dbNode._id,
          content: (dbNode as any).textContent,
          chatNodeId: (dbNode as any).chatNodeId,
          canvasId: canvasId as Id<"canvases">, // Use canvasId from route params
          selectedThreadId: (dbNode as any).selectedThreadId,
          selectedAgentThreadId: (dbNode as any).selectedAgentThreadId,
        };

        // Debug logging for chat nodes
        if (dbNode.nodeType === "chat") {
          console.log("[Canvas] Loading chat node:", {
            nodeId: dbNode._id,
            chatNodeId: nodeData.chatNodeId,
            canvasId: nodeData.canvasId,
            selectedThreadId: nodeData.selectedThreadId,
          });
        }

        return {
          id: dbNode._id,
          type: dbNode.nodeType,
          position: dbNode.position,
          data: nodeData,
        };
      });

      // Map database edges to ReactFlow edges
      const flowEdges: Edge[] = canvasData.edges.map((dbEdge) => ({
        id: dbEdge._id,
        source: dbEdge.source,
        target: dbEdge.target,
        sourceHandle: dbEdge.sourceHandle,
        targetHandle: dbEdge.targetHandle,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setHasLoadedFromDB(true);
    }
  }, [canvasData, hasLoadedFromDB, setNodes, setEdges]);

  // Handle connection between nodes
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        // Create edge in database
        await createEdge({
          canvasId: canvasId as Id<"canvases">,
          source: connection.source as Id<"canvas_nodes">,
          target: connection.target as Id<"canvas_nodes">,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
        });

        // Update local state
        setEdges((eds) => addEdge(connection, eds));
        toast.success("Nodes connected");
      } catch (error) {
        console.error("[Canvas] Error creating edge:", error);
        toast.error("Failed to connect nodes");
      }
    },
    [createEdge, setEdges, canvasId]
  );

  // Handle node drag end (save position to DB)
  const onNodeDragStop = useCallback(
    async (_event: any, node: Node) => {
      try {
        await updateNodePosition({
          canvasNodeId: node.id as Id<"canvas_nodes">,
          position: node.position,
        });
      } catch (error) {
        console.error("[Canvas] Error updating node position:", error);
      }
    },
    [updateNodePosition]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        try {
          await deleteNode({
            canvasNodeId: node.id as Id<"canvas_nodes">,
          });
        } catch (error) {
          console.error("[Canvas] Error deleting node:", error);
          toast.error("Failed to delete node");
        }
      }
    },
    [deleteNode]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        try {
          await deleteEdge({
            edgeId: edge.id as Id<"canvas_edges">,
          });
        } catch (error) {
          console.error("[Canvas] Error deleting edge:", error);
          toast.error("Failed to delete edge");
        }
      }
    },
    [deleteEdge]
  );

  // Add text node
  const handleAddTextNode = async () => {
    try {
      const result = await createTextNode({
        canvasId: canvasId as Id<"canvases">,
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        content: "",
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "text",
          position: { x: Math.random() * 400, y: Math.random() * 400 },
          data: {
            canvasNodeId: result.canvasNodeId,
            content: "",
          },
        },
      ]);

      toast.success("Text node created");
    } catch (error) {
      console.error("[Canvas] Error creating text node:", error);
      toast.error("Failed to create text node");
    }
  };

  // Add chat node
  const handleAddChatNode = async () => {
    try {
      const result = await createChatNode({
        canvasId: canvasId as Id<"canvases">,
        position: { x: Math.random() * 400, y: Math.random() * 400 },
      });

      // Reload canvas data to get the full chat node data
      toast.success("Chat node created");
    } catch (error) {
      console.error("[Canvas] Error creating chat node:", error);
      toast.error("Failed to create chat node");
    }
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to view this canvas.
          </p>
        </div>
      </div>
    );
  }

  if (!canvasData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
      >
        <Panel position="top-left">
          <div className="flex items-center gap-2 p-2">
            <Button
              onClick={handleAddTextNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Add Text
            </Button>
            <Button
              onClick={handleAddChatNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Add Chat
            </Button>
          </div>
        </Panel>
      </Canvas>
    </div>
  );
}
