"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Pedido = {
  id: string;
  franjaHoraria?: string | null;
  tipoEntrega: string;
  estadoPago: string;
  saldo: number;
  fechaRetiro?: string | null;
  direccionEntrega?: string | null;
  telefonoContacto?: string | null;
  observacionEntrega?: string | null;
  cliente: { nombre: string; telefono: string; direccion?: string | null };
};

export default function ChoferPage() {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [retiros, setRetiros] = useState<Pedido[]>([]);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/chofer?fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => {
        setRetiros(data.retiros ?? []);
        setEntregas(data.entregas ?? []);
        setLoading(false);
      });
  }, [fecha]);

  function llamar(tel: string) {
    window.open(`tel:${tel}`);
  }

  // Prefer direccionEntrega over cliente.direccion
  function direccion(p: Pedido): string | null {
    return p.direccionEntrega ?? p.cliente.direccion ?? null;
  }

  // Prefer telefonoContacto over cliente.telefono
  function telefono(p: Pedido): string {
    return p.telefonoContacto ?? p.cliente.telefono;
  }

  function PedidoCard({ p, colorClass }: { p: Pedido; colorClass: string }) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{p.cliente.nombre}</p>
            <p className="text-sm text-gray-500">{telefono(p)}</p>
            {direccion(p) && (
              <p className="text-sm text-blue-700 font-medium mt-0.5">{direccion(p)}</p>
            )}
            {p.franjaHoraria && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">
                {p.franjaHoraria}
              </span>
            )}
            {p.observacionEntrega && (
              <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 px-2 py-1 rounded">
                {p.observacionEntrega}
              </p>
            )}
            {p.saldo > 0 && (
              <p className="text-xs text-red-600 font-medium mt-1">
                Saldo: ${p.saldo.toLocaleString()} — COBRAR AL ENTREGAR
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => llamar(telefono(p))}
              className="bg-gray-100 px-3 py-2.5 rounded-lg hover:bg-gray-200 text-base min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              📞
            </button>
            <Link
              href={`/pedidos/${p.id}`}
              className={`text-xs font-medium px-3 py-2.5 rounded-lg hover:opacity-80 text-center min-h-[44px] flex items-center justify-center ${colorClass}`}
            >
              Ver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Panel Chofer</h1>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
        />
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Retiros */}
          <div>
            <h2 className="font-semibold mb-2 text-blue-700">
              Retiros del día ({retiros.length})
            </h2>
            <div className="space-y-2">
              {retiros.length === 0 && (
                <div className="text-gray-400 text-sm bg-white border border-gray-200 rounded p-4">Sin retiros</div>
              )}
              {retiros.map((p) => (
                <PedidoCard key={p.id} p={p} colorClass="bg-blue-50 text-blue-600" />
              ))}
            </div>
          </div>

          {/* Entregas */}
          <div>
            <h2 className="font-semibold mb-2 text-green-700">
              Entregas pendientes ({entregas.length})
            </h2>
            <div className="space-y-2">
              {entregas.length === 0 && (
                <div className="text-gray-400 text-sm bg-white border border-gray-200 rounded p-4">Sin entregas</div>
              )}
              {entregas.map((p) => (
                <PedidoCard key={p.id} p={p} colorClass="bg-green-50 text-green-600" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
