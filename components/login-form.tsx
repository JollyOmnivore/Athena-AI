'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { authenticate } from '@/app/login/actions'
import Link from 'next/link'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { IconSpinner } from './ui/icons'
import { getMessageFromCode } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [result, dispatch] = useFormState(authenticate, undefined)

  useEffect(() => {
    if (result) {
      if (result.type === 'error') {
        toast.error(getMessageFromCode(result.resultCode))
      } else {
        toast.success(getMessageFromCode(result.resultCode))
        router.refresh()
      }
    }
  }, [result, router])

  return (
    <div className="flex min-h-screen">
      {/* Left side with background image */}
      <div
        className="w-3/4 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://aadcdn.msauthimages.net/dbd5a2dd-c3bph4vvox91wi95bikb-7ynz0urfj3eigczrwjfrwg/logintenantbranding/0/illustration?ts=638062018908988317')",
        }}
      ></div>

      {/* Right side with login box */}
      <div className="w-1/4 flex items-center justify-center bg-white">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
          <div className="flex flex-col items-center py-6 px-8">
            <img
              src="https://logowik.com/content/uploads/images/t_western-colorado-university5212.logowik.com.webp"
              alt="Western Logo"
              className="w-60 h-40"
            />
            <h1 className="text-xl font-bold text-gray-800 dark:text-black mb-2">
              Western Colorado University
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
            Sign into Office 365 with your Western email address and password. 
            If you experience any problems, please submit this form to get help from IT Services.
            </p>
          </div>
          <form
            action={dispatch}
            className="flex flex-col gap-6 px-8 py-6"
          >
            <div>
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>
            <LoginButton />
          </form>
          <div className="flex justify-center pb-6">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className={`mt-4 h-10 w-15 items-center justify-center rounded-md text-white font-medium ${
        pending
          ? 'bg-blue-600 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700'
      }`}
      aria-disabled={pending}
    >
      {pending ? <IconSpinner /> : 'Sign in'}
    </button>
  )
}
