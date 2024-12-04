import { getSession } from 'next-auth/react'
import { auth } from '@/auth'
import { redirect, useRouter } from 'next/navigation'
import { allowedEmails } from '@/lib/allowed-emails'
import { router } from 'next/client'

export default async function RedirectorPage() {
  const router = useRouter()
  const session = await auth();

  if (!session) {
    redirect('/')
  }

  const email = session.user?.email

  if (email && allowedEmails.includes(email)) {
    router.refresh()
    redirect('/dashboard')
  } else {
    redirect('/')
  }
  return null
}