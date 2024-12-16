import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { allowedEmails } from '@/lib/allowed-emails'

export default async function DashboardLayout() {
  const session = await auth()

  // Check if user's email is in the allowed list
  const email = session?.user?.email
  if (!email || !allowedEmails.includes(email)) {
    redirect('/')
  }

  return (
    <div className="mx-auto max-w-4xl px-8 text-black text-center">
      <section className="rounded-lg border bg-background p-12">
        <div className="grid grid-cols-2">
          <div className="flex flex-col gap-16 pr-8 border-r-2 border-gray-300">
            {/* Left Side Vertical Layout */}
            <Link
              href="/"
              className="p-8 bg-blue-200 rounded shadow hover:bg-blue-300 transition text-black"
            >
              <div className="font-bold">Go to Home</div>
            </Link>

            <div className="p-8 bg-purple-200 rounded shadow">View Student Chats</div>
          </div>

          <div className="flex flex-col gap-16 pl-8">
            {/* Right Side Vertical Layout */}
            <div className="p-8 bg-green-200 rounded shadow">Class 1</div>
            <div className="p-8 bg-yellow-200 rounded shadow">Class 2</div>
            <div className="p-8 bg-red-200 rounded shadow">Class 3</div>
            <div className="p-8 bg-orange-200 rounded shadow">Class 4</div>
          </div>
        </div>
      </section>
    </div>
  )
}
