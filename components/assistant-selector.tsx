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
import { allowedEmails } from '@/lib/allowed-emails'

interface Assistant {
  id: string
  name: string
  facultyOnly?: boolean
}

const assistants: Assistant[] = [
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_1_ID || '',
    name: 'CS490 Neural Networks'
  },
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_2_ID || '',
    name: 'ANTH 107 Intro to Anthropology'
  },
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_3_ID || '',
    name: 'Writing Assistant'
  },
  {
    id: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_4_ID || '',
    name: 'Vanilla ChatGPT4o (Faculty Only)',
    facultyOnly: true
  }
]

export function AssistantSelector() {
  const [selectedAssistantId, setSelectedAssistantId] = useLocalStorage(
    'selectedAssistantId',
    assistants[0].id
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()

  // Fetch user email on component mount
  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const response = await fetch('/api/user')
        const data = await response.json()
        console.log('Response from /api/user:', data) // Debug log
        console.log('User email:', data.email)
        console.log('Allowed emails:', allowedEmails)
        console.log('Is faculty?:', data.email && allowedEmails.includes(data.email))
        setUserEmail(data.email)
      } catch (error) {
        console.error('Error fetching user email:', error)
      }
    }
    fetchUserEmail()
  }, [])

  // Filter assistants based on user permissions
  const availableAssistants = assistants.filter(assistant => {
    if (!assistant.facultyOnly) return true
    const isFaculty = userEmail && allowedEmails.includes(userEmail)
    console.log('Checking assistant:', assistant.name, 'Faculty only?:', assistant.facultyOnly, 'Is faculty?:', isFaculty, 'User email:', userEmail)
    console.log('Allowed emails:', allowedEmails)
    return isFaculty
  })

  console.log('Available assistants:', availableAssistants)

  const selectedAssistant = availableAssistants.find(
    assistant => assistant.id === selectedAssistantId
  )

  // If selected assistant is not available, default to first available
  useEffect(() => {
    if (!selectedAssistant && availableAssistants.length > 0) {
      setSelectedAssistantId(availableAssistants[0].id)
    }
  }, [selectedAssistant, availableAssistants])

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

      // Generate a new chat ID and navigate to the new chat
      const newChatId = nanoid()
      router.push(`/chat/${newChatId}`)
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
        <Button variant="ghost" size="icon" className="ml-2 px-4 w-full">
          <IconMenu className="h-5 w-5" />
          <span className="sr-only">Select Assistant</span>
          <span className="ml-2">{selectedAssistant?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableAssistants.map(assistant => (
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