"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
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

type FormErrors = Partial<Record<keyof FormData, string>>

export function MedicamentoDialog({ open, onOpenChange, medicamento }: MedicamentoDialogProps) {

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // refs para foco en primer error
  const codigoRef = useRef<HTMLInputElement | null>(null)
  const nombreRef = useRef<HTMLInputElement | null>(null)
  const fechaRef = useRef<HTMLInputElement | null>(null)
  const cantidadRef = useRef<HTMLInputElement | null>(null)
  const precioCompraRef = useRef<HTMLInputElement | null>(null)
  const precioVentaRef = useRef<HTMLInputElement | null>(null)

  // cargar datos en formulario
  useEffect(() => {
    if (medicamento) {
      setFormData({
        codigo: medicamento.codigo ?? "",
        nombre: medicamento.nombre ?? "",
        descripcion: medicamento.descripcion ?? "",
        fechaVencimiento: medicamento.fechaVencimiento ?? "",
        cantidad: medicamento.cantidad ?? 0,
        precioCompra: medicamento.precioCompra ?? 0,
        precioVenta: medicamento.precioVenta ?? 0,
        estado: medicamento.estado ?? "disponible",
      })
    } else {
      setFormData(INITIAL_FORM)
    }
    setErrors({})
  }, [medicamento, open])

  // reset al cerrar
  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM)
      setLoading(false)
      setErrors({})
    }
  }, [open])

  // obtener auth UID
  const getAuthUid = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  }

  // obtener ID de usuario local
  const getUsuarioId = async () => {
    const authUid = await getAuthUid()
    if (!authUid) return null

    const { data, error } = await supabase
      .from("usuarios")
      .select("id")
      .eq("auth_uid", authUid)
      .maybeSingle()

    if (error) {
      console.error("Error buscando usuario local:", error)
      return null
    }

    return data?.id ?? null
  }

  // registrar entrada
  const registrarEntrada = async (
    medicamento_id: number,
    usuario_id: number | null,
    cantidad: number,
    precio_unitario: number,
    observaciones: string
  ) => {
    const created_by = await getAuthUid()

    await supabase.from("entradas_inventario").insert({
      medicamento_id,
      usuario_id,
      cantidad,
      precio_unitario,
      fecha_entrada: new Date().toISOString(),
      observaciones,
      created_by
    })
  }

  // registrar salida
  const registrarSalida = async (
    medicamento_id: number,
    usuario_id: number | null,
    cantidad: number,
    motivo: string
  ) => {
    const created_by = await getAuthUid()

    await supabase.from("salidas_inventario").insert({
      medicamento_id,
      usuario_id,
      cantidad,
      fecha_salida: new Date().toISOString(),
      motivo,
      created_by
    })
  }

  // --- VALIDACIONES ---
  const CODE_REGEX = /^[A-Z]{2}-\d{3}$/
  const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9' -]{2,}$/ // letras, espacios, - y '
  const isValidDate = (d: string) => {
    if (!d) return false
    const t = Date.parse(d)
    return !Number.isNaN(t)
  }
  const todayIsOrBefore = (d: string) => {
    // compara fecha (sin tiempo)
    const given = new Date(d)
    given.setHours(0,0,0,0)
    const today = new Date()
    today.setHours(0,0,0,0)
    return given >= today
  }

  const validateField = (key: keyof FormData, value: FormData[keyof FormData]): string | null => {
    switch (key) {
      case "codigo": {
        const v = String(value ?? "").trim()
        if (!v) return "Código obligatorio."
        if (!CODE_REGEX.test(v)) return "Código inválido. Formato AA-000 (dos mayúsculas, guion y 3 números)."
        return null
      }
      case "nombre": {
        const v = String(value ?? "").trim()
        if (!v) return "Nombre obligatorio."
        if (!NAME_REGEX.test(v)) return "Nombre inválido (mín. 2 caracteres, solo letras y espacios)."
        return null
      }
      case "fechaVencimiento": {
        const v = String(value ?? "").trim()
        if (!v) return "Fecha de vencimiento obligatoria."
        if (!isValidDate(v)) return "Fecha inválida."
        if (!todayIsOrBefore(v)) return "La fecha no puede ser anterior a hoy."
        return null
      }
      case "cantidad": {
        const v = value === "" ? "" : Number(value)
        if (v === "") return "Cantidad obligatoria."
        if (!Number.isFinite(Number(v)) || Number(v) < 0) return "Cantidad inválida (>= 0)."
        if (!Number.isInteger(Number(v))) return "Cantidad debe ser un número entero."
        return null
      }
      case "precioCompra": {
        const v = value === "" ? "" : Number(value)
        if (v === "") return "Precio de compra obligatorio."
        if (!Number.isFinite(Number(v)) || Number(v) < 0) return "Precio de compra inválido (>= 0)."
        return null
      }
      case "precioVenta": {
        const v = value === "" ? "" : Number(value)
        if (v === "") return "Precio de venta obligatorio."
        if (!Number.isFinite(Number(v)) || Number(v) < 0) return "Precio de venta inválido (>= 0)."
        // validar relación con precioCompra si ambos están presentes
        const pc = formData.precioCompra === "" ? null : Number(formData.precioCompra)
        if (pc !== null && Number(v) < pc) return "Precio de venta no puede ser menor que precio de compra."
        return null
      }
      case "descripcion":
      case "estado":
        return null
      default:
        return null
    }
  }

  // validar todo el formulario (evita problemas de types usando Array<keyof FormData>)
  const validateAll = (data: FormData): FormErrors => {
    const nextErrors: FormErrors = {}
    for (const k of Object.keys(data) as Array<keyof FormData>) {
      const err = validateField(k, data[k])
      if (err) nextErrors[k] = err
    }
    return nextErrors
  }

  const focusFirstError = (errs: FormErrors) => {
    if (errs.codigo) { codigoRef.current?.focus(); return }
    if (errs.nombre) { nombreRef.current?.focus(); return }
    if (errs.fechaVencimiento) { fechaRef.current?.focus(); return }
    if (errs.cantidad) { cantidadRef.current?.focus(); return }
    if (errs.precioCompra) { precioCompraRef.current?.focus(); return }
    if (errs.precioVenta) { precioVentaRef.current?.focus(); return }
  }

  const handleBlur = (k: keyof FormData) => {
    const err = validateField(k, formData[k])
    setErrors(prev => ({ ...prev, [k]: err ?? undefined }))
  }

  // SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const nextErrors = validateAll(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    setLoading(true)

    const payload = {
      codigo: String(formData.codigo).trim(),
      nombre: String(formData.nombre).trim(),
      descripcion: formData.descripcion || null,
      fecha_vencimiento: String(formData.fechaVencimiento),
      stock: Number(formData.cantidad),
      precio_compra: Number(formData.precioCompra),
      precio_venta: Number(formData.precioVenta),
      estado: formData.estado === "disponible" ? "Disponible" : "No Disponible"
    }

    try {
      const usuarioId = await getUsuarioId()

      if (medicamento && medicamento.id) {
        // EDITAR — obtener stock actual
        const { data: actual } = await supabase
          .from("medicamentos")
          .select("stock")
          .eq("id", medicamento.id)
          .maybeSingle()

        const stockAntiguo = actual?.stock ?? 0
        const stockNuevo = payload.stock

        // actualizar medicamento
        const resp = await supabase
          .from("medicamentos")
          .update(payload)
          .eq("id", medicamento.id)
          .select()
          .maybeSingle()

        if (resp.error) throw resp.error

        // registrar entrada o salida
        if (stockNuevo > stockAntiguo) {
          await registrarEntrada(
            medicamento.id,
            usuarioId,
            stockNuevo - stockAntiguo,
            payload.precio_compra,
            "Ajuste por actualización"
          )
        }

        if (stockNuevo < stockAntiguo) {
          await registrarSalida(
            medicamento.id,
            usuarioId,
            stockAntiguo - stockNuevo,
            "Vencido o ajuste por actualización"
          )
        }

        alert("Medicamento actualizado")

      } else {
        // CREAR
        const resp = await supabase
          .from("medicamentos")
          .insert(payload)
          .select()
          .maybeSingle()

        if (resp.error) throw resp.error

        const nuevoId = resp.data.id

        // registrar entrada inicial
        if (payload.stock > 0) {
          await registrarEntrada(
            nuevoId,
            usuarioId,
            payload.stock,
            payload.precio_compra,
            "Ingreso inicial"
          )
        }

        alert("Medicamento creado")
      }

      onOpenChange(false)
      setFormData(INITIAL_FORM)
      setErrors({})

    } catch (error) {
      console.error(error)
      alert("Error inesperado, revisa consola")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[80vh] overflow-y-auto p-6 bg-white rounded-lg shadow-xl">
        <DialogHeader className="mb-6">
          <DialogTitle>{medicamento ? "Editar Medicamento" : "Nuevo Medicamento"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>

          {/* código y nombre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Código *</Label>
              <Input
                ref={codigoRef}
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                onBlur={() => handleBlur("codigo")}
                aria-invalid={!!errors.codigo}
                aria-describedby={errors.codigo ? "err-codigo" : undefined}
                required
                className={`${errors.codigo ? "border-red-500" : ""}`}
              />
              {errors.codigo && <p id="err-codigo" className="text-red-600 text-sm mt-1">{errors.codigo}</p>}
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                ref={nombreRef}
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                onBlur={() => handleBlur("nombre")}
                aria-invalid={!!errors.nombre}
                aria-describedby={errors.nombre ? "err-nombre" : undefined}
                required
                className={`${errors.nombre ? "border-red-500" : ""}`}
              />
              {errors.nombre && <p id="err-nombre" className="text-red-600 text-sm mt-1">{errors.nombre}</p>}
            </div>
          </div>

          {/* descripción */}
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
          </div>

          {/* fecha + cantidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Fecha de Vencimiento *</Label>
              <Input
                ref={fechaRef}
                type="date"
                value={formData.fechaVencimiento}
                onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                onBlur={() => handleBlur("fechaVencimiento")}
                aria-invalid={!!errors.fechaVencimiento}
                aria-describedby={errors.fechaVencimiento ? "err-fecha" : undefined}
                required
                className={`${errors.fechaVencimiento ? "border-red-500" : ""}`}
              />
              {errors.fechaVencimiento && <p id="err-fecha" className="text-red-600 text-sm mt-1">{errors.fechaVencimiento}</p>}
            </div>

            <div>
              <Label>Cantidad *</Label>
              <Input
                ref={cantidadRef}
                type="number"
                min={0}
                value={formData.cantidad === "" ? "" : String(formData.cantidad)}
                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value === "" ? "" : Number(e.target.value) })}
                onBlur={() => handleBlur("cantidad")}
                aria-invalid={!!errors.cantidad}
                aria-describedby={errors.cantidad ? "err-cantidad" : undefined}
                required
                className={`${errors.cantidad ? "border-red-500" : ""}`}
              />
              {errors.cantidad && <p id="err-cantidad" className="text-red-600 text-sm mt-1">{errors.cantidad}</p>}
            </div>
          </div>

          {/* precios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>Precio Compra *</Label>
              <Input
                ref={precioCompraRef}
                type="number"
                step="0.01"
                min={0}
                value={formData.precioCompra === "" ? "" : String(formData.precioCompra)}
                onChange={(e) => setFormData({ ...formData, precioCompra: e.target.value === "" ? "" : Number(e.target.value) })}
                onBlur={() => handleBlur("precioCompra")}
                aria-invalid={!!errors.precioCompra}
                aria-describedby={errors.precioCompra ? "err-precioc" : undefined}
                required
                className={`${errors.precioCompra ? "border-red-500" : ""}`}
              />
              {errors.precioCompra && <p id="err-precioc" className="text-red-600 text-sm mt-1">{errors.precioCompra}</p>}
            </div>

            <div>
              <Label>Precio Venta *</Label>
              <Input
                ref={precioVentaRef}
                type="number"
                step="0.01"
                min={0}
                value={formData.precioVenta === "" ? "" : String(formData.precioVenta)}
                onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value === "" ? "" : Number(e.target.value) })}
                onBlur={() => handleBlur("precioVenta")}
                aria-invalid={!!errors.precioVenta}
                aria-describedby={errors.precioVenta ? "err-preciov" : undefined}
                required
                className={`${errors.precioVenta ? "border-red-500" : ""}`}
              />
              {errors.precioVenta && <p id="err-preciov" className="text-red-600 text-sm mt-1">{errors.precioVenta}</p>}
            </div>

            <div>
              <Label>Estado *</Label>
              <Select
                value={formData.estado}
                onValueChange={(value) =>
                  setFormData({ ...formData, estado: value as "disponible" | "no-disponible" })
                }
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

          {/* botones */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => {
              onOpenChange(false)
              setFormData(INITIAL_FORM)
              setErrors({})
            }} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? "Guardando..." : medicamento ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
