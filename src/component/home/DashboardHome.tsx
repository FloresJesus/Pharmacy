"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/component/ui/card"
import { AlertTriangle, DollarSign, Package, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"

interface Medicamento {
  id: number
  nombre?: string
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
  const router = useRouter()

  // ---- configurables ----
  const EXPIRY_DAYS = 30            // medicamentos por vencer en X días
  const LOW_STOCK_THRESHOLD = 5     // umbral stock bajo
  const SALES_DAYS = 30             // número de días a mostrar en la gráfica
  // -----------------------

  // estados
  const [checking, setChecking] = useState(true)
  const [totalMedicamentos, setTotalMedicamentos] = useState<number>(0)
  const [ventasHoy, setVentasHoy] = useState<number>(0)
  const [totalClientes, setTotalClientes] = useState<number>(0)
  const [alertasCount, setAlertasCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // datos específicos
  const [medsPorVencer, setMedsPorVencer] = useState<Medicamento[]>([])
  const [ventasRows, setVentasRows] = useState<Venta[]>([])

  const formatBs = (v: number) => `Bs. ${v.toFixed(2)}`

  // --- useMemo: AGRUPAR ventasRows por día (YYYY-MM-DD) ---
  // Está al top-level para no violar las reglas de hooks.
  const salesChartData = useMemo(() => {
    // crear array con SALES_DAYS días con total 0
    const data: { date: string; total: number }[] = []
    const today = new Date()
    for (let i = SALES_DAYS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const isoDay = d.toISOString().slice(0, 10) // YYYY-MM-DD
      data.push({ date: isoDay, total: 0 })
    }

    if (!ventasRows || ventasRows.length === 0) {
      return data
    }

    // acumular ventas en su día correspondiente
    for (const v of ventasRows) {
      if (!v?.fecha_venta) continue
      const day = new Date(v.fecha_venta)
      day.setHours(0, 0, 0, 0)
      const dayKey = day.toISOString().slice(0, 10)
      const idx = data.findIndex(d => d.date === dayKey)
      if (idx >= 0) {
        data[idx].total += Number(v.monto_total ?? 0)
      } else {
        // si la fecha está fuera del rango (por zona horaria u otro motivo), la agregamos
        data.push({ date: dayKey, total: Number(v.monto_total ?? 0) })
      }
    }

    // ordenar por fecha por si agregamos fuera de rango
    data.sort((a, b) => a.date.localeCompare(b.date))

    return data.map(d => ({ ...d, date: d.date }))
  }, [ventasRows, SALES_DAYS])

  // --- comprobación de sesión (hooks en orden) ---
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) {
        router.replace("/login")
      } else {
        setChecking(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login")
      } else {
        setChecking(false)
      }
    })

    return () => {
      mounted = false
      try { listener.subscription.unsubscribe() } catch {}
    }
  }, [router])

  // fetch principal
  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const startIso = startOfToday.toISOString()

      // rango vencimiento
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)
      const expiryIso = expiryDate.toISOString()

      // total medicamentos (head)
      const medsCountResp = await supabase
        .from("medicamentos")
        .select("id", { count: "exact", head: true })

      if (medsCountResp.error) throw medsCountResp.error
      setTotalMedicamentos(medsCountResp.count ?? 0)

      // ventas de hoy
      const ventasResp = await supabase
        .from("ventas")
        .select("monto_total, fecha_venta")
        .gte("fecha_venta", startIso)

      if (ventasResp.error) throw ventasResp.error
      const ventasTodayRows = (ventasResp.data ?? []) as Venta[]
      const ventasSum = ventasTodayRows.reduce((sum, v) => sum + Number(v.monto_total ?? 0), 0)
      setVentasHoy(ventasSum)

      // clientes count
      const clientesResp = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })

      if (clientesResp.error) throw clientesResp.error
      setTotalClientes(clientesResp.count ?? 0)

      // medicamentos por vencer (entre hoy y expiryDate)
      const vencResp = await supabase
        .from("medicamentos")
        .select("id, nombre, fecha_vencimiento, stock")
        .gte("fecha_vencimiento", startIso)
        .lte("fecha_vencimiento", expiryIso)
        .order("fecha_vencimiento", { ascending: true })

      if (vencResp.error) throw vencResp.error
      const vencRows = (vencResp.data ?? []) as Medicamento[]
      setMedsPorVencer(vencRows)

      // stock bajo
      const stockResp = await supabase
        .from("medicamentos")
        .select("id, stock")
        .lte("stock", LOW_STOCK_THRESHOLD)

      if (stockResp.error) throw stockResp.error
      const stockRows = (stockResp.data ?? []) as Medicamento[]

      // combinamos sin duplicados para alertas
      const alertIds = new Set<number>()
      vencRows.forEach((m) => alertIds.add(m.id))
      stockRows.forEach((m) => alertIds.add(m.id))
      setAlertasCount(alertIds.size)

      // ventas para gráfica: últimos SALES_DAYS días (incluye hoy)
      const salesStart = new Date()
      salesStart.setDate(salesStart.getDate() - (SALES_DAYS - 1))
      salesStart.setHours(0, 0, 0, 0)
      const salesStartIso = salesStart.toISOString()

      const ventasChartResp = await supabase
        .from("ventas")
        .select("monto_total, fecha_venta")
        .gte("fecha_venta", salesStartIso)
        .order("fecha_venta", { ascending: true })

      if (ventasChartResp.error) throw ventasChartResp.error
      const ventasAllRows = (ventasChartResp.data ?? []) as Venta[]
      setVentasRows(ventasAllRows)
    } catch (err) {
      console.error("Dashboard fetch error:", err)
      setError("Error al cargar los datos del dashboard.")
    } finally {
      setLoading(false)
    }
  }, [EXPIRY_DAYS, LOW_STOCK_THRESHOLD, SALES_DAYS])

  useEffect(() => {
    if (!checking) {
      fetchDashboard()
    }
  }, [fetchDashboard, checking])

  if (checking) {
    return (
      <div className="p-6">
        <p>Comprobando sesión...</p>
      </div>
    )
  }

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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Medicamentos por vencer */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Medicamentos por vencer</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Cargando...</p>
              ) : medsPorVencer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay medicamentos por vencer dentro del rango.</p>
              ) : (
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground sticky top-0 bg-white">
                      <tr>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Vence</th>
                        <th className="p-2">Días</th>
                        <th className="p-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medsPorVencer.map((m) => {
                        const venc = new Date(m.fecha_vencimiento)
                        const today = new Date()
                        const diffMs = venc.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
                        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                        return (
                          <tr key={m.id} className="border-t">
                            <td className="p-2">{m.nombre ?? `#${m.id}`}</td>
                            <td className="p-2">{new Date(m.fecha_vencimiento).toLocaleDateString()}</td>
                            <td className={`p-2 ${daysLeft <= 3 ? "text-red-600 font-semibold" : ""}`}>{daysLeft}</td>
                            <td className={`p-2 ${m.stock <= LOW_STOCK_THRESHOLD ? "text-red-600" : ""}`}>{m.stock}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfica de ventas por día */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Ventas — últimos {SALES_DAYS} días</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {loading ? (
                <p>Cargando gráfica...</p>
              ) : (
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d) => {
                        // formatea YYYY-MM-DD -> DD/MM
                        try {
                          const [y, m, day] = String(d).split("-")
                          return `${day}/${m}`
                        } catch {
                          return String(d).slice(5)
                        }
                      }} />
                      <YAxis tickFormatter={(v) => Number(v).toFixed(0)} />
                      <Tooltip formatter={(value: unknown) => formatBs(Number(value))} labelFormatter={(label) => label} />
                      <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
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
