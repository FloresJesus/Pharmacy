"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Plus, Search, Edit3, Trash2, Printer } from "lucide-react"
import { Button } from "@/component/ui/button"
import { Card, CardContent, CardHeader } from "@/component/ui/card"
import { Input } from "@/component/ui/input"
import { supabase } from "@/lib/supabase"
import VentaDialog from "@/component/venta/ventaDialog" // <-- asegúrate de la ruta

interface VentaRow {
  id: number
  fecha_venta: string
  monto_total: number
  estado: string
  cliente_id: number | null
  clientes: { id: number; nombre: string; apellido: string } | null
}

interface ItemRowFromDB {
  id: number
  venta_id: number
  medicamento_id: number
  cantidad: number
  precio_por_unidad: number
  subtotal: number
  medicamentos: { codigo: string; nombre: string }[] | null
}

type VentaItem = {
  id: number
  medicamento_id: number
  medicamentoLabel: string
  cantidad: number
  precio_por_unidad: number
  subtotal: number
}

type VentaWithItems = {
  id: number
  fecha_venta: string
  monto_total: number
  estado: string
  clienteNombre: string
  clienteId: number | null
  items: VentaItem[]
}

export default function VentasPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [ventas, setVentas] = useState<VentaWithItems[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null)
  const [ventaDialogOpen, setVentaDialogOpen] = useState(false)
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)

  const formatBs = (value: number) => `Bs. ${value.toFixed(2)}`

  const fetchVentas = useCallback(async () => {
    setLoadingList(true)
    try {
      // obtener ventas desde supabase
      const resp = await supabase
        .from("ventas")
        .select(
          `
          id,
          fecha_venta,
          monto_total,
          estado,
          cliente_id,
          clientes:cliente_id (id, nombre, apellido)
        `
        )
        .order("id", { ascending: false })

      if (resp.error) throw resp.error

      const rows = (resp.data ?? []) as unknown as VentaRow[]
      const ventaIds = rows.map((r) => r.id)

      const itemsBySale: Record<number, VentaItem[]> = {}

      if (ventaIds.length > 0) {
        // obtener items de venta relacionados
        const itResp = await supabase
          .from("items_venta")
          .select(
            `
            id,
            venta_id,
            medicamento_id,
            cantidad,
            precio_por_unidad,
            subtotal,
            medicamentos:medicamento_id (codigo, nombre)
          `
          )
          .in("venta_id", ventaIds)

        if (itResp.error) throw itResp.error

        const itRows = (itResp.data ?? []) as unknown as ItemRowFromDB[]

        for (const it of itRows) {
          const med = Array.isArray(it.medicamentos) ? it.medicamentos[0] ?? null : it.medicamentos
          const label = med ? `${med.codigo} - ${med.nombre}` : `#${it.medicamento_id}`

          if (!itemsBySale[it.venta_id]) itemsBySale[it.venta_id] = []
          itemsBySale[it.venta_id].push({
            id: it.id,
            medicamento_id: it.medicamento_id,
            medicamentoLabel: label,
            cantidad: Number(it.cantidad),
            precio_por_unidad: Number(it.precio_por_unidad),
            subtotal: Number(it.subtotal)
          })
        }
      }

      const mapped: VentaWithItems[] = rows.map((r) => ({
        id: r.id,
        fecha_venta: r.fecha_venta,
        monto_total: Number(r.monto_total ?? 0),
        estado: r.estado ?? "",
        clienteId: r.cliente_id ?? null,
        clienteNombre: r.clientes ? `${r.clientes.nombre} ${r.clientes.apellido}` : "Cliente no registrado",
        items: itemsBySale[r.id] ?? []
      }))

      setVentas(mapped)
    } catch (err) {
      console.error("Fetch ventas error:", err)
      alert("Error al cargar ventas. Revisa la consola.")
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchVentas()
  }, [fetchVentas])

  // abrir dialog nuevo
  const handleNew = () => {
    setEditingVentaId(null)
    setVentaDialogOpen(true)
  }

  // abrir dialog edición
  const handleEdit = (ventaId: number) => {
    setEditingVentaId(ventaId)
    setVentaDialogOpen(true)
  }

  const handleDelete = async (ventaId: number) => {
    if (!confirm("¿Eliminar esta venta? Esta acción no se puede deshacer.")) return
    setLoadingDeleteId(ventaId)
    try {
      const resp = await supabase.from("ventas").delete().eq("id", ventaId).select().maybeSingle()
      if (resp.error) throw resp.error
      setVentas((prev) => prev.filter((v) => v.id !== ventaId))
    } catch (err) {
      console.error("Delete venta:", err)
      if (err instanceof Error) alert(err.message)
      else alert("Error al eliminar venta.")
    } finally {
      setLoadingDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter(
      (v) =>
        v.id.toString().includes(q) ||
        v.clienteNombre.toLowerCase().includes(q) ||
        (v.fecha_venta ?? "").toLowerCase().includes(q) ||
        v.items.some(it => it.medicamentoLabel.toLowerCase().includes(q))
    )
  }, [ventas, searchTerm])

  // Generar comprobante
  const requestComprobante = async (ventaId: number) => {
    try {
      setGeneratingId(ventaId)
      const resp = await fetch("/api/comprobantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventaId, tipo: "FACTURA", serie: "F001" }),
      })
      const data = await resp.json()
      if (!data.ok) {
        alert("Error al generar comprobante: " + (data.error ?? "desconocido"))
        return
      }
      if (data.signedUrl) window.open(data.signedUrl, "_blank")
      else alert("Comprobante generado en: " + (data.storagePath ?? "ruta desconocida"))
    } catch (err) {
      console.error("Error requestComprobante:", err)
      alert("Error generando comprobante (ver consola).")
    } finally {
      setGeneratingId(null)
    }
  }

  return (
    <Sidebar>
      <Header />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Ventas</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Registro de ventas</p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Button onClick={handleNew} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva venta</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          </div>
        </div>

        {/* Buscador como en clientes */}
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, producto o número de venta..."
                  className="pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden p-4 space-y-6">
              {loadingList ? (
                <div className="text-center text-muted-foreground py-8">Cargando ventas...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {ventas.length === 0 ? "No hay ventas registradas." : "No se encontraron resultados."}
                </div>
              ) : (
                filtered.map((v) => (
                  <article key={v.id} className="border rounded p-4">
                    <div className="border p-3 rounded mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div>
                        <div className="text-sm text-muted-foreground">V-{String(v.id).padStart(3, "0")}</div>
                        <div className="text-xs text-muted-foreground">{new Date(v.fecha_venta).toLocaleString()}</div>
                      </div>
                      <div className="text-right mt-3 sm:mt-0">
                        <div className="text-sm text-muted-foreground">Total</div>
                        <div className="font-bold">{formatBs(v.monto_total)}</div>
                      </div>
                    </div>

                    <div className="border p-3 rounded mb-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Cliente:</div>
                      <div className="font-medium">{v.clienteNombre}</div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Productos:</h3>
                      <div className="space-y-2">
                        {v.items.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No hay productos registrados para esta venta.</div>
                        ) : v.items.map(it => (
                          <div key={it.id} className="border p-3 rounded flex items-center justify-between">
                            <div className="font-medium flex-1">{it.medicamentoLabel}</div>
                            <div className="flex items-center gap-8 text-sm text-muted-foreground whitespace-nowrap">
                              <span>Cantidad: <span className="font-medium ml-1">{it.cantidad}</span></span>
                              <span>Precio: <span className="font-medium ml-1">{formatBs(it.precio_por_unidad)}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(v.id)} className="inline-flex items-center gap-2">
                        <Edit3 className="h-4 w-4" /> <span className="hidden sm:inline">Editar</span>
                      </Button>

                      <Button variant="ghost" size="sm" onClick={() => requestComprobante(v.id)} className="inline-flex items-center gap-2" disabled={generatingId === v.id}>
                        {generatingId === v.id ? "Generando..." : (<><Printer className="h-4 w-4" /> <span className="hidden sm:inline">Comprobante</span></>)}
                      </Button>

                      <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)} className="inline-flex items-center gap-2 text-red-600" disabled={loadingDeleteId === v.id}>
                        <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{loadingDeleteId === v.id ? "Eliminando..." : "Eliminar"}</span>
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VentaDialog integrado */}
      <VentaDialog
        open={ventaDialogOpen}
        onOpenChange={(open) => {
          setVentaDialogOpen(open)
          if (!open) {
            // limpiar edición cuando se cierre
            setEditingVentaId(null)
            // refrescar lista al cerrar (en caso de que haya cambios)
            fetchVentas()
          }
        }}
        ventaId={editingVentaId}
        onSaved={() => {
          // refrescar y cerrar
          fetchVentas()
          setVentaDialogOpen(false)
          setEditingVentaId(null)
        }}
      />
    </Sidebar>
  )
}
