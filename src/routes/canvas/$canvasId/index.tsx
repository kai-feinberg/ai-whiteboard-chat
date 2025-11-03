// src/routes/canvas/$canvasId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Canvas } from "@/components/ai-elements/canvas/canvas";
import { Panel } from "@/components/ai-elements/canvas/panel";
import { Edge as CustomEdge } from "@/components/ai-elements/canvas/edge";
import { Button } from "@/components/ui/button";
import { TextNode } from "@/features/canvas/components/TextNode";
import { ChatNode } from "@/features/canvas/components/ChatNode";
import { YouTubeNode } from "@/features/canvas/components/YouTubeNode";
import { WebsiteNode } from "@/features/canvas/components/WebsiteNode";
import { TikTokNode } from "@/features/canvas/components/TikTokNode";
import { FacebookAdNode } from "@/features/canvas/components/FacebookAdNode";
import { GroupNode } from "@/features/canvas/components/GroupNode";
import { useCallback, useEffect, useState, createContext, useContext } from "react";

// Context for canvas operations (like ungrouping)
const CanvasContext = createContext<{
  onNodeUngrouped?: (nodeData: any) => void;
}>({});

export const useCanvasContext = () => useContext(CanvasContext);
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { FileText, MessageSquare, Loader2, Video, Globe, Folder } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { UrlInputDialog } from "@/components/canvas/UrlInputDialog";

export const Route = createFileRoute("/canvas/$canvasId/")({
  component: CanvasEditor,
});

const nodeTypes: NodeTypes = {
  text: TextNode,
  chat: ChatNode,
  youtube: YouTubeNode,
  website: WebsiteNode,
  tiktok: TikTokNode,
  facebook_ad: FacebookAdNode,
  group: GroupNode,
};

const edgeTypes: EdgeTypes = {
  animated: CustomEdge.Animated,
  temporary: CustomEdge.Temporary,
};

