"use client"

import React, { useState, useEffect, useRef, FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog"
import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { supabase } from "@/lib/supabase"

export interface Usuario {
  id?: number | null
  nombre_usuario: string
  nombre_completo: string
  contrasena?: string | null
  rol?: string | null
  activo?: boolean | null
  email?: string | null
}

interface UsuarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: Usuario | null
  onSaved: () => void
}

interface UsuarioForm {
  nombre_usuario: string
  nombre_completo: string
  contrasena: string
  rol: string
  activo: boolean
  email: string
  create_auth?: boolean
}

const INITIAL_FORM: UsuarioForm = {
  nombre_usuario: "",
  nombre_completo: "",
  contrasena: "",
  rol: "vendedor",
  activo: true,
  email: "",
  create_auth: false,
}

type FormErrors = Partial<Record<keyof UsuarioForm, string>>

export function UsuarioDialog({ open, onOpenChange, usuario, onSaved }: UsuarioDialogProps) {
  const [formData, setFormData] = useState<UsuarioForm>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // refs for focusing first error
  const usuarioRef = useRef<HTMLInputElement | null>(null)
  const nombreRef = useRef<HTMLInputElement | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const contrasenaRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (usuario) {
      setFormData({
        nombre_usuario: usuario.nombre_usuario ?? "",
        nombre_completo: usuario.nombre_completo ?? "",
        contrasena: "",
        rol: usuario.rol ?? "vendedor",
        activo: usuario.activo ?? true,
        email: usuario.email ?? "",
        create_auth: false,
      })
    } else {
      setFormData(INITIAL_FORM)
    }
    setErrors({})
  }, [usuario, open])

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM)
      setLoading(false)
      setErrors({})
    }
  }, [open])

  // validation rules
  const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/ // letras/números/._- longitud 3-30
  const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/ // nombre completo razonable
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const PASSWORD_MIN = 6

  const validateField = (key: keyof UsuarioForm, value: UsuarioForm[keyof UsuarioForm]): string | null => {
    const v = String(value ?? "").trim()
    switch (key) {
      case "nombre_usuario":
        if (!v) return "Usuario es obligatorio."
        if (!USERNAME_REGEX.test(v)) return "Usuario inválido. Sólo letras, números y . _ - (3-30 caracteres)."
        return null
      case "nombre_completo":
        if (!v) return "Nombre completo es obligatorio."
        if (!NAME_REGEX.test(v)) return "Nombre completo inválido (mín. 2 caracteres)."
        return null
      case "email":
        if (!v) return "Email es obligatorio."
        if (!EMAIL_REGEX.test(v)) return "Email inválido."
        return null
      case "contrasena":
        // si es edición y contraseña vacía -> OK (no cambiar)
        if (usuario) {
          if (!v) return null
        }
        if (!v) return "Contraseña es obligatoria."
        if (v.length < PASSWORD_MIN) return `Contraseña demasiado corta (mín. ${PASSWORD_MIN} caracteres).`
        return null
      case "rol":
        if (!v) return "Rol es obligatorio."
        if (!["admin", "farmaceutico", "vendedor"].includes(v)) return "Rol inválido."
        return null
      case "activo":
        return null
      case "create_auth":
        return null
      default:
        return null
    }
  }

  const validateAll = (data: UsuarioForm): FormErrors => {
    const next: FormErrors = {}
    for (const k of Object.keys(data) as Array<keyof UsuarioForm>) {
      const err = validateField(k, data[k])
      if (err) next[k] = err
    }
    // additional cross-field validations:
    if (!next.contrasena && !usuario && !data.contrasena.trim()) {
      // ensure password on create
      next.contrasena = "Contraseña es obligatoria para nuevo usuario."
    }
    return next
  }

  const focusFirstError = (errs: FormErrors) => {
    if (errs.nombre_usuario) { usuarioRef.current?.focus(); return }
    if (errs.nombre_completo) { nombreRef.current?.focus(); return }
    if (errs.email) { emailRef.current?.focus(); return }
    if (errs.contrasena) { contrasenaRef.current?.focus(); return }
  }

  const handleBlur = (k: keyof UsuarioForm) => {
    const err = validateField(k, formData[k])
    setErrors(prev => ({ ...prev, [k]: err ?? undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    const nextErrors = validateAll(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    // if user asked to create auth account, ensure email + password present
    if (formData.create_auth) {
      if (!formData.email.trim()) {
        setErrors(prev => ({ ...prev, email: "Email necesario para crear cuenta Auth." }))
        emailRef.current?.focus()
        return
      }
      if (!formData.contrasena.trim()) {
        setErrors(prev => ({ ...prev, contrasena: "Contraseña necesaria para crear cuenta Auth." }))
        contrasenaRef.current?.focus()
        return
      }
    }

    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token ?? null

    try {
      if (usuario && usuario.id) {
        const res = await fetch("/api/usuarios", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: usuario.id,
            nombre_usuario: formData.nombre_usuario.trim(),
            nombre_completo: formData.nombre_completo.trim(),
            email: formData.email.trim() || null,
            rol: formData.rol,
            activo: formData.activo,
            contrasena: formData.contrasena?.trim() || "",
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? "Error actualizando usuario")
        alert("Usuario actualizado correctamente.")
      } else {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            nombre_usuario: formData.nombre_usuario.trim(),
            nombre_completo: formData.nombre_completo.trim(),
            email: formData.email.trim() || null,
            rol: formData.rol,
            activo: formData.activo,
            contrasena: formData.contrasena?.trim() || "",
            create_auth: formData.create_auth ?? false,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? "Error creando usuario")
        alert("Usuario creado correctamente.")
      }

      onSaved()
      onOpenChange(false)
      setFormData(INITIAL_FORM)
      setErrors({})
    } catch (ex: unknown) {
      console.error("Error usuario (dialog):", ex)
      const message = ex instanceof Error ? ex.message : String(ex)
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-gray-900">{usuario ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nombre_usuario">Usuario *</Label>
              <Input
                id="nombre_usuario"
                type="text"
                ref={usuarioRef}
                value={formData.nombre_usuario}
                onChange={(e) => setFormData({ ...formData, nombre_usuario: e.target.value })}
                onBlur={() => handleBlur("nombre_usuario")}
                className={`w-full ${errors.nombre_usuario ? "border-red-500" : ""}`}
                aria-invalid={!!errors.nombre_usuario}
                aria-describedby={errors.nombre_usuario ? "err-usuario" : undefined}
                required
              />
              {errors.nombre_usuario && <p id="err-usuario" className="text-red-600 text-sm mt-1">{errors.nombre_usuario}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre_completo">Nombre completo *</Label>
              <Input
                id="nombre_completo"
                type="text"
                ref={nombreRef}
                value={formData.nombre_completo}
                onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                onBlur={() => handleBlur("nombre_completo")}
                className={`w-full ${errors.nombre_completo ? "border-red-500" : ""}`}
                aria-invalid={!!errors.nombre_completo}
                aria-describedby={errors.nombre_completo ? "err-nombre-completo" : undefined}
                required
              />
              {errors.nombre_completo && <p id="err-nombre-completo" className="text-red-600 text-sm mt-1">{errors.nombre_completo}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
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

            <div className="space-y-2">
              <Label htmlFor="rol">Rol *</Label>
              <select
                id="rol"
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="admin">Administrador</option>
                <option value="farmaceutico">Farmacéutico</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrasena">{usuario ? "Contraseña (dejar vacía para no cambiar)" : "Contraseña *"}</Label>
            <Input
              id="contrasena"
              type="password"
              ref={contrasenaRef}
              value={formData.contrasena}
              onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
              onBlur={() => handleBlur("contrasena")}
              className={`w-full ${errors.contrasena ? "border-red-500" : ""}`}
              required={!usuario}
              aria-invalid={!!errors.contrasena}
              aria-describedby={errors.contrasena ? "err-contrasena" : undefined}
            />
            {errors.contrasena && <p id="err-contrasena" className="text-red-600 text-sm mt-1">{errors.contrasena}</p>}
          </div>

          {!usuario && (
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.create_auth}
                  onChange={(e) => setFormData({ ...formData, create_auth: e.target.checked })}
                />
                <span>Crear cuenta en Supabase Auth (email/password)</span>
              </label>
              <p className="text-sm text-muted-foreground">
                Si marcas esto, el servidor intentará crear la cuenta en Supabase Auth (necesita que quien hace la petición sea admin).
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Activo</Label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              />
              <span>{formData.activo ? "Activo" : "Inactivo"}</span>
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setFormData(INITIAL_FORM)
                setErrors({})
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (usuario ? "Actualizando..." : "Guardando...") : usuario ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
