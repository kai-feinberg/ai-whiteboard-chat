// src/features/agents/components/AgentSelector.tsx
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
} from "@/components/ai-elements/prompt-input";
import { Bot } from "lucide-react";

interface AgentSelectorProps {
  value: string | null; // agentId
  onChange: (agentId: string) => void;
  className?: string;
}

export function AgentSelector({ value, onChange, className }: AgentSelectorProps) {
  const agents = useQuery(api.agents.functions.listAgents) ?? [];

  const defaultAgents = agents.filter(a => !a.isCustom);
  const customAgents = agents.filter(a => a.isCustom);

  const selectedAgent = agents.find(a => a.id === value);

  return (
    <PromptInputModelSelect value={value || "default"} onValueChange={onChange}>
      <PromptInputModelSelectTrigger className={className}>
        <Bot className="h-4 w-4 mr-2" />
        <PromptInputModelSelectValue>
          {selectedAgent?.name || "Select Agent"}
        </PromptInputModelSelectValue>
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        {/* Default Agents */}
        {defaultAgents.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Default Agents
            </div>
            {defaultAgents.map(agent => (
              <PromptInputModelSelectItem key={agent.id} value={agent.id}>
                {agent.name}
                {agent.isDefault && (
                  <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                )}
              </PromptInputModelSelectItem>
            ))}
          </>
        )}

        {/* Custom Agents */}
        {customAgents.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">
              Custom Agents
            </div>
            {customAgents.map(agent => (
              <PromptInputModelSelectItem key={agent.id} value={agent.id}>
                {agent.name}
                {agent.isDefault && (
                  <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                )}
              </PromptInputModelSelectItem>
            ))}
          </>
        )}
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}
