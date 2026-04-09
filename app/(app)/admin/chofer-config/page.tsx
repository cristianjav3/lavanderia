"use client";

import { useEffect, useState } from "react";

type Franja = { desde: string; hasta: string };
type DiaConfig = { id: string; dia: number; activo: boolean; franjas: Franja[] };

const DIA_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function ChoferConfigPage() {
  const [configs, setConfigs] = useState<DiaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/chofer-config")
      .then((r) => r.json())
      .then((data: DiaConfig[]) => {
        // Ensure franjas is always an array
        setConfigs(
          data.map((d) => ({
            ...d,
            franjas: Array.isArray(d.franjas) ? d.franjas : [],
          }))
        );
        setLoading(false);
      });
  }, []);

  async function guardar(dia: number) {
    const config = configs.find((c) => c.dia === dia);
    if (!config) return;
    setGuardando(dia);
    await fetch("/api/admin/chofer-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dia: config.dia, activo: config.activo, franjas: config.franjas }),
    });
    setGuardando(null);
  }

  function toggleActivo(dia: number) {
    setConfigs((prev) =>
      prev.map((c) => (c.dia === dia ? { ...c, activo: !c.activo } : c))
    );
  }

  function agregarFranja(dia: number) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.dia === dia
          ? { ...c, franjas: [...c.franjas, { desde: "09:00", hasta: "12:00" }] }
          : c
      )
    );
  }

  function eliminarFranja(dia: number, idx: number) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.dia === dia
          ? { ...c, franjas: c.franjas.filter((_, i) => i !== idx) }
          : c
      )
    );
  }

  function actualizarFranja(dia: number, idx: number, campo: "desde" | "hasta", valor: string) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.dia === dia
          ? {
              ...c,
              franjas: c.franjas.map((f, i) =>
                i === idx ? { ...f, [campo]: valor } : f
              ),
            }
          : c
      )
    );
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando configuración...</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Configuración del Chofer</h1>
        <p className="text-xs text-gray-400">Define los días y franjas horarias disponibles para entregas a domicilio.</p>
      </div>

      <div className="space-y-3">
        {configs.map((config) => (
          <div
            key={config.dia}
            className={`bg-white border rounded-lg p-4 transition-opacity ${!config.activo ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActivo(config.dia)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${config.activo ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.activo ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
                <span className="font-semibold">{DIA_LABELS[config.dia]}</span>
                {!config.activo && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactivo</span>
                )}
              </div>
              <button
                onClick={() => guardar(config.dia)}
                disabled={guardando === config.dia}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando === config.dia ? "Guardando..." : "Guardar"}
              </button>
            </div>

            {config.activo && (
              <div className="space-y-2">
                {config.franjas.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Sin franjas horarias definidas.</p>
                )}
                {config.franjas.map((franja, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                    <span className="text-xs text-gray-500 w-12">Desde</span>
                    <input
                      type="time"
                      value={franja.desde}
                      onChange={(e) => actualizarFranja(config.dia, idx, "desde", e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-500 w-12">Hasta</span>
                    <input
                      type="time"
                      value={franja.hasta}
                      onChange={(e) => actualizarFranja(config.dia, idx, "hasta", e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => eliminarFranja(config.dia, idx)}
                      className="ml-auto text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => agregarFranja(config.dia)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Agregar franja
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
