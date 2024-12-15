import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-6">
        <h1 className="text-lg font-semibold">
          Welcome to Athena AI
        </h1>
        <p className="leading-normal text-muted-foreground">
          The best AI-powered tutoring platform, fusing high-powered industry-standard models with academic honesty and transparency.
        </p>
        <p className="leading-normal text-muted-foreground">
          Our platform allows professors to create tailored chatbots for their students, upholding academic integrity by discouraging cheating and enabling high-quality learning anytime, anywhere.
        </p>
        <p className="leading-normal text-muted-foreground">
          Experience the future of education with Athena AI, where innovation and learning converge.
        </p>
      </div>
    </div>
  )
}
