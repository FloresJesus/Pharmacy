import Sidebar from "@/component/sidebar";
import Header from "@/component/header";

export default function userPage() {
  return (
    <Sidebar>
      <Header/>
        <div className="space-y-6 p-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Usuarios</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestión de usuarios</p>
          </div>
          <h1>Esta en desarrollo...</h1>
        </div>
    </Sidebar>
  )
}