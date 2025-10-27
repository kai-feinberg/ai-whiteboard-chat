import * as React from "react"
import { Search, BookmarkCheck, User, FileText, Database } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { UserButton, OrganizationSwitcher } from "@clerk/tanstack-react-start"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"

// Navigation data for AdScout app
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      items: [
        {
          title: "All Ads",
          url: "/",
        },
      ],
    },
    {
      title: "Ad Creation",
      url: "/ads",
      items: [
        {
          title: "My Ads",
          url: "/ads",
        },
        {
          title: "Create New Ad",
          url: "/ads/new",
        },
      ],
    },
    {
      title: "AI Chat",
      url: "/ai-chat",
      items: [
        {
          title: "Document Playground",
          url: "/ai-chat",
        },
      ],
    },
    {
      title: "Subscriptions",
      url: "/subscriptions",
      items: [
        {
          title: "Manage Subscriptions",
          url: "/subscriptions",
        },
      ],
    },
    {
      title: "Account",
      url: "/profile",
      items: [
        {
          title: "Profile",
          url: "/profile",
        },
      ],
    },
    {
      title: "Admin",
      url: "/admin/seed",
      items: [
        {
          title: "Seed Data",
          url: "/admin/seed",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Search className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">AdScout</span>
                  <span className="">Ad Intelligence</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link to={item.url} className="font-medium">
                    {item.title}
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <Link to={subItem.url}>{subItem.title}</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl={() => window.location.href = '/'}
            afterSelectOrganizationUrl={() => window.location.href = '/'}
          />
          <UserButton
            appearance={{
              elements: {
                userButtonBox: "flex-row-reverse",
                userButtonAvatarBox: "w-10 h-10",
                userButtonTrigger: "w-full justify-start px-2 py-2 rounded-md hover:bg-sidebar-accent",
                userButtonOuterIdentifier: "text-sm font-medium",
                userButtonInnerIdentifier: "text-xs text-muted-foreground",
              }
            }}
            showName={true}
          />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
