"use client";

import { useEffect, useState } from "react";

type Producto = {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  unidad: string | null;
  activo: boolean;
};

type FormData = {
  nombre: string;
  tipo: string;
  precio: string;
  unidad: string;
};

const FORM_VACIO: FormData = { nombre: "", tipo: "servicio", precio: "", unidad: "" };

const TIPO_LABELS: Record<string, string> = {
  servicio: "Servicio",
  producto: "Producto",
};

const UNIDADES_SUGERIDAS = ["prenda", "unidad", "kg", "par"];

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/admin/productos");
    const data = await res.json();
    setProductos(data);
    setLoading(false);
  }

  function abrirCrear() {
    setEditando(null);
    setForm(FORM_VACIO);
    setError("");
    setModalAbierto(true);
  }

  function abrirEditar(p: Producto) {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      precio: String(p.precio),
      unidad: p.unidad ?? "",
    });
    setError("");
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setError("");
  }

  async function guardar() {
    setError("");
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.precio || isNaN(Number(form.precio))) { setError("El precio es obligatorio"); return; }

    setGuardando(true);
    const body = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      precio: Number(form.precio),
      unidad: form.unidad.trim() || null,
      ...(editando ? { id: editando.id, activo: editando.activo } : {}),
    };

    const res = await fetch("/api/admin/productos", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      setGuardando(false);
      return;
    }

    await cargar();
    cerrarModal();
    setGuardando(false);
  }

  async function toggleActivo(p: Producto) {
    setToggling(p.id);
    await fetch("/api/admin/productos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    await cargar();
    setToggling(null);
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando productos...</div>;

  const activos = productos.filter((p) => p.activo);
  const inactivos = productos.filter((p) => !p.activo);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Productos y servicios</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activos.length} activo{activos.length !== 1 ? "s" : ""}
            {inactivos.length > 0 && ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={abrirCrear}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Tabla */}
      {productos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
          Sin productos. Creá el primero.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unidad</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productos.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.tipo === "servicio" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {TIPO_LABELS[p.tipo] ?? p.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${p.precio.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unidad ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(p)}
                      disabled={toggling === p.id}
                      className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${p.activo ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${p.activo ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(p)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">
              {editando ? "Editar producto" : "Nuevo producto"}
            </h2>

            <div className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Ej: Canasto, Planchado…"
                  autoFocus
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
                <div className="flex gap-2">
                  {(["servicio", "producto"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: t })}
                      className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                        form.tipo === t
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precio */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Precio *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Unidad */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Unidad (opcional)</label>
                <input
                  type="text"
                  list="unidades-sugeridas"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="prenda, unidad, kg…"
                />
                <datalist id="unidades-sugeridas">
                  {UNIDADES_SUGERIDAS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear producto"}
              </button>
              <button
                onClick={cerrarModal}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded font-medium hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
