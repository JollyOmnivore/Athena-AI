import 'server-only'
import { IconOpenAI } from '@/components/ui/icons'
import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import OpenAI from 'openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock
} from '@/components/stocks'

import { z } from 'zod'
/*
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
*/
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { SpinnerMessage } from '@/components/spinner-message'

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID

// Initialize OpenAI client
const openAIClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Submits a user message to the OpenAI Assistant and handles the response stream
 * @param content - The user's message content
 * @returns A streamable UI component containing the response
 */
async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  try {
    console.log('🟦 Starting new message submission:', content)
    const cookieStore = cookies()
    const selectedAssistantId = cookieStore.get('selectedAssistantId')?.value ||
      process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_1_ID

    if (!selectedAssistantId) {
      throw new Error('No assistant ID available')
    }

    console.log('🟦 Using Assistant ID:', selectedAssistantId)

    const responseUI = createStreamableUI(
      <div className="opacity-60 transition-opacity duration-300">
        <SpinnerMessage />
      </div>
    )

    // Initialize messages if undefined
    if (!aiState.get().messages) {
      aiState.update({
        ...aiState.get(),
        messages: []
      })
    }

    // Add user message to state
    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: content
    }

    aiState.update({
      ...aiState.get(),
      messages: [...(aiState.get().messages || []), userMessage]
    })

    try {
      let threadId = aiState.get().threadId
      if (!threadId) {
        const thread = await openAIClient.beta.threads.create()
        threadId = thread.id
        console.log('🟦 Created new thread:', threadId)
        aiState.update({
          ...aiState.get(),
          threadId
        })
      } else {
        console.log('🟦 Using existing thread:', threadId)
      }

      console.log('🟦 Sending message to OpenAI:', {
        threadId,
        content,
        timestamp: new Date().toISOString()
      })

      // Add message to thread
      await openAIClient.beta.threads.messages.create(threadId, {
        role: 'user',
        content
      })

      console.log('🟦 Message sent to thread, creating run...')

      // Run the assistant
      const run = await openAIClient.beta.threads.runs.create(threadId, {
        assistant_id: selectedAssistantId
      })

      console.log('🟦 Run created:', run.id)

      let runStatus = await openAIClient.beta.threads.runs.retrieve(threadId, run.id)
      let attempts = 0
      const maxAttempts = 200

      while (runStatus.status !== 'completed' && attempts < maxAttempts) {
        console.log('🟨 Run status:', runStatus.status, 'Attempt:', attempts + 1)
        await new Promise(resolve => setTimeout(resolve, 1000))
        runStatus = await openAIClient.beta.threads.runs.retrieve(threadId, run.id)
        attempts++

        if (runStatus.status === 'failed') {
          console.error('🟥 Run failed:', runStatus)
          throw new Error('Assistant run failed')
        }
      }

      if (attempts >= maxAttempts) {
        console.error('🟥 Run timed out after', maxAttempts, 'attempts')
        return {
          id: nanoid(),
          display: (
            <div className="flex flex-col gap-2">
              <div className="text-red-500">
                The response took too long. The assistant might be processing a complex request.
              </div>
              <div className="text-muted-foreground text-sm">
                Please try asking your question again or break it into smaller parts.
              </div>
            </div>
          )
        }
      }

      console.log('🟩 Run completed, fetching messages...')

      const messages = await openAIClient.beta.threads.messages.list(threadId)
      
      if (!messages?.data?.length) {
        console.error('🟥 No messages received from OpenAI')
        throw new Error('No messages received from OpenAI')
      }

      const lastMessage = messages.data[0]
      console.log('🟩 Received message:', {
        messageId: lastMessage.id,
        timestamp: new Date().toISOString(),
        content: lastMessage.content
      })

      if (!lastMessage?.content?.[0] || lastMessage.content[0].type !== 'text') {
        console.error('🟥 Invalid message format:', lastMessage)
        throw new Error('Invalid response format')
      }

      const messageContent = lastMessage.content[0].text.value
      console.log('🟩 Processed message content:', messageContent.substring(0, 100) + '...')

      // Add assistant message to state with explicit type checking
      const assistantMessage: Message = {
        id: nanoid(),
        role: 'assistant' as const, // explicitly type as const
        content: messageContent
      }

      // Ensure messages array exists before updating
      const currentMessages = aiState.get().messages || []
      
      aiState.update({
        ...aiState.get(),
        messages: [...currentMessages, assistantMessage]
      })

      responseUI.done(
        <div className="opacity-100 transition-opacity duration-300">
          <BotMessage content={messageContent} />
        </div>
      )

      return {
        id: nanoid(),
        display: responseUI.value
      }

    } catch (error) {
      console.error('🟥 Error in OpenAI request:', error)
      return {
        id: nanoid(),
        display: (
          <div className="text-red-500">
            Error: The assistant failed to respond. Please try again.
          </div>
        )
      }
    }

  } catch (error) {
    console.error('🟥 Error in submitUserMessage:', error)
    return {
      id: nanoid(),
      display: (
        <div className="text-red-500">
          Error: Failed to get response. Please try again.
        </div>
      )
    }
  }
}


export type AIState = {
  chatId: string          
  threadId?: string      
  messages: Message[]     
}


export type UIState = {
  id: string             
  display: React.ReactNode 
}[]


export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage
  },
  initialUIState: [],
  initialAIState: {
    chatId: nanoid(),
    messages: [],
    threadId: undefined
  },
  onGetUIState: async () => {
    'use server'
    const session = await auth()
    if (!session?.user) return []

    const aiState = getAIState() as Chat
    if (!aiState?.messages) return []

    return getUIStateFromAIState(aiState)
  },
  onSetAIState: async ({ state }) => {
    'use server'
    const session = await auth()
    if (!session?.user) return

    const { chatId, messages } = state
    if (!messages?.length) return

    const createdAt = new Date()
    const userId = session.user.id as string
    const path = `/chat/${chatId}`
    const title = (messages[0]?.content as string)?.substring(0, 100) || 'New Chat'

    const chat: Chat = {
      id: chatId,
      title,
      userId,
      createdAt,
      messages,
      path
    }

    await saveChat(chat)
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  if (!aiState?.messages) return []

  return aiState.messages
      .filter(message => message?.role !== 'system' && message?.content)
      .map((message, index) => ({
        id: `${aiState.chatId}-${index}`,
        display:
            message.role === 'user' ? (
                <UserMessage>{message.content as string}</UserMessage>
            ) : message.role === 'assistant' && typeof message.content === 'string' ? (
                <BotMessage content={message.content} />
            ) : null
      }))
      .filter(Boolean)
}
