"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { Card, CardContent, CardHeader } from "@/component/ui/card"

type Perfil = {
  id?: number
  nombre_usuario?: string
  nombre_completo?: string
  email?: string | null
  rol?: string | null
  activo?: boolean | null
  created_by?: string | null
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("") // puede ser email o nombre_usuario
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si ya hay session client-side, redirigir
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        router.replace("/dashboard")
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/dashboard")
      }
    })

    return () => {
      mounted = false
      try {
        listener.subscription.unsubscribe()
      } catch {}
    }
  }, [router])

  // Resuelve nombre_usuario -> email (si el input no es email)
  const resolveEmailFromUsername = async (userOrEmail: string): Promise<{ email?: string | null; perfil?: Perfil; error?: string }> => {
    if (!userOrEmail) return { error: "Usuario vacío" }

    // si parece un email, devolvemos directamente
    if (userOrEmail.includes("@")) {
      return { email: userOrEmail }
    }

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("email, rol, activo, created_by, id, nombre_usuario, nombre_completo")
        .eq("nombre_usuario", userOrEmail)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("Error buscando usuario por nombre_usuario:", error)
        return { error: "No se pudo buscar el usuario. (Err DB)" }
      }

      if (!data) {
        return { error: "Usuario no encontrado." }
      }

      if (data.activo === false) {
        return { error: "Cuenta desactivada. Contacta al administrador." }
      }

      return { email: data.email ?? undefined, perfil: data }
    } catch (ex) {
      console.error("Excepción lookup username:", ex)
      return { error: "Error interno al buscar usuario." }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username || !password) {
      setError("Ingrese usuario (email) y contraseña")
      return
    }

    setLoading(true)

    try {
      // 1) resolver email si el usuario no ingresó email
      const resolver = await resolveEmailFromUsername(username.trim())
      if (resolver.error) {
        setError(resolver.error)
        setLoading(false)
        return
      }

      const emailToUse = resolver.email ?? username.trim()

      // 2) intentar iniciar sesión con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })

      if (error) {
        console.error("Supabase signIn error:", error)
        setError(error.message ?? "Error iniciando sesión")
        setLoading(false)
        return
      }

      // 3) obtener / confirmar perfil
      let perfil: Perfil | undefined = resolver.perfil

      if (!perfil) {
        // esperar a que la sesión exista y obtener uid
        const { data: sessData } = await supabase.auth.getSession()
        const uid = sessData?.session?.user?.id ?? null

        // buscar por created_by = uid (si guardas así)
        if (uid) {
          try {
            const { data: pByUid, error: eUid } = await supabase
              .from("usuarios")
              .select("id, nombre_usuario, nombre_completo, email, rol, activo, created_by")
              .eq("created_by", uid)
              .limit(1)
              .maybeSingle()

            if (eUid) console.warn("Error lookup by uid:", eUid)
            if (pByUid) perfil = pByUid
          } catch (ex) {
            console.warn("Exception lookup by uid:", ex)
          }
        }

        // si aún no hay perfil, buscar por email
        if (!perfil) {
          try {
            const { data: pByEmail, error: eEmail } = await supabase
              .from("usuarios")
              .select("id, nombre_usuario, nombre_completo, email, rol, activo, created_by")
              .eq("email", emailToUse)
              .limit(1)
              .maybeSingle()

            if (eEmail) console.warn("Error lookup by email:", eEmail)
            if (pByEmail) perfil = pByEmail
          } catch (ex) {
            console.warn("Exception lookup by email:", ex)
          }
        }
      }

      // 4) Si perfil existe y está inactivo => cerrar y avisar
      if (perfil?.activo === false) {
        try {
          await supabase.auth.signOut()
        } catch {}
        setError("Cuenta desactivada. Contacta al administrador.")
        setLoading(false)
        return
      }

      // 5) redirigir según rol (fallback a dashboard)
      const rol = (perfil?.rol ?? "vendedor").toLowerCase()
      if (rol === "admin" || rol === "administrador") {
        router.replace("/dashboard")
      } else if (rol === "farmaceutico" || rol === "farmacéutico") {
        router.replace("/medicamentos")
      } else if (rol === "vendedor") {
        router.replace("/ventas")
      } else {
        router.replace("/dashboard")
      }
    } catch (err: unknown) {
      console.error("Login unexpected error:", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-50 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
            <Image src="/images/logo.png" alt="Logo" width={250} height={50} priority />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Usuario o email
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario (nombre de usuario) o email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium mt-6 bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
