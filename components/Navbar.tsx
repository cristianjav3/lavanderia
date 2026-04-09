"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Operación diaria — todos los usuarios
const mainLinks = [
  { href: "/cajon",        label: "Cajón" },
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/pedidos",     label: "Pedidos" },
  { href: "/pedidos/nuevo", label: "+ Nuevo" },
  { href: "/chofer",      label: "Chofer" },
  { href: "/deposito",    label: "Depósito" },
];

// Solo admin — aparecen después del separador
const adminLinks = [
  { href: "/clientes",              label: "Clientes" },
  { href: "/admin/analytics",       label: "Analítica" },
  { href: "/admin/configuracion",   label: "Configuración" },
];

// ─── Selector de empresa ─────────────────────────────────────────────────────

type EmpresaItem = {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  logoUrl: string | null;
  colorPrincipal: string | null;
  hasKey: boolean;
};

function displayName(e: EmpresaItem) {
  return e.nombreComercial || e.nombre;
}

function EmpresaSelector({ empresas, activaId }: { empresas: EmpresaItem[]; activaId: string }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [keyModal, setKeyModal] = useState<{ id: string } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const activa = empresas.find((e) => e.id === activaId) ?? empresas[0];
  const color = activa?.colorPrincipal || "#2563eb";

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function seleccionar(id: string, accessKey?: string) {
    if (id === activaId || switching) return;
    setSwitching(true);
    const res = await fetch("/api/admin/empresa-activa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: id, accessKey }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const d = await res.json();
      setKeyError(d.error || "Error");
      setSwitching(false);
    }
  }

  function iniciarSeleccion(e: EmpresaItem) {
    if (e.id === activaId || switching) return;
    setOpen(false);
    if (e.hasKey) {
      setKeyInput("");
      setKeyError("");
      setKeyModal({ id: e.id });
    } else {
      seleccionar(e.id);
    }
  }

  async function confirmarConClave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!keyModal) return;
    setKeyError("");
    await seleccionar(keyModal.id, keyInput);
    if (!switching) setKeyModal(null);
  }

  if (!activa) return null;

  function LogoOrInitial({ e, small }: { e: EmpresaItem; small?: boolean }) {
    const sz = small ? "h-4 w-4" : "h-5 w-5";
    const eColor = e.colorPrincipal || "#6b7280";
    return e.logoUrl ? (
      <img src={e.logoUrl} alt="" className={`${sz} object-contain rounded-sm`} />
    ) : (
      <div
        className={`${sz} rounded-sm flex items-center justify-center text-white font-bold`}
        style={{ backgroundColor: eColor, fontSize: small ? "9px" : "10px" }}
      >
        {displayName(e).charAt(0).toUpperCase()}
      </div>
    );
  }

  // Una sola empresa — solo muestra el badge sin dropdown
  if (empresas.length === 1) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium text-gray-700"
        style={{ borderColor: color + "50", backgroundColor: color + "10" }}
      >
        <LogoOrInitial e={activa} small />
        <span className="max-w-[120px] truncate">{displayName(activa)}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        style={{ borderColor: open ? color : color + "50", backgroundColor: open ? color + "10" : "transparent" }}
      >
        <LogoOrInitial e={activa} small />
        <span className="max-w-[120px] truncate">{displayName(activa)}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Empresa activa</p>
          </div>
          {empresas.map((e) => {
            const isActive = e.id === activaId;
            const eColor = e.colorPrincipal || "#2563eb";
            return (
              <button
                key={e.id}
                onClick={() => iniciarSeleccion(e)}
                disabled={switching}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-gray-700 hover:bg-gray-50"
                style={isActive ? { backgroundColor: eColor + "12", color: eColor } : {}}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 shrink-0">
                  <LogoOrInitial e={e} />
                </div>
                <span className="text-sm font-medium truncate flex-1">{displayName(e)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {e.hasKey && !isActive && (
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {isActive && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: eColor }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de clave de acceso */}
      {keyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
            <div className="p-5 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Clave requerida</p>
              <p className="text-xs text-gray-400 mt-1">
                {displayName(empresas.find((e) => e.id === keyModal.id)!)} requiere una clave de acceso.
              </p>
            </div>
            <form onSubmit={confirmarConClave} className="p-5 space-y-3">
              <input
                type="password"
                value={keyInput}
                onChange={(ev) => setKeyInput(ev.target.value)}
                autoFocus
                placeholder="Clave de acceso"
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm"
              />
              {keyError && <p className="text-red-600 text-xs">{keyError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setKeyModal(null); setSwitching(false); }}
                  className="flex-1 border border-gray-300 py-2.5 rounded text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={switching || !keyInput}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {switching ? "..." : "Ingresar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Navbar principal ─────────────────────────────────────────────────────────

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [empresaActiva, setEmpresaActiva] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/empresas")
      .then((r) => r.json())
      .then((data: { empresas: EmpresaItem[]; activa: string | null }) => {
        setEmpresas(data.empresas ?? []);
        setEmpresaActiva(data.activa ?? data.empresas?.[0]?.id ?? "");
      });
  }, [isAdmin]);

  // Cerrar menú al navegar
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/pedidos") return pathname === "/pedidos";
    return pathname.startsWith(href);
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      {/* Barra principal */}
      <div className="px-4 py-2 flex items-center justify-between gap-4">
        {/* Izquierda: logo + links desktop */}
        <div className="flex items-center gap-0.5 min-w-0">
          <span className="font-bold text-blue-700 mr-3 text-base shrink-0">🧺</span>

          {/* Links — solo en desktop */}
          <div className="hidden md:flex items-center gap-0.5 flex-wrap">
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive(l.href)
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <span className="text-gray-200 mx-1 shrink-0">|</span>
                {adminLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive(l.href)
                        ? "bg-orange-100 text-orange-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Derecha */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Selector empresa — visible siempre si es admin */}
          {isAdmin && empresas.length > 0 && (
            <EmpresaSelector empresas={empresas} activaId={empresaActiva} />
          )}

          {/* Usuario + salir — solo desktop */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-gray-500 whitespace-nowrap">
              {session?.user?.name}{" "}
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                {(session?.user as { role?: string })?.role}
              </span>
            </span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-600 hover:underline text-sm">
              Salir
            </button>
          </div>

          {/* Hamburger — solo mobile */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menú"
          >
            {menuOpen ? (
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menú mobile desplegable */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-3 py-3 space-y-1">
          {mainLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="border-t border-gray-100 my-2" />
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(l.href)
                      ? "bg-orange-100 text-orange-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </>
          )}

          <div className="border-t border-gray-100 pt-2 mt-2 flex items-center justify-between px-3">
            <span className="text-sm text-gray-500">
              {session?.user?.name}{" "}
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs ml-1">
                {(session?.user as { role?: string })?.role}
              </span>
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-50"
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
