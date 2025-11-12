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
import { Sparkles, Check } from "lucide-react";
import modelsConfig from "@/config/models.json";

interface ModelSelectorProps {
  value: string | null; // modelId
  onChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

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

  return (
    <ModelSelectorDialog open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="outline"
          className={className}
          role="combobox"
          aria-expanded={open}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          <span className="truncate">
            {selectedModel?.name || "Select Model"}
          </span>
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
  );
}
