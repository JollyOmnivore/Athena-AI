'use client'

import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { IconMenu } from '@/components/ui/icons'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { cn } from '@/lib/utils'

interface Assistant {
  id: string
  name: string
}

const assistants: Assistant[] = [
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_1_ID || '',
    name: 'Assistant 1'
  },
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_2_ID || '',
    name: 'Assistant 2'
  }
]

export function AssistantSelector() {
  const [selectedAssistantId, setSelectedAssistantId] = useLocalStorage(
    'selectedAssistantId',
    assistants[0].id
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const updateAssistant = async (assistantId: string) => {
    if (isUpdating) return
    
    try {
      setIsUpdating(true)
      setSelectedAssistantId(assistantId)
      
      const response = await fetch('/api/set-assistant', {
        method: 'POST',
        body: JSON.stringify({ assistantId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to update assistant')
      }
    } catch (error) {
      console.error('Error updating assistant:', error)
      // Revert the local storage value if the server update failed
      setSelectedAssistantId(selectedAssistantId)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isUpdating}>
        <Button variant="ghost" size="icon" className="ml-2">
          <IconMenu className="h-5 w-5" />
          <span className="sr-only">Select Assistant</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {assistants.map(assistant => (
          <DropdownMenuItem
            key={assistant.id}
            onClick={() => updateAssistant(assistant.id)}
            className={cn(
              selectedAssistantId === assistant.id ? 'bg-accent' : '',
              isUpdating ? 'opacity-50 cursor-not-allowed' : ''
            )}
            disabled={isUpdating}
          >
            {assistant.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}