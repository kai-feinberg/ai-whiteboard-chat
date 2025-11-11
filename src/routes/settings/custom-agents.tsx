// src/routes/settings/custom-agents.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, Check, Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCustomer } from "autumn-js/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/settings/custom-agents")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: CustomAgentsPage,
});

interface AgentFormData {
  name: string;
  systemPrompt: string;
  isDefault: boolean;
}

function CustomAgentsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AgentFormData>({
    name: "",
    systemPrompt: "",
    isDefault: false,
  });

  // Load agents
  const agents = useQuery(api.agents.functions.listAgents) ?? [];
  const customAgents = agents.filter((a) => a.isCustom);

  // Check if custom agents feature is available using Autumn
  // custom_agents is a BOOLEAN feature (not usage-based)
  // For boolean features, check if the feature exists in customer.features
  const { customer } = useCustomer();
  const customAgentsFeature = customer?.features?.custom_agents;
  const isPro = !!customAgentsFeature; // Boolean feature exists = enabled

  // Mutations and Actions
  const createAgent = useAction(api.agents.functions.createCustomAgent); // Action (uses Autumn check)
  const updateAgent = useMutation(api.agents.functions.updateCustomAgent);
  const deleteAgent = useMutation(api.agents.functions.deleteCustomAgent);

  const handleOpenForm = (agent?: any) => {
    // Prevent opening form if not pro (only for creating new agents)
    if (!agent && !isPro) {
      toast.error("Custom agents are a PRO feature. Please upgrade to create custom agents.");
      return;
    }

    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        isDefault: agent.isDefault,
      });
    } else {
      setEditingAgent(null);
      setFormData({
        name: "",
        systemPrompt: "",
        isDefault: false,
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingAgent(null);
    setFormData({
      name: "",
      systemPrompt: "",
      isDefault: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    if (!formData.systemPrompt.trim()) {
      toast.error("System prompt is required");
      return;
    }

    try {
      if (editingAgent) {
        await updateAgent({
          agentId: editingAgent.id as Id<"custom_agents">,
          name: formData.name,
          systemPrompt: formData.systemPrompt,
          isDefault: formData.isDefault,
        });
        toast.success("Agent updated successfully");
      } else {
        await createAgent({
          name: formData.name,
          systemPrompt: formData.systemPrompt,
          isDefault: formData.isDefault,
        });
        toast.success("Agent created successfully");
      }
      handleCloseForm();
    } catch (error) {
      console.error("[CustomAgents] Error saving agent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save agent");
    }
  };

  const handleDelete = async () => {
    if (!deleteAgentId) return;

    try {
      await deleteAgent({ agentId: deleteAgentId as Id<"custom_agents"> });
      toast.success("Agent deleted successfully");
      setDeleteAgentId(null);
    } catch (error) {
      console.error("[CustomAgents] Error deleting agent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete agent");
    }
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">Custom Agents</h1>
                {!isPro && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <Crown className="h-3 w-3 mr-1" />
                    PRO
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Manage your organization's custom AI agents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPro && (
              <Link to="/pricing">
                <Button variant="default" size="sm">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </Link>
            )}
            <Button onClick={() => handleOpenForm()} disabled={!isPro}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-6xl mx-auto">
        {customAgents.length === 0 ? (
          <div className="relative">
            <div className={`text-center py-12 border rounded-lg bg-muted/20 ${!isPro ? 'blur-sm' : ''}`}>
              <p className="text-lg font-medium mb-2">No custom agents yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first custom agent to get started
              </p>
              <Button onClick={() => handleOpenForm()} disabled={!isPro}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-amber-600">
                    <Crown className="h-8 w-8" />
                    <span className="text-2xl font-semibold">PRO Feature</span>
                  </div>
                  <p className="text-muted-foreground max-w-md">
                    Custom agents allow you to create specialized AI assistants with custom system prompts for your organization.
                  </p>
                  <Link to="/pricing">
                    <Button size="lg">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Pro
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {customAgents.map((agent) => (
              <div
                key={agent.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium">{agent.name}</h3>
                      {agent.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                          <Check className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {agent.systemPrompt}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenForm(agent)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteAgentId(agent.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingAgent ? "Edit Agent" : "Create Agent"}
              </DialogTitle>
              <DialogDescription>
                {editingAgent
                  ? "Update your custom agent's configuration"
                  : "Create a new custom agent for your organization"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., VSL Writer, Ideation Bot"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="Enter the instructions for your agent..."
                  value={formData.systemPrompt}
                  onChange={(e) =>
                    setFormData({ ...formData, systemPrompt: e.target.value })
                  }
                  rows={8}
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This prompt will be used as the agent's instructions when
                  responding to messages.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: checked === true })
                  }
                />
                <Label htmlFor="isDefault" className="text-sm font-normal">
                  Set as default agent for this organization
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAgent ? "Update Agent" : "Create Agent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteAgentId}
        onOpenChange={(open) => !open && setDeleteAgentId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this agent? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAgentId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
