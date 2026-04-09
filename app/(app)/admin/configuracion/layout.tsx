"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/configuracion/empresa",   label: "Empresa",    icon: "🏢" },
  { href: "/admin/configuracion/chofer",    label: "Chofer",     icon: "🚗" },
  { href: "/admin/configuracion/sucursales",label: "Sucursales", icon: "📍" },
  { href: "/admin/configuracion/personal",  label: "Personal",   icon: "👥" },
  { href: "/admin/configuracion/productos", label: "Productos",  icon: "📦" },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar */}
      <aside className="w-44 shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Configuración</p>
        <nav className="space-y-0.5">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
