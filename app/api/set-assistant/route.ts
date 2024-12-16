import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await auth()
    console.log('API Session:', session) // Debug log
  console.log('API User email:', session?.user?.email) // Debug log
  console.log('Allowed emails:', process.env.ALLOWED_EMAILS) // Debug log
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { assistantId } = await request.json()
  
  // Set the cookie
  cookies().set('selectedAssistantId', assistantId)
  
  return NextResponse.json({ success: true })
}