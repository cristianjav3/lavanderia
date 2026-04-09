"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ESTADO_LABELS, ESTADO_COLORS, PAGO_COLORS } from "@/lib/constants";

type PedidoResult = {
  id: string;
  numero: number;
  estado: string;
  estadoPago: string;
  total: number;
  saldo: number;
  createdAt: string;
  cliente: { nombre: string; telefono: string } | null;
};

interface Props {
  autoFocus?: boolean;
}

export function BuscadorPedidos({ autoFocus }: Props) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PedidoResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Normalizar: sacar # del inicio
    const trimmed = q.trim().replace(/^#/, "");
    if (trimmed.length < 1) {
      setResultados([]);
      setMostrar(false);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    // Debounce más corto para búsqueda por número (respuesta casi inmediata)
    const delay = /^\d+$/.test(trimmed) ? 150 : 250;

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pedidos?q=${encodeURIComponent(trimmed)}`);
        const data: PedidoResult[] = await res.json();
        setResultados(Array.isArray(data) ? data : []);
        setMostrar(true);
      } finally {
        setBuscando(false);
      }
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMostrar(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function limpiar() {
    setQ("");
    setResultados([]);
    setMostrar(false);
    inputRef.current?.focus();
  }

  // Si hay exactamente 1 resultado y la búsqueda es por número, resaltarlo
  const esResultadoExacto =
    resultados.length === 1 &&
    /^\d+$/.test(q.trim().replace(/^#/, "")) &&
    resultados[0].numero === parseInt(q.trim().replace(/^#/, ""));

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input */}
      <div className="relative">
        {/* Ícono lupa */}
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => resultados.length > 0 && setMostrar(true)}
          placeholder="#Ticket, nombre o teléfono..."
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full pl-12 pr-20 py-4 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:ring-0 bg-white shadow-sm min-h-[56px] placeholder:text-gray-400 transition-colors"
        />

        {/* Estado derecha del input */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {buscando && (
            <span className="text-xs text-gray-400 animate-pulse">buscando...</span>
          )}
          {q && !buscando && (
            <button
              onClick={limpiar}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg"
              aria-label="Limpiar"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Hint visual debajo del input — solo cuando está vacío */}
      {!q && (
        <div className="flex items-center gap-4 mt-2 px-1">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono text-xs">#123</span>
            número exacto
          </span>
          <span className="text-xs text-gray-400">· nombre · teléfono</span>
        </div>
      )}

      {/* Dropdown de resultados */}
      {mostrar && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">

          {resultados.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-gray-500 text-sm">Sin resultados para <strong>&quot;{q}&quot;</strong></p>
              <p className="text-gray-400 text-xs mt-1">Probá con el nombre completo o el número de ticket</p>
            </div>
          ) : (
            <>
              {/* Header del dropdown */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">
                  {resultados.length} resultado{resultados.length !== 1 ? "s" : ""}
                </span>
                <Link
                  href={`/pedidos?q=${encodeURIComponent(q.trim().replace(/^#/, ""))}`}
                  onClick={limpiar}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Ver en lista completa →
                </Link>
              </div>

              {/* Resultado único exacto — presentación especial */}
              {esResultadoExacto ? (
                <Link
                  href={`/pedidos/${resultados[0].id}`}
                  onClick={limpiar}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                >
                  {/* Número grande */}
                  <div className="shrink-0 text-center">
                    <div className="text-4xl font-black font-mono text-blue-600 leading-none">
                      #{resultados[0].numero}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(resultados[0].createdAt).toLocaleDateString("es-AR")}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">
                      {resultados[0].cliente?.nombre ?? "—"}
                    </p>
                    <p className="text-sm text-gray-500">{resultados[0].cliente?.telefono ?? ""}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[resultados[0].estado] ?? "bg-gray-100 text-gray-700"}`}>
                        {ESTADO_LABELS[resultados[0].estado] ?? resultados[0].estado}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAGO_COLORS[resultados[0].estadoPago] ?? "bg-gray-100"}`}>
                        {resultados[0].estadoPago}
                      </span>
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-gray-800">${resultados[0].total.toLocaleString()}</p>
                    {resultados[0].saldo > 0 && (
                      <p className="text-sm text-red-600 font-semibold">
                        Saldo ${resultados[0].saldo.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-blue-600 font-medium mt-1">Abrir →</p>
                  </div>
                </Link>
              ) : (
                /* Lista de resultados múltiples */
                <div className="divide-y divide-gray-50 max-h-[65vh] overflow-y-auto">
                  {resultados.map((p) => (
                    <Link
                      key={p.id}
                      href={`/pedidos/${p.id}`}
                      onClick={limpiar}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                    >
                      {/* Número */}
                      <div className="shrink-0 w-14 text-center">
                        <span className="font-black font-mono text-xl text-blue-600 leading-none">
                          #{p.numero}
                        </span>
                      </div>

                      {/* Info cliente + estado */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.cliente?.nombre ?? "—"}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100 text-gray-700"}`}>
                            {ESTADO_LABELS[p.estado] ?? p.estado}
                          </span>
                          <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-AR")}</span>
                        </div>
                      </div>

                      {/* Total + saldo */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-800">${p.total.toLocaleString()}</p>
                        {p.saldo > 0 && (
                          <p className="text-xs text-red-600 font-medium">Saldo ${p.saldo.toLocaleString()}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
