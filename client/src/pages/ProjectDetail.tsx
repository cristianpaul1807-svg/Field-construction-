import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, projectStatusTone } from "@/components/StatusBadge";
import { ArrowLeft, FileText, MessageCircle, MapPin } from "lucide-react";
import {
  projects,
  findClient,
  estimates,
  expensesByProject,
  documents,
  photos,
  scheduleEvents,
  formatCurrency,
  projectStatusLabel,
} from "@/lib/mockData";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">
        Proyecto no encontrado.{" "}
        <Link href="/projects" className="text-primary hover:underline">Volver a Projects</Link>
      </div>
    );
  }

  const client = findClient(project.clientId);
  const estimate = estimates.find((e) => e.id === project.estimateId);
  const expenses = expensesByProject.filter((e) => e.projectId === project.id);
  const projectDocuments = documents.filter((d) => d.projectId === project.id);
  const projectPhotos = photos.filter((p) => p.projectId === project.id);
  const projectSchedule = scheduleEvents.filter((s) => s.projectId === project.id);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Volver a Projects
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{client?.name} · {project.type}</p>
        </div>
        <StatusBadge tone={projectStatusTone[project.status]}>
          {projectStatusLabel[project.status]}
        </StatusBadge>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="budget">Presupuesto</TabsTrigger>
          <TabsTrigger value="expenses">Gastos</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="schedule">Cronograma</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4 text-sm">Progreso</h3>
                <div className="w-full bg-secondary rounded-full h-2 mb-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progressPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{project.progressPercent}% completado</p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-3 text-sm">Equipo asignado</h3>
                <div className="space-y-2">
                  {project.team.map((member) => (
                    <div key={member} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                        {member.charAt(0)}
                      </div>
                      <span>{member}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Presupuesto</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(project.budgetUsed)} / {formatCurrency(project.budgetTotal)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Fechas</p>
                <p className="text-sm text-foreground mt-1">{project.startDate} → {project.endDate}</p>
              </Card>
              <Button variant="outline" className="w-full gap-2">
                <MessageCircle size={14} /> Enviar actualización
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <MapPin size={14} /> Ver ubicación
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <Card className="p-6">
            {estimate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">Presupuesto #{estimate.id.toUpperCase()}</h3>
                  <Button size="sm" variant="outline" className="gap-2">
                    <FileText size={14} /> Ver PDF
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Zona</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Categoría</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Ítem</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.lines.map((line, idx) => (
                        <tr key={idx} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground">{line.zone}</td>
                          <td className="py-2 text-muted-foreground">{line.category}</td>
                          <td className="py-2 text-muted-foreground">{line.item}</td>
                          <td className="py-2 text-right text-foreground">{formatCurrency(line.quantity * line.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Este proyecto no tiene un presupuesto vinculado.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Categoría</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Presupuestado</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Real</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Desviación</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => {
                  const variance = ((row.actual - row.budgeted) / row.budgeted) * 100;
                  return (
                    <tr key={row.category} className="border-b border-border last:border-0">
                      <td className="py-3 text-foreground font-medium">{row.category}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.budgeted)}</td>
                      <td className="py-3 text-right text-foreground">{formatCurrency(row.actual)}</td>
                      <td className={`py-3 text-right font-medium ${variance > 0 ? "text-status-error-fg" : "text-status-success-fg"}`}>
                        {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Sin gastos registrados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card className="p-6">
            <div className="space-y-2">
              {projectDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.uploadedAt} · {doc.sizeKb} KB</p>
                    </div>
                  </div>
                  <StatusBadge tone="neutral" className="capitalize flex-shrink-0">{doc.tag}</StatusBadge>
                </div>
              ))}
              {projectDocuments.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin documentos todavía.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {projectPhotos.map((photo) => (
                <div key={photo.id} className="space-y-1.5">
                  <div className="aspect-square rounded-lg border border-border" style={{ background: photo.color }} />
                  <p className="text-xs text-muted-foreground truncate">{photo.zone}</p>
                  <StatusBadge tone={photo.visibleToClient ? "success" : "neutral"}>
                    {photo.visibleToClient ? "Visible al cliente" : "Interno"}
                  </StatusBadge>
                </div>
              ))}
              {projectPhotos.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">Sin fotos todavía.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card className="p-6">
            <div className="space-y-3">
              {projectSchedule.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date} · {event.time}</p>
                  </div>
                  <StatusBadge tone="neutral" className="capitalize">{event.type}</StatusBadge>
                </div>
              ))}
              {projectSchedule.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin eventos programados para este proyecto.</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
