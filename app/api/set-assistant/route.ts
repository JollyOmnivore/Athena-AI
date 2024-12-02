import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { assistantId } = await request.json()
  
  // Set the cookie
  cookies().set('selectedAssistantId', assistantId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  })

  return NextResponse.json({ success: true })
} 