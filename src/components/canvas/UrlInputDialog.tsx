import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UrlInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
  inputType?: "url" | "text";
}

export function UrlInputDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  placeholder = "Enter URL...",
  inputType = "url",
}: UrlInputDialogProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="py-4">
            <Input
              type={inputType}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Add Node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
