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
    const cookieStore = cookies()
    const selectedAssistantId = cookieStore.get('selectedAssistantId')?.value ||
        process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_1_ID

    if (!selectedAssistantId) {
      throw new Error('No assistant ID available')
    }


    const responseUI = createStreamableUI(
        <div className="opacity-60 transition-opacity duration-300">
          <SpinnerMessage />
        </div>
    )


    aiState.update({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'user',
          content
        }
      ]
    })


    let threadId = aiState.get().threadId
    if (!threadId) {
      const thread = await openAIClient.beta.threads.create()
      threadId = thread.id
      aiState.update({
        ...aiState.get(),
        threadId
      })
    }


    await openAIClient.beta.threads.messages.create(threadId, {
      role: 'user',
      content
    })


    const run = await openAIClient.beta.threads.runs.create(threadId, {
      assistant_id: selectedAssistantId
    })

    // Wait for run to complete while showing loading state
    let runStatus = await openAIClient.beta.threads.runs.retrieve(threadId, run.id)

    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      runStatus = await openAIClient.beta.threads.runs.retrieve(threadId, run.id)

      if (runStatus.status === 'failed') {
        throw new Error('Run failed')
      }
    }

    // Get messages
    const messages = await openAIClient.beta.threads.messages.list(threadId)
    const lastMessage = messages.data[0]

    if (!lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
      throw new Error('Invalid response format')
    }

    const messageContent = lastMessage.content[0].text.value

    // Update AI state with assistant response
    aiState.update({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'assistant',
          content: messageContent
        }
      ]
    })

    // Replace with message from API
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
    console.error('Error in submitUserMessage:', error)
    throw error
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
