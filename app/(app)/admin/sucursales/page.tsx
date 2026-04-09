"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Sucursal = { id: string; nombre: string; direccion?: string | null; telefono?: string | null };

const FORM_VACIO = { nombre: "", direccion: "", telefono: "" };

export default function SucursalesAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state (create + edit)
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Sucursal | null>(null);
  const [form, setForm] = useState(FORM_VACIO);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { router.replace("/dashboard"); return; }
    fetch("/api/sucursales")
      .then((r) => r.json())
      .then((data) => { setSucursales(data); setLoading(false); });
  }, [status, isAdmin, router]);

  function abrirNueva() {
    setEditando(null);
    setForm(FORM_VACIO);
    setError("");
    setMostrarForm(true);
  }

  function abrirEditar(s: Sucursal) {
    setEditando(s);
    setForm({ nombre: s.nombre, direccion: s.direccion ?? "", telefono: s.telefono ?? "" });
    setError("");
    setMostrarForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError("");

    if (editando) {
      const res = await fetch("/api/sucursales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editando.id, ...form }),
      });
      if (res.ok) {
        const s = await res.json();
        setSucursales(sucursales.map((x) => (x.id === s.id ? s : x)));
        setMostrarForm(false);
      } else {
        const d = await res.json();
        setError(d.error || "Error al guardar");
      }
    } else {
      const res = await fetch("/api/sucursales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const s = await res.json();
        setSucursales([...sucursales, s]);
        setMostrarForm(false);
      } else {
        const d = await res.json();
        setError(d.error || "Error al agregar");
      }
    }
    setSaving(false);
  }

  async function eliminar(id: string) {
    await fetch("/api/sucursales", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSucursales(sucursales.filter((s) => s.id !== id));
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sucursales</h1>
        <button
          onClick={abrirNueva}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Nueva sucursal
        </button>
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg">{editando ? "Editar sucursal" : "Nueva sucursal"}</h2>
            </div>
            <form onSubmit={guardar} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ej: Sucursal Centro"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <input
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ej: Av. Corrientes 1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ej: 11 1234-5678"
                />
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
                  {saving ? "Guardando..." : editando ? "Guardar cambios" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {sucursales.length === 0 && (
          <p className="text-gray-400 text-sm p-4">No hay sucursales</p>
        )}
        {sucursales.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{s.nombre}</p>
              {s.direccion && <p className="text-xs text-gray-500 mt-0.5">{s.direccion}</p>}
              {s.telefono && <p className="text-xs text-gray-400">{s.telefono}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => abrirEditar(s)}
                className="text-blue-600 text-xs hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => eliminar(s.id)}
                className="text-red-500 text-xs hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
