"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { Textarea } from "@/component/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/component/ui/select"

interface Medicamento {
  id: string
  codigo: string
  nombre: string
  descripcion: string
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

export function MedicamentoDialog({ open, onOpenChange, medicamento}: MedicamentoDialogProps) {
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    fechaVencimiento: "",
    cantidad: 0,
    precioCompra: 0,
    precioVenta: 0,
    estado: "disponible",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Guardando medicamento:", formData)
    alert("Medicamento guardado exitosamente (simulación)")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-gray-900">{medicamento ? "Editar Medicamento" : "Nuevo Medicamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="block text-sm font-medium text-gray-700">Código *</Label>
              <Input
                id="codigo"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.precioCompra}
                onChange={(e) => setFormData({ ...formData, precioCompra: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precioVenta" className="block text-sm font-medium text-gray-700">Precio Venta (Bs.) *</Label>
              <Input
                id="precioVenta"
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.precioVenta}
                onChange={(e) => setFormData({ ...formData, precioVenta: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="block text-sm font-medium text-gray-700">Estado *</Label>
              <Select
                value={formData.estado}
                onValueChange={(value: "disponible" | "no-disponible") => setFormData({ ...formData, estado: value })}
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
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {medicamento ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
