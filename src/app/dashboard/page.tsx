"use client"

import { useEffect, useState, useCallback } from "react"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/component/ui/card"
import { AlertTriangle, DollarSign, Package, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Medicamento {
  id: number
  fecha_vencimiento: string
  stock: number
}

interface Venta {
  monto_total: number
  fecha_venta: string
}

interface Stat {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  color: string
}

export default function DashboardHome() {
  const EXPIRY_DAYS = 30
  const LOW_STOCK_THRESHOLD = 5

  const [totalMedicamentos, setTotalMedicamentos] = useState<number>(0)
  const [ventasHoy, setVentasHoy] = useState<number>(0)
  const [totalClientes, setTotalClientes] = useState<number>(0)
  const [alertasCount, setAlertasCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatBs = (v: number) => `Bs. ${v.toFixed(2)}`

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const startIso = startOfToday.toISOString()

      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)
      const expiryIso = expiryDate.toISOString()

      // Medicamentos
      const medsCountResp = await supabase
        .from("medicamentos")
        .select("id", { count: "exact", head: true })

      if (medsCountResp.error) throw medsCountResp.error
      setTotalMedicamentos(medsCountResp.count ?? 0)

      // Ventas del día
      const ventasResp = await supabase
        .from("ventas")
        .select("monto_total, fecha_venta")
        .gte("fecha_venta", startIso)

      if (ventasResp.error) throw ventasResp.error

      const ventasRows = (ventasResp.data ?? []) as Venta[]
      const ventasSum = ventasRows.reduce((sum, v) => sum + Number(v.monto_total || 0), 0)
      setVentasHoy(ventasSum)

      // Clientes
      const clientesResp = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })

      if (clientesResp.error) throw clientesResp.error
      setTotalClientes(clientesResp.count ?? 0)

      // Alertas (vencimientos + stock bajo)
      const vencResp = await supabase
        .from("medicamentos")
        .select("id, fecha_vencimiento, stock")
        .gte("fecha_vencimiento", startIso)
        .lte("fecha_vencimiento", expiryIso)

      if (vencResp.error) throw vencResp.error
      const vencRows = (vencResp.data ?? []) as Medicamento[]
      // Stock bajo
      const stockResp = await supabase
        .from("medicamentos")
        .select("id, stock")
        .lte("stock", LOW_STOCK_THRESHOLD)

      if (stockResp.error) throw stockResp.error
      const stockRows = (stockResp.data ?? []) as Medicamento[]

      // combinamos sin duplicar IDs
      const alertIds = new Set<number>()
      vencRows.forEach((m) => alertIds.add(m.id))
      stockRows.forEach((m) => alertIds.add(m.id))
      setAlertasCount(alertIds.size)
    } catch (err) {
      console.error("Dashboard fetch error:", err)
      setError("Error al cargar los datos del dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const stats: Stat[] = [
    {
      title: "Total Medicamentos",
      value: totalMedicamentos.toString(),
      icon: Package,
      description: "Total registrados",
      color: "text-blue-600",
    },
    {
      title: "Ventas del Día",
      value: formatBs(ventasHoy),
      icon: DollarSign,
      description: "Monto total de ventas de hoy",
      color: "text-green-600",
    },
    {
      title: "Clientes Registrados",
      value: totalClientes.toString(),
      icon: Users,
      description: "Clientes activos en la base",
      color: "text-purple-600",
    },
    {
      title: "Alertas Activas",
      value: alertasCount.toString(),
      icon: AlertTriangle,
      description: "Medicamentos por vencer o con poco stock",
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
            Resumen general de la farmacia
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>
    </Sidebar>
  )
}
