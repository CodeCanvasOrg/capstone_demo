'use client'

import { type Data } from '@generated/data'
import { ChevronDown, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'

export default function ExportDropdown({ document }: { document: Data.Document }) {
  const exportOptions = [{ text: 'PDF', url: `/documents/${document.id}/export/pdf` }]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-4" />
          Export
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {exportOptions.map((option) => (
          <DropdownMenuItem key={option.text} asChild>
            <a href={option.url}>{option.text}</a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
