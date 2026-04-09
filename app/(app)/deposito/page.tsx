"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Pedido = {
  id: string;
  total: number;
  saldo: number;
  updatedAt: string;
  cliente: { nombre: string; telefono: string };
  items: { tipo: string; cantidad: number }[];
};

export default function DepositoPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deposito")
      .then((r) => r.json())
      .then((data) => { setPedidos(data); setLoading(false); });
  }, []);

  function diasEnDeposito(updatedAt: string) {
    const diff = Date.now() - new Date(updatedAt).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function enviarWA(p: Pedido) {
    const tel = p.cliente.telefono.replace(/\D/g, "");
    const dias = diasEnDeposito(p.updatedAt);
    const msg = encodeURIComponent(
      `Hola ${p.cliente.nombre}, le informamos que tiene ropa en depósito hace ${dias} días en nuestra lavandería. Por favor pase a retirarla. Saldo pendiente: $${p.saldo.toLocaleString()}.`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Depósito</h1>
      <p className="text-sm text-gray-500">
        Pedidos listos sin retirar por más de 7 días ({pedidos.length} pedidos)
      </p>

      {pedidos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          No hay pedidos en depósito
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Tel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Días</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Saldo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${diasEnDeposito(p.updatedAt) > 30 ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.id.slice(-8)}</td>
                  <td className="px-4 py-2 font-medium">{p.cliente.nombre}</td>
                  <td className="px-4 py-2 text-gray-500">{p.cliente.telefono}</td>
                  <td className="px-4 py-2">
                    <span className={`font-bold ${diasEnDeposito(p.updatedAt) > 30 ? "text-red-600" : "text-orange-600"}`}>
                      {diasEnDeposito(p.updatedAt)} días
                    </span>
                  </td>
                  <td className="px-4 py-2">${p.total.toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-red-600">
                    {p.saldo > 0 ? `$${p.saldo.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <Link href={`/pedidos/${p.id}`} className="text-blue-600 hover:underline text-xs">
                      Ver
                    </Link>
                    <button onClick={() => enviarWA(p)} className="text-green-600 hover:underline text-xs">
                      WhatsApp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
