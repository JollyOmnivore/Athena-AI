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

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()
  
  if (!ASSISTANT_ID) {
    throw new Error('OPENAI_ASSISTANT_ID is not set')
  }

  const responseUI = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      <SpinnerMessage />
    </div>
  )

  runAsyncFnWithoutBlocking(async () => {
    try {
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
        assistant_id: ASSISTANT_ID
      })

      let fullResponse = ''
      while (true) {
        const runStatus = await openAIClient.beta.threads.runs.retrieve(
          threadId,
          run.id
        )
        
        if (runStatus.status === 'completed') {
          const messages = await openAIClient.beta.threads.messages.list(threadId)
          if (messages.data[0]?.content?.[0]) {
            const response = messages.data[0].content[0]
            if (response && 'text' in response) {
              fullResponse = response.text.value
              responseUI.done(
                <BotMessage content={fullResponse} />
              )
              break
            }
          }
        } else if (runStatus.status === 'failed') {
          responseUI.done(
            <BotMessage content="Sorry, I encountered an error processing your request." />
          )
          throw new Error('Assistant run failed')
        } else if (runStatus.status === 'in_progress') {
          const messages = await openAIClient.beta.threads.messages.list(threadId)
          if (messages.data[0]?.content?.[0]) {
            const latestMessage = messages.data[0].content[0]
            if (latestMessage && 'text' in latestMessage) {
              const currentResponse = latestMessage.text.value
              if (currentResponse !== fullResponse) {
                fullResponse = currentResponse
                responseUI.update(
                  <BotMessage content={fullResponse} />
                )
              }
            }
          }
        }
        
        await sleep(1000)
      }

      if (fullResponse) {
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'user',
              content
            },
            {
              id: nanoid(),
              role: 'assistant',
              content: fullResponse
            }
          ]
        })
      }
    } catch (error) {
      console.error('Error in submitUserMessage:', error)
      responseUI.done(
        <BotMessage content="Sorry, something went wrong. Please try again." />
      )
    }
  })

  return {
    id: nanoid(),
    display: responseUI.value
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
