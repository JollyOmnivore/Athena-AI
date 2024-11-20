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
  Stock,
  Purchase
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

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID

// Initialize OpenAI client
const openAIClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}...
        </p>
      </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)
    
    purchasing.update(
        <div className="inline-flex items-start gap-1 md:items-center">
          {spinner}
          <p className="mb-2">
            Purchasing {amount} ${symbol}... working on it...
          </p>
        </div>
    )

    await sleep(1000)

    purchasing.done(
        <div>
          <p className="mb-2">
            You have successfully purchased {amount} ${symbol}. Total cost:{' '}
            {formatNumber(amount * price)}
          </p>
        </div>
    )

    systemMessage.done(
        <SystemMessage>
          You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
          {formatNumber(amount * price)}.
        </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
              amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

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

    // Initialize UI with loading state
    const streamContent = createStreamableValue('')
    const responseUI = createStreamableUI(
      <SpinnerMessage />
    )

    // Get or create thread
    let threadId = aiState.get().threadId
    if (!threadId) {
      const thread = await openAIClient.beta.threads.create()
      threadId = thread.id
      aiState.update({
        ...aiState.get(),
        threadId
      })
    }

    // Add message to thread
    await openAIClient.beta.threads.messages.create(threadId, {
      role: 'user',
      content
    })

    // Update UI state with user message
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

    // Run the assistant
    const run = await openAIClient.beta.threads.runs.create(threadId, {
      assistant_id: selectedAssistantId
    })

    // Wait for run to complete
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

    // Now TypeScript knows this is text content
    const messageContent = lastMessage.content[0].text.value

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

    responseUI.done(
      <BotMessage content={messageContent} />
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

/**
 * Type definition for the AI's state
 */
export type AIState = {
  chatId: string          // Unique identifier for the chat session
  threadId?: string       // OpenAI thread ID for conversation continuity
  messages: Message[]     // Array of messages in the conversation
}

/**
 * Type definition for UI state elements
 */
export type UIState = {
  id: string             // Unique identifier for UI element
  display: React.ReactNode // React component to display
}[]

/**
 * Initialize the AI with configuration and state management
 */
export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase
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

export function SpinnerMessage() {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
        <IconOpenAI />
      </div>
      <div className="ml-4 h-[24px] flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
        {spinner}
      </div>
    </div>
  )
}