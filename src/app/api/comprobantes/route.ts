// app/api/comprobantes/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib"
import fs from "fs"
import path from "path"

type VentaRow = {
  id: number
  cliente_id: number | null
  fecha_venta: string
  monto_total: number | string
  estado?: string | null
  clientes?: { id?: number; nombre?: string; apellido?: string; ci?: string } | null
}

type ItemRow = {
  id: number
  venta_id: number
  medicamento_id: number
  cantidad: number
  precio_por_unidad: number | string
  subtotal: number | string
  medicamentos?: { codigo?: string; nombre?: string }[] | null
}

type ComprobanteInsert = {
  venta_id: number
  tipo: string
  serie: string
  numero: string
  fecha_emision: string
  datos_json: Record<string, unknown>
  storage_path: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

async function tryReadLogo(): Promise<Uint8Array | null> {
  try {
    const logoPath = path.resolve(process.cwd(), "public", "images", "logo.png")
    if (!fs.existsSync(logoPath)) return null
    const buff = fs.readFileSync(logoPath)
    return new Uint8Array(buff)
  } catch {
    return null
  }
}

/**
 * Diseño mejorado del comprobante:
 * - Cabecera con logo a la izquierda y datos de la empresa + título a la derecha.
 * - Bloque con Nº de comprobante y fecha.
 * - Tabla con columnas: Detalle | Precio unit. | Cantidad | Subtotal
 * - Pie con total grande a la derecha y datos de empresa abajo.
 *
 * Color principal (accent) se eligió para combinar con tu logo (azul verdoso).
 * Puedes ajustar `accent` si deseas otro color.
 */
async function generatePdfBytes(venta: VentaRow, items: ItemRow[], logoBytes: Uint8Array | null) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 portrait
  const { width, height } = page.getSize()
  const margin = 42
  let cursorY = height - margin

  // Fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  //const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  // Colors
  const accent = rgb(0.05, 0.47, 0.66) // azul verdoso - combina con tu logo
  const accentLight = rgb(0.92, 0.96, 0.98)
  const dark = rgb(0.07, 0.07, 0.07)
  const muted = rgb(0.35, 0.35, 0.35)

  // --- HEADER ---
  const headerH = 90
  // Left area for logo
  const logoMaxH = headerH - 20
  if (logoBytes) {
    try {
      const img = await pdfDoc.embedPng(logoBytes)
      const scale = Math.min(1, logoMaxH / img.height)
      const logoH = img.height * scale
      const logoW = img.width * scale
      page.drawImage(img, { x: margin, y: cursorY - logoH + 6, width: logoW, height: logoH })
    } catch (e) {
      console.warn("No se pudo embeder logo:", e)
    }
  }

  // Right area: title + company small lines
  const title = "COMPROBANTE DE VENTA"
  const titleSize = 18
  const titleW = fontBold.widthOfTextAtSize(title, titleSize)
  const rightX = width - margin
  page.drawText(title, { x: rightX - titleW, y: cursorY - 6, size: titleSize, font: fontBold, color: accent })

  // optional: small company lines under title
  const companyLines = [
    "FARMACIA VIDA SANA",
    "Tel: (591) 99999999 | Oruro",
  ]
  let compY = cursorY - 28
  for (const line of companyLines) {
    page.drawText(line, { x: rightX - font.widthOfTextAtSize(line, 9) - 0, y: compY, size: 9, font, color: muted })
    compY -= 11
  }

  cursorY -= headerH

  // small separator line
  page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 0.8, color: accentLight })
  cursorY -= 16

  // --- INFO BLOCK: No. comprobante / Fecha / Cliente ---
  const blockH = 55
  // Left: number & date
  const ventaNum = `N° V-${String(venta.id).padStart(6, "0")}`
  page.drawText(ventaNum, { x: margin, y: cursorY + blockH - 18, size: 12, font: fontBold, color: dark })
  const fechaStr = new Date(venta.fecha_venta).toLocaleString()
  page.drawText(fechaStr, { x: margin, y: cursorY + blockH - 34, size: 9, font, color: muted })

  // Right: total small (mirrored)
  const totalSmall = `Total: Bs. ${Number(venta.monto_total ?? 0).toFixed(2)}`
  const totalSmallW = fontBold.widthOfTextAtSize(totalSmall, 12)
  page.drawText(totalSmall, { x: width - margin - totalSmallW, y: cursorY + blockH - 18, size: 12, font: fontBold, color: dark })

  // Client line under number
  const clienteTxt = venta.clientes ? `${venta.clientes.nombre ?? ""} ${venta.clientes.apellido ?? ""}` : "Cliente: No registrado"
  page.drawText("Cliente:", { x: margin, y: cursorY + 8, size: 10, font: fontBold, color: muted })
  page.drawText(clienteTxt, { x: margin + 62, y: cursorY + 8, size: 10, font, color: dark })

  cursorY -= blockH
  cursorY -= 8

  // --- TABLE HEADER ---
  const tableX = margin
  const tableW = width - margin * 2
  const colDetalleW = Math.floor(tableW * 0.58)
  const colPrecioW = Math.floor(tableW * 0.15)
  const colCantidadW = Math.floor(tableW * 0.12)
  //const colSubtotalW = tableW - (colDetalleW + colPrecioW + colCantidadW)

  const headH = 22
  page.drawRectangle({ x: tableX, y: cursorY - headH + 6, width: tableW, height: headH, color: accent })
  const headY = cursorY - headH + 12
  page.drawText("DETALLE", { x: tableX + 8, y: headY, size: 10, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText("PRECIO U.", { x: tableX + colDetalleW + 8, y: headY, size: 10, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText("CANT.", { x: tableX + colDetalleW + colPrecioW + 8, y: headY, size: 10, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText("SUBTOTAL", { x: tableX + colDetalleW + colPrecioW + colCantidadW + 8, y: headY, size: 10, font: fontBold, color: rgb(1, 1, 1) })

  cursorY -= headH
  cursorY -= 6

  // helper wrap
  const wrapText = (text: string, fontRef: PDFFont, size: number, maxWidth: number) => {
    const words = text.split(" ")
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
      const test = cur ? cur + " " + w : w
      if (fontRef.widthOfTextAtSize(test, size) > maxWidth) {
        if (cur) {
          lines.push(cur)
          cur = w
        } else {
          lines.push(test)
          cur = ""
        }
      } else {
        cur = test
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  // rows
  const rowPad = 8
  let itemIndex = 0
  for (const it of items) {
    // page break
    if (cursorY < margin + 120) {
      const newPage = pdfDoc.addPage([595, 842])
      // copy basics (not necessary to re-add logo for simplicity)
      // Note: For full fidelity you'd replicate header per page. Keep simple here.
      cursorY = height - margin - 20
      // draw table header on new page
      newPage.drawRectangle({ x: tableX, y: cursorY - headH + 6, width: tableW, height: headH, color: accent })
      cursorY -= headH + 6
    }

    const med = Array.isArray(it.medicamentos) ? it.medicamentos[0] ?? null : it.medicamentos
    const labelRaw = med ? `${med.codigo ?? ""} - ${med.nombre ?? ""}` : `#${it.medicamento_id}`
    const lines = wrapText(labelRaw, font, 10, colDetalleW - rowPad * 2)

    const rowH = Math.max(18, lines.length * 12 + 8)

    // alternating background
    const bg = itemIndex % 2 === 0 ? rgb(1, 1, 1) : accentLight
    page.drawRectangle({ x: tableX, y: cursorY - rowH + 6, width: tableW, height: rowH, color: bg })

    // draw text lines
    let ly = cursorY - 10
    for (const l of lines) {
      page.drawText(l, { x: tableX + rowPad, y: ly, size: 10, font, color: dark })
      ly -= 12
    }

    // numbers (right aligned)
    const precioStr = Number(it.precio_por_unidad ?? 0).toFixed(2)
    const cantidadStr = String(it.cantidad)
    const subtotalStr = Number(it.subtotal ?? 0).toFixed(2)

    const precioW = font.widthOfTextAtSize(precioStr, 10)
    page.drawText(precioStr, { x: tableX + colDetalleW + colPrecioW - precioW - rowPad, y: cursorY - 8, size: 10, font, color: dark })

    const cantidadW = font.widthOfTextAtSize(cantidadStr, 10)
    page.drawText(cantidadStr, { x: tableX + colDetalleW + colPrecioW + colCantidadW - cantidadW - rowPad, y: cursorY - 8, size: 10, font, color: dark })

    const subtotalW = font.widthOfTextAtSize(subtotalStr, 10)
    page.drawText(subtotalStr, { x: tableX + tableW - subtotalW - rowPad, y: cursorY - 8, size: 10, font, color: dark })

    // vertical separators
    const sepColor = rgb(0.85, 0.85, 0.85)
    page.drawLine({ start: { x: tableX + colDetalleW, y: cursorY + 6 }, end: { x: tableX + colDetalleW, y: cursorY - rowH + 6 }, thickness: 0.6, color: sepColor })
    page.drawLine({ start: { x: tableX + colDetalleW + colPrecioW, y: cursorY + 6 }, end: { x: tableX + colDetalleW + colPrecioW, y: cursorY - rowH + 6 }, thickness: 0.6, color: sepColor })
    page.drawLine({ start: { x: tableX + colDetalleW + colPrecioW + colCantidadW, y: cursorY + 6 }, end: { x: tableX + colDetalleW + colPrecioW + colCantidadW, y: cursorY - rowH + 6 }, thickness: 0.6, color: sepColor })

    cursorY -= rowH + 6
    itemIndex += 1
  }

  // table footer line
  page.drawLine({ start: { x: tableX, y: cursorY + 6 }, end: { x: tableX + tableW, y: cursorY + 6 }, thickness: 0.8, color: rgb(0.7, 0.7, 0.7) })
  cursorY -= 6

  // TOTAL box on right
  const totalLabel = "TOTAL"
  const totalValue = `Bs. ${Number(venta.monto_total ?? 0).toFixed(2)}`
  const totalLabelSize = 12
  const totalValueSize = 16
  const totalW = fontBold.widthOfTextAtSize(totalValue, totalValueSize)
  page.drawText(totalLabel, { x: tableX + tableW - totalW - 8 - 60, y: cursorY - 2, size: totalLabelSize, font: fontBold, color: muted })
  page.drawText(totalValue, { x: tableX + tableW - totalW - 8, y: cursorY - 6, size: totalValueSize, font: fontBold, color: dark })

  cursorY -= 40

  // FOOTER: company/block
  const footerY = margin + 30
  page.drawLine({ start: { x: margin, y: footerY + 30 }, end: { x: width - margin, y: footerY + 30 }, thickness: 0.5, color: accentLight })

  const footerLeftX = margin
  page.drawText("FARMACIA VIDA SANA", { x: footerLeftX, y: footerY + 10, size: 10, font: fontBold, color: accent })
  page.drawText("Av. Principal 123 - Oruro", { x: footerLeftX, y: footerY - 2, size: 9, font, color: muted })
  page.drawText("Tel: (000) 000-000 | Email: contacto@farmaciavidasana.bo", { x: footerLeftX, y: footerY - 14, size: 9, font, color: muted })

  // "Gracias" small
  page.drawText("Gracias por su preferencia.", { x: width - margin - font.widthOfTextAtSize("Gracias por su preferencia.", 10), y: footerY - 2, size: 10, font, color: muted })

  const bytes = await pdfDoc.save()
  return bytes
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ventaId = Number(body?.ventaId)
    const tipo = String(body?.tipo ?? "FACTURA")
    const serie = String(body?.serie ?? "F001")
    const numero = String(body?.numero ?? ventaId.toString().padStart(6, "0"))
    const generarFirmado = body?.generarFirmado !== false

    if (!ventaId || Number.isNaN(ventaId)) {
      return NextResponse.json({ ok: false, error: "ventaId inválido" }, { status: 400 })
    }

    // Buscar comprobante existente
    const { data: existing } = await supabase
      .from("comprobantes")
      .select("id, venta_id, storage_path")
      .eq("venta_id", ventaId)
      .maybeSingle()

    if (existing && existing.storage_path) {
      if (generarFirmado) {
        const { data: urlData, error: urlErr } = await supabase.storage
          .from("comprobantes")
          .createSignedUrl(existing.storage_path, 60 * 60)

        if (urlErr) {
          console.warn("Error creando signedUrl existente:", urlErr)
          return NextResponse.json({ ok: true, storagePath: existing.storage_path, comprobanteId: existing.id })
        }

        return NextResponse.json({
          ok: true,
          signedUrl: urlData?.signedUrl ?? null,
          storagePath: existing.storage_path,
          comprobanteId: existing.id,
        })
      }

      return NextResponse.json({
        ok: true,
        storagePath: existing.storage_path,
        comprobanteId: existing.id,
      })
    }

    // Obtener venta e items
    const ventaResp = await supabase
      .from("ventas")
      .select("id, cliente_id, fecha_venta, monto_total, estado, clientes:cliente_id (id, nombre, apellido, ci)")
      .eq("id", ventaId)
      .maybeSingle()
    if (ventaResp.error) throw ventaResp.error
    if (!ventaResp.data) return NextResponse.json({ ok: false, error: "Venta no encontrada" }, { status: 404 })

    const itemsResp = await supabase
      .from("items_venta")
      .select("id, venta_id, medicamento_id, cantidad, precio_por_unidad, subtotal, medicamentos:medicamento_id (codigo, nombre)")
      .eq("venta_id", ventaId)
    if (itemsResp.error) throw itemsResp.error

    const venta = ventaResp.data as VentaRow
    const items = (itemsResp.data ?? []) as ItemRow[]

    // Crear PDF bytes
    const logo = await tryReadLogo()
    const pdfBytes = await generatePdfBytes(venta, items, logo)

    // Subir a Storage
    const bucket = "comprobantes"
    const now = new Date()
    const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
    const fileName = `comprobante-V-${String(ventaId).padStart(6, "0")}.pdf`
    const storagePath = `${folder}/${fileName}`

    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, pdfBytes as Uint8Array, { contentType: "application/pdf", upsert: true })
    if (uploadErr) throw uploadErr

    // Insertar comprobante
    const payload: ComprobanteInsert = {
      venta_id: ventaId,
      tipo,
      serie,
      numero,
      fecha_emision: new Date().toISOString(),
      datos_json: { venta, items },
      storage_path: storagePath,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("comprobantes")
      .insert(payload)
      .select("id")
      .maybeSingle()

    if (insertErr) throw insertErr

    // Firmar URL si se requiere
    let signedUrl: string | null = null
    if (generarFirmado) {
      const { data: urlData, error: urlErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60)
      if (urlErr) console.warn("Error creando signedUrl:", urlErr)
      signedUrl = urlData?.signedUrl ?? null
    }

    return NextResponse.json({
      ok: true,
      comprobanteId: inserted?.id ?? null,
      storagePath,
      signedUrl,
    })
  } catch (err: unknown) {
    console.error("Error /api/comprobantes:", err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}