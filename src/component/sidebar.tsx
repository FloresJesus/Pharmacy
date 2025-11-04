"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CircleUser,
  ShoppingCart,
  FileText,
  Package,
  Menu,
  X,
  LogOut
} from "lucide-react";
import Image from 'next/image';

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Medicamentos', href: '/medicamentos', icon: Package },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Ventas', href: '/ventas', icon: ShoppingCart },
    { name: 'Reportes', href: '/reportes', icon: FileText },
    { name: 'Usuarios', href: '/usuarios', icon: CircleUser },
  ]

  return (
    <div className="relative min-h-screen">
      <button
        className="fixed top-4 left-4 z-50 block md:hidden p-2 bg-white rounded-lg shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <div className="flex">
        <aside
          className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 
            border-r bg-blue-400 transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center p-6 border-b border-gray-200">
              <Link href="/">
                <Image src="/images/logo.png" alt="Logo" width={150} height={50} priority />
              </Link>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href} 
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                        ${isActive 
                          ? "bg-blue-500 text-white font-medium" 
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg"
                onClick={() => {
                  // Handle logout logic here
                }}
              >
                <LogOut className="h-5 w-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-8 md:p-12">
          {children}
        </main>
      </div>
    </div>
  );
}