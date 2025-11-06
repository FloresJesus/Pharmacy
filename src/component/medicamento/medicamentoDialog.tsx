"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { Textarea } from "@/component/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/component/ui/select"

import { supabase } from "@/lib/supabase"

interface Medicamento {
  id?: number | null
  codigo: string
  nombre: string
  descripcion?: string | null
  fechaVencimiento: string
  cantidad: number
  precioCompra: number
  precioVenta: number
  estado: "disponible" | "no-disponible"
}

interface MedicamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  medicamento: Medicamento | null
}

interface FormData {
  codigo: string
  nombre: string
  descripcion: string
  fechaVencimiento: string
  cantidad: number | ""
  precioCompra: number | ""
  precioVenta: number | ""
  estado: "disponible" | "no-disponible"
}

const INITIAL_FORM: FormData = {
  codigo: "",
  nombre: "",
  descripcion: "",
  fechaVencimiento: "",
  cantidad: "" as number | "",
  precioCompra: "" as number | "",
  precioVenta: "" as number | "",
  estado: "disponible",
}

export function MedicamentoDialog({ open, onOpenChange, medicamento}: MedicamentoDialogProps) {

  
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  
  useEffect(() => {
    if (medicamento) {
      setFormData({
        codigo: medicamento.codigo ?? "",
        nombre: medicamento.nombre ?? "",
        descripcion: medicamento.descripcion ?? "",
        fechaVencimiento: medicamento.fechaVencimiento ?? "",
        cantidad: typeof medicamento.cantidad === "number" ? medicamento.cantidad : (medicamento.cantidad ?? 0),
        precioCompra: typeof medicamento.precioCompra === "number" ? medicamento.precioCompra : (medicamento.precioCompra ?? 0),
        precioVenta: typeof medicamento.precioVenta === "number" ? medicamento.precioVenta : (medicamento.precioVenta ?? 0),
        estado: medicamento.estado ?? "disponible",
      })
    } else {
      setFormData(INITIAL_FORM)
    }
  }, [medicamento, open])

  // Reset cuando se cierra
  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM)
      setLoading(false)
    }
  }, [open])

  const validate = useCallback((data: FormData) => {
    if (!data.codigo.trim()) return "El campo código es obligatorio."
    if (!data.nombre.trim()) return "El campo nombre es obligatorio."
    if (!data.fechaVencimiento) return "La fecha de vencimiento es obligatoria."
    const cantidadNum = Number(data.cantidad)
    const precioC = Number(data.precioCompra)
    const precioV = Number(data.precioVenta)
    if (Number.isNaN(cantidadNum) || cantidadNum < 0) return "Cantidad inválida."
    if (Number.isNaN(precioC) || precioC < 0) return "Precio de compra inválido."
    if (Number.isNaN(precioV) || precioV < 0) return "Precio de venta inválido."
    return null
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const err = validate(formData)
    if (err) {
      alert(err)
      return
    }

    setLoading(true)

    // Payload mapeado a columnas reales de la tabla `medicamentos`
    const payload = {
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion?.trim() ?? null,
      fecha_vencimiento: formData.fechaVencimiento,
      stock: Number(formData.cantidad),
      // stock_minimo se deja al default de la DB
      precio_compra: Number(formData.precioCompra),
      precio_venta: Number(formData.precioVenta),
      estado: formData.estado === "disponible" ? "Disponible" : "No Disponible",
    }

    try {
      console.debug("Payload a enviar:", payload)

      if (medicamento && medicamento.id) {
        // UPDATE
        const resp = await supabase
          .from("medicamentos")
          .update(payload)
          .eq("id", medicamento.id)
          .select()
          .maybeSingle()

        console.debug("Respuesta update:", resp)

        if (resp.error) {
          throw new Error(resp.error.message ?? JSON.stringify(resp.error))
        }
        if (!resp.data) {
          throw new Error("La actualización no afectó ninguna fila.")
        }

        alert("Medicamento actualizado correctamente.")
      } else {
        // INSERT
        const resp = await supabase
          .from("medicamentos")
          .insert(payload)
          .select()
          .maybeSingle()

        console.debug("Respuesta insert:", resp)

        if (resp.error) {
          throw new Error(resp.error.message ?? JSON.stringify(resp.error))
        }
        if (!resp.data) {
          throw new Error("La inserción no devolvió datos. Revisa la consola/network para detalles.")
        }

        alert("Medicamento creado correctamente.")
      }

      onOpenChange(false)
      setFormData(INITIAL_FORM)
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error:", err.message, err)
        alert(err.message)
      } else {
        console.error("Error desconocido:", err)
        alert(`Ocurrió un error al guardar (ver consola). Detalle: ${String(err)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-gray-900">{medicamento ? "Editar Medicamento" : "Nuevo Medicamento"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="block text-sm font-medium text-gray-700">Código *</Label>
              <Input
                id="codigo"
                ref={firstInputRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre *</Label>
              <Input
                id="nombre"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">Descripción</Label>
            <Textarea
              id="descripcion"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700">Fecha de Vencimiento *</Label>
              <Input
                id="fechaVencimiento"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.fechaVencimiento}
                onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidad" className="block text-sm font-medium text-gray-700">Cantidad *</Label>
              <Input
                id="cantidad"
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.cantidad === "" ? "" : String(formData.cantidad)}
                onChange={(e) => {
                  const val = e.target.value
                  setFormData({ ...formData, cantidad: val === "" ? "" : Number(val) })
                }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="precioCompra" className="block text-sm font-medium text-gray-700">Precio Compra (Bs.) *</Label>
              <Input
                id="precioCompra"
                type="number"
                step="0.01"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.precioCompra === "" ? "" : String(formData.precioCompra)}
                onChange={(e) => setFormData({ ...formData, precioCompra: e.target.value === "" ? "" : Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precioVenta" className="block text-sm font-medium text-gray-700">Precio Venta (Bs.) *</Label>
              <Input
                id="precioVenta"
                type="number"
                step="0.01"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.precioVenta === "" ? "" : String(formData.precioVenta)}
                onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value === "" ? "" : Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="block text-sm font-medium text-gray-700">Estado *</Label>
              <Select
                value={formData.estado}
                onValueChange={(value) => setFormData({ ...formData, estado: value as "disponible" | "no-disponible" })}
              >
                <SelectTrigger id="estado" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  <SelectItem value="disponible" className="px-6 py-2 hover:bg-gray-100">Disponible</SelectItem>
                  <SelectItem value="no-disponible" className="px-6 py-2 hover:bg-gray-100">No Disponible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setFormData(INITIAL_FORM)
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={loading}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? (medicamento ? "Actualizando..." : "Guardando...") : (medicamento ? "Actualizar" : "Guardar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
