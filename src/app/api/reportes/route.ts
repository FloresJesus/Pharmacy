// app/api/reportes/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import fs from "fs"
import path from "path"

/* ---------------- Types (según tu schema) ---------------- */
interface ClienteRel { id?: number; nombre?: string; apellido?: string; ci?: string | null }

interface VentaRow {
  id: number
  cliente_id?: number | null
  usuario_id?: number | null
  fecha_venta: string
  monto_total: number | string
  estado?: string | null
  clientes?: ClienteRel | null
}

interface ItemRow {
  id: number
  venta_id: number
  medicamento_id: number
  cantidad: number
  precio_por_unidad: number | string
  subtotal: number | string
  medicamentos?: { codigo?: string; nombre?: string }[] | null
}

interface MedicamentoRow {
  id: number
  codigo: string
  nombre: string
  descripcion?: string | null
  fecha_vencimiento?: string | null
  stock: number
  stock_minimo?: number | null
  precio_compra?: number | string
  precio_venta?: number | string
  estado?: string | null
}

interface EntradaRow {
  id: number
  medicamento_id: number
  usuario_id?: number | null
  cantidad: number
  fecha_entrada: string
  precio_unitario?: number | string
  observaciones?: string | null
  medicamento?: { codigo?: string; nombre?: string }[] | null
}

interface SalidaRow {
  id: number
  medicamento_id: number
  usuario_id?: number | null
  cantidad: number
  fecha_salida: string
  motivo?: string | null
  medicamento?: { codigo?: string; nombre?: string }[] | null
}

type ReporteInsert = {
  tipo: string
  formato: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  parametros?: Record<string, unknown>
  resultado_path?: string | null
  resultado_size?: number | null
  estado?: string
  notas?: string | null
  created_by?: string | null
}

/* ---------------- Supabase init ---------------- */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

/* ---------------- Helpers ---------------- */

async function tryReadLogo(): Promise<Uint8Array | null> {
  try {
    const logoPath = path.resolve(process.cwd(), "public", "images", "logo.png")
    if (!fs.existsSync(logoPath)) return null
    return new Uint8Array(fs.readFileSync(logoPath))
  } catch {
    return null
  }
}

function objectArrayToCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows || rows.length === 0) return ""
  const keys = Object.keys(rows[0]) as (keyof T)[]
  const escapeVal = (val: unknown): string => {
    if (val === null || val === undefined) return ""
    const s = String(val)
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const header = keys.join(",")
  const lines = rows.map((r) => keys.map((k) => escapeVal(r[k])).join(","))
  return [header, ...lines].join("\n")
}

