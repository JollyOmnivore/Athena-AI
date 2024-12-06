import { auth } from '@/auth'
import { allowedEmails } from '@/lib/allowed-emails'
import { redirect } from 'next/navigation'

export default async function RedirectorPage() {
  const session = await auth()

  if (!session) {
    redirect('/') // Redirect to home if session doesn't exist
  }

  const email = session.user?.email

  if (email && allowedEmails.includes(email)) {
    redirect('/dashboard') // Redirect to dashboard
  } else {
    redirect('/') // Redirect to home
  }

  return null
}