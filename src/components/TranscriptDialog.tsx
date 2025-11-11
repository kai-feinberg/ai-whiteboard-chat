// src/components/TranscriptDialog.tsx
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface TranscriptDialogProps {
  transcript: string;
  title?: string;
  triggerText?: string;
  triggerClassName?: string;
}

export function TranscriptDialog({
  transcript,
  title = "Transcript",
  triggerText = "View Transcript",
  triggerClassName,
}: TranscriptDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (!transcript || transcript.length === 0) {
        toast.error("No content to copy");
        return;
      }

      await navigator.clipboard.writeText(transcript);

      setCopied(true);
      toast.success(`Copied ${transcript.length.toLocaleString()} characters to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.ceil(transcript.length / 4);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {transcript}
          </div>
        </ScrollArea>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {wordCount.toLocaleString()} words • ~{estimatedTokens.toLocaleString()} tokens
        </div>
      </DialogContent>
    </Dialog>
  );
}
