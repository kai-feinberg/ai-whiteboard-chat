import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Target, DollarSign } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const stats = [
  {
    title: "Total Ads Created",
    value: "24",
    change: "+12% from last month",
    icon: Target,
  },
  {
    title: "Active Campaigns",
    value: "8",
    change: "3 pending review",
    icon: TrendingUp,
  },
  {
    title: "Avg. Engagement",
    value: "4.2%",
    change: "+0.8% from last month",
    icon: Users,
  },
  {
    title: "Total Spend",
    value: "$12,450",
    change: "+18% from last month",
    icon: DollarSign,
  },
];

function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your ad performance and activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">New ad created</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Campaign launched</p>
                  <p className="text-xs text-muted-foreground">5 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Ad pending review</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Summer Sale Campaign</p>
                  <p className="text-xs text-muted-foreground">6.2% CTR</p>
                </div>
                <div className="text-sm font-medium text-green-600">+24%</div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Product Launch</p>
                  <p className="text-xs text-muted-foreground">5.8% CTR</p>
                </div>
                <div className="text-sm font-medium text-green-600">+18%</div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Brand Awareness</p>
                  <p className="text-xs text-muted-foreground">4.9% CTR</p>
                </div>
                <div className="text-sm font-medium text-green-600">+12%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
