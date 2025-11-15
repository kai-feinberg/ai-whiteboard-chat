import * as React from "react"
import { LayoutDashboard, MessageSquare, CreditCard, Sparkles, Bot } from "lucide-react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { UserButton, OrganizationSwitcher } from "@clerk/tanstack-react-start"
import { useCustomer } from "autumn-js/react"
import { Button } from "@/components/ui/button"
import { DevCreditsAdjuster } from "@/components/dev-credits-adjuster"

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

  // Get top-up credits
  const topUpCredits = customer?.features?.topup_credits;
  const topUpBalance = topUpCredits?.balance || 0;

  // Total credits

  return (
    <div className="space-y-3">
      {/* Organization Switcher */}
      <OrganizationSwitcher
        hidePersonal={false}
        afterCreateOrganizationUrl={() => window.location.href = '/'}
        afterSelectOrganizationUrl={() => window.location.href = '/'}
        appearance={{
          elements: {
            rootBox: "w-full",
            organizationSwitcherTrigger: "w-full px-3 py-2 rounded-md border-0 bg-sidebar-accent/40 hover:bg-sidebar-accent/60 justify-start transition-colors",
            organizationSwitcherTriggerIcon: { color: "oklch(0.98 0.005 70 / 0.7)" },
            organizationPreviewAvatarBox: "w-7 h-7",
            organizationPreviewMainIdentifier: { color: "oklch(0.98 0.005 70)", fontSize: "0.875rem", fontWeight: 500 },
            organizationPreviewSecondaryIdentifier: { color: "oklch(0.98 0.005 70 / 0.7)", fontSize: "0.75rem" },
          }
        }}
      />

      {/* User Profile */}
      <UserButton
        appearance={{
          variables: {
            colorText: "oklch(0.98 0.005 70)",
            colorTextSecondary: "oklch(0.98 0.005 70 / 0.7)",
          },
          elements: {
            userButtonBox: "w-full",
            userButtonTrigger: "w-full px-3 py-2 rounded-md hover:bg-sidebar-accent justify-start transition-colors",
            userButtonAvatarBox: "w-7 h-7 order-first",
            userButtonOuterIdentifier: "text-sm font-medium text-sidebar-foreground",
            userButtonInnerIdentifier: "text-xs text-sidebar-foreground/70",
          }
        }}
        showName={true}
      />

      {/* Divider */}
      <div className="border-t border-sidebar-border" />

      {/* Credits Display - smaller text */}
      <div className="px-1 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-medium">Monthly</span>
          <span className="text-xs font-semibold text-sidebar-foreground">{balance.toLocaleString()} / {included.toLocaleString()}</span>
        </div>
        {isPro && topUpBalance > 0 && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-medium">Top-Up</span>
            <span className="text-xs font-semibold text-sidebar-foreground">{topUpBalance.toLocaleString()}</span>
          </div>
        )}

      </div>

      {/* Upgrade Button - outline style */}
      {!isPro && (
        <Button asChild variant="outline" size="sm" className="w-full text-sidebar-foreground border-sidebar-border hover:bg-accent hover:text-accent-foreground text-black">
          <Link to="/pricing">
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade to Pro
          </Link>
        </Button>
      )}

      {/* Dev Credits Adjuster - localhost only */}
      <DevCreditsAdjuster />
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar {...props} className="border-none shadow-none">
      <SidebarHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-semibold text-xl m-2 text-sidebar-foreground hover:opacity-80 transition-opacity">
            <span>Sprawl AI</span>
          </Link>
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
                        ? "font-semibold text-sidebar-foreground text-[16px] bg-sidebar-footer !outline-1 outline-sidebar-border rounded-lg"
                        : "font-medium text-sidebar-foreground/70 text-[16px] hover:text-sidebar-foreground bg-transparent hover:bg-transparent rounded-lg"
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
        <div className="bg-sidebar-footer rounded-xl p-4">
          <UserCreditsCard />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
