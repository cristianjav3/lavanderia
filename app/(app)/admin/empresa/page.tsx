"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Stats = {
  pedidos: number;
  clientes: number;
  usuarios: number;
  sucursales: number;
};

type Empresa = {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  razonSocial: string | null;
  cuit: string | null;
  telefono: string;
  direccion: string;
  logoUrl: string | null;
  colorPrincipal: string | null;
  hasKey: boolean;
  stats: Stats;
};

type EmpresaItem = { id: string; nombre: string; nombreComercial: string | null; logoUrl: string | null; colorPrincipal: string | null; hasKey: boolean };

const FORM_NUEVA_VACIO = { nombre: "", razonSocial: "", cuit: "", telefono: "", direccion: "", accessKey: "" };

// Simple color presets to avoid dynamic Tailwind classes
const COLOR_PRESETS = [
  { label: "Azul",     value: "#2563eb" },
  { label: "Verde",    value: "#16a34a" },
  { label: "Violeta",  value: "#7c3aed" },
  { label: "Naranja",  value: "#ea580c" },
  { label: "Rosa",     value: "#db2777" },
  { label: "Gris",     value: "#4b5563" },
  { label: "Negro",    value: "#111827" },
];

export default function EmpresaAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [empresaActiva, setEmpresaActiva] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  // Campos de edición
  const [nombre, setNombre] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [colorPrincipal, setColorPrincipal] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [cambiarClave, setCambiarClave] = useState(false);

  // Modal nueva empresa
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [formNueva, setFormNueva] = useState(FORM_NUEVA_VACIO);
  const [creando, setCreando] = useState(false);
  const [errorNueva, setErrorNueva] = useState("");

  // Confirmar eliminación
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");

  // Modal clave para seleccionar empresa
  const [keyModal, setKeyModal] = useState<{ id: string } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [switchingKey, setSwitchingKey] = useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { router.replace("/dashboard"); return; }
    cargar();
  }, [status, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const [resEmpresa, resLista] = await Promise.all([
      fetch("/api/admin/empresa"),
      fetch("/api/admin/empresas"),
    ]);
    const [dataEmpresa, dataLista] = await Promise.all([
      resEmpresa.json(),
      resLista.json(),
    ]);

    if (dataEmpresa) {
      setEmpresa(dataEmpresa);
      setNombre(dataEmpresa.nombre);
      setNombreComercial(dataEmpresa.nombreComercial ?? "");
      setRazonSocial(dataEmpresa.razonSocial ?? "");
      setCuit(dataEmpresa.cuit ?? "");
      setTelefono(dataEmpresa.telefono);
      setDireccion(dataEmpresa.direccion);
      setLogoUrl(dataEmpresa.logoUrl ?? "");
      setColorPrincipal(dataEmpresa.colorPrincipal ?? "");
      setAccessKey("");
      setCambiarClave(false);
    }
    setEmpresas(dataLista.empresas ?? []);
    setEmpresaActiva(dataLista.activa ?? "");
    setLoading(false);
  }

  function iniciarSeleccion(e: EmpresaItem) {
    if (e.id === empresaActiva) return;
    if (e.hasKey) {
      setKeyInput("");
      setKeyError("");
      setKeyModal({ id: e.id });
    } else {
      seleccionarEmpresa(e.id);
    }
  }

  async function seleccionarEmpresa(id: string, clave?: string) {
    const res = await fetch("/api/admin/empresa-activa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: id, accessKey: clave }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const d = await res.json();
      setKeyError(d.error || "Error");
      setSwitchingKey(false);
    }
  }

  async function confirmarConClave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!keyModal) return;
    setKeyError("");
    setSwitchingKey(true);
    await seleccionarEmpresa(keyModal.id, keyInput);
  }

  async function eliminarEmpresa() {
    if (!confirmarEliminar) return;
    setEliminando(true);
    setErrorEliminar("");
    const res = await fetch("/api/admin/empresas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmarEliminar }),
    });
    if (res.ok) {
      setConfirmarEliminar(null);
      window.location.reload();
    } else {
      const d = await res.json();
      setErrorEliminar(d.error || "Error al eliminar");
    }
    setEliminando(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa) return;
    setSaving(true);
    setError("");
    setOk(false);

    const body: Record<string, unknown> = { id: empresa.id, nombre, nombreComercial, razonSocial, cuit, telefono, direccion, logoUrl, colorPrincipal };
    if (cambiarClave) body.accessKey = accessKey; // empty string = remove key

    const res = await fetch("/api/admin/empresa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 3000);
      // Reload page to refresh Navbar with new identity
      setTimeout(() => window.location.reload(), 1000);
    } else {
      const d = await res.json();
      setError(d.error || "Error al guardar");
    }
    setSaving(false);
  }

  async function crearEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setErrorNueva("");

    const res = await fetch("/api/admin/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formNueva),
    });

    if (res.ok) {
      const nueva = await res.json();
      await fetch("/api/admin/empresa-activa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: nueva.id }),
      });
      window.location.reload();
    } else {
      const d = await res.json();
      setErrorNueva(d.error || "Error al crear");
    }
    setCreando(false);
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando...</div>;

  const colorEfectivo = colorPrincipal || "#2563eb";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Empresas</h1>
        <button
          onClick={() => { setMostrarNueva(true); setFormNueva(FORM_NUEVA_VACIO); setErrorNueva(""); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Nueva empresa
        </button>
      </div>

      {/* Lista de empresas */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {empresas.length === 0 && (
          <p className="text-gray-400 text-sm p-4">No hay empresas</p>
        )}
        {empresas.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: e.colorPrincipal || "#e5e7eb" }}
              />
              {/* Logo */}
              {e.logoUrl ? (
                <img src={e.logoUrl} alt="" className="h-6 w-6 object-contain rounded" />
              ) : null}
              <div>
                <span className="font-medium text-sm">{e.nombreComercial || e.nombre}</span>
                {e.nombreComercial && e.nombreComercial !== e.nombre && (
                  <span className="text-xs text-gray-400 ml-1.5">({e.nombre})</span>
                )}
              </div>
              {e.id === empresaActiva && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activa</span>
              )}
              {e.hasKey && (
                <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">🔒 clave</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {e.id !== empresaActiva && (
                <button
                  onClick={() => iniciarSeleccion(e)}
                  className="text-blue-600 text-xs hover:underline"
                >
                  Seleccionar
                </button>
              )}
              {e.id !== empresaActiva && (
                <button
                  onClick={() => { setConfirmarEliminar(e.id); setErrorEliminar(""); }}
                  className="text-red-500 text-xs hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empresa activa: estadísticas */}
      {empresa && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Color bar */}
          <div className="h-1.5" style={{ backgroundColor: colorEfectivo }} />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded-lg border border-gray-100 p-1" />
              ) : (
                <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ backgroundColor: colorEfectivo }}>
                  {(empresa.nombreComercial || empresa.nombre).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{empresa.nombreComercial || empresa.nombre}</p>
                {empresa.nombreComercial && (
                  <p className="text-xs text-gray-400">{empresa.nombre}</p>
                )}
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aislamiento activo</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: colorEfectivo + "18" }}>
                <p className="text-2xl font-bold" style={{ color: colorEfectivo }}>{empresa.stats.pedidos}</p>
                <p className="text-xs mt-0.5" style={{ color: colorEfectivo }}>Pedidos</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{empresa.stats.clientes}</p>
                <p className="text-xs text-purple-600 mt-0.5">Clientes</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{empresa.stats.usuarios}</p>
                <p className="text-xs text-orange-600 mt-0.5">Usuarios</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">{empresa.stats.sucursales}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sucursales</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de edición */}
      {empresa ? (
        <form onSubmit={guardar} className="space-y-4">

          {/* Identidad visual */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="h-1" style={{ backgroundColor: colorEfectivo }} />
            <div className="p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Identidad visual</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre comercial</label>
                  <input
                    value={nombreComercial}
                    onChange={(e) => setNombreComercial(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Ej: LavanderApp"
                  />
                  <p className="text-xs text-gray-400 mt-1">Aparece en el header y selector</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color principal</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={colorPrincipal || "#2563eb"}
                      onChange={(e) => setColorPrincipal(e.target.value)}
                      className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                    />
                    <input
                      value={colorPrincipal}
                      onChange={(e) => setColorPrincipal(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                      placeholder="#2563eb"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => setColorPrincipal(c.value)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c.value,
                          borderColor: colorPrincipal === c.value ? "#111827" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL del logo</label>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="https://..."
                />
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain border border-gray-200 rounded p-1" />
                )}
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-b border-gray-100">Vista previa en header</p>
                <div className="px-3 py-2 flex items-center gap-2 bg-white">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 bg-gray-50">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-4 w-4 object-contain rounded-sm" />
                    ) : (
                      <div className="h-4 w-4 rounded-sm flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: colorEfectivo }}>
                        {(nombreComercial || nombre || "E").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-700">{nombreComercial || nombre || "Empresa"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clave de acceso */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Clave de acceso</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {empresa?.hasKey ? "Clave configurada — requerida para seleccionar esta empresa." : "Sin clave — cualquier admin puede seleccionar esta empresa."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setCambiarClave(!cambiarClave); setAccessKey(""); }}
                className="text-blue-600 text-xs hover:underline"
              >
                {cambiarClave ? "Cancelar" : empresa?.hasKey ? "Cambiar clave" : "Agregar clave"}
              </button>
            </div>
            {cambiarClave && (
              <div>
                <input
                  type="text"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder={empresa?.hasKey ? "Nueva clave (dejar vacío para eliminar)" : "Ej: mi-clave-secreta"}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Dejar vacío para quitar la clave de esta empresa.</p>
              </div>
            )}
          </div>

          {/* Datos legales */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Datos legales</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre legal *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Razón social</label>
              <input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Ej: Lavandería S.R.L."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CUIT</label>
                <input
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ej: 20-12345678-9"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono *</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dirección *</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
          {ok && <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded">Guardado. Actualizando header...</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full text-white py-2.5 rounded font-medium disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: colorEfectivo }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      ) : (
        <p className="text-gray-400 text-sm">No hay empresa activa. Creá una con el botón de arriba.</p>
      )}

      {/* Modal confirmar eliminación */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-red-600">Eliminar empresa</h2>
              <p className="text-sm text-gray-500 mt-1">
                Esta acción es irreversible. Solo se puede eliminar si la empresa no tiene pedidos ni clientes.
              </p>
            </div>
            <div className="p-5 space-y-3">
              {errorEliminar && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{errorEliminar}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmarEliminar(null)}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={eliminarEmpresa}
                  disabled={eliminando}
                  className="flex-1 bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {eliminando ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal clave para seleccionar empresa */}
      {keyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
            <div className="p-5 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Clave requerida</p>
              <p className="text-xs text-gray-400 mt-1">
                {(empresas.find((e) => e.id === keyModal.id)?.nombreComercial || empresas.find((e) => e.id === keyModal.id)?.nombre)} requiere una clave de acceso.
              </p>
            </div>
            <form onSubmit={confirmarConClave} className="p-5 space-y-3">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoFocus
                placeholder="Clave de acceso"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              {keyError && <p className="text-red-600 text-xs">{keyError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setKeyModal(null); setSwitchingKey(false); }}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={switchingKey || !keyInput}
                  className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {switchingKey ? "..." : "Ingresar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal nueva empresa */}
      {mostrarNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg">Nueva empresa</h2>
              <p className="text-xs text-gray-400 mt-1">Comenzará sin pedidos ni clientes.</p>
            </div>
            <form onSubmit={crearEmpresa} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  value={formNueva.nombre}
                  onChange={(e) => setFormNueva({ ...formNueva, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Razón social</label>
                <input
                  value={formNueva.razonSocial}
                  onChange={(e) => setFormNueva({ ...formNueva, razonSocial: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ej: Lavandería S.R.L."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">CUIT</label>
                  <input
                    value={formNueva.cuit}
                    onChange={(e) => setFormNueva({ ...formNueva, cuit: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="20-12345678-9"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono *</label>
                  <input
                    value={formNueva.telefono}
                    onChange={(e) => setFormNueva({ ...formNueva, telefono: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección *</label>
                <input
                  value={formNueva.direccion}
                  onChange={(e) => setFormNueva({ ...formNueva, direccion: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Clave de acceso <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={formNueva.accessKey}
                  onChange={(e) => setFormNueva({ ...formNueva, accessKey: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Dejar vacío para no requerir clave"
                />
              </div>
              {errorNueva && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{errorNueva}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarNueva(false)}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {creando ? "Creando..." : "Crear empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
