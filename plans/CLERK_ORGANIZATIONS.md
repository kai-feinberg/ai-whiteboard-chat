# Clerk Organizations - Comprehensive Guide for TanStack Start

## Table of Contents
1. [Overview](#overview)
2. [Core Hooks](#core-hooks)
3. [Prebuilt UI Components](#prebuilt-ui-components)
4. [Common Patterns](#common-patterns)
5. [Custom Flows](#custom-flows)
6. [Best Practices](#best-practices)

---

## Overview

Clerk Organizations enable multi-tenancy in your application, allowing users to create and join organizations, manage members, and handle invitations. This guide focuses on React/TanStack Start implementations.

### Key Concepts

- **Organization**: A group of users with shared resources and permissions
- **Membership**: A user's association with an organization, including their role
- **Invitation**: A request for a user to join an organization
- **Active Organization**: The currently selected organization in the user's session

---

## Core Hooks

### `useOrganization()`

Access and manage the currently active organization.

#### Basic Usage

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

function OrganizationInfo() {
  const { organization, isLoaded } = useOrganization()

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!organization) {
    return <div>No active organization</div>
  }

  return <div>Active organization: {organization.name}</div>
}
```

#### Fetching Members with Pagination

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

function MemberListPage() {
  const { memberships } = useOrganization({
    memberships: {
      keepPreviousData: true, // Persist cached data until new data is fetched
    },
  })

  if (!memberships) {
    return null
  }

  return (
    <div>
      <h2>Organization members</h2>
      <ul>
        {memberships.data?.map((membership) => (
          <li key={membership.id}>
            {membership.publicUserData?.firstName} {membership.publicUserData?.lastName} &lt;
            {membership.publicUserData?.identifier}&gt; :: {membership.role}
          </li>
        ))}
      </ul>

      <button
        disabled={!memberships.hasPreviousPage}
        onClick={memberships.fetchPrevious}
      >
        Previous page
      </button>

      <button
        disabled={!memberships.hasNextPage}
        onClick={memberships.fetchNext}
      >
        Next page
      </button>
    </div>
  )
}
```

#### Infinite Scroll for Members

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

function MemberList() {
  const { memberships } = useOrganization({
    memberships: {
      infinite: true, // Append new data to existing list
      keepPreviousData: true,
    },
  })

  if (!memberships) {
    return null
  }

  return (
    <div>
      <h2>Organization members</h2>
      <ul>
        {memberships.data?.map((membership) => (
          <li key={membership.id}>
            {membership.publicUserData?.firstName} {membership.publicUserData?.lastName} &lt;
            {membership.publicUserData?.identifier}&gt; :: {membership.role}
          </li>
        ))}
      </ul>

      <button
        disabled={!memberships.hasNextPage}
        onClick={memberships.fetchNext}
      >
        Load more
      </button>
    </div>
  )
}
```

#### Fetching Invitations

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

const OrgInvitationsParams = {
  invitations: {
    pageSize: 5,
    keepPreviousData: true,
  },
}

function InvitationList() {
  const { isLoaded, invitations, memberships } = useOrganization({
    ...OrgInvitationsParams,
  })

  if (!isLoaded) {
    return <>Loading</>
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Invited</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invitations?.data?.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.emailAddress}</td>
              <td>{inv.createdAt.toLocaleDateString()}</td>
              <td>{inv.role}</td>
              <td>
                <button
                  onClick={async () => {
                    await inv.revoke()
                    await Promise.all([
                      memberships?.revalidate,
                      invitations?.revalidate
                    ])
                  }}
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button
          disabled={!invitations?.hasPreviousPage || invitations?.isFetching}
          onClick={() => invitations?.fetchPrevious?.()}
        >
          Previous
        </button>

        <button
          disabled={!invitations?.hasNextPage || invitations?.isFetching}
          onClick={() => invitations?.fetchNext?.()}
        >
          Next
        </button>
      </div>
    </>
  )
}
```

#### Managing Custom Roles

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'
import { OrganizationCustomRoleKey } from '@clerk/types'
import { useState, useEffect, useRef } from 'react'

function SelectRole({
  fieldName,
  isDisabled = false,
  onChange,
  defaultRole
}: {
  fieldName: string
  isDisabled?: boolean
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  defaultRole?: string
}) {
  const { organization } = useOrganization()
  const [fetchedRoles, setRoles] = useState<OrganizationCustomRoleKey[]>([])
  const isPopulated = useRef(false)

  useEffect(() => {
    if (isPopulated.current) return
    organization
      ?.getRoles({
        pageSize: 20,
        initialPage: 1,
      })
      .then((res) => {
        isPopulated.current = true
        setRoles(res.data.map((roles) => roles.key as OrganizationCustomRoleKey))
      })
  }, [organization?.id])

  if (fetchedRoles.length === 0) return null

  return (
    <select
      name={fieldName}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      onChange={onChange}
      defaultValue={defaultRole}
    >
      {fetchedRoles?.map((roleKey) => (
        <option key={roleKey} value={roleKey}>
          {roleKey}
        </option>
      ))}
    </select>
  )
}
```

### `useOrganizationList()`

Manage multiple organizations and switch between them.

#### Display User's Organizations

```tsx
import { useOrganizationList } from '@clerk/tanstack-react-start'

function JoinedOrganizations() {
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })

  if (!isLoaded) {
    return <>Loading</>
  }

  return (
    <>
      <ul>
        {userMemberships.data?.map((mem) => (
          <li key={mem.id}>
            <span>{mem.organization.name}</span>
            <button
              onClick={() => setActive({ organization: mem.organization.id })}
            >
              Select
            </button>
          </li>
        ))}
      </ul>

      <button
        disabled={!userMemberships.hasNextPage}
        onClick={() => userMemberships.fetchNext()}
      >
        Load more
      </button>
    </>
  )
}
```

#### Create New Organization

```tsx
import { useOrganizationList } from '@clerk/tanstack-react-start'
import { FormEventHandler, useState } from 'react'

function CreateOrganization() {
  const { isLoaded, createOrganization } = useOrganizationList()
  const [organizationName, setOrganizationName] = useState('')

  if (!isLoaded) return null

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    createOrganization({ name: organizationName })
      .then((res) => {
        console.log('Organization created:', res)
      })
      .catch((err) => {
        console.error('Error creating organization:', JSON.stringify(err, null, 2))
      })
    setOrganizationName('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="organizationName"
        value={organizationName}
        onChange={(e) => setOrganizationName(e.currentTarget.value)}
        placeholder="Organization name"
      />
      <button type="submit">Create organization</button>
    </form>
  )
}
```

#### Display User Invitations

```tsx
import { useOrganizationList } from '@clerk/tanstack-react-start'

function UserInvitationsTable() {
  const { isLoaded, userInvitations } = useOrganizationList({
    userInvitations: {
      infinite: true,
      keepPreviousData: true,
    },
  })

  if (!isLoaded || userInvitations.isLoading) {
    return <>Loading</>
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Org name</th>
          </tr>
        </thead>
        <tbody>
          {userInvitations.data?.map((inv) => (
            <tr key={inv.id}>
              <th>{inv.emailAddress}</th>
              <th>{inv.publicOrganizationData.name}</th>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        disabled={!userInvitations.hasPreviousPage}
        onClick={userInvitations.fetchPrevious}
      >
        Prev
      </button>
      <button
        disabled={!userInvitations.hasNextPage}
        onClick={userInvitations.fetchNext}
      >
        Next
      </button>
    </>
  )
}
```

### `useAuth()`

Get the current organization ID from the session.

```tsx
import { useAuth } from '@clerk/tanstack-react-start'

function CurrentOrgIndicator() {
  const { orgId } = useAuth()

  return (
    <div>
      {orgId ? `Current org: ${orgId}` : 'No active organization'}
    </div>
  )
}
```

---

## Prebuilt UI Components

Clerk provides several prebuilt components that handle all the UI and logic for organization management.

### `<OrganizationSwitcher />`

Allows users to switch between organizations and their personal account.

#### Basic Usage

```tsx
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organization-switcher')({
  component: OrganizationSwitcherPage,
})

function OrganizationSwitcherPage() {
  return <OrganizationSwitcher />
}
```

#### With URL Slugs

```tsx
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

function Header() {
  return (
    <OrganizationSwitcher
      hideSlug={false} // Allow users to customize the org's URL slug
      afterCreateOrganizationUrl="/orgs/:slug"
      afterSelectOrganizationUrl="/orgs/:slug"
    />
  )
}
```

#### Customizing with Additional Pages

```tsx
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

const DotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z" />
  </svg>
)

const CustomPage = () => (
  <div>
    <h1>Custom page</h1>
    <p>This is the content of the custom page.</p>
  </div>
)

function Header() {
  return (
    <header>
      <OrganizationSwitcher>
        {/* Add custom page */}
        <OrganizationSwitcher.OrganizationProfilePage
          label="Custom Page"
          url="custom"
          labelIcon={<DotIcon />}
        >
          <CustomPage />
        </OrganizationSwitcher.OrganizationProfilePage>

        {/* Add custom link */}
        <OrganizationSwitcher.OrganizationProfileLink
          label="Homepage"
          url="/"
          labelIcon={<DotIcon />}
        />

        {/* Reorder default pages */}
        <OrganizationSwitcher.OrganizationProfilePage label="members" />
        <OrganizationSwitcher.OrganizationProfilePage label="general" />
      </OrganizationSwitcher>
    </header>
  )
}
```

### `<OrganizationProfile />`

Full-featured organization management interface.

```tsx
import { OrganizationProfile } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

// Note: Use a catch-all route for full functionality
export const Route = createFileRoute('/organization-profile/$')({
  component: OrganizationProfilePage,
})

function OrganizationProfilePage() {
  return <OrganizationProfile />
}
```

### `<OrganizationList />`

Display and manage all organizations the user is part of.

```tsx
import { OrganizationList } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organizations')({
  component: OrganizationListPage,
})

function OrganizationListPage() {
  return (
    <OrganizationList
      afterCreateOrganizationUrl={(org) => `/organization/${org.slug}`}
      afterSelectPersonalUrl={(user) => `/user/${user.id}`}
      afterSelectOrganizationUrl={(org) => `/organization/${org.slug}`}
    />
  )
}
```

### `<CreateOrganization />`

Dedicated organization creation form.

```tsx
import { CreateOrganization } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/create-organization')({
  component: CreateOrganizationPage,
})

