"use client"

import React, { useState, useEffect, useRef, FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { Textarea } from "@/component/ui/textarea"
import { supabase } from "@/lib/supabase"


export interface Cliente {
  id?: number | null
  ci: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  direccion: string
}

interface ClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: Cliente | null
}

interface FormData {
  ci: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  direccion: string
}

const INITIAL_FORM: FormData = {
  ci: "",
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  direccion: "",
}

export function ClienteDialog({ open, onOpenChange, cliente }: ClienteDialogProps) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (cliente) {
      setFormData({
        ci: cliente.ci ?? "",
        nombre: cliente.nombre ?? "",
        apellido: cliente.apellido ?? "",
        telefono: cliente.telefono ?? "",
        email: cliente.email ?? "",
        direccion: cliente.direccion ?? "",
      })
    } else {
      setFormData(INITIAL_FORM)
    }
  }, [cliente, open])

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM)
      setLoading(false)
    }
  }, [open])

  const validate = (d: FormData) => {
    if (!d.ci.trim()) return "C.I. es obligatorio."
    if (!d.nombre.trim()) return "Nombre es obligatorio."
    if (!d.apellido.trim()) return "Apellido es obligatorio."
    if (!d.telefono.trim()) return "Teléfono es obligatorio."
    if (!d.email.trim()) return "Email es obligatorio."
    if (!d.direccion.trim()) return "Dirección es obligatorio."
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    const err = validate(formData)
    if (err) {
      alert(err)
      return
    }
    setLoading(true)
    const payload = {
      ci: formData.ci.trim(),
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email.trim(),
      direccion: formData.direccion.trim() || null,
    }

    try {
      if (cliente && cliente.id) {
        const resp = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", cliente.id)
          .select()
          .single()
        if (resp.error) throw new Error(resp.error.message ?? JSON.stringify(resp.error))
        alert("Cliente actualizado correctamente.")
      } else {
        const resp = await supabase
          .from("clientes")
          .insert(payload)
          .select()
          .single()
        if (resp.error) throw new Error(resp.error.message ?? JSON.stringify(resp.error))
        alert("Cliente creado correctamente.")
      }
      onOpenChange(false)
      setFormData(INITIAL_FORM)
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error cliente:", err.message)
        alert(err.message)
      } else {
        console.error("Error cliente desconocido:", err)
        alert("Ocurrió un error (ver consola).")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-gray-900">{cliente ? "Editar Cliente":"Nuevo Cliente"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="block text-sm font-medium text-gray-700">Nombre *</Label>
              <Input
                type="text"
                id="nombre"
                ref={firstRef}
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Apellido *</Label>
              <Input
                type="text"
                id="apellido"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                className="w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700">C.I. *</Label>
              <Input
                type="text"
                id="ci"
                value={formData.ci}
                onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                className="w-full"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidad" className="block text-sm font-medium text-gray-700">Telefono *</Label>
              <Input
                type="text"
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="precioCompra" className="block text-sm font-medium text-gray-700">Email *</Label>
              <Input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="direccion" className="block text-sm font-medium text-gray-700">Dirección *</Label>
              <Input
                type="text"
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className="w-full"
                required
              />
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
              {loading ? (cliente ? "Actualizando..." : "Guardando...") : (cliente ? "Actualizar" : "Guardar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}