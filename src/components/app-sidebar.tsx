import * as React from "react"
import { LayoutDashboard, Eye, MessageSquare, Search } from "lucide-react"
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

// Navigation data - simplified to core routes
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      items: [
        {
          title: "Overview",
          url: "/",
          icon: Eye,
        },
      ],
    },
    {
      title: "AI Chat",
      url: "/ai-chat",
      icon: MessageSquare,
      items: [
        {
          title: "Document Playground",
          url: "/ai-chat",
          icon: MessageSquare,
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
            {data.navMain.map((item) => {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url} className="font-medium">
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <SubIcon className="h-4 w-4" />
                                {subItem.title}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
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
