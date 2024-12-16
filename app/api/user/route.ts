import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  console.log('API Session:', session)
  console.log('API User email:', session?.user?.email)
  return NextResponse.json({ 
    email: session?.user?.email || null 
  })
} 