import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useAuth } from '@clerk/tanstack-react-start'
import { toast } from 'sonner'
import { DocumentEditor } from '@/features/documents/components/document-editor'
import type { Value } from 'platejs'

export const Route = createFileRoute('/documents/$documentId')({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error('Not authenticated')
    }
    if (!context.orgId) {
      throw new Error('No organization selected')
    }
  },
  component: DocumentEditorPage,
})

const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }]

function DocumentEditorPage() {
  const navigate = useNavigate()
  const { documentId } = Route.useParams()
  const { orgId } = useAuth()

  const document = useQuery(api.documents.functions.getDocument, {
    documentId: documentId as Id<'documents'>,
  })
  const updateDocument = useMutation(api.documents.functions.updateDocument)

  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState<Value>(EMPTY_VALUE)
  const [hasInitialized, setHasInitialized] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<
    'saved' | 'saving' | 'idle'
  >('idle')

  const lastSavedContentRef = React.useRef<string>('')
  const lastSavedTitleRef = React.useRef<string>('')
  const pendingSavesRef = React.useRef(0)

  React.useEffect(() => {
    if (document && !hasInitialized) {
      setTitle(document.title)
      const docContent = document.content as Value | undefined
      const initialContent =
        docContent && Array.isArray(docContent) && docContent.length > 0
          ? docContent
          : EMPTY_VALUE
      setContent(initialContent)
      lastSavedContentRef.current = JSON.stringify(initialContent)
      lastSavedTitleRef.current = document.title
      setHasInitialized(true)
      setSaveStatus('saved')
    }
  }, [document, hasInitialized])

  React.useEffect(() => {
    if (!hasInitialized) return

    const contentStr = JSON.stringify(content)
    if (contentStr === lastSavedContentRef.current) return

    const timeoutId = setTimeout(async () => {
      if (contentStr === lastSavedContentRef.current) return

      pendingSavesRef.current++
      setSaveStatus('saving')
      try {
        await updateDocument({
          documentId: documentId as Id<'documents'>,
          content,
        })
        lastSavedContentRef.current = contentStr
        pendingSavesRef.current--
        if (pendingSavesRef.current === 0) {
          setSaveStatus('saved')
        }
      } catch (error) {
        console.error('[Document] Error saving content:', error)
        pendingSavesRef.current--
        toast.error('Failed to save document')
        setSaveStatus('idle')
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [content, documentId, hasInitialized, updateDocument])

  const handleTitleBlur = async () => {
    const titleToSave = title || 'Untitled Document'
    if (titleToSave === lastSavedTitleRef.current) return

    pendingSavesRef.current++
    setSaveStatus('saving')
    try {
      await updateDocument({
        documentId: documentId as Id<'documents'>,
        title: titleToSave,
      })
      lastSavedTitleRef.current = titleToSave
      pendingSavesRef.current--
      if (pendingSavesRef.current === 0) {
        setSaveStatus('saved')
      }
    } catch (error) {
      console.error('[Document] Error saving title:', error)
      pendingSavesRef.current--
      toast.error('Failed to save title')
      setSaveStatus('idle')
    }
  }

  const handleBack = () => {
    navigate({ to: '/documents' })
  }

  const handleContentChange = (value: Value) => {
    setContent(value)
    setSaveStatus('idle')
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            No Organization Selected
          </h2>
          <p className="text-muted-foreground">
            Please select an organization to view documents.
          </p>
        </div>
      </div>
    )
  }

  if (document === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    )
  }

  if (document === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This document doesn't exist or you don't have access to it.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSaveStatus('idle')
            }}
            onBlur={handleTitleBlur}
            placeholder="Untitled Document"
            className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full max-w-xl"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-4">
          <DocumentEditor
            initialValue={content}
            onChange={handleContentChange}
            className="min-h-[calc(100vh-200px)]"
          />
        </div>
      </div>
    </div>
  )
}
