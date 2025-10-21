import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <SignIn routing="hash" forceRedirectUrl="/" />
    </div>
  )
}