function CreateOrganizationPage() {
  return <CreateOrganization />
}
```

### `<TaskChooseOrganization />`

Onboarding component for organization selection.

```tsx
import { TaskChooseOrganization } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/onboarding/choose-organization')({
  component: ChooseOrganizationPage,
})

function ChooseOrganizationPage() {
  return <TaskChooseOrganization redirectUrlComplete="/dashboard" />
}
```

---

## Common Patterns

### Protecting Routes by Organization

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

function OrganizationPage({ params }: { params: { slug: string } }) {
  const { organization } = useOrganization()

  // Check if organization slug matches URL
  if (!organization || organization.slug !== params.slug) {
    return (
      <>
        <p>Sorry, organization {params.slug} is not valid.</p>
        <OrganizationSwitcher
          hidePersonal={false}
          hideSlug={false}
          afterCreateOrganizationUrl="/orgs/:slug"
          afterSelectOrganizationUrl="/orgs/:slug"
          afterSelectPersonalUrl="/me"
        />
      </>
    )
  }

  return <div>Welcome to organization {organization.name}</div>
}
```

### Organization Switcher with Current Selection

```tsx
import { useAuth, useOrganizationList } from '@clerk/tanstack-react-start'

function JoinedOrganizations() {
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: {
      pageSize: 5,
      keepPreviousData: true,
    },
  })
  const { orgId } = useAuth()

  if (!isLoaded) {
    return <p>Loading...</p>
  }

  return (
    <>
      <h1>Joined organizations</h1>
      {userMemberships?.data?.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Identifier</th>
              <th>Organization</th>
              <th>Joined</th>
              <th>Role</th>
              <th>Set as active org</th>
            </tr>
          </thead>
          <tbody>
            {userMemberships?.data?.map((mem) => (
              <tr key={mem.id}>
                <td>{mem.publicUserData.identifier}</td>
                <td>{mem.organization.name}</td>
                <td>{mem.createdAt.toLocaleDateString()}</td>
                <td>{mem.role}</td>
                <td>
                  {orgId === mem.organization.id ? (
                    <p>Currently active</p>
                  ) : (
                    <button
                      onClick={() => setActive({ organization: mem.organization.id })}
                    >
                      Set as active
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
```

