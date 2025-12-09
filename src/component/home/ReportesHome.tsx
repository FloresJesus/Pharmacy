"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Card, CardContent, CardHeader } from "@/component/ui/card"
import { Input } from "@/component/ui/input"
import { Button } from "@/component/ui/button"
import {
  FileText,
  Calendar,
  Download,
  BarChart2,
  Box,
  AlertTriangle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type ReportTile = {
  key: string
  title: string
  icon: React.ComponentType<{ className?: string }>
}

// --- Tipado mínimo para las keys ---
type TileKey = "ventas" | "inventario" | "vencimiento" | "stock_bajo"
type TipoOption = { value: string; label: string }
// ------------------------------------

const TILES: ReportTile[] = [
  { key: "ventas", title: "REPORTES DE VENTAS", icon: FileText },
  { key: "inventario", title: "REPORTES DE INVENTARIO", icon: Box },
  { key: "vencimiento", title: "MEDICAMENTOS POR VENCER", icon: AlertTriangle },
  { key: "stock_bajo", title: "STOCK BAJO", icon: BarChart2 },
]

export default function ReportesHome() {
  const [selected, setSelected] = useState<TileKey>("ventas")
  const [tipoReporte, setTipoReporte] = useState<string>("ventas_detallado")
  const [fechaInicio, setFechaInicio] = useState<string>("")
  const [fechaFin, setFechaFin] = useState<string>("")
  const [formato, setFormato] = useState<"PDF" | "CSV">("PDF")
  const [generando, setGenerando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [loadingTiles, setLoadingTiles] = useState(false)

  // restricción usuario / auth
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) router.replace("/login")
      else setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.replace("/login")
      else setChecking(false)
    })

    return () => {
      mounted = false
      try { listener.subscription.unsubscribe() } catch {}
    }
  }, [router])

  const tiposPorTile = useMemo(
    () =>
      ({
        ventas: [
          { value: "ventas_detallado", label: "Ventas detallado" },
          { value: "ventas_resumen", label: "Resumen por día" },
          { value: "ventas_por_cliente", label: "Por cliente" },
        ],
        inventario: [
          { value: "inventario_actual", label: "Inventario actual" },
          { value: "movimientos", label: "Movimientos de stock" },
        ],
        vencimiento: [{ value: "por_vencer", label: "Por vencer en rango" }],
        stock_bajo: [{ value: "minimos", label: "Productos con stock bajo" }],
      } as Record<TileKey, TipoOption[]>),
    []
  )

  useEffect(() => {
    const t = tiposPorTile[selected]?.[0]?.value
    if (t) setTipoReporte(t)
  }, [selected, tiposPorTile])

  const downloadBlob = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const requestReport = useCallback(
    async (actionName: "generate" | "export") => {
      setMensaje(null)
      if (actionName === "generate") setGenerando(true)
      else setExportando(true)

      try {
        const payload = {
          tipoReporte,
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          formato,
        }

        const resp = await fetch("/api/reportes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!resp.ok) {
          let errorMsg = "Error generando reporte"
          try {
            const parsed: unknown = await resp.json()
            if (typeof parsed === "string") errorMsg = parsed
            else if (typeof parsed === "object" && parsed !== null) {
              const obj = parsed as Record<string, unknown>
              if (typeof obj.error === "string") errorMsg = obj.error
              else if (typeof obj.message === "string") errorMsg = obj.message
              else errorMsg = JSON.stringify(obj)
            }
          } catch {
            try {
              const txt = await resp.text()
              if (txt) errorMsg = txt
            } catch {}
          }
          throw new Error(errorMsg)
        }

        const contentDisposition =
          resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition") || ""
        let filename = `reporte.${formato === "CSV" ? "csv" : "pdf"}`
        if (contentDisposition) {
          const rfc5987 = /filename\*\s*=\s*([^;]+)/i.exec(contentDisposition)
          const normal = /filename\s*=\s*("?)([^";]+)\1/i.exec(contentDisposition)
          if (rfc5987 && rfc5987[1]) {
            const raw = rfc5987[1].trim()
            const maybe = raw.replace(/^(UTF-8'')/i, "")
            try {
              filename = decodeURIComponent(maybe.replace(/['"]/g, ""))
            } catch {
              filename = maybe.replace(/['"]/g, "")
            }
          } else if (normal && normal[2]) {
            try {
              filename = decodeURIComponent(normal[2].trim().replace(/['"]/g, ""))
            } catch {
              filename = normal[2].trim().replace(/['"]/g, "")
            }
          } else {
            const fallback = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i.exec(contentDisposition)
            if (fallback && fallback[1]) filename = fallback[1].replace(/['"]/g, "")
          }
        }

        const blob = await resp.blob()
        await downloadBlob(blob, filename)
        setMensaje(actionName === "generate" ? "Reporte descargado." : "Archivo exportado y descargado.")
      } catch (err: unknown) {
        console.error("Error requestReport:", err)
        if (err instanceof Error) setMensaje(err.message ?? "Error generando/exportando")
        else setMensaje(String(err) || "Error generando/exportando")
      } finally {
        setGenerando(false)
        setExportando(false)
      }
    },
    [tipoReporte, fechaInicio, fechaFin, formato]
  )

  if (checking) return <div className="p-6">Comprobando sesión...</div>

  return (
    <Sidebar>
      <Header />
      <div className="space-y-6 p-4 max-w-7xl mx-auto">
        {/* Título */}
        <div className="mb-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Generación de reportes</p>
        </div>

        {/* Tiles responsive: 1 / 2 / 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TILES.map((t) => {
            const Icon = t.icon
            const active = selected === (t.key as TileKey)
            return (
              <div
                key={t.key}
                onClick={() => setSelected(t.key as TileKey)}
                role="button"
                tabIndex={0}
                className={`flex flex-col justify-between rounded-lg overflow-hidden transition-shadow duration-150 cursor-pointer
                  ${active ? "ring-2 ring-blue-500 border-transparent shadow-lg" : "border border-gray-200 shadow-sm"} bg-white
                  min-h-[110px] sm:min-h-[140px]`}
              >
                <div className="p-4 sm:p-5">
                  <div className="text-sm sm:text-base font-semibold leading-tight mb-2">{t.title}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Haz clic para seleccionar este tipo de reporte.</p>
                </div>

                <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-t">
                  <div className="flex items-center gap-3">
                    <div className={`${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"} p-2 rounded-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">{active ? "Activo" : "Seleccionar"}</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(t.key as TileKey)
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium focus:outline-none ${active ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}
                  >
                    {active ? "Activo" : "Seleccionar"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Card formulario */}
        <Card className="w-full">
          <CardHeader className="flex items-start gap-3 pb-2">
            <div className="p-2 bg-gray-50 rounded"><Calendar className="h-5 w-5" /></div>
            <div>
              <div className="text-base font-semibold">Generar Reportes</div>
              <div className="text-sm text-muted-foreground">Elige el tipo, rango de fechas y formato</div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Tipo de reporte</label>
                  <select
                    value={tipoReporte}
                    onChange={(e) => setTipoReporte(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {tiposPorTile[selected]?.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Fecha inicio</label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full h-12" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Formato</label>
                  <select
                    value={formato}
                    onChange={(e) => setFormato(e.target.value as "PDF" | "CSV")}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="PDF">PDF</option>
                    <option value="CSV">CSV</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Fecha fin</label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full h-12" />
                </div>
              </div>
            </div>

            {/* Botones adaptativos: apilan en móvil */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                onClick={() => requestReport("generate")}
                className="w-full sm:w-auto inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 justify-center"
                disabled={generando}
              >
                {generando ? "Generando..." : <><FileText className="h-4 w-4" /> Generar Reporte</>}
              </Button>

              <Button
                onClick={() => requestReport("export")}
                className="w-full sm:w-auto inline-flex items-center gap-2 border px-4 py-2 justify-center"
                disabled={exportando}
                variant="ghost"
              >
                <Download className="h-4 w-4" /> {exportando ? "Exportando..." : "Exportar"}
              </Button>

              <div className="mt-2 sm:mt-0 sm:ml-auto text-sm text-muted-foreground">
                <span className="hidden sm:inline">Categoria:</span> <span className="font-medium ml-2">{selected}</span>
              </div>
            </div>

            {mensaje && <div className="mt-4 p-3 rounded border bg-gray-50 text-sm">{mensaje}</div>}
          </CardContent>
        </Card>

        {/* Acción extra */}
        <div className="flex">
          <button
            onClick={() => {
              setLoadingTiles(true)
              setMensaje(null)
              setTimeout(() => {
                setLoadingTiles(false)
                setMensaje("Tiles actualizados (simulado).")
              }, 700)
            }}
            disabled={loadingTiles}
            className="w-full sm:w-auto px-3 py-2 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            {loadingTiles ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>
    </Sidebar>
  )
}
