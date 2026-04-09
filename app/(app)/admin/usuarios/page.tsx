"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Sucursal = { id: string; nombre: string };
type Usuario = {
  id: string;
  name: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
  sucursalId: string | null;
  sucursal: Sucursal | null;
  createdAt: string;
};

const FORM_VACIO = { name: "", email: "", telefono: "", password: "", role: "empleado", sucursalId: "" };

export default function UsuariosAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete state
  const [eliminando, setEliminando] = useState<Usuario | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuggestion, setDeleteSuggestion] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { router.replace("/dashboard"); return; }
    Promise.all([
      fetch("/api/admin/usuarios").then((r) => r.json()),
      fetch("/api/sucursales").then((r) => r.json()),
    ]).then(([u, s]) => {
      setUsuarios(u);
      setSucursales(s);
      setLoading(false);
    });
  }, [status, isAdmin, router]);

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setError("");
    setMostrarForm(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ name: u.name, email: u.email, telefono: u.telefono ?? "", password: "", role: u.role, sucursalId: u.sucursalId ?? "" });
    setError("");
    setMostrarForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editando ? `/api/admin/usuarios/${editando.id}` : "/api/admin/usuarios";
    const method = editando ? "PATCH" : "POST";
    const body = { ...form, sucursalId: form.sucursalId || null };
    if (editando && !form.password) delete (body as Record<string, unknown>).password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const u = await res.json();
      if (editando) {
        setUsuarios(usuarios.map((x) => (x.id === u.id ? u : x)));
      } else {
        setUsuarios([...usuarios, u]);
      }
      setMostrarForm(false);
    } else {
      const d = await res.json();
      setError(d.error || "Error al guardar");
    }
    setSaving(false);
  }

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsuarios(usuarios.map((x) => (x.id === updated.id ? updated : x)));
    }
  }

  function abrirEliminar(u: Usuario) {
    setEliminando(u);
    setDeleteError("");
    setDeleteSuggestion(false);
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/admin/usuarios/${eliminando.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setUsuarios(usuarios.filter((u) => u.id !== eliminando.id));
      setEliminando(null);
    } else {
      setDeleteError(data.error || "Error al eliminar");
      if (data.tieneOperaciones) setDeleteSuggestion(true);
    }
    setDeleting(false);
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Personal</h1>
        <button
          onClick={abrirNuevo}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo empleado
        </button>
      </div>

      {/* Modal formulario */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg">{editando ? "Editar empleado" : "Nuevo empleado"}</h2>
            </div>
            <form onSubmit={guardar} className="p-5 space-y-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos del empleado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Nombre completo</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rol</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="empleado">Empleado</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Local asignado</label>
                    <select
                      value={form.sucursalId}
                      onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {sucursales.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Acceso al sistema</p>
                <div>
                  <label className="block text-sm font-medium mb-1">Usuario (email)</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="juan@lavanderia.com"
                    required={!editando}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contraseña{" "}
                    {editando && <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="••••••••"
                    required={!editando}
                  />
                </div>
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {eliminando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg text-red-700">Eliminar empleado</h2>
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que querés eliminar a <strong>{eliminando.name}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {deleteError}
                {deleteSuggestion && (
                  <p className="mt-1 font-medium">
                    Usá el botón <strong>Desactivar</strong> para deshabilitar el acceso sin perder el historial.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEliminando(null)}
                className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              {!deleteSuggestion && (
                <button
                  onClick={confirmarEliminar}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
              )}
              {deleteSuggestion && (
                <button
                  onClick={async () => {
                    await toggleActivo(eliminando);
                    setEliminando(null);
                  }}
                  className="flex-1 bg-orange-500 text-white py-2 rounded text-sm font-medium hover:bg-orange-600"
                >
                  Desactivar en cambio
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabla — desktop ─────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No hay empleados</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Tel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Rol</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Local</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.telefono ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === "admin" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {u.sucursal?.nombre ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => abrirEditar(u)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => toggleActivo(u)} className={`text-xs hover:underline ${u.activo ? "text-orange-500" : "text-green-600"}`}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => abrirEliminar(u)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Cards — mobile ───────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {usuarios.length === 0 && (
          <div className="text-center py-8 text-gray-400">No hay empleados</div>
        )}
        {usuarios.map((u) => (
          <div key={u.id} className={`bg-white border border-gray-200 rounded-lg p-4 space-y-3 ${!u.activo ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{u.name}</p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                {u.telefono && <p className="text-xs text-gray-400">{u.telefono}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  u.role === "admin" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                }`}>{u.role}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  u.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>{u.activo ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
            {u.sucursal && (
              <p className="text-xs text-gray-500">Local: <strong>{u.sucursal.nombre}</strong></p>
            )}
            <div className="flex gap-3 pt-1 border-t border-gray-100">
              <button onClick={() => abrirEditar(u)} className="text-blue-600 text-sm font-medium py-1">Editar</button>
              <button onClick={() => toggleActivo(u)} className={`text-sm font-medium py-1 ${u.activo ? "text-orange-500" : "text-green-600"}`}>
                {u.activo ? "Desactivar" : "Activar"}
              </button>
              <button onClick={() => abrirEliminar(u)} className="text-red-500 text-sm font-medium py-1 ml-auto">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
