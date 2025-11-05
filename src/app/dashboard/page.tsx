import Sidebar from "@/component/sidebar";
import Header from "@/component/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/component/ui/card";
import { AlertTriangle, DollarSign, Package, Users } from "lucide-react";

export default function DashboardHome() {

  const stats = [
    {
      title: "Total Medicamentos",
      value: "0",
      icon: Package,
      description: "0% desde el mes pasado",
      color: "text-blue-600",
    },
    {
      title: "Ventas del Día",
      value: "Bs. 0",
      icon: DollarSign,
      description: "0 transacciones hoy",
      color: "text-green-600",
    },
    {
      title: "Clientes Registrados",
      value: "0",
      icon: Users,
      description: "+0 nuevos esta semana",
      color: "text-purple-600",
    },
    {
      title: "Alertas Activas",
      value: "0",
      icon: AlertTriangle,
      description: "0 por vencer, 0 stock bajo",
      color: "text-red-600",
    },
  ]

  return (
    <Sidebar>
      <Header />
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat,index) => (
            <Card key={index} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Sidebar>
  );
}