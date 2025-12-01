"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Sidebar from "@/component/sidebar"
import Header from "@/component/header"
import { Plus, Search, Edit3, Trash2 } from "lucide-react"
import { Button } from "@/component/ui/button"
import { Card, CardContent, CardHeader } from "@/component/ui/card"
import { Input } from "@/component/ui/input"
import { UsuarioDialog, Usuario } from "@/component/usuarios/usuarioDialog"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface UsuarioDB {
  id: number
  nombre_usuario: string
  nombre_completo: string
  password_hash?: string | null
  rol?: string | null
  activo?: boolean | null
  email?: string | null
  created_by?: string | null
}

export default function UsuariosHome() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null)

  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [perfilActual, setPerfilActual] = useState<UsuarioDB | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) {
        router.replace("/login")
      } else {
        setChecking(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login")
      } else {
        setChecking(false)
      }
    })

    return () => {
      mounted = false
      try {
        listener.subscription.unsubscribe()
      } catch {}
    }
  }, [router])

  // cargar perfil actual (por created_by = uid o por email)
  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user) return
      const uid = session.user.id
      try {
        const { data: pByUid } = await supabase.from("usuarios").select("*").eq("created_by", uid).limit(1).maybeSingle()
        if (pByUid) {
          setPerfilActual(pByUid as UsuarioDB)
          return
        }
        const { data: pByEmail } = await supabase.from("usuarios").select("*").eq("email", session.user.email).limit(1).maybeSingle()
        if (pByEmail) setPerfilActual(pByEmail as UsuarioDB)
      } catch (err) {
        console.error("Error loading profile:", err)
      }
    }
    loadProfile()
    return () => { mounted = false }
  }, [])

  const isAdmin = perfilActual?.rol === "admin" || perfilActual?.rol === "administrador"

  const fetchUsuarios = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error cargar usuarios:", error)
        setUsuarios([])
        return
      }
      if (!data) {
        setUsuarios([])
        return
      }

      const mapped: Usuario[] = (data as UsuarioDB[]).map((u) => ({
        id: u.id,
        nombre_usuario: u.nombre_usuario,
        nombre_completo: u.nombre_completo,
        contrasena: "",
        rol: u.rol ?? "vendedor",
        activo: u.activo ?? true,
        email: u.email ?? "",
      }))
      setUsuarios(mapped)
    } catch (err) {
      console.error("Fetch usuarios:", err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchUsuarios()
  }, [fetchUsuarios])

  useEffect(() => {
    if (!dialogOpen) fetchUsuarios()
  }, [dialogOpen, fetchUsuarios])

  const handleEdit = (u: Usuario) => {
    if (!isAdmin && perfilActual && u.email !== perfilActual.email) {
      alert("No tienes permisos para editar otros usuarios.")
      return
    }
    setEditing(u)
    setDialogOpen(true)
  }
  const handleAdd = () => {
    if (!isAdmin) {
      alert("Solo administradores pueden crear usuarios.")
      return
    }
    setEditing(null)
    setDialogOpen(true)
  }

  const handleDelete = async (u: Usuario) => {
    if (!isAdmin) {
      alert("Solo administradores pueden eliminar usuarios.")
      return
    }
    if (!confirm(`Eliminar usuario ${u.nombre_usuario}?`)) return
    if (!u.id) return
    setLoadingDeleteId(u.id)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token ?? null
      const resp = await fetch(`/api/usuarios?id=${u.id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error ?? "Error eliminando usuario")
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id))
      alert("Usuario eliminado.")
    } catch (error) {
      console.error("Delete usuario:", error)
      alert(String(error) ?? "Error eliminando usuario.")
    } finally {
      setLoadingDeleteId(null)
    }
  }

  const toggleActivo = async (u: Usuario) => {
    if (!isAdmin) {
      alert("Solo administradores pueden cambiar estado.")
      return
    }
    if (!u.id) return
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token ?? null
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: u.id,
          activo: !u.activo,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Error cambiando estado")
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)))
    } catch (err) {
      console.error("Toggle activo:", err)
      alert("Error cambiando estado (ver consola).")
    }
  }

  const filteredUsuarios = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (u) =>
        (u.nombre_usuario ?? "").toLowerCase().includes(q) ||
        (u.nombre_completo ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    )
  }, [usuarios, searchTerm])

  if (checking) return <div className="p-6">Comprobando sesión...</div>

  return (
    <Sidebar>
      <Header />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Usuarios</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Administración de usuarios</p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Button onClick={handleAdd} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-4 sm:py-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Usuario</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por usuario, nombre o email..." className="pl-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full sm:min-w-[640px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">#</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Usuario</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Rol</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Activo</th>
                      <th className="p-2 sm:p-4 text-left text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsuarios.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-sm text-muted-foreground">
                          {loadingList ? "Cargando..." : usuarios.length === 0 ? "No hay usuarios. Agrega uno nuevo." : "No se encontraron resultados."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsuarios.map((u) => (
                        <tr key={u.id} className="border-t border-border/50 hover:bg-muted/50">
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{u.id}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{u.nombre_usuario}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{u.nombre_completo}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{u.email}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">{u.rol}</td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">
                            <button onClick={() => toggleActivo(u)} className={`px-2 py-1 text-sm rounded ${u.activo ? "bg-green-100" : "bg-red-100"}`}>
                              {u.activo ? "Sí" : "No"}
                            </button>
                          </td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm">
                            <div className="flex items-center gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="hover:bg-muted px-2 py-1 inline-flex items-center gap-2" title={`Editar ${u.nombre_usuario}`} aria-label={`Editar ${u.nombre_usuario}`}>
                                <Edit3 className="h-4 w-4" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>

                              <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="hover:bg-muted px-2 py-1 inline-flex items-center gap-2 text-red-600" title={`Eliminar ${u.nombre_usuario}`} aria-label={`Eliminar ${u.nombre_usuario}`} disabled={!isAdmin || loadingDeleteId === u.id}>
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">{loadingDeleteId === u.id ? "Eliminando..." : "Eliminar"}</span>
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

      <UsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} usuario={editing} onSaved={() => { setDialogOpen(false); setEditing(null); fetchUsuarios(); }} />
    </Sidebar>
  )
}
