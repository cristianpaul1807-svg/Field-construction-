import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, MapPin, Users, FileText } from "lucide-react";

interface ProjectDetailProps {
  projectId: string;
  projectName: string;
}

export default function ProjectDetail({
  projectId,
  projectName,
}: ProjectDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <h2 className="text-2xl font-bold text-foreground">{projectName}</h2>
        <p className="text-muted-foreground mt-1">Project ID: {projectId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline/Chat-like Activity */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Activity & Updates</h3>
            <div className="space-y-4">
              {[
                {
                  time: "Today 2:30 PM",
                  user: "John Smith",
                  action: "Completed framing work",
                  status: "completed",
                },
                {
                  time: "Today 10:15 AM",
                  user: "Sarah Johnson",
                  action: "Approved material purchase",
                  status: "completed",
                },
                {
                  time: "Yesterday 4:45 PM",
                  user: "Mike Davis",
                  action: "Submitted inspection report",
                  status: "completed",
                },
              ].map((activity, idx) => (
                <div key={idx} className="flex gap-4 pb-4 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {activity.user.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {activity.user}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Budget Breakdown */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Budget Breakdown</h3>
            <div className="space-y-4">
              {[
                { category: "Materials", budgeted: 65000, spent: 42000 },
                { category: "Labor", budgeted: 50000, spent: 35000 },
                { category: "Subcontractors", budgeted: 35000, spent: 20500 },
              ].map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {item.category}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${item.spent.toLocaleString()} / ${item.budgeted.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${(item.spent / item.budgeted) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <Card className="p-4">
            <h4 className="font-semibold text-foreground mb-3 text-sm">
              Project Status
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-lg font-bold text-foreground">65%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Budget Used</p>
                <p className="text-lg font-bold text-foreground">56.9%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Days</p>
                <p className="text-lg font-bold text-foreground">28 days</p>
              </div>
            </div>
          </Card>

          {/* Team Members */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-foreground text-sm">Team</h4>
              <Users size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {["John Smith", "Sarah Johnson", "Mike Davis", "Lisa Chen"].map(
                (member, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {member.charAt(0)}
                    </div>
                    <span>{member}</span>
                  </div>
                )
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <h4 className="font-semibold text-foreground mb-3 text-sm">
              Actions
            </h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
              >
                <MessageCircle size={14} />
                Send Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
              >
                <MapPin size={14} />
                View Location
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
              >
                <FileText size={14} />
                Documents
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
