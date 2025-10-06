import { createFileRoute, Link } from '@tanstack/react-router'
import { SignOutButton } from '@/features/auth/components/SignOutButton'

export const Route = createFileRoute('/anotherPage')({
  component: AnotherPage,
})

function AnotherPage() {

  return (
    <main className="p-8 flex flex-col gap-16">
      <h1 className="text-4xl font-bold text-center">
        Example Page
      </h1>
      <div className="flex flex-col gap-8 max-w-lg mx-auto">
        <div className="flex justify-end">
          <SignOutButton />
        </div>
        <p>This is a legacy example page. It can be removed if not needed.</p>
        <Link to="/" className="text-blue-600 underline hover:no-underline">
          Back to Home
        </Link>
      </div>
    </main>
  )
}
