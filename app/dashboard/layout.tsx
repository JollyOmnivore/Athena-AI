import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { allowedEmails } from '@/lib/allowed-emails'

export default async function DashboardLayout() {
  const session = await auth()

  // Check if user's email is in the allowed list
  const email = session?.user?.email
  if (!email || !allowedEmails.includes(email)) {
    redirect('/') // Redirect unauthorized users to the home page
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <div className="grid grid-cols-2 gap-6 p-8 bg-white rounded shadow-md">
          {/* Box 1: Link to "/" */}
          <Link
            href="/"
            className="p-6 bg-blue-200 rounded shadow hover:bg-blue-300 transition"
          >
            <div className="text-center font-bold">Go to Home</div>
          </Link>

          {/* Other Boxes */}
          <div className="p-6 bg-green-200 rounded shadow">Box 2</div>
          <div className="p-6 bg-yellow-200 rounded shadow">Box 3</div>
          <div className="p-6 bg-red-200 rounded shadow">Box 4</div>
        </div>
      </div>
    </div>
  )
}