### Invite Members with Role Selection

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'
import { OrganizationCustomRoleKey } from '@clerk/types'
import { useState } from 'react'

const OrgMembersParams = {
  memberships: {
    pageSize: 5,
    keepPreviousData: true,
  },
}

const OrgInvitationsParams = {
  invitations: {
    pageSize: 5,
    keepPreviousData: true,
  },
}

function InviteMember() {
  const { isLoaded, organization, invitations } = useOrganization(OrgInvitationsParams)
  const [emailAddress, setEmailAddress] = useState('')
  const [disabled, setDisabled] = useState(false)

  if (!isLoaded || !organization) {
    return <>Loading</>
  }

  const onSubmit = async (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()

    const submittedData = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as {
      email: string | undefined
      role: OrganizationCustomRoleKey | undefined
    }

    if (!submittedData.email || !submittedData.role) {
      return
    }

    setDisabled(true)
    await organization.inviteMember({
      emailAddress: submittedData.email,
      role: submittedData.role,
    })
    await invitations?.revalidate?.()
    setEmailAddress('')
    setDisabled(false)
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        name="email"
        type="text"
        placeholder="Email address"
        value={emailAddress}
        onChange={(e) => setEmailAddress(e.target.value)}
      />
      <label>Role</label>
      <SelectRole fieldName="role" />
      <button type="submit" disabled={disabled}>
        Invite
      </button>
    </form>
  )
}
```

### Managing Membership Requests

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

const MembershipRequestsParams = {
  membershipRequests: {
    pageSize: 5,
    keepPreviousData: true,
  },
}

function MembershipRequests() {
  const { isLoaded, membershipRequests } = useOrganization(MembershipRequestsParams)

  if (!isLoaded) {
    return <>Loading</>
  }

  return (
    <>
      <h1>Membership requests</h1>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Date requested</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {membershipRequests?.data?.map((mem) => (
            <tr key={mem.id}>
              <td>{mem.publicUserData.identifier}</td>
              <td>{mem.createdAt.toLocaleDateString()}</td>
              <td>
                <button
                  onClick={async () => {
                    await mem.accept()
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={async () => {
                    await mem.reject()
                  }}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button
          disabled={
            !membershipRequests?.hasPreviousPage ||
            membershipRequests?.isFetching
          }
          onClick={() => membershipRequests?.fetchPrevious?.()}
        >
          Previous
        </button>

        <button
          disabled={
            !membershipRequests?.hasNextPage ||
            membershipRequests?.isFetching
          }
          onClick={() => membershipRequests?.fetchNext?.()}
        >
          Next
        </button>
      </div>
    </>
  )
}
```

