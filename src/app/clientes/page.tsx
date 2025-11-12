"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Plus, Search, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/component/ui/button"
import { Card, CardContent, CardHeader } from "@/component/ui/card"
import { Input } from "@/component/ui/input"
import { ClienteDialog, Cliente } from "@/component/cliente/clienteDialog"
import { supabase } from "@/lib/supabase"

interface ClienteDB {
  id: number
  ci: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  direccion: string | null
  fecha_registro: string
}

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null)

  const fetchClientes = useCallback(async () => {
    setLoadingList(true)
    try {
      // obtener clientes desde supabase
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("id", { ascending: true })
      if (error) {
        console.error("Error cargar clientes:", error)
        return
      }
      if (!data) {
        setClientes([])
        return
      }
      const mapped: Cliente[] = (data as ClienteDB[]).map(c => ({
        id: c.id,
        ci: c.ci,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion ?? "",
      }))
      setClientes(mapped)
    } catch (err) {
      console.error("Fetch clientes:", err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  useEffect(() => {
    if (!dialogOpen) fetchClientes()
  }, [dialogOpen, fetchClientes])

  const handleEdit = (c: Cliente) => { setEditing(c); setDialogOpen(true) }
  const handleAdd = () => { setEditing(null); setDialogOpen(true) }

  const handleDelete = async (c: Cliente) => {
    if (!confirm(`Eliminar cliente ${c.nombre} ${c.apellido}?`)) return
    if (!c.id) return
    setLoadingDeleteId(c.id)
    try {
      // eliminar cliente en supabase
      const resp = await supabase
        .from("clientes")
        .delete()
        .eq("id", c.id)
        .select()
        .maybeSingle()
      if (resp.error) throw new Error(resp.error.message ?? JSON.stringify(resp.error))
      setClientes(prev => prev.filter(x => x.id !== c.id))
    } catch (err) {
      if (err instanceof Error) {
        console.error("Delete cliente:", err.message)
        alert(err.message)
      } else {
        console.error("Delete cliente unknown:", err)
        alert("Ocurrió un error al eliminar.")
      }
    } finally {
      setLoadingDeleteId(null)
    }
  }

  const filteredClientes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(c => c.nombre.toLowerCase().includes(q) || c.ci.toLowerCase().includes(q) || c.apellido.toLowerCase().includes(q))
  }, [clientes, searchTerm])

  return (
    <Sidebar>
      <Header />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Registro de clientes</p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-4 sm:py-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
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
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">C.I.</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Apellido</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Teléfono</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Dirección</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-sm text-muted-foreground">
                          {loadingList ? "Cargando..." : (clientes.length === 0 ? "No hay clientes. Agrega uno nuevo." : "No se encontraron resultados.")}
                        </td>
                      </tr>
                    ) : (
                      filteredClientes.map((med) => (
                        <tr key={med.id} className="border-t border-border/50 hover:bg-muted/50">
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.ci}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.nombre}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.apellido}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.telefono}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.email}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{med.direccion}</td>
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
      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editing}
      />
    </Sidebar>
  )
}