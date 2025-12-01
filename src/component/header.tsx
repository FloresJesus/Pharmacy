"use client";

import { useEffect, useState } from "react";
import { CircleUser, LogOut, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [nombre, setNombre] = useState<string>("Cargando...");
  const [rol, setRol] = useState<string>("---");
  const [open, setOpen] = useState(false);

  // Obtener datos del usuario logueado
  useEffect(() => {
    const loadUser = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;

      if (!uid) {
        setNombre("Invitado");
        setRol("Sin rol");
        return;
      }

      const { data } = await supabase
        .from("usuarios")
        .select("nombre_completo, rol")
        .eq("auth_uid", uid)
        .maybeSingle();

      setNombre(data?.nombre_completo || "Usuario");
      setRol(data?.rol || "Sin rol");
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm relative">
      <h1 className="text-lg font-semibold text-gray-800">Sistema Farmacéutico</h1>

      {/* User Section */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-800">{nombre}</p>
            <p className="text-xs text-gray-500">{rol}</p>
          </div>

          <CircleUser className="h-8 w-8 text-gray-700" />
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border z-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
