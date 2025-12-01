// src/component/hooks/useCurrentUser.ts
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type CurrentUser = {
  authUid: string | null
  usuarioId: number | null
  nombre_usuario?: string | null
  nombre_completo?: string | null
  rol?: string | null
}

export function useCurrentUser() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<CurrentUser>({
    authUid: null,
    usuarioId: null
  })

  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const authUid = session?.user?.id ?? null
        if (!authUid) {
          if (mounted) {
            setUser({ authUid: null, usuarioId: null })
            setLoading(false)
          }
          return
        }

        // intenta leer perfil interno por auth_uid (o created_by fallback)
        const { data: perfil, error } = await supabase
          .from("usuarios")
          .select("id, nombre_usuario, nombre_completo, rol, auth_uid, created_by")
          .or(`auth_uid.eq.${authUid},created_by.eq.${authUid}`)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.warn("useCurrentUser - error fetching perfil:", error)
        }

        if (mounted) {
          setUser({
            authUid,
            usuarioId: perfil?.id ?? null,
            nombre_usuario: perfil?.nombre_usuario ?? null,
            nombre_completo: perfil?.nombre_completo ?? null,
            rol: perfil?.rol ?? null
          })
        }
      } catch (err) {
        console.error("useCurrentUser error:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Cuando cambia la sesión, reinit
      if (session?.user?.id) {
        init()
      } else {
        setUser({ authUid: null, usuarioId: null })
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      try { listener.subscription.unsubscribe() } catch {}
    }
  }, [])

  return { user, loading }
}
