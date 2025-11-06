"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/component/ui/select"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"

//
// Tipos locales
//
type ClienteOpt = { id: number; nombre: string; apellido: string; ci: string }
type MedicamentoOpt = { id: number; codigo: string; nombre: string; stock: number; precio_venta: number }

type ItemForm = {
  id?: number
  medicamento_id: number | null
  medicamentoLabel: string
  cantidad: number
  precio_por_unidad: number
  subtotal: number
}

type VentaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ventaId?: number | null
  onSaved?: () => void
}

const NONE_VALUE = "__NONE__" // sentinel para Radix Select (no puede ser "")

export default function VentaDialog({ open, onOpenChange, ventaId, onSaved }: VentaDialogProps) {
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [medicamentos, setMedicamentos] = useState<MedicamentoOpt[]>([])

  const [clienteId, setClienteId] = useState<number | "">("")
  const [items, setItems] = useState<ItemForm[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingInit, setLoadingInit] = useState(false)

  const total = items.reduce((s, it) => s + (it.subtotal || 0), 0)

  const formatBs = (n: number) => {
    try {
      return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", minimumFractionDigits: 2 }).format(n)
    } catch {
      return `Bs. ${n.toFixed(2)}`
    }
  }

  // carga inicial: clientes, medicamentos y (si aplica) venta + items
  useEffect(() => {
    if (!open) return

    const load = async () => {
      setLoadingInit(true)
      try {
        // Clientes
        const cResp = await supabase.from("clientes").select("id,nombre,apellido,ci").order("nombre", { ascending: true })
        if (cResp.error) throw cResp.error
        const cRows = (cResp.data ?? []) as unknown as ClienteOpt[]
        setClientes(cRows)

        // Medicamentos
        const mResp = await supabase.from("medicamentos").select("id,codigo,nombre,stock,precio_venta,estado").order("nombre", { ascending: true })
        if (mResp.error) throw mResp.error
        const mRowsRaw = (mResp.data ?? []) as unknown as Array<{ id: number; codigo: string; nombre: string; stock: number | null; precio_venta: number | null }>
        const meds: MedicamentoOpt[] = mRowsRaw.map(m => ({
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          stock: Number(m.stock ?? 0),
          precio_venta: Number(m.precio_venta ?? 0)
        }))
        setMedicamentos(meds)

        // Si estamos editando, cargar venta y sus items
        if (ventaId) {
          // venta
          const vResp = await supabase.from("ventas").select("cliente_id, fecha_venta, monto_total").eq("id", ventaId).maybeSingle()
          if (vResp.error) throw vResp.error
          const ventaRow = (vResp.data ?? null) as unknown as { cliente_id?: number } | null
          setClienteId(ventaRow?.cliente_id ?? "")

          // items de la venta
          const itResp = await supabase.from("items_venta").select("id,medicamento_id,cantidad,precio_por_unidad,subtotal").eq("venta_id", ventaId)
          if (itResp.error) throw itResp.error
          const itRowsRaw = (itResp.data ?? []) as unknown as Array<{ id: number; medicamento_id: number; cantidad: number; precio_por_unidad: number; subtotal: number }>

          const mappedItems: ItemForm[] = itRowsRaw.map(ir => {
            const med = meds.find(m => m.id === ir.medicamento_id) ?? null
            const label = med ? `${med.codigo} - ${med.nombre}` : String(ir.medicamento_id)
            return {
              id: ir.id,
              medicamento_id: ir.medicamento_id,
              medicamentoLabel: label,
              cantidad: Number(ir.cantidad),
              precio_por_unidad: Number(ir.precio_por_unidad),
              subtotal: Number(ir.subtotal)
            }
          })

          setItems(mappedItems)
        } else {
          // nuevo
          setClienteId("")
          setItems([])
        }
      } catch (err) {
        console.error("Carga inicial ventaDialog:", err)
        alert("Error al cargar datos (ver consola).")
      } finally {
        setLoadingInit(false)
      }
    }

    load()
  }, [open, ventaId])

  // helpers para items
  const addItem = () => setItems(prev => [...prev, { medicamento_id: null, medicamentoLabel: "", cantidad: 1, precio_por_unidad: 0, subtotal: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItems(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch }
      copy[idx].cantidad = Number(copy[idx].cantidad)
      copy[idx].precio_por_unidad = Number(copy[idx].precio_por_unidad)
      copy[idx].subtotal = Number((copy[idx].cantidad * copy[idx].precio_por_unidad).toFixed(2))
      return copy
    })
  }

  const onSelectMedicamento = (idx: number, medIdOrNone: string) => {
    // medIdOrNone comes as string from Select
    if (medIdOrNone === NONE_VALUE) {
      updateItem(idx, { medicamento_id: null, medicamentoLabel: "", precio_por_unidad: 0, cantidad: 1 })
      return
    }
    const medId = Number(medIdOrNone)
    const med = medicamentos.find(m => m.id === medId) ?? null
    updateItem(idx, {
      medicamento_id: medId,
      medicamentoLabel: med ? `${med.codigo} - ${med.nombre}` : String(medId),
      precio_por_unidad: med ? med.precio_venta : 0,
      cantidad: 1
    })
  }

  // validación básica
  const validate = (): string | null => {
    if (!clienteId) return "Selecciona un cliente."
    if (items.length === 0) return "Agrega al menos 1 producto."
    for (const it of items) {
      if (!it.medicamento_id) return "Selecciona un medicamento en cada fila."
      if (!it.cantidad || it.cantidad <= 0) return "Cantidad inválida."
      const med = medicamentos.find(m => m.id === it.medicamento_id)
      if (med && it.cantidad > med.stock) return `Stock insuficiente para ${med.nombre} (disponible ${med.stock}).`
    }
    return null
  }

  // guardar (crear o actualizar)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (loading) return

    const err = validate()
    if (err) { alert(err); return }

    setLoading(true)
    try {
      if (!ventaId) {
        // crear venta
        const respV = await supabase.from("ventas").insert({
          cliente_id: Number(clienteId),
          usuario_id: null,
          monto_total: Number(total.toFixed(2)),
          estado: "CONFIRMADA"
        }).select().maybeSingle()
        if (respV.error) throw respV.error
        const created = (respV.data ?? null) as unknown as { id: number } | null
        if (!created || typeof created.id !== "number") throw new Error("La creación de la venta no devolvió id.")

        const newVentaId = created.id

        // insertar items
        const payloadItems = items.map(it => ({
          venta_id: newVentaId,
          medicamento_id: it.medicamento_id,
          cantidad: it.cantidad,
          precio_por_unidad: it.precio_por_unidad,
          subtotal: it.subtotal
        }))

        const respItems = await supabase.from("items_venta").insert(payloadItems).select()
        if (respItems.error) throw respItems.error

        // actualizar stocks (simple decremento)
        for (const it of items) {
          if (it.medicamento_id == null) continue
          const med = medicamentos.find(m => m.id === it.medicamento_id) ?? null
          const newStock = (med ? med.stock : 0) - it.cantidad
          await supabase.from("medicamentos").update({ stock: newStock }).eq("id", it.medicamento_id)
        }

        alert("Venta creada correctamente.")
      } else {
        // editar: restaurar stocks de items anteriores, actualizar venta, insertar items nuevos y decrementar
        const oldResp = await supabase.from("items_venta").select("medicamento_id,cantidad").eq("venta_id", ventaId)
        if (oldResp.error) throw oldResp.error
        const oldItems = (oldResp.data ?? []) as unknown as Array<{ medicamento_id: number; cantidad: number }>

        // restaurar stock sumando las cantidades antiguas
        for (const oi of oldItems) {
          const medResp = await supabase.from("medicamentos").select("stock").eq("id", oi.medicamento_id).maybeSingle()
          if (medResp.error) throw medResp.error
          const current = medResp.data ? Number((medResp.data as { stock?: number }).stock ?? 0) : 0
          await supabase.from("medicamentos").update({ stock: current + Number(oi.cantidad) }).eq("id", oi.medicamento_id)
        }

        // actualizar venta
        const updV = await supabase.from("ventas").update({ cliente_id: Number(clienteId), monto_total: Number(total.toFixed(2)) }).eq("id", ventaId).select().maybeSingle()
        if (updV.error) throw updV.error

        // eliminar items antiguos
        const del = await supabase.from("items_venta").delete().eq("venta_id", ventaId)
        if (del.error) throw del.error

        // insertar nuevos items
        const payloadItems = items.map(it => ({
          venta_id: ventaId,
          medicamento_id: it.medicamento_id,
          cantidad: it.cantidad,
          precio_por_unidad: it.precio_por_unidad,
          subtotal: it.subtotal
        }))
        const respItems = await supabase.from("items_venta").insert(payloadItems).select()
        if (respItems.error) throw respItems.error

        // decrementar stock según nuevos items
        for (const it of items) {
          if (it.medicamento_id == null) continue
          const medResp = await supabase.from("medicamentos").select("stock").eq("id", it.medicamento_id).maybeSingle()
          if (medResp.error) throw medResp.error
          const current = medResp.data ? Number((medResp.data as { stock?: number }).stock ?? 0) : 0
          await supabase.from("medicamentos").update({ stock: current - it.cantidad }).eq("id", it.medicamento_id)
        }

        alert("Venta actualizada correctamente.")
      }

      onOpenChange(false)
      if (onSaved) onSaved()
    } catch (err) {
      console.error("Error guardando venta:", err)
      if (err instanceof Error) alert(err.message)
      else alert("Error al guardar la venta. Revisa la consola.")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold">{ventaId ? `Editar Venta V-${String(ventaId).padStart(3, "0")}` : "Nueva Venta"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => handleSave(e)} className="space-y-4">
          

          {/* Cliente -> ahora en la parte superior */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <Select
              value={clienteId === "" ? NONE_VALUE : String(clienteId)}
              onValueChange={(val) => setClienteId(val === NONE_VALUE ? "" : Number(val))}
            >
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder="Selecciona un cliente..." />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                <SelectItem value={NONE_VALUE} className="px-6 py-2 hover:bg-gray-100">-- Seleccionar --</SelectItem>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)} className="px-6 py-2 hover:bg-gray-100">{`${c.nombre} ${c.apellido} (${c.ci})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Productos */}
          <div className="py-8">
            <h3 className="text-lg font-semibold mb-2">Productos</h3>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="border rounded px-3 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 w-full">
                    <label className="text-xs text-muted-foreground">Producto</label>
                    <Select
                      value={it.medicamento_id ? String(it.medicamento_id) : NONE_VALUE}
                      onValueChange={(val) => onSelectMedicamento(idx, val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona medicamento..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                        <SelectItem value={NONE_VALUE} className="px-6 py-2 hover:bg-gray-100">--</SelectItem>
                        {medicamentos.map(m => <SelectItem key={m.id} value={String(m.id)} className="px-6 py-2 hover:bg-gray-100">{`${m.codigo} - ${m.nombre} (stk: ${m.stock})`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Cantidad</label>
                      <input type="number" min={1} value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })} className="w-24 border rounded px-2 py-1" />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Precio</label>
                      <input type="number" step="0.01" min={0} value={it.precio_por_unidad} onChange={(e) => updateItem(idx, { precio_por_unidad: Number(e.target.value) })} className="w-28 border rounded px-2 py-1" />
                    </div>

                    <div className="text-right">
                      <label className="text-xs text-muted-foreground">Subtotal</label>
                      <div className="font-medium">{formatBs(it.subtotal)}</div>
                    </div>

                    <div>
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:underline ml-2">Quitar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Button type="button" onClick={addItem} className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> Agregar producto
              </Button>
            </div>
          </div>

          {/* Total (reforzado antes de botones) */}
          <div className="flex items-center justify-between mt-2">
            
            <div className="">
              <div className="text-sm text-muted-foreground">Total:</div>
            </div>
            <div>
              <div className="font-bold text-xl">{formatBs(total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" onClick={handleClose} className="px-4 py-2 bg-white border" disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white">{loading ? (ventaId ? "Actualizando..." : "Guardando...") : (ventaId ? "Actualizar" : "Guardar")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
