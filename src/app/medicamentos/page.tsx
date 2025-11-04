import Sidebar from "@/component/sidebar";
import Header from "@/component/header";
import { Plus,Search } from "lucide-react";
import { Button } from "@/component/ui/button";
import { Card, CardContent, CardHeader } from "@/component/ui/card";
import { Input } from "@/component/ui/input";

export default function MedicamentosPage() {
  return (
    <Sidebar>
      <Header />
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Medicamentos</h1>
            <p className="text-muted-foreground mt-1">Gestión de inventario de medicamentos</p>
          </div>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4" />
            Nuevo Medicamento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Código</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Nombre</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Vencimiento</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Stock</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Precio Venta</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Estado</th>
                      <th className="text-left p-4 font-semibold text-sm text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Aquí irán las filas de medicamentos */}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}