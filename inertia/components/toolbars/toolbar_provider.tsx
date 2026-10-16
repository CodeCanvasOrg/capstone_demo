'use client'

import { useEditorState, type Editor } from '@tiptap/react'
import type { StarterKitOptions } from '@tiptap/starter-kit'
import React from 'react'

export type { StarterKitOptions }

export interface ToolbarContextProps {
  editor: Editor
  transaction?: number
}

export const ToolbarContext = React.createContext<ToolbarContextProps | null>(null)

interface ToolbarProviderProps {
  editor: Editor
  children: React.ReactNode
}

export const ToolbarProvider = ({ editor, children }: ToolbarProviderProps) => {
  const transaction = useEditorState({ editor, selector: (state) => state.transactionNumber })
  return (
    <ToolbarContext.Provider value={{ editor, transaction }}> {children} </ToolbarContext.Provider>
  )
}

export const useToolbar = () => {
  const context = React.useContext(ToolbarContext)

  if (!context) {
    throw new Error('useToolbar must be used within a ToolbarProvider')
  }

  return context
}