function CanvasEditor() {
  const { canvasId } = Route.useParams();
  const { orgId } = useAuth();
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false);

  // Dialog state
  const [dialogState, setDialogState] = useState<{
    type: "youtube" | "website" | "tiktok" | "facebook" | null;
    open: boolean;
  }>({ type: null, open: false });

  // Queries and mutations
  const canvasData = useQuery(
    api.canvas.functions.getCanvasWithNodes,
    { canvasId: canvasId as Id<"canvases"> }
  );
  const createTextNode = useMutation(api.canvas.nodes.createTextNode);
  const createChatNode = useAction(api.canvas.nodes.createChatNode);
  const createYouTubeNode = useAction(api.canvas.youtube.createYouTubeNode);
  const createWebsiteNode = useAction(api.canvas.website.createWebsiteNode);
  const createTikTokNode = useAction(api.canvas.tiktok.createTikTokNode);
  const createFacebookAdNode = useAction(api.canvas.facebook.createFacebookAdNode);
  const createGroup = useMutation(api.canvas.groups.createGroup);
  const addNodeToGroup = useMutation(api.canvas.groups.addNodeToGroup);
  const removeNodeFromGroup = useMutation(api.canvas.groups.removeNodeFromGroup);
  const createEdge = useMutation(api.canvas.edges.createEdge);
  const deleteNode = useMutation(api.canvas.nodes.deleteNode);
  const deleteEdge = useMutation(api.canvas.edges.deleteEdge);
  const updateNodePosition = useMutation(api.canvas.nodes.updateNodePosition);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Handler for when a node is ungrouped - add it back to React Flow
  // MUST be before conditional returns to avoid hooks order issues
  const handleNodeUngrouped = useCallback((nodeData: any) => {
    console.log("[Canvas] Node ungrouped, adding back to React Flow:", nodeData);

    // Create React Flow node from DB node data
    const flowNode: Node = {
      id: nodeData._id,
      type: nodeData.nodeType,
      position: nodeData.position,
      data: {
        canvasNodeId: nodeData._id,
        // Add other data fields as needed
        content: nodeData.textContent,
        chatNodeId: nodeData.chatNodeId,
        youtubeNodeId: nodeData.youtubeNodeId,
        websiteNodeId: nodeData.websiteNodeId,
        tiktokNodeId: nodeData.tiktokNodeId,
        facebookAdNodeId: nodeData.facebookAdNodeId,
        canvasId: canvasId as Id<"canvases">,
      },
      draggable: true,
    };

    // Add to React Flow
    setNodes((nds) => [...nds, flowNode]);
  }, [setNodes, canvasId]);

  // Load canvas data from DB on mount
  useEffect(() => {
    if (!hasLoadedFromDB && canvasData?.nodes && canvasData?.edges) {
      // Map database nodes to ReactFlow nodes
      // FILTER OUT nodes that are inside groups - groups render them internally
      const flowNodes: Node[] = canvasData.nodes
        .filter((dbNode) => !dbNode.parentGroupId)
        .map((dbNode) => {
        const nodeData = {
          canvasNodeId: dbNode._id,
          content: (dbNode as any).textContent,
          chatNodeId: (dbNode as any).chatNodeId,
          youtubeNodeId: (dbNode as any).youtubeNodeId,
          websiteNodeId: (dbNode as any).websiteNodeId,
          tiktokNodeId: (dbNode as any).tiktokNodeId,
          facebookAdNodeId: (dbNode as any).facebookAdNodeId,
          groupNodeId: (dbNode as any).groupNodeId,
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
          // NO parent-child relationship - groups render children internally
          // parentNode: dbNode.parentGroupId,  // REMOVED
          // Groups should render behind other nodes
          zIndex: dbNode.nodeType === 'group' ? -1 : undefined,
          draggable: true,
        };
      });

      // Map database edges to ReactFlow edges
      const flowEdges: Edge[] = canvasData.edges.map((dbEdge) => ({
        id: dbEdge._id,
        type: 'animated',
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

        // Update local state with animated edge type
        setEdges((eds) => addEdge({ ...connection, type: 'animated' }, eds));
        toast.success("Nodes connected");
      } catch (error) {
        console.error("[Canvas] Error creating edge:", error);
        toast.error("Failed to connect nodes");
      }
    },
    [createEdge, setEdges, canvasId]
  );

  // Helper: Check if node is inside group bounds
  const isNodeInsideGroup = useCallback((node: Node, group: Node) => {
    // Calculate node center point
    const nodeCenter = {
      x: node.position.x + ((node.width as number) || 400) / 2,
      y: node.position.y + ((node.height as number) || 300) / 2,
    };

    // Check if center is inside group bounds
    const groupWidth = (group.width as number) || 600;
    const groupHeight = (group.height as number) || 400;

    return (
      nodeCenter.x >= group.position.x &&
      nodeCenter.x <= group.position.x + groupWidth &&
      nodeCenter.y >= group.position.y &&
      nodeCenter.y <= group.position.y + groupHeight
    );
  }, []);

  // Handle node drag end (save position to DB + handle grouping)
  const onNodeDragStop = useCallback(
    async (_event: any, node: Node) => {
      try {
        // Don't process grouping logic for group nodes themselves
        if (node.type !== 'group') {
          // Check if node should be added to a group
          const groups = nodes.filter((n) => n.type === 'group' && n.id !== node.id);

          for (const group of groups) {
            if (isNodeInsideGroup(node, group)) {
              console.log("[Canvas] Adding node to group:", node.id, "→", group.id);

              // Add to group in DB (backend calculates grid position)
              await addNodeToGroup({
                canvasNodeId: node.id as Id<"canvas_nodes">,
                parentGroupId: group.id as Id<"canvas_nodes">,
              });

              // REMOVE node from React Flow state - group will render it internally
              setNodes((nds) => nds.filter((n) => n.id !== node.id));

              toast.success("Node added to group");
              return; // Skip normal position update
            }
          }
        }

        // Normal position update (no grouping)
        await updateNodePosition({
          canvasNodeId: node.id as Id<"canvas_nodes">,
          position: node.position,
        });
      } catch (error) {
        console.error("[Canvas] Error updating node position:", error);
        toast.error("Failed to update node");
      }
    },
    [updateNodePosition, addNodeToGroup, nodes, setNodes, isNodeInsideGroup]
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
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createChatNode({
        canvasId: canvasId as Id<"canvases">,
        position,
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "chat",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            chatNodeId: result.chatNodeId,
            canvasId: canvasId as Id<"canvases">,
            selectedThreadId: result.threadId,
          },
        },
      ]);

      toast.success("Chat node created");
    } catch (error) {
      console.error("[Canvas] Error creating chat node:", error);
      toast.error("Failed to create chat node");
    }
  };

  // Add YouTube node
  const handleAddYouTubeNode = async () => {
    setDialogState({ type: "youtube", open: true });
  };

  const handleYouTubeUrlSubmit = async (url: string) => {
    try {
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createYouTubeNode({
        canvasId: canvasId as Id<"canvases">,
        position,
        url,
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "youtube",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            youtubeNodeId: result.youtubeNodeId,
          },
        },
      ]);

      toast.success("YouTube node created");
    } catch (error) {
      console.error("[Canvas] Error creating YouTube node:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create YouTube node");
    }
  };

  // Add Website node
  const handleAddWebsiteNode = async () => {
    setDialogState({ type: "website", open: true });
  };

  const handleWebsiteUrlSubmit = async (url: string) => {
    try {
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createWebsiteNode({
        canvasId: canvasId as Id<"canvases">,
        position,
        url,
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "website",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            websiteNodeId: result.websiteNodeId,
          },
        },
      ]);

      toast.success("Website node created");
    } catch (error) {
      console.error("[Canvas] Error creating website node:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create website node");
    }
  };

  // Add TikTok node
  const handleAddTikTokNode = async () => {
    setDialogState({ type: "tiktok", open: true });
  };

  const handleTikTokUrlSubmit = async (url: string) => {
    try {
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createTikTokNode({
        canvasId: canvasId as Id<"canvases">,
        position,
        url,
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "tiktok",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            tiktokNodeId: result.tiktokNodeId,
          },
        },
      ]);

      toast.success("TikTok node created");
    } catch (error) {
      console.error("[Canvas] Error creating TikTok node:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create TikTok node");
    }
  };

  // Add Facebook Ad node
  const handleAddFacebookAdNode = async () => {
    setDialogState({ type: "facebook", open: true });
  };

  // Add Group node
  const handleAddGroup = async () => {
    try {
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createGroup({
        canvasId: canvasId as Id<"canvases">,
        position,
        title: "New Group",
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "group",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            groupNodeId: result.groupNodeId,
          },
          zIndex: -1, // Render behind other nodes
        },
      ]);

      toast.success("Group created");
    } catch (error) {
      console.error("[Canvas] Error creating group:", error);
      toast.error("Failed to create group");
    }
  };

  const handleFacebookAdInputSubmit = async (input: string) => {
    // Parse Ad ID from URL or use input directly
    let adId = input.trim();

    // Try to extract ID from URL patterns:
    // https://www.facebook.com/ads/library?id=123456789
    // https://www.facebook.com/ads/library/?id=123456789
    const urlMatch = input.match(/[?&]id=(\d+)/);
    if (urlMatch) {
      adId = urlMatch[1];
    } else {
      // If no URL pattern found, check if input is just a number
      const numericMatch = input.match(/^\d+$/);
      if (!numericMatch) {
        toast.error("Please enter a valid Facebook Ad Library URL or numeric Ad ID");
        return;
      }
    }

    try {
      const position = { x: Math.random() * 400, y: Math.random() * 400 };
      const result = await createFacebookAdNode({
        canvasId: canvasId as Id<"canvases">,
        position,
        adId,
      });

      // Add to local state immediately for better UX
      setNodes((nds) => [
        ...nds,
        {
          id: result.canvasNodeId,
          type: "facebook_ad",
          position,
          data: {
            canvasNodeId: result.canvasNodeId,
            facebookAdNodeId: result.facebookAdNodeId,
          },
        },
      ]);

      toast.success("Facebook Ad node created");
    } catch (error) {
      console.error("[Canvas] Error creating Facebook Ad node:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create Facebook Ad node");
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
    <CanvasContext.Provider value={{ onNodeUngrouped: handleNodeUngrouped }}>
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
        edgeTypes={edgeTypes}
      >
        <Panel position="top-left">
          <div className="flex items-center gap-2 p-2">
            <Button
              onClick={handleAddGroup}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Folder className="h-4 w-4" />
              Add Group
            </Button>
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
            <Button
              onClick={handleAddYouTubeNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              Add YouTube
            </Button>
            <Button
              onClick={handleAddWebsiteNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              Add Website
            </Button>
            <Button
              onClick={handleAddTikTokNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
              Add TikTok
            </Button>
            <Button
              onClick={handleAddFacebookAdNode}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Add Facebook Ad
            </Button>
          </div>
        </Panel>
      </Canvas>

      {/* URL Input Dialogs */}
      <UrlInputDialog
        open={dialogState.open && dialogState.type === "youtube"}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        onSubmit={handleYouTubeUrlSubmit}
        title="Add YouTube Video"
        description="Enter the YouTube video URL to add to your canvas"
        placeholder="https://www.youtube.com/watch?v=..."
      />

      <UrlInputDialog
        open={dialogState.open && dialogState.type === "website"}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        onSubmit={handleWebsiteUrlSubmit}
        title="Add Website"
        description="Enter the website URL to scrape and add to your canvas"
        placeholder="https://example.com"
      />

      <UrlInputDialog
        open={dialogState.open && dialogState.type === "tiktok"}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        onSubmit={handleTikTokUrlSubmit}
        title="Add TikTok Video"
        description="Enter the TikTok video URL to add to your canvas"
        placeholder="https://www.tiktok.com/@username/video/..."
      />

      <UrlInputDialog
        open={dialogState.open && dialogState.type === "facebook"}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        onSubmit={handleFacebookAdInputSubmit}
        title="Add Facebook Ad"
        description="Enter the Facebook Ad Library URL or numeric Ad ID"
        placeholder="https://www.facebook.com/ads/library?id=... or Ad ID"
        inputType="text"
      />
      </div>
    </CanvasContext.Provider>
  );
}