---

## Custom Flows

### Conditional Organization Display

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

function Dashboard() {
  const { organization, isLoaded } = useOrganization()

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!organization) {
    return (
      <div>
        <h2>Select an organization to continue</h2>
        <OrganizationSwitcher />
      </div>
    )
  }

  return (
    <div>
      <h1>Welcome to {organization.name}</h1>
      {/* Organization-specific content */}
    </div>
  )
}
```

### Pagination Configuration Options

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

function ConfigurableMemberList() {
  const { invitations } = useOrganization({
    // Option 1: Use default values (initialPage = 1, pageSize = 10)
    invitations: true,

    // Option 2: Custom pagination
    // invitations: {
    //   pageSize: 20,
    //   initialPage: 2, // skips the first page
    // },

    // Option 3: Infinite scroll
    // invitations: {
    //   infinite: true,
    // },
  })

  // Component implementation...
}
```

---

## Best Practices

### 1. Always Check `isLoaded`

```tsx
function OrganizationComponent() {
  const { organization, isLoaded } = useOrganization()

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  // Safe to use organization data
}
```

### 2. Use `keepPreviousData` for Better UX

```tsx
const { memberships } = useOrganization({
  memberships: {
    keepPreviousData: true, // Prevents flickering during pagination
  },
})
```

### 3. Handle No Active Organization State

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

