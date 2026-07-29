import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Filter, TrendingUp, TrendingDown } from "lucide-react";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderDashboard = () => (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Executive summary of your business</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Projects</p>
              <p className="text-2xl font-bold text-foreground mt-2">12</p>
              <p className="text-xs text-muted-foreground mt-2">+2 this month</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-2">$45,200</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp size={14} className="text-green-600" />
                <p className="text-xs text-green-600">+12% vs last month</p>
              </div>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold text-foreground mt-2">$18,500</p>
              <p className="text-xs text-muted-foreground mt-2">5 invoices</p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Quotes</p>
              <p className="text-2xl font-bold text-foreground mt-2">8</p>
              <p className="text-xs text-muted-foreground mt-2">Awaiting approval</p>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Projects</h2>
          <div className="space-y-3">
            {[
              { name: "Downtown Office Renovation", progress: 65, team: 8 },
              { name: "Residential Kitchen Remodel", progress: 45, team: 4 },
              { name: "Commercial HVAC Installation", progress: 20, team: 3 },
            ].map((project, idx) => (
              <div key={idx} className="pb-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <span className="text-xs text-muted-foreground">{project.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{project.team} team members</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Appointments</h2>
          <div className="space-y-3">
            {[
              { date: "Today 2:30 PM", client: "John Smith", type: "Site Visit" },
              { date: "Tomorrow 10:00 AM", client: "Sarah Johnson", type: "Quote Review" },
              { date: "Wed 3:00 PM", client: "Mike Davis", type: "Project Kickoff" },
            ].map((appt, idx) => (
              <div key={idx} className="pb-3 border-b border-border last:border-0">
                <p className="text-xs text-muted-foreground">{appt.date}</p>
                <p className="text-sm font-medium text-foreground mt-1">{appt.client}</p>
                <p className="text-xs text-muted-foreground">{appt.type}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { user: "Sarah Johnson", action: "Completed framing work", time: "2 hours ago" },
            { user: "John Smith", action: "Submitted invoice #INV-2024-045", time: "4 hours ago" },
            { user: "Mike Davis", action: "Approved material purchase", time: "Yesterday" },
          ].map((activity, idx) => (
            <div key={idx} className="flex gap-3 pb-3 border-b border-border last:border-0">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                {activity.user.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{activity.user}</p>
                <p className="text-xs text-muted-foreground">{activity.action}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderCRM = () => (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage leads and customer relationships
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus size={18} />
          <span className="hidden sm:inline">New Lead</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Leads by Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { status: "New", count: 5, color: "bg-blue-100 text-blue-700" },
          { status: "Quoted", count: 8, color: "bg-purple-100 text-purple-700" },
          { status: "Negotiating", count: 3, color: "bg-yellow-100 text-yellow-700" },
          { status: "Won", count: 12, color: "bg-green-100 text-green-700" },
          { status: "Lost", count: 2, color: "bg-red-100 text-red-700" },
        ].map((col) => (
          <Card key={col.status} className="p-4">
            <p className="text-xs text-muted-foreground">{col.status}</p>
            <p className={`text-2xl font-bold mt-2 ${col.color}`}>{col.count}</p>
          </Card>
        ))}
      </div>

      {/* Leads Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Leads</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Project Type</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Value</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "John Smith", status: "Quoted", type: "Kitchen Remodel", value: "$45k", activity: "2 days ago" },
                { name: "Sarah Johnson", status: "Won", type: "Office Renovation", value: "$150k", activity: "1 week ago" },
                { name: "Mike Davis", status: "Negotiating", type: "HVAC System", value: "$12k", activity: "Today" },
              ].map((lead, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-secondary transition-colors">
                  <td className="py-3 text-foreground">{lead.name}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      lead.status === "Won" ? "bg-green-100 text-green-700" :
                      lead.status === "Quoted" ? "bg-purple-100 text-purple-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">{lead.type}</td>
                  <td className="py-3 text-foreground font-medium">{lead.value}</td>
                  <td className="py-3 text-muted-foreground">{lead.activity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderBudgets = () => (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Budgets & Estimates</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Create and manage project budgets
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus size={18} />
          <span className="hidden sm:inline">New Budget</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Budget Builder</h2>
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-3">Zone: Living Room</h3>
            
            {/* Materials Section */}
            <div className="mb-4 pl-4 border-l-2 border-primary">
              <h4 className="text-sm font-semibold text-foreground mb-2">📦 Materials</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paint (10L)</span>
                  <span className="text-foreground">$150</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flooring (50 sqm)</span>
                  <span className="text-foreground">$2,500</span>
                </div>
              </div>
            </div>

            {/* Labor Section */}
            <div className="mb-4 pl-4 border-l-2 border-primary">
              <h4 className="text-sm font-semibold text-foreground mb-2">👨‍🔧 Labor</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Painter (40 hours @ $50/hr)</span>
                  <span className="text-foreground">$2,000</span>
                </div>
              </div>
            </div>

            {/* Subcontractors Section */}
            <div className="pl-4 border-l-2 border-primary">
              <h4 className="text-sm font-semibold text-foreground mb-2">🤝 Subcontractors</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Electrician</span>
                  <span className="text-foreground">$1,200</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-secondary">
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-xl font-bold text-foreground mt-1">$5,850</p>
            </Card>
            <Card className="p-4 bg-secondary">
              <p className="text-xs text-muted-foreground">Margin (25%)</p>
              <p className="text-xl font-bold text-foreground mt-1">$1,463</p>
            </Card>
            <Card className="p-4 bg-primary text-primary-foreground">
              <p className="text-xs opacity-90">Total Quote</p>
              <p className="text-xl font-bold mt-1">$7,313</p>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 bg-primary hover:bg-primary/90">Generate PDF</Button>
            <Button variant="outline" className="flex-1">Save Draft</Button>
          </div>
        </div>
      </Card>

      {/* Assembly Templates */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Assembly Templates</h2>
        <p className="text-sm text-muted-foreground mb-4">Reusable recipes for common work types</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: "Standard Kitchen Renovation", items: 12, labor: "80 hrs" },
            { name: "Bathroom Remodel", items: 8, labor: "40 hrs" },
            { name: "Flooring Installation", items: 5, labor: "30 hrs" },
          ].map((template, idx) => (
            <Card key={idx} className="p-4 border-2 border-border hover:border-primary transition-colors cursor-pointer">
              <p className="font-medium text-foreground">{template.name}</p>
              <p className="text-xs text-muted-foreground mt-2">{template.items} items • {template.labor}</p>
              <Button size="sm" className="w-full mt-3 bg-primary hover:bg-primary/90">
                Use Template
              </Button>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderCostTracking = () => (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cost Tracking & Profitability</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Compare budgeted vs. actual costs
        </p>
      </div>

      <Card className="p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-foreground mb-4">Downtown Office Renovation</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium">Item</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Budgeted</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Actual</th>
              <th className="text-right py-2 text-muted-foreground font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Materials", budgeted: 65000, actual: 68500, variance: 5.4 },
              { item: "Labor", budgeted: 50000, actual: 48200, variance: -3.6 },
              { item: "Subcontractors", budgeted: 35000, actual: 37800, variance: 8.0 },
            ].map((row, idx) => (
              <tr key={idx} className="border-b border-border hover:bg-secondary transition-colors">
                <td className="py-3 text-foreground font-medium">{row.item}</td>
                <td className="py-3 text-right text-foreground">${row.budgeted.toLocaleString()}</td>
                <td className="py-3 text-right text-foreground">${row.actual.toLocaleString()}</td>
                <td className={`py-3 text-right font-medium ${
                  row.variance > 0 ? "text-red-600" : "text-green-600"
                }`}>
                  {row.variance > 0 ? "+" : ""}{row.variance}%
                </td>
              </tr>
            ))}
            <tr className="bg-secondary font-bold">
              <td className="py-3 text-foreground">TOTAL</td>
              <td className="py-3 text-right text-foreground">$150,000</td>
              <td className="py-3 text-right text-foreground">$154,500</td>
              <td className="py-3 text-right text-red-600">+3.0%</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderPlaceholder = (title: string) => (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground mt-2">This section is coming soon...</p>
    </div>
  );

  return (
    <DashboardLayout
      activeSection={activeSection}
      onNavClick={setActiveSection}
    >
      {activeSection === "dashboard" && renderDashboard()}
      {activeSection === "crm" && renderCRM()}
      {activeSection === "budgets" && renderBudgets()}
      {activeSection === "cost-tracking" && renderCostTracking()}
      {activeSection === "projects" && renderPlaceholder("Projects")}
      {activeSection === "materials" && renderPlaceholder("Materials & Costs")}
      {activeSection === "contracts" && renderPlaceholder("Contracts & Documents")}
      {activeSection === "photo-gallery" && renderPlaceholder("Photo Gallery")}
      {activeSection === "technicians" && renderPlaceholder("Technicians & Crew")}
      {activeSection === "subcontractors" && renderPlaceholder("Subcontractors")}
      {activeSection === "gps-routing" && renderPlaceholder("GPS & Routing")}
      {activeSection === "check-in" && renderPlaceholder("Check-in/Check-out")}
      {activeSection === "work-orders" && renderPlaceholder("Work Orders")}
      {activeSection === "scheduling" && renderPlaceholder("Scheduling")}
      {activeSection === "invoicing" && renderPlaceholder("Invoicing & Payments")}
      {activeSection === "reports" && renderPlaceholder("Reports & Analytics")}
      {activeSection === "client-portal" && renderPlaceholder("Client Portal")}
      {activeSection === "communication" && renderPlaceholder("Communication")}
      {activeSection === "company-data" && renderPlaceholder("Company Data")}
      {activeSection === "materials-catalog" && renderPlaceholder("Materials Catalog")}
      {activeSection === "assembly-templates" && renderPlaceholder("Assembly Templates")}
      {activeSection === "margins-rules" && renderPlaceholder("Margins & Rules")}
      {activeSection === "users-roles" && renderPlaceholder("Users & Roles")}
    </DashboardLayout>
  );
}
