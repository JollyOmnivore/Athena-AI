'use client'

import { useState, useEffect } from 'react'
import { spinner } from '@/components/stocks/spinner'
import { IconOpenAI } from '@/components/ui/icons'

const loadingPhrases = [
  "Vectorizing coursework...",
  "Analyzing user interaction...",
  "Generating helpful notes...",
  "Processing educational context...",
  "Preparing personalized response...",
  "Reviewing learning materials..."
]

export function SpinnerMessage() {
  const [currentPhrase, setCurrentPhrase] = useState(loadingPhrases[0])
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase(prev => {
        const currentIndex = loadingPhrases.indexOf(prev)
        const nextIndex = (currentIndex + 1) % loadingPhrases.length
        return loadingPhrases[nextIndex]
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="group relative flex items-start md:-ml-12 opacity-60">
      <div className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
        <IconOpenAI />
      </div>
      <div className="ml-4 flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
        <div className="flex items-center gap-2">
          {spinner}
          <span className="text-sm text-muted-foreground animate-fade-in">
            {currentPhrase}
          </span>
        </div>
      </div>
    </div>
  )
} 