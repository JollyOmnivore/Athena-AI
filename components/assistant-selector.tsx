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
import { useRouter } from 'next/navigation'
import { nanoid } from '@/lib/utils'
import assistantConfig from '@/config/assistants.json'

interface Assistant {
  id: string
  name: string
  description?: string
}

// Map the configuration to actual assistant objects with environment variables
const assistants: Assistant[] = assistantConfig.assistants.map(assistant => ({
  id: process.env[assistant.id] || '',
  name: assistant.name,
  description: assistant.description
}))

export function AssistantSelector() {
  const router = useRouter()
  const [selectedAssistantId, setSelectedAssistantId] = useLocalStorage(
    'selectedAssistantId',
    assistants[0].id
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const currentAssistant = assistants.find(a => a.id === selectedAssistantId)

  // Add effect to check selected assistant on mount and after navigation
  useEffect(() => {
    // Get the assistant ID from the cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
    }
    
    const cookieAssistantId = getCookie('selectedAssistantId')
    if (cookieAssistantId && cookieAssistantId !== selectedAssistantId) {
      setSelectedAssistantId(cookieAssistantId)
    }
  }, [setSelectedAssistantId])

  const updateAssistant = async (assistantId: string) => {
    if (isUpdating) return
    
    try {
      setIsUpdating(true)
      
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

      setSelectedAssistantId(assistantId)

      // Generate new chat ID and redirect
      const newChatId = nanoid()
      router.push(`/chat/${newChatId}`)
      router.refresh()

    } catch (error) {
      console.error('Error updating assistant:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center">
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
      <span className="ml-2 text-sm text-muted-foreground">
        {currentAssistant?.name}
      </span>
    </div>
  )
}