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
          <div className="h-full flex flex-col border-r-2 border-slate-200 dark:border-slate-800 shadow-xl bg-slate-50/30 dark:bg-slate-950/30">
            <div className="border-b-2 border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 shadow-md">
              {documentHeader ? (
                documentHeader
              ) : (
                <h2 className="text-lg font-bold">Document</h2>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChatVisible(!isChatVisible)}
                title={isChatVisible ? "Hide chat" : "Show chat"}
                className="hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-sm"
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
            <PanelResizeHandle className="w-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors shadow-sm" />
            <Panel defaultSize={30} minSize={20} maxSize={60}>
              <div className="h-full flex flex-col shadow-xl bg-slate-50/30 dark:bg-slate-950/30">
                <div className="border-b-2 border-slate-200 dark:border-slate-800 p-4 bg-white/50 dark:bg-slate-900/50 shadow-md">
                  <h2 className="text-lg font-bold">
                    AI Assistant
                  </h2>
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
