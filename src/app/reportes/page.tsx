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

type ReportTile = {
  key: string
  title: string
  icon: React.ComponentType<{ className?: string }>
}

const TILES: ReportTile[] = [
  { key: "ventas", title: "REPORTES DE VENTAS", icon: FileText },
  { key: "inventario", title: "REPORTES DE INVENTARIO", icon: Box },
  { key: "vencimiento", title: "MEDICAMENTOS POR VENCER", icon: AlertTriangle },
  { key: "stock_bajo", title: "STOCK BAJO", icon: BarChart2 },
]

export default function ReportesDashboard() {
  const [selected, setSelected] = useState<string>("ventas")
  const [tipoReporte, setTipoReporte] = useState<string>("ventas_detallado")
  const [fechaInicio, setFechaInicio] = useState<string>("")
  const [fechaFin, setFechaFin] = useState<string>("")
  const [formato, setFormato] = useState<"PDF" | "CSV">("PDF")
  const [generando, setGenerando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [loadingTiles, setLoadingTiles] = useState(false)

  const tiposPorTile = useMemo(() => {
    return {
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
    } as Record<string, { value: string; label: string }[]>
  }, [])

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
          // ---------- Seguro y tipado: parseo del body de error ----------
          let errorMsg = "Error generando reporte"

          try {
            const parsed: unknown = await resp.json()

            if (typeof parsed === "string") {
              errorMsg = parsed
            } else if (typeof parsed === "object" && parsed !== null) {
              const obj = parsed as Record<string, unknown>
              if (typeof obj.error === "string") errorMsg = obj.error
              else if (typeof obj.message === "string") errorMsg = obj.message
              else errorMsg = JSON.stringify(obj)
            }
          } catch {
            // No es JSON -> intentar leer texto plano
            try {
              const txt = await resp.text()
              if (txt) errorMsg = txt
            } catch {
              /* ignore */
            }
          }

          throw new Error(errorMsg)
        }

        // obtener filename de Content-Disposition (maneja filename* y filename)
        const contentDisposition =
          resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition") || ""
        let filename = `reporte.${formato === "CSV" ? "csv" : "pdf"}`
        if (contentDisposition) {
          // intenta capturar filename* (RFC5987) o filename normal
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
            if (fallback && fallback[1]) {
              filename = fallback[1].replace(/['"]/g, "")
            }
          }
        }

        const blob = await resp.blob()
        await downloadBlob(blob, filename)
        setMensaje(actionName === "generate" ? "Reporte descargado." : "Archivo exportado y descargado.")
      } catch (err: unknown) {
        console.error("Error requestReport:", err)
        if (err instanceof Error) {
          setMensaje(err.message ?? "Error generando/exportando")
        } else {
          setMensaje(String(err) || "Error generando/exportando")
        }
      } finally {
        setGenerando(false)
        setExportando(false)
      }
    },
    [tipoReporte, fechaInicio, fechaFin, formato]
  )

  return (
    <Sidebar>
      <Header />
      <div className="space-y-6 p-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Generación de reportes</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TILES.map((t) => {
            const Icon = t.icon
            const active = selected === t.key
            return (
              <div
                key={t.key}
                onClick={() => setSelected(t.key)}
                role="button"
                tabIndex={0}
                className={`rounded-lg border transition-shadow duration-150 overflow-hidden ${active ? "ring-2 ring-blue-500 border-transparent shadow-lg" : "border-gray-200 shadow-sm"} bg-white h-44 flex flex-col justify-between`}
              >
                <div className="p-5">
                  <div className="text-lg sm:text-xl font-semibold leading-tight mb-3">{t.title}</div>
                </div>
                <div className="flex items-center justify-between px-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"} p-2 rounded-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm text-muted-foreground hidden sm:block">Seleccionado</div>
                  </div>
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(t.key)
                      }}
                      className={`px-3 py-1 rounded text-sm font-medium focus:outline-none ${active ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}
                    >
                      {active ? "Activo" : "Seleccionar"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Card className="w-full border-gray-200 shadow-sm rounded-lg">
          <CardHeader className="flex items-start gap-3 pb-4">
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
                    className="w-full border rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {(tiposPorTile[selected] || []).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Fecha inicio</label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="h-12" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Formato</label>
                  <select value={formato} onChange={(e) => setFormato(e.target.value as "PDF" | "CSV")} className="w-full border rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="PDF">PDF</option>
                    <option value="CSV">CSV</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Fecha fin</label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="h-12" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => requestReport("generate")} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2" disabled={generando}>
                {generando ? "Generando..." : <><FileText className="h-4 w-4" /> Generar Reporte</>}
              </Button>

              <Button onClick={() => requestReport("export")} className="inline-flex items-center gap-2 border px-4 py-2" disabled={exportando} variant="ghost">
                <Download className="h-4 w-4" /> {exportando ? "Exportando..." : "Exportar"}
              </Button>

              <div className="ml-auto text-sm text-muted-foreground">
                <span className="hidden sm:inline">Tipo:</span> <span className="font-medium ml-2">{selected}</span>
              </div>
            </div>

            {mensaje && <div className="mt-4 p-3 rounded border bg-gray-50 text-sm">{mensaje}</div>}
          </CardContent>
        </Card>

        <div className="flex gap-2">
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
            className="px-3 py-2 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            {loadingTiles ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>
    </Sidebar>
  )
}
