"use client";

import { useState } from "react";

export default function SetupAdminPage() {
  const [estado, setEstado] = useState<"idle" | "loading" | "ok" | "existe" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  async function crearAdmin() {
    setEstado("loading");
    try {
      const res = await fetch("/api/setup-admin", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setEstado("ok");
      } else {
        setEstado("existe");
      }
      setMensaje(data.message);
    } catch {
      setEstado("error");
      setMensaje("Error al conectar con el servidor");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🧺</div>
          <h1 className="text-xl font-bold text-gray-800">Configuración inicial</h1>
          <p className="text-sm text-gray-500 mt-1">Crear el usuario administrador del sistema</p>
        </div>

        {estado === "idle" || estado === "loading" ? (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Email:</span> admin@lavanderia.com</p>
              <p><span className="font-medium">Password:</span> admin123</p>
              <p><span className="font-medium">Rol:</span> Administrador</p>
            </div>
            <button
              onClick={crearAdmin}
              disabled={estado === "loading"}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {estado === "loading" ? "Creando..." : "Crear Administrador Inicial"}
            </button>
          </div>
        ) : (
          <div className={`rounded-lg p-4 text-center space-y-3 ${
            estado === "ok" ? "bg-green-50 border border-green-200" :
            estado === "existe" ? "bg-yellow-50 border border-yellow-200" :
            "bg-red-50 border border-red-200"
          }`}>
            <p className="text-2xl">
              {estado === "ok" ? "✅" : estado === "existe" ? "⚠️" : "❌"}
            </p>
            <p className={`font-medium text-sm ${
              estado === "ok" ? "text-green-800" :
              estado === "existe" ? "text-yellow-800" :
              "text-red-800"
            }`}>
              {mensaje}
            </p>
            {(estado === "ok" || estado === "existe") && (
              <a
                href="/login"
                className="inline-block mt-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Ir al login →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
