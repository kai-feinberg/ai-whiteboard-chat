'use client'

import type { Value } from 'platejs'

import { Plate, usePlateEditor } from 'platejs/react'

import { DocumentEditorKit } from '../plugins/document-editor-kit'
import { Editor, EditorContainer } from '~/components/ui/editor'

export interface DocumentEditorProps {
  initialValue: Value
  onChange: (value: Value) => void
  readOnly?: boolean
  className?: string
}

export function DocumentEditor({
  initialValue,
  onChange,
  readOnly = false,
  className,
}: DocumentEditorProps) {
  const editor = usePlateEditor({
    plugins: DocumentEditorKit,
    value: initialValue,
  })

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        onChange(value)
      }}
      readOnly={readOnly}
    >
      <EditorContainer className={className}>
        <Editor variant="default" />
      </EditorContainer>
    </Plate>
  )
}