async function generateSimplePdf(title: string, headers: string[], rows: (string | number)[][], logoBytes: Uint8Array | null) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const margin = 36
  let cursorY = height - margin

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const accent = rgb(0.06, 0.45, 0.75)
  const dark = rgb(0.08, 0.08, 0.08)

  if (logoBytes) {
    try {
      const img = await pdfDoc.embedPng(logoBytes)
      const scale = Math.min(1, 60 / img.height)
      page.drawImage(img, { x: margin, y: cursorY - 60, width: img.width * scale, height: img.height * scale })
    } catch {
      // ignore
    }
  }

  page.drawText(title.replace('_',' '), { x: margin+200, y: cursorY - 12, size: 16, font: fontBold, color: accent })
  page.drawText(`Fecha: ${new Date().toLocaleDateString()}`, { x: margin, y: cursorY - 80, size: 10, font, color: dark })
  page.drawText(`Generado por el sistema de gestión de farmacia`, { x: margin, y: cursorY - 92, size: 10, font, color: dark })
  cursorY -= 100

  const colCount = Math.max(1, headers.length)
  const tableWidth = width - margin * 2
  const colW = Math.floor(tableWidth / colCount)
  const headH = 18

  for (let i = 0; i < colCount; i++) {
    page.drawRectangle({ x: margin + i * colW, y: cursorY - headH, width: colW, height: headH, color: accent })
    page.drawText(String(headers[i] ?? ""), { x: margin + i * colW + 6, y: cursorY - headH + 4, size: 9, font: fontBold, color: rgb(1, 1, 1) })
  }
  cursorY -= headH + 8

  const rowH = 14
  for (const r of rows) {
    if (cursorY < margin + 50) {
      page = pdfDoc.addPage([595, 842])
      cursorY = height - margin - 20
    }
    for (let i = 0; i < colCount; i++) {
      const txt = r[i] === null || r[i] === undefined ? "" : String(r[i])
      page.drawText(txt, { x: margin + i * colW + 6, y: cursorY - 10, size: 9, font, color: dark })
    }
    cursorY -= rowH
  }

  page.drawLine({ start: { x: margin, y: margin + 18 }, end: { x: width - margin, y: margin + 18 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  return pdfDoc.save()
}

/* ------------------ Handler POST (con registro en reportes) ------------------ */

export async function POST(req: Request) {
  let reporteId: number | null = null
  try {
    const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as {
      tipoReporte?: string
      fechaInicio?: string
      fechaFin?: string
      formato?: string
      threshold?: number
      userId?: string | null
    }

    const tipoReporte = String(body.tipoReporte ?? "inventario_actual")
    const fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null
    const fechaFin = body.fechaFin ? new Date(body.fechaFin) : null
    const formato = (String(body.formato ?? "PDF") || "PDF").toUpperCase() as "PDF" | "CSV"
    const threshold = typeof body.threshold === "number" ? Number(body.threshold) : null
    const createdBy = typeof body.userId === "string" ? body.userId : null

    // Insertar registro PENDIENTE (sin genéricos problemáticos)
    const insertPayload: ReporteInsert = {
      tipo: tipoReporte,
      formato,
      fecha_inicio: fechaInicio ? fechaInicio.toISOString() : null,
      fecha_fin: fechaFin ? fechaFin.toISOString() : null,
      parametros: { threshold: threshold ?? undefined },
      estado: "PENDIENTE",
      notas: null,
      created_by: createdBy ?? null,
    }

    const createResp = await supabase.from("reportes").insert(insertPayload).select("id").maybeSingle()
    if (createResp.error) {
      console.warn("No se pudo crear registro en reportes (continuando sin id):", createResp.error)
      reporteId = null
    } else {
      // createResp.data puede ser { id: number } o null
      const createdRow = createResp.data as { id?: number } | null
      reporteId = createdRow?.id ?? null
    }

    // Generar filas según tipoReporte
    let rows: Record<string, unknown>[] = []

    // ---------- VENTAS ----------
    if (tipoReporte === "ventas_detallado" || tipoReporte === "ventas_resumen" || tipoReporte === "ventas_por_cliente") {
      // construimos la query sin genéricos y aplicamos filtros condicionalmente
      let ventasQuery = supabase.from("ventas").select("id, fecha_venta, monto_total, estado, cliente_id, clientes:cliente_id (id, nombre, apellido)")
      ventasQuery = ventasQuery.order("id", { ascending: false })
      if (fechaInicio) ventasQuery = ventasQuery.gte("fecha_venta", fechaInicio.toISOString())
      if (fechaFin) {
        const end = new Date(fechaFin); end.setHours(23, 59, 59, 999)
        ventasQuery = ventasQuery.lte("fecha_venta", end.toISOString())
      }
      const ventasResp = await ventasQuery
      if (ventasResp.error) throw ventasResp.error
      const ventas = (ventasResp.data ?? []) as VentaRow[]

      if (tipoReporte === "ventas_detallado") {
        const ventaIds = ventas.map((v) => v.id)
        let items: ItemRow[] = []
        if (ventaIds.length > 0) {
          const itemsResp = await supabase
            .from("items_venta")
            .select("id, venta_id, medicamento_id, cantidad, precio_por_unidad, subtotal, medicamentos:medicamento_id (codigo, nombre)")
            .in("venta_id", ventaIds)
          if (itemsResp.error) throw itemsResp.error
          items = (itemsResp.data ?? []) as ItemRow[]
        }

        for (const v of ventas) {
          const its = items.filter(i => i.venta_id === v.id)
          const itemsTxt = its.map(it => {
            const med = Array.isArray(it.medicamentos) ? it.medicamentos[0] ?? null : it.medicamentos
            const label = med ? `${med.codigo ?? ""} ${med.nombre ?? ""}` : `#${it.medicamento_id}`
            return `${label} x${it.cantidad}\n` //@${Number(it.precio_por_unidad).toFixed(2)} => ${Number(it.subtotal).toFixed(2)}
          }).join(" | ")
          rows.push({
            venta_id: v.id,
            fecha_venta: v.fecha_venta.slice(0, 10),
            cliente: v.clientes ? `${v.clientes.nombre ?? ""} ${v.clientes.apellido ?? ""}` : "No registrado",
            monto_total: Number(v.monto_total ?? 0).toFixed(2),
            estado: v.estado ?? "",
            items: itemsTxt,
          })
        }
      } else if (tipoReporte === "ventas_resumen") {
        const mapDay = new Map<string, { total: number; count: number }>()
        for (const v of ventas) {
          const d = new Date(v.fecha_venta).toISOString().slice(0, 10)
          const cur = mapDay.get(d) ?? { total: 0, count: 0 }
          cur.total += Number(v.monto_total ?? 0)
          cur.count += 1
          mapDay.set(d, cur)
        }
        for (const [day, info] of mapDay.entries()) rows.push({ fecha: day, ventas: info.count, total: info.total.toFixed(2) })
        rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      } else {
        // ventas_por_cliente
        const mapClient = new Map<string, { total: number; count: number }>()
        for (const v of ventas) {
          const name = v.clientes ? `${v.clientes.nombre ?? ""} ${v.clientes.apellido ?? ""}` : "No registrado"
          const cur = mapClient.get(name) ?? { total: 0, count: 0 }
          cur.total += Number(v.monto_total ?? 0)
          cur.count += 1
          mapClient.set(name, cur)
        }
        for (const [cliente, info] of mapClient.entries()) rows.push({ cliente, ventas_count: info.count, total: info.total.toFixed(2) })
      }
    }

    // ---------- INVENTARIO ACTUAL ----------
    else if (tipoReporte === "inventario_actual") {
      const medsResp = await supabase.from("medicamentos").select("id, codigo, nombre, stock, stock_minimo, precio_venta, fecha_vencimiento, estado")
      if (medsResp.error) throw medsResp.error
      const meds = (medsResp.data ?? []) as MedicamentoRow[]
      rows = meds.map(m => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        stock: m.stock,
        stock_minimo: m.stock_minimo ?? 0,
        precio_venta: Number(m.precio_venta ?? 0).toFixed(2),
        fecha_vencimiento: m.fecha_vencimiento ?? "",
        estado: m.estado ?? ""
      }))
    }

    // ---------- MOVIMIENTOS ----------
    else if (tipoReporte === "movimientos") {
      let entradasQuery = supabase.from("entradas_inventario").select("id, medicamento_id, cantidad, fecha_entrada, precio_unitario, observaciones, medicamento:medicamento_id (codigo, nombre)")
      let salidasQuery = supabase.from("salidas_inventario").select("id, medicamento_id, cantidad, fecha_salida, motivo, medicamento:medicamento_id (codigo, nombre)")
      if (fechaInicio) {
        entradasQuery = entradasQuery.gte("fecha_entrada", fechaInicio.toISOString())
        salidasQuery = salidasQuery.gte("fecha_salida", fechaInicio.toISOString())
      }
      if (fechaFin) {
        const end = new Date(fechaFin); end.setHours(23, 59, 59, 999)
        entradasQuery = entradasQuery.lte("fecha_entrada", end.toISOString())
        salidasQuery = salidasQuery.lte("fecha_salida", end.toISOString())
      }
      const [entradasResp, salidasResp] = await Promise.all([entradasQuery, salidasQuery])
      if (entradasResp.error) throw entradasResp.error
      if (salidasResp.error) throw salidasResp.error
      const entradas = (entradasResp.data ?? []) as EntradaRow[]
      const salidas = (salidasResp.data ?? []) as SalidaRow[]

      for (const en of entradas) {
        const med = Array.isArray(en.medicamento) ? en.medicamento[0] ?? null : en.medicamento
        rows.push({
          tipo: "ENTRADA",
          fecha: en.fecha_entrada,
          medicamento: med ? `${med.codigo} ${med.nombre}` : String(en.medicamento_id),
          cantidad: en.cantidad,
          precio_unitario: Number(en.precio_unitario ?? 0).toFixed(2),
          observaciones: en.observaciones ?? ""
        })
      }
      for (const sa of salidas) {
        const med = Array.isArray(sa.medicamento) ? sa.medicamento[0] ?? null : sa.medicamento
        rows.push({
          tipo: "SALIDA",
          fecha: sa.fecha_salida,
          medicamento: med ? `${med.codigo} ${med.nombre}` : String(sa.medicamento_id),
          cantidad: sa.cantidad,
          motivo: sa.motivo ?? ""
        })
      }
      rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    }

    // ---------- POR VENCER ----------
    else if (tipoReporte === "por_vencer") {
      let startIso: string, endIso: string
      if (!fechaInicio || !fechaFin) {
        const now = new Date()
        const start = now
        const end = new Date(); end.setDate(now.getDate() + 30)
        startIso = start.toISOString().slice(0, 10)
        endIso = end.toISOString().slice(0, 10)
      } else {
        startIso = fechaInicio.toISOString().slice(0, 10)
        endIso = fechaFin.toISOString().slice(0, 10)
      }
      const resp = await supabase.from("medicamentos").select("id, codigo, nombre, fecha_vencimiento, stock").gte("fecha_vencimiento", startIso).lte("fecha_vencimiento", endIso)
      if (resp.error) throw resp.error
      rows = (resp.data ?? []).map((m: MedicamentoRow) => ({ id: m.id, codigo: m.codigo, nombre: m.nombre, fecha_vencimiento: m.fecha_vencimiento, stock: m.stock }))
    }

    // ---------- STOCK BAJO / MINIMOS ----------
    else if (tipoReporte === "stock_bajo" || tipoReporte === "minimos") {
      const resp = await supabase.from("medicamentos").select("id, codigo, nombre, stock, stock_minimo, precio_venta")
      if (resp.error) throw resp.error
      const all = (resp.data ?? []) as MedicamentoRow[]
      const filtered = threshold !== null ? all.filter(m => m.stock <= threshold) : all.filter(m => m.stock <= (m.stock_minimo ?? 0))
      rows = filtered.map(m => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        stock: m.stock,
        stock_minimo: m.stock_minimo ?? 0,
        precio_venta: Number(m.precio_venta ?? 0).toFixed(2)
      }))
    }

    // unsupported
    else {
      if (reporteId) await supabase.from("reportes").update({ estado: "ERROR", notas: "tipoReporte no soportado" }).eq("id", reporteId)
      return NextResponse.json({ ok: false, error: "tipoReporte no soportado" }, { status: 400 })
    }

    // Generar archivo y devolver (sin storage)
    const logo = await tryReadLogo()
    const rangePart = fechaInicio && fechaFin ? `${fechaInicio.toISOString().slice(0,10)}_${fechaFin.toISOString().slice(0,10)}` : new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")
    const fileBase = `reporte-${tipoReporte}-${rangePart}`

    if (formato === "CSV") {
      const csv = objectArrayToCsv(rows)
      const fileName = `${fileBase}.csv`
      const headers = {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      }
      const buf = Buffer.from(csv, "utf-8")
      if (reporteId) await supabase.from("reportes").update({ estado: "GENERADO", notas: "descarga directa", resultado_size: buf.length }).eq("id", reporteId)
      return new NextResponse(buf, { status: 200, headers })
    } else {
      const headersKeys = rows.length > 0 ? Object.keys(rows[0]) : ["Info"]
      const rowsData = rows.map(r => headersKeys.map(k => {
        const v = r[k]
        if (v === null || v === undefined) return ""
        if (typeof v === "object") return JSON.stringify(v)
        return String(v)
      }))
      const pdfBytes = await generateSimplePdf(`Reporte: ${tipoReporte}`, headersKeys, rowsData, logo)
      const fileName = `${fileBase}.pdf`
      const headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      }
      const buf = Buffer.from(pdfBytes)
      if (reporteId) await supabase.from("reportes").update({ estado: "GENERADO", notas: "descarga directa", resultado_size: buf.length }).eq("id", reporteId)
      return new NextResponse(buf, { status: 200, headers })
    }
  } catch (err: unknown) {
    console.error("Error /api/reportes:", err)
    const message = err instanceof Error ? err.message : String(err)
    try {
      if (typeof reporteId === "number") {
        await supabase.from("reportes").update({ estado: "ERROR", notas: message }).eq("id", reporteId)
      }
    } catch (uErr) {
      console.warn("Error actualizando registro de reporte tras fallo:", uErr)
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
