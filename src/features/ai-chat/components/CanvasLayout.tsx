// src/features/ai-chat/components/CanvasLayout.tsx
import { ReactNode, useState } from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface CanvasLayoutProps {
  documentPanel: ReactNode;
  chatPanel: ReactNode;
  documentHeader?: ReactNode;
}

export function CanvasLayout({ documentPanel, chatPanel, documentHeader }: CanvasLayoutProps) {
  const [isChatVisible, setIsChatVisible] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Document Panel */}
        <Panel defaultSize={isChatVisible ? 60 : 100} minSize={30}>
          <div className="h-full flex flex-col border-r">
            <div className="border-b p-4 flex items-center justify-between">
              {documentHeader ? (
                documentHeader
              ) : (
                <h2 className="text-lg font-semibold">Document</h2>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChatVisible(!isChatVisible)}
                title={isChatVisible ? "Hide chat" : "Show chat"}
              >
                {isChatVisible ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">{documentPanel}</div>
          </div>
        </Panel>

        {/* Chat Panel */}
        {isChatVisible && (
          <>
            <PanelResizeHandle  />
            <Panel defaultSize={30} minSize={20} maxSize={60}>
              <div className="h-full flex flex-col">
                <div className="border-b p-4">
                  <h2 className="text-lg font-semibold">AI Assistant</h2>
                </div>
                <div className="flex-1 overflow-hidden">{chatPanel}</div>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
