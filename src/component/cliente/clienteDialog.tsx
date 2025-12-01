"use client"

import React, { useState, useEffect, useRef, FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
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

type FormErrors = Partial<Record<keyof FormData, string>>

export function ClienteDialog({ open, onOpenChange, cliente }: ClienteDialogProps) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const firstRef = useRef<HTMLInputElement | null>(null)
  const apellidoRef = useRef<HTMLInputElement | null>(null)
  const ciRef = useRef<HTMLInputElement | null>(null)
  const telefonoRef = useRef<HTMLInputElement | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const direccionRef = useRef<HTMLInputElement | null>(null)

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
    setErrors({})
  }, [cliente, open])

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM)
      setLoading(false)
      setErrors({})
    }
  }, [open])

  // --- reglas y/o validaciones REGEX ---
  const CI_REGEX = /^\d{6,12}$/ // sólo dígitos, 6-12 caracteres (ajusta si necesitas otro rango)
  const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/
  const PHONE_DIGITS_REGEX = /[0-9]/g
  const PHONE_REGEX = /^[+]?[\d\s\-()]{8}$/
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // validar un solo campo (útil onBlur)
  const validateField = (key: keyof FormData, value: string): string | null => {
    switch (key) {
      case "ci":
        if (!value.trim()) return "C.I. es obligatorio."
        if (!CI_REGEX.test(value.trim())) return "C.I. inválida. Debe contener sólo dígitos (6 a 12)."
        return null
      case "nombre":
        if (!value.trim()) return "Nombre es obligatorio."
        if (!NAME_REGEX.test(value.trim())) return "Nombre inválido. Usa sólo letras y espacios (mín. 2 caracteres)."
        return null
      case "apellido":
        if (!value.trim()) return "Apellido es obligatorio."
        if (!NAME_REGEX.test(value.trim())) return "Apellido inválido. Usa sólo letras y espacios (mín. 2 caracteres)."
        return null
      case "telefono":
        if (!value.trim()) return "Teléfono es obligatorio."
        // contar dígitos reales para asegurar longitud mínima razonable
        const digits = (value.match(PHONE_DIGITS_REGEX) || []).length
        if (digits < 8) return "Teléfono inválido. Debe tener al menos 8 dígitos."
        if (!PHONE_REGEX.test(value.trim())) return "Formato de teléfono inválido."
        return null
      case "email":
        if (!value.trim()) return "Email es obligatorio."
        if (!EMAIL_REGEX.test(value.trim())) return "Email inválido."
        return null
      case "direccion":
        if (!value.trim()) return "Dirección es obligatorio."
        if (value.trim().length < 3) return "Dirección demasiado corta."
        return null
      default:
        return null
    }
  }

  // validar todo el formulario
  const validateAll = (data: FormData): FormErrors => {
    const nextErrors: FormErrors = {}

    // Object.keys devuelve string[], por eso hacemos el cast a Array<keyof FormData>
    for (const k of Object.keys(data) as Array<keyof FormData>) {
      const value = data[k] // TypeScript sabe que value es string
      const err = validateField(k, value)
      if (err) {
        nextErrors[k] = err
      }
    }

    return nextErrors
  }

  // handler onBlur para validación campo a campo
  const handleBlur = (key: keyof FormData) => {
    const err = validateField(key, formData[key])
    setErrors(prev => ({ ...prev, [key]: err ?? undefined }))
  }

  const focusFirstError = (errs: FormErrors) => {
    if (errs.nombre) {
      firstRef.current?.focus()
      return
    }
    if (errs.apellido) {
      apellidoRef.current?.focus()
      return
    }
    if (errs.ci) {
      ciRef.current?.focus()
      return
    }
    if (errs.telefono) {
      telefonoRef.current?.focus()
      return
    }
    if (errs.email) {
      emailRef.current?.focus()
      return
    }
    if (errs.direccion) {
      direccionRef.current?.focus()
      return
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    // validar
    const nextErrors = validateAll(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
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
      setErrors({})
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
              <Label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre *</Label>
              <Input
                type="text"
                id="nombre"
                ref={firstRef}
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                onBlur={() => handleBlur("nombre")}
                className={`w-full ${errors.nombre ? "border-red-500" : ""}`}
                aria-invalid={!!errors.nombre}
                aria-describedby={errors.nombre ? "err-nombre" : undefined}
                required
              />
              {errors.nombre && <p id="err-nombre" className="text-red-600 text-sm mt-1">{errors.nombre}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido" className="block text-sm font-medium text-gray-700">Apellido *</Label>
              <Input
                type="text"
                id="apellido"
                ref={apellidoRef}
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                onBlur={() => handleBlur("apellido")}
                className={`w-full ${errors.apellido ? "border-red-500" : ""}`}
                aria-invalid={!!errors.apellido}
                aria-describedby={errors.apellido ? "err-apellido" : undefined}
                required
              />
              {errors.apellido && <p id="err-apellido" className="text-red-600 text-sm mt-1">{errors.apellido}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ci" className="block text-sm font-medium text-gray-700">C.I. *</Label>
              <Input
                type="text"
                id="ci"
                ref={ciRef}
                value={formData.ci}
                onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                onBlur={() => handleBlur("ci")}
                className={`w-full ${errors.ci ? "border-red-500" : ""}`}
                aria-invalid={!!errors.ci}
                aria-describedby={errors.ci ? "err-ci" : undefined}
                required
              />
              {errors.ci && <p id="err-ci" className="text-red-600 text-sm mt-1">{errors.ci}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono *</Label>
              <Input
                type="text"
                id="telefono"
                ref={telefonoRef}
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                onBlur={() => handleBlur("telefono")}
                className={`w-full ${errors.telefono ? "border-red-500" : ""}`}
                aria-invalid={!!errors.telefono}
                aria-describedby={errors.telefono ? "err-telefono" : undefined}
                required
              />
              {errors.telefono && <p id="err-telefono" className="text-red-600 text-sm mt-1">{errors.telefono}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">Email *</Label>
              <Input
                type="email"
                id="email"
                ref={emailRef}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={() => handleBlur("email")}
                className={`w-full ${errors.email ? "border-red-500" : ""}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "err-email" : undefined}
                required
              />
              {errors.email && <p id="err-email" className="text-red-600 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="direccion" className="block text-sm font-medium text-gray-700">Dirección *</Label>
              <Input
                type="text"
                id="direccion"
                ref={direccionRef}
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                onBlur={() => handleBlur("direccion")}
                className={`w-full ${errors.direccion ? "border-red-500" : ""}`}
                aria-invalid={!!errors.direccion}
                aria-describedby={errors.direccion ? "err-direccion" : undefined}
                required
              />
              {errors.direccion && <p id="err-direccion" className="text-red-600 text-sm mt-1">{errors.direccion}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setFormData(INITIAL_FORM)
                setErrors({})
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
