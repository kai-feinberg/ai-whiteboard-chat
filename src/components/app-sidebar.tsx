import * as React from "react"
import { LayoutDashboard, MessageSquare, CreditCard, Sparkles, Bot } from "lucide-react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { UserButton, OrganizationSwitcher } from "@clerk/tanstack-react-start"
import { useCustomer } from "autumn-js/react"
import { Button } from "@/components/ui/button"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// Navigation data - simplified to core routes
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Playground",
      url: "/playground",
      icon: MessageSquare,
    },
    {
      title: "Pricing",
      url: "/pricing",
      icon: CreditCard,
    },
    {
      title: "Custom Agents",
      url: "/settings/custom-agents",
      icon: Bot,
    },
  ],
}

function UserCreditsCard() {
  const { customer } = useCustomer({
    swrConfig: {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      refreshWhenHidden: false,
    }
  });

  // Get current product
  const currentProduct = customer?.products?.[0];
  const productName = currentProduct?.name || "Free";
  const isPro = productName === "Pro";

  // Get credits info
  const creditsFeature = customer?.features?.ai_credits;
  const balance = creditsFeature?.balance || 0;
  const included = creditsFeature?.included_usage || 0;
  const percentRemaining = included > 0 ? (balance / included) * 100 : 0;
  const isLow = percentRemaining < 20;

  return (
    <div className="border rounded-lg bg-sidebar-accent/30 p-3 space-y-3 shadow-md">
      {/* User Info */}
      <UserButton
        appearance={{
          elements: {
            userButtonBox: "flex-row-reverse",
            userButtonAvatarBox: "w-10 h-10",
            userButtonTrigger: "w-full justify-start px-0 py-0 rounded-md hover:bg-transparent",
            userButtonOuterIdentifier: "text-sm font-semibold",
            userButtonInnerIdentifier: "text-xs text-muted-foreground",
          }
        }}
        showName={true}
      />

      {/* Tier and Credits Combined */}
      <div className="space-y-2.5 pt-2 border-t">
        {/* Tier Badge - only show for Pro */}
        {isPro && (
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">{productName}</span>
          </div>
        )}

        {/* Credits Info */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/70">AI Credits</span>
            <span className="text-sm font-semibold">{balance.toLocaleString()} / {included.toLocaleString()}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isLow ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${Math.max(0, Math.min(100, percentRemaining))}%` }}
            />
          </div>
        </div>

        {/* Upgrade Button */}
        {!isPro && (
          <Button asChild size="sm" className="w-full mt-1">
            <Link to="/pricing">
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to Pro
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar {...props} className="bg-transparent border-none shadow-none">
      <SidebarHeader className="pb-4">
        <div className="flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="default" asChild>
                <Link to="/" className="font-semibold text-xl m-2">
                  <span>Sprawl AI</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarMenu className="gap-1.5">
            {data.navMain.map((item) => {
              const Icon = item.icon;
              const isActive = matchRoute({ to: item.url, fuzzy: item.url === "/" ? false : true });

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg" isActive={!!isActive}>
                    <Link
                      to={item.url}
                      className={isActive
                        ? "font-semibold text-foreground text-[16px] bg-accent/40"
                        : "font-medium text-foreground/85 text-[16px] hover:text-foreground hover:bg-accent"
                      }
                    >
                      <Icon className="h-5 w-5" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 pt-6">
        <div className="flex flex-col gap-3">
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl={() => window.location.href = '/'}
            afterSelectOrganizationUrl={() => window.location.href = '/'}
          />
          <UserCreditsCard />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
