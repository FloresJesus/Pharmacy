"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

import { Button } from "@/component/ui/button"
import { Input } from "@/component/ui/input"
import { Label } from "@/component/ui/label"
import { Card, CardContent, CardHeader } from "@/component/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si ya hay session client-side, redirigir
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        router.replace('/dashboard')
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace('/dashboard')
      }
    })

    return () => {
      mounted = false
      try { listener.subscription.unsubscribe() } catch {}
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username || !password) {
      setError('Ingrese usuario (email) y contraseña')
      return
    }

    setLoading(true)
    try {
      // Se asume username = email. Si no, debes mapear username -> email en la DB.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // A veces la sesión tarda un tick en ser persistida; comprobamos explícitamente.
      if (data?.session) {
        router.replace('/dashboard')
      } else {
        // pedir sesión explícitamente
        const { data: sessData } = await supabase.auth.getSession()
        if (sessData?.session) {
          router.replace('/dashboard')
        } else {
          setError('No se pudo iniciar sesión. Intenta de nuevo.')
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
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
                type="email"
                placeholder="Ingrese su usuario (email)"
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
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
