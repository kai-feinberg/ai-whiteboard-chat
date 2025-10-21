import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Outlet,
  useRouteContext,
} from '@tanstack/react-router'
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  OrganizationSwitcher,
  useAuth,
  useOrganization,
  useClerk,
  useOrganizationList,
} from '@clerk/tanstack-react-start'
import { createServerFn } from '@tanstack/react-start'
import { QueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { auth } from '@clerk/tanstack-react-start/server'
import appCss from '~/styles/app.css?url'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { Toaster } from '@/components/ui/sonner'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const authData = await auth()
  const token = await authData.getToken({ template: 'convex' })

  return {
    userId: authData.userId,
    orgId: authData.orgId,
    token,
  }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AdScout - Ad Intelligence Platform',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const auth = await fetchClerkAuth()
    const { userId, orgId, token } = auth

    // During SSR only (the only time serverHttpClient exists),
    // set the Clerk auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return {
      userId,
      orgId,
      token,
    }
  },
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>
        <RootDocument>
          <SignedIn>
            <AuthenticatedContent />
          </SignedIn>
          <SignedOut>
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <div className="w-full max-w-md space-y-8 p-8">
                <div className="text-center">
                  <h1 className="text-4xl font-bold tracking-tight">AdScout</h1>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Ad Intelligence Platform
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Sign in to track, analyze, and discover winning ad campaigns
                  </p>
                </div>
                <div className="mt-8 flex justify-center">
                  <SignInButton mode="modal">
                    <button className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              </div>
            </div>
          </SignedOut>
          <Toaster />
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function AuthenticatedContent() {
  const { organization, isLoaded } = useOrganization()
  const clerk = useClerk()
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })
  const [isSettingOrg, setIsSettingOrg] = React.useState(false)

  // Auto-select first organization if none is active
  React.useEffect(() => {
    async function autoSelectFirstOrg() {
      if (!isLoaded || isSettingOrg) return

      if (!organization && userMemberships?.data && userMemberships.data.length > 0) {
        setIsSettingOrg(true)
        try {
          // Set the first organization as active
          await clerk.setActive({ organization: userMemberships.data[0].organization.id })
          window.location.reload()
        } catch (error) {
          console.error('Failed to auto-select organization:', error)
          setIsSettingOrg(false)
        }
      }
    }

    autoSelectFirstOrg()
  }, [isLoaded, organization, clerk, userMemberships, isSettingOrg])

  if (!isLoaded || isSettingOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Create an Organization</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to continue using AdScout
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl={() => window.location.href = '/'}
              afterSelectOrganizationUrl={() => window.location.href = '/'}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-semibold">AdScout</span>
          <div className="ml-auto flex items-center gap-4">
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl={() => window.location.href = '/'}
              afterSelectOrganizationUrl={() => window.location.href = '/'}
            />
            <UserButton />
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
