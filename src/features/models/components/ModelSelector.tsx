// src/features/models/components/ModelSelector.tsx
import { useState } from "react";
import {
  ModelSelector as ModelSelectorDialog,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import modelsConfig from "@/config/models.json";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

interface ModelSelectorProps {
  value: string | null; // modelId
  onChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const getAvailableModels = useAction(api.models.getAvailableModels);

  const models = modelsConfig.models;
  const selectedModel = models.find((m) => m.id === value);

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof models>);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
  };

  const handleLogModels = async () => {
    setIsLoadingModels(true);
    try {
      const availableModels = await getAvailableModels();
      console.log("Available Language Models:", availableModels);
    } catch (error) {
      console.error("Failed to fetch available models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <ModelSelectorDialog open={open} onOpenChange={setOpen}>
        <ModelSelectorTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-8 rounded-full border border-gray-300 bg-white px-3 py-3 font-medium text-gray-900 shadow-none transition-all gap-1",
            "hover:bg-gray-50 hover:border-gray-400",
            open && "bg-gray-50 border-gray-400",
            className
          )}
          role="combobox"
          aria-expanded={open}
        >
          {selectedModel && (
            <ModelSelectorLogo provider={selectedModel.provider} className="shrink-0" />
          )}
          <span className="truncate">
            {selectedModel?.name || "Select Model"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500 opacity-60 shrink-0" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
            <ModelSelectorGroup key={provider} heading={provider.toUpperCase()}>
              {providerModels.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  value={model.id}
                  onSelect={() => handleSelect(model.id)}
                  className="cursor-pointer"
                >
                  <ModelSelectorLogoGroup>
                    <ModelSelectorLogo provider={model.provider} />
                  </ModelSelectorLogoGroup>
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  {value === model.id && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelectorDialog>
    {/* <Button
      variant="ghost"
      size="sm"
      onClick={handleLogModels}
      disabled={isLoadingModels}
      className="h-8 w-8 p-0 rounded-full border border-gray-300 hover:bg-gray-50"
      title="Log available models"
    >
      <RefreshCw className={cn("h-4 w-4", isLoadingModels && "animate-spin")} />
    </Button> */}
  </div>
  );
}
