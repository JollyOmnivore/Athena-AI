import 'server-only'

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
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'

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
  
  // Validate Assistant ID is configured
  if (!ASSISTANT_ID) {
    throw new Error('OPENAI_ASSISTANT_ID is not set')
  }

  // Initialize UI with loading state
  const responseUI = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      <SpinnerMessage />
    </div>
  )

  // Process the message asynchronously to prevent blocking
  runAsyncFnWithoutBlocking(async () => {
    try {
      // Get or create a new thread for the conversation
      let threadId = aiState.get().threadId
      if (!threadId) {
        const thread = await openAIClient.beta.threads.create()
        threadId = thread.id
        // Store the thread ID in state for future messages
        aiState.update({
          ...aiState.get(),
          threadId
        })
      }

      // Add the user's message to the thread
      await openAIClient.beta.threads.messages.create(threadId, {
        role: 'user',
        content
      })

      // Start the assistant's response
      const run = await openAIClient.beta.threads.runs.create(threadId, {
        assistant_id: ASSISTANT_ID
      })

      // Track the full response as it's being generated
      let fullResponse = ''
      
      // Poll for updates until the response is complete
      while (true) {
        const runStatus = await openAIClient.beta.threads.runs.retrieve(
          threadId,
          run.id
        )
        
        if (runStatus.status === 'completed') {
          // Get the final response
          const messages = await openAIClient.beta.threads.messages.list(threadId)
          if (messages.data[0]?.content?.[0]) {
            const response = messages.data[0].content[0]
            if (response && 'text' in response) {
              fullResponse = response.text.value
              // Update UI with completed response
              responseUI.done(
                <BotMessage content={fullResponse} />
              )
              break
            }
          }
        } else if (runStatus.status === 'failed') {
          // Handle failure cases
          responseUI.done(
            <BotMessage content="Sorry, I encountered an error processing your request." />
          )
          throw new Error('Assistant run failed')
        } else if (runStatus.status === 'in_progress') {
          // Check for partial responses while processing
          const messages = await openAIClient.beta.threads.messages.list(threadId)
          if (messages.data[0]?.content?.[0]) {
            const latestMessage = messages.data[0].content[0]
            if (latestMessage && 'text' in latestMessage) {
              const currentResponse = latestMessage.text.value
              // Only update UI if we have new content
              if (currentResponse !== fullResponse) {
                fullResponse = currentResponse
                responseUI.update(
                  <BotMessage content={fullResponse} />
                )
              }
            }
          }
        }
        
        // Wait before polling again to prevent rate limiting
        await sleep(1000)
      }

      // Update the AI state with the complete conversation
      if (fullResponse) {
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            // Add user message to history
            {
              id: nanoid(),
              role: 'user',
              content
            },
            // Add assistant response to history
            {
              id: nanoid(),
              role: 'assistant',
              content: fullResponse
            }
          ]
        })
      }
    } catch (error) {
      // Log errors and show user-friendly message
      console.error('Error in submitUserMessage:', error)
      responseUI.done(
        <BotMessage content="Sorry, something went wrong. Please try again." />
      )
    }
  })

  // Return streamable UI component
  return {
    id: nanoid(),
    display: responseUI.value
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

    if (session && session.user) {
      const aiState = getAIState() as Chat

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