function ProtectedContent() {
  const { organization, isLoaded } = useOrganization()

  if (!isLoaded) return <div>Loading...</div>

  if (!organization) {
    return (
      <div>
        <p>Please select an organization</p>
        <OrganizationSwitcher />
      </div>
    )
  }

  return <div>{/* Protected content */}</div>
}
```

### 4. Combine Multiple Data Fetches

```tsx
import { useOrganization } from '@clerk/tanstack-react-start'

function OrganizationDashboard() {
  const {
    organization,
    memberships,
    invitations,
    membershipRequests
  } = useOrganization({
    memberships: {
      pageSize: 10,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 10,
      keepPreviousData: true,
    },
    membershipRequests: {
      pageSize: 10,
      keepPreviousData: true,
    },
  })

  // All data fetched in a single hook call
}
```

### 5. Revalidate After Mutations

```tsx
async function handleRevoke(invitation) {
  await invitation.revoke()

  // Revalidate to refresh the list
  await Promise.all([
    memberships?.revalidate,
    invitations?.revalidate
  ])
}
```

### 6. Use URL Slugs for SEO

```tsx
import { OrganizationSwitcher } from '@clerk/tanstack-react-start'

function Header() {
  return (
    <OrganizationSwitcher
      hideSlug={false}
      afterCreateOrganizationUrl="/orgs/:slug"
      afterSelectOrganizationUrl="/orgs/:slug"
    />
  )
}
```

### 7. Implement Proper Error Handling

```tsx
import { useOrganizationList } from '@clerk/tanstack-react-start'

function CreateOrgForm() {
  const { createOrganization } = useOrganizationList()

  const handleSubmit = async (name: string) => {
    try {
      const org = await createOrganization({ name })
      console.log('Created:', org)
    } catch (err) {
      // Handle errors appropriately
      console.error('Error creating organization:', err)
      // Show user-friendly error message
    }
  }
}
```

### 8. Disable Actions During Loading

```tsx
function InviteButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleInvite = async () => {
    setIsLoading(true)
    try {
      // Perform invitation
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button disabled={isLoading} onClick={handleInvite}>
      {isLoading ? 'Inviting...' : 'Invite'}
    </button>
  )
}
```

---

## API Reference Quick Links

### Hooks
- `useOrganization()` - Access active organization and its data
- `useOrganizationList()` - Manage multiple organizations
- `useAuth()` - Get current organization ID

### Components
- `<OrganizationSwitcher />` - Switch between organizations
- `<OrganizationProfile />` - Full organization management UI
- `<OrganizationList />` - List all user organizations
- `<CreateOrganization />` - Create organization form
- `<TaskChooseOrganization />` - Onboarding organization selection

### Key Properties

#### Organization Object
- `id` - Unique identifier
- `name` - Organization name
- `slug` - URL-friendly identifier
- `createdAt` - Creation timestamp
- `getRoles()` - Fetch available roles
- `inviteMember()` - Send invitation

#### Membership Object
- `id` - Unique identifier
- `organization` - Organization object
- `role` - User's role
- `publicUserData` - User information
- `createdAt` - Membership creation date

#### Invitation Object
- `id` - Unique identifier
- `emailAddress` - Invitee's email
- `role` - Assigned role
- `createdAt` - Invitation creation date
- `revoke()` - Cancel invitation

---

## TanStack Start Specific Notes

### Routing Patterns

For components requiring catch-all routes (like `<OrganizationProfile />`):

```tsx
// app/routes/organization-profile.$.tsx
import { OrganizationProfile } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organization-profile/$')({
  component: OrganizationProfilePage,
})

function OrganizationProfilePage() {
  return <OrganizationProfile />
}
```

### Import Paths

Always import from `@clerk/tanstack-react-start`:

```tsx
import {
  useOrganization,
  useOrganizationList,
  OrganizationSwitcher,
  OrganizationProfile,
  OrganizationList,
  CreateOrganization,
  TaskChooseOrganization
} from '@clerk/tanstack-react-start'
```

---

## Resources

- [Clerk Organizations Documentation](https://clerk.com/docs/organizations/overview)
- [TanStack Start Quickstart](https://clerk.com/docs/quickstarts/tanstack-start)
- [Error Handling Guide](https://clerk.com/docs/guides/development/custom-flows/error-handling)
