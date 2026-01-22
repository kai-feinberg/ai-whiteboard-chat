import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Plus, FileText, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as React from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/documents/")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const documents = useQuery(api.documents.functions.listMyDocuments);
  const createDocument = useMutation(api.documents.functions.createDocument);
  const deleteDocument = useMutation(api.documents.functions.deleteDocument);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [documentToDelete, setDocumentToDelete] = React.useState<Id<"documents"> | null>(null);

  const handleCreateDocument = async () => {
    try {
      const documentId = await createDocument({ title: "Untitled Document" });
      toast.success("Document created");
      navigate({ to: `/documents/${documentId}` });
    } catch (error) {
      console.error("[Documents] Error creating document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create document"
      );
    }
  };

  const handleDeleteDocument = (documentId: Id<"documents">, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(documentId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      await deleteDocument({ documentId: documentToDelete });
      toast.success("Document deleted");
    } catch (error) {
      console.error("[Documents] Error deleting document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleSelectDocument = (documentId: Id<"documents">) => {
    navigate({ to: `/documents/${documentId}` });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to view documents.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (documents === undefined) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Documents</h1>
              <p className="text-muted-foreground mt-1">
                Save and organize your notes and content
              </p>
            </div>
            <Button onClick={handleCreateDocument} size="lg" disabled>
              <Plus className="h-5 w-5 mr-2" />
              New Document
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground mt-1">
              Save and organize your notes and content
            </p>
          </div>
          <Button onClick={handleCreateDocument} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first document to start saving notes and organizing content
            </p>
            <Button onClick={handleCreateDocument} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card
              key={doc._id}
              className="cursor-pointer hover:shadow-lg transition-shadow relative group"
              onClick={() => handleSelectDocument(doc._id)}
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  onClick={(e) => handleDeleteDocument(doc._id, e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  {doc.title || "Untitled Document"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
