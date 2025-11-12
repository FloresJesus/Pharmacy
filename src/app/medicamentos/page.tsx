"use client"
import { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "@/component/sidebar";
import Header from "@/component/header";
import { Plus, Search, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/component/ui/button";
import { Card, CardContent, CardHeader } from "@/component/ui/card";
import { Input } from "@/component/ui/input";
import { MedicamentoDialog } from "@/component/medicamento/medicamentoDialog";
// supabase
import { supabase } from "@/lib/supabase";

interface MedicamentoDB {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  fecha_vencimiento: string | null
  stock: number
  precio_compra: number
  precio_venta: number
  estado: string
}

interface Medicamento {
  id: number
  codigo: string
  nombre: string
  descripcion: string
  fechaVencimiento: string
  cantidad: number
  precioCompra: number
  precioVenta: number
  estado: "disponible" | "no-disponible"
}

export default function MedicamentosPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMed, setEditingMed] = useState<Medicamento | null>(null)

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null)
  const [loadingList, setLoadingList] = useState(false)

  const fetchMedicamentos = useCallback(async () => {
    setLoadingList(true)
    try {
      // obtener datos desde supabase de la tabla medicamentos
      const { data, error } = await supabase
        .from("medicamentos")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error al cargar medicamentos:", error)
        return
      }
      if (!data) {
        setMedicamentos([])
        return
      }

      const mapped: Medicamento[] = (data as MedicamentoDB[]).map((d) => ({
        id: d.id,
        codigo: d.codigo,
        nombre: d.nombre,
        descripcion: d.descripcion ?? "",
        fechaVencimiento: d.fecha_vencimiento ?? "",
        cantidad: Number(d.stock ?? 0),
        precioCompra: Number(d.precio_compra ?? 0),
        precioVenta: Number(d.precio_venta ?? 0),
        estado: (d.estado ?? "").toLowerCase() === "disponible" ? "disponible" : "no-disponible"
      }))
      setMedicamentos(mapped)
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  // carga inicial
  useEffect(() => {
    fetchMedicamentos()
  }, [fetchMedicamentos])

  // cuando se cierra el dialog 
  useEffect(() => {
    if (!dialogOpen) {
      fetchMedicamentos()
    }
  }, [dialogOpen, fetchMedicamentos])

  const handleEdit = (med: Medicamento) => {
    setEditingMed(med)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingMed(null)
    setDialogOpen(true)
  }

  const handleDelete = async (med: Medicamento) => {
    const confirmed = confirm(`¿Eliminar "${med.nombre}" (código ${med.codigo})? Esta acción no se puede deshacer.`)
    if (!confirmed) return

    setLoadingDeleteId(med.id)
    try {
      const resp = await supabase
        .from("medicamentos")
        .delete()
        .eq("id", med.id)
        .select()
        .maybeSingle()

      if (resp.error) {
        throw new Error(resp.error.message ?? JSON.stringify(resp.error))
      }

      // actualizar estado local sin volver a fetch completo (más rápido)
      setMedicamentos(prev => prev.filter(m => m.id !== med.id))
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Delete error:", err.message, err)
        alert(err.message)
      } else {
        console.error("Delete error unknown:", err)
        alert(`Ocurrió un error al eliminar (ver consola).`)
      }
    } finally {
      setLoadingDeleteId(null)
    }
  }

  const filteredMedicamentos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return medicamentos
    return medicamentos.filter((m) =>
      m.nombre.toLowerCase().includes(q) ||
      m.codigo.toLowerCase().includes(q)
    )
  }, [medicamentos, searchTerm])

  // helper para formatear precio en Bs.
  const formatBs = (value: number) => {
    // Ejemplo: "Bs. 123.45"
    return `Bs. ${value.toFixed(2)}`
  }

  return (
    <Sidebar>
      <Header />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Medicamentos</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestión de inventario de medicamentos</p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-4 sm:py-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Medicamento</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  className="pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full sm:min-w-[640px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground">Código</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground">Nombre</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">Vencimiento</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground">Stock</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">Precio Venta</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground">Estado</th>
                      <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-sm text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedicamentos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-sm text-muted-foreground">
                          {loadingList ? "Cargando..." : (medicamentos.length === 0 ? "No hay medicamentos. Agrega uno nuevo." : "No se encontraron resultados.")}
                        </td>
                      </tr>
                    ) : (
                      filteredMedicamentos.map((med) => (
                        <tr key={med.id} className="border-t border-border/50 hover:bg-muted/50">
                          <td className="p-2 sm:p-4 text-xs sm:text-sm whitespace-nowrap">{med.codigo}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.nombre}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">{med.fechaVencimiento}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.cantidad}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">{formatBs(Number(med.precioVenta))}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              med.estado === "disponible"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {med.estado === "disponible" ? "Disponible" : "No disponible"}
                            </span>
                          </td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(med)}
                                className="hover:bg-muted px-2 py-1 inline-flex items-center gap-2"
                                title={`Editar ${med.nombre}`}
                                aria-label={`Editar ${med.nombre}`}
                              >
                                <Edit3 className="h-4 w-4" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(med)}
                                className="hover:bg-muted px-2 py-1 inline-flex items-center gap-2 text-red-600"
                                title={`Eliminar ${med.nombre}`}
                                aria-label={`Eliminar ${med.nombre}`}
                                disabled={loadingDeleteId === med.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">{loadingDeleteId === med.id ? "Eliminando..." : "Eliminar"}</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MedicamentoDialog
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        medicamento={editingMed}
      />
    </Sidebar>
  );
}
