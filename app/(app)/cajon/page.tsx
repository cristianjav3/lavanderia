"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Concepto = { id: string; nombre: string; tipo: string };
type Movimiento = {
  id: string;
  tipo: string;
  monto: number;
  descripcion?: string;
  concepto?: Concepto;
  createdAt: string;
};
type Cajon = {
  id: string;
  userId: string;
  saldoInicial: number;
  saldoFinal: number | null;
  estado: string;
  movimientos: Movimiento[];
  createdAt: string;
  fechaCierre?: string | null;
  user?: { name: string; sucursal?: { nombre: string } | null };
};
type PagoRegistrado = {
  id: string;
  monto: number;
  metodoPago: string;
  createdAt: string;
  pedido: {
    numero: number;
    total: number;
    cliente: { nombre: string };
  };
};

type Vista = "principal" | "ingreso" | "gasto" | "cierre" | "cerrado";

function calcBalance(cajon: Cajon, pagos: PagoRegistrado[]) {
  const ventasEfectivo = pagos
    .filter((p) => p.metodoPago === "efectivo")
    .reduce((s, p) => s + p.monto, 0);
  const ventasTarjeta = pagos
    .filter((p) => p.metodoPago === "tarjeta")
    .reduce((s, p) => s + p.monto, 0);
  const ventasMercadopago = pagos
    .filter((p) => p.metodoPago === "mercadopago")
    .reduce((s, p) => s + p.monto, 0);
  const totalCobrado = ventasEfectivo + ventasTarjeta + ventasMercadopago;

  const ingresos = cajon.movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + m.monto, 0);
  const gastos = cajon.movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((s, m) => s + m.monto, 0);

  // Solo el efectivo físico entra al cajón
  const efectivoEsperado = cajon.saldoInicial + ventasEfectivo + ingresos - gastos;

  return {
    ventasEfectivo,
    ventasTarjeta,
    ventasMercadopago,
    totalCobrado,
    ingresos,
    gastos,
    efectivoEsperado,
  };
}

export default function CajonPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCajones, setAdminCajones] = useState<Cajon[]>([]);
  const [cajon, setCajon] = useState<Cajon | null>(null);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>("principal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pagos del cajón (cargados al entrar a cierre)
  const [pagosCierre, setPagosCierre] = useState<PagoRegistrado[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Formulario apertura
  const [montoApertura, setMontoApertura] = useState("");

  // Formulario movimiento
  const [movConceptoId, setMovConceptoId] = useState("");
  const [movDescripcion, setMovDescripcion] = useState("");
  const [movMonto, setMovMonto] = useState("");
  const [nuevoConcepto, setNuevoConcepto] = useState("");
  const [mostrarNuevoConcepto, setMostrarNuevoConcepto] = useState(false);

  // Formulario cierre
  const [montoCierre, setMontoCierre] = useState("");

  const [sesionesAbiertas, setSesionesAbiertas] = useState<Cajon[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/cajon").then((r) => r.json()),
      fetch("/api/cajon/conceptos").then((r) => r.json()),
    ]).then(async ([data, co]) => {
      if (data?.admin) {
        setIsAdmin(true);
        setAdminCajones(data.cajones);
        setSesionesAbiertas(data.sesionesAbiertas ?? []);
      } else {
        setCajon(data);
        if (data?.estado === "cerrado") {
          setVista("cerrado");
          // Cargar pagos para mostrar el balance en la vista cerrado
          try {
            const rep = await fetch(`/api/cajon/${data.id}/reporte`);
            if (rep.ok) {
              const repData = await rep.json();
              setPagosCierre(repData.pagos ?? []);
            }
          } catch { /* sin pagos */ }
        }
      }
      setConceptos(co);
      setLoading(false);
    });
  }, []);

  async function abrirCajon(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/cajon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apertura: parseFloat(montoApertura) }),
    });
    if (res.ok) {
      const c = await res.json();
      setCajon(c);
      setVista("principal");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error || "Error al abrir cajón");
    }
    setSaving(false);
  }

  async function agregarMovimiento(tipo: "ingreso" | "gasto") {
    if (!movMonto || parseFloat(movMonto) <= 0) { setError("Monto inválido"); return; }
    if (!movConceptoId && !movDescripcion) { setError("Elegí un concepto o escribí una descripción"); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/cajon/${cajon!.id}/movimiento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, conceptoId: movConceptoId || null, descripcion: movDescripcion || null, monto: parseFloat(movMonto) }),
    });
    if (res.ok) {
      const mov = await res.json();
      setCajon({ ...cajon!, movimientos: [...cajon!.movimientos, mov] });
      setMovConceptoId("");
      setMovDescripcion("");
      setMovMonto("");
      setVista("principal");
    } else {
      const d = await res.json();
      setError(d.error || "Error");
    }
    setSaving(false);
  }

  async function agregarConcepto(tipo: string) {
    if (!nuevoConcepto.trim()) return;
    const res = await fetch("/api/cajon/conceptos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoConcepto.trim(), tipo }),
    });
    if (res.ok) {
      const c = await res.json();
      setConceptos([...conceptos, c]);
      setMovConceptoId(c.id);
      setNuevoConcepto("");
      setMostrarNuevoConcepto(false);
    } else {
      const d = await res.json();
      setError(d.error || "Error al crear concepto");
    }
  }

  async function irACierre() {
    setLoadingBalance(true);
    setError("");
    try {
      const res = await fetch(`/api/cajon/${cajon!.id}/reporte`);
      if (res.ok) {
        const data = await res.json();
        setPagosCierre(data.pagos ?? []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(`Error al cargar cobros: ${err.error ?? res.status}`);
      }
    } catch (e) {
      setError(`Error de red: ${String(e)}`);
    }
    setMontoCierre("");
    setLoadingBalance(false);
    setVista("cierre");
  }

  async function cerrarCajon(e: React.FormEvent) {
    e.preventDefault();
    if (!montoCierre) { setError("Ingresá el monto"); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/cajon/${cajon!.id}/cierre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cierre: parseFloat(montoCierre) }),
    });
    if (res.ok) {
      const c = await res.json();
      setCajon(c);
      setVista("cerrado");
    } else {
      const d = await res.json();
      setError(d.error || "Error al cerrar");
    }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>;

  // ── ADMIN VIEW ────────────────────────────────────────────────────────────
  if (isAdmin) {
    return <AdminCajonesView cajones={adminCajones} sesionesAbiertas={sesionesAbiertas} />;
  }

  // ── APERTURA ──────────────────────────────────────────────────────────────
  if (!cajon) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-3">💰</div>
            <h1 className="text-2xl font-bold">Apertura de cajón</h1>
            <p className="text-gray-500 text-sm mt-1">
              Contá el dinero disponible y registrá el monto inicial para comenzar el día
            </p>
          </div>
          <form onSubmit={abrirCajon} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Dinero en caja al iniciar</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-3 text-2xl font-bold focus:outline-none focus:border-blue-500"
                  placeholder="0"
                  autoFocus
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Abriendo..." : "Iniciar cajón del día"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const conceptosGasto = conceptos.filter((c) => c.tipo === "gasto");
  const conceptosIngreso = conceptos.filter((c) => c.tipo === "ingreso");

  // ── CAJÓN CERRADO ────────────────────────────────────────────────────────
  if (vista === "cerrado" && cajon.saldoFinal !== null) {
    const bal = calcBalance(cajon, pagosCierre);
    const diferencia = cajon.saldoFinal - bal.efectivoEsperado;
    const fechaCierre = new Date(cajon.createdAt).toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long",
    });
    return (
      <div className="max-w-lg mx-auto space-y-5 py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Cajón cerrado</h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{fechaCierre}</p>
          </div>
          <Link
            href={`/cajon/${cajon.id}/reporte`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Ver reporte / PDF
          </Link>
        </div>

        <BalanceCierre cajon={cajon} pagos={pagosCierre} />

        {/* Resultado arqueo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex justify-between font-bold text-lg">
            <span>Contado al cerrar</span>
            <span>${cajon.saldoFinal.toLocaleString()}</span>
          </div>
          <div className={`flex justify-between font-bold text-xl rounded-lg px-3 py-3 ${diferencia === 0 ? "bg-green-50 text-green-700" : diferencia > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
            <span>{diferencia === 0 ? "✓ Caja saldada" : diferencia > 0 ? "↑ Sobrante" : "↓ Faltante"}</span>
            <span>{diferencia !== 0 && `$${Math.abs(diferencia).toLocaleString()}`}</span>
          </div>
        </div>

        {/* Abrir nueva caja */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-gray-600 text-sm text-center">
            Si necesitás seguir operando, podés abrir una nueva caja ahora.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => { setCajon(null); setPagosCierre([]); setMontoApertura(""); setError(""); }}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Abrir nueva caja
            </button>
            <Link
              href="/pedidos"
              className="inline-block bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Ir a pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── CIERRE ───────────────────────────────────────────────────────────────
  if (vista === "cierre") {
    const bal = calcBalance(cajon, pagosCierre);
    const cierreNum = parseFloat(montoCierre) || 0;
    const diferencia = cierreNum - bal.efectivoEsperado;

    return (
      <div className="max-w-lg mx-auto space-y-5 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setVista("principal"); setError(""); }} className="text-gray-400 hover:text-gray-600">← Volver</button>
          <h1 className="text-xl font-bold">Cierre de cajón</h1>
        </div>

        <BalanceCierre cajon={cajon} pagos={pagosCierre} />

        <form onSubmit={cerrarCajon} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Arqueo — dinero contado al cerrar</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={montoCierre}
                onChange={(e) => setMontoCierre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-3 text-2xl font-bold focus:outline-none focus:border-blue-500"
                placeholder="0"
                autoFocus
                required
              />
            </div>
          </div>
          {montoCierre && (
            <div className={`rounded-lg px-4 py-3 font-bold text-center ${diferencia === 0 ? "bg-green-50 text-green-700" : diferencia > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
              {diferencia === 0
                ? "✓ Caja saldada"
                : diferencia > 0
                ? `↑ Sobrante de $${Math.abs(diferencia).toLocaleString()}`
                : `↓ Faltante de $${Math.abs(diferencia).toLocaleString()}`}
            </div>
          )}
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-gray-800 text-white py-2.5 rounded-lg font-semibold hover:bg-gray-900 disabled:opacity-50">
            {saving ? "Cerrando..." : "Confirmar cierre de caja"}
          </button>
        </form>
      </div>
    );
  }

  // ── INGRESO / GASTO ──────────────────────────────────────────────────────
  if (vista === "ingreso" || vista === "gasto") {
    const esIngreso = vista === "ingreso";
    const conceptosFiltrados = esIngreso ? conceptosIngreso : conceptosGasto;

    return (
      <div className="max-w-lg mx-auto space-y-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setVista("principal"); setError(""); }} className="text-gray-400 hover:text-gray-600">← Volver</button>
          <h1 className="text-xl font-bold">{esIngreso ? "Registrar ingreso" : "Registrar gasto"}</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Concepto</label>
            <div className="flex flex-wrap gap-2">
              {conceptosFiltrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setMovConceptoId(c.id); setMovDescripcion(""); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${movConceptoId === c.id ? (esIngreso ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600") : "border-gray-300 hover:bg-gray-50"}`}
                >
                  {c.nombre}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMostrarNuevoConcepto(!mostrarNuevoConcepto)}
                className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-gray-400 text-gray-500 hover:bg-gray-50"
              >
                + Nuevo concepto
              </button>
            </div>
            {mostrarNuevoConcepto && (
              <div className="flex gap-2 mt-2">
                <input
                  value={nuevoConcepto}
                  onChange={(e) => setNuevoConcepto(e.target.value)}
                  placeholder="Nombre del concepto..."
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarConcepto(vista))}
                />
                <button onClick={() => agregarConcepto(vista)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">
                  Agregar
                </button>
              </div>
            )}
            {!movConceptoId && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">O escribí una descripción libre</label>
                <input
                  value={movDescripcion}
                  onChange={(e) => setMovDescripcion(e.target.value)}
                  placeholder="Ej: pago a proveedor..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={movMonto}
                onChange={(e) => setMovMonto(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-3 text-2xl font-bold focus:outline-none focus:border-blue-500"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}

          <button
            onClick={() => agregarMovimiento(vista as "ingreso" | "gasto")}
            disabled={saving}
            className={`w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50 ${esIngreso ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {saving ? "Guardando..." : esIngreso ? "Registrar ingreso" : "Registrar gasto"}
          </button>
        </div>
      </div>
    );
  }

  // ── PRINCIPAL ────────────────────────────────────────────────────────────
  const gastosTotales = cajon.movimientos.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
  const ingresosTotales = cajon.movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Cajón del día</h1>
          <p className="text-xs text-gray-500 mt-0.5">{new Date(cajon.createdAt).toLocaleString("es-AR")}</p>
        </div>
        <button
          onClick={irACierre}
          disabled={loadingBalance}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {loadingBalance ? "Cargando..." : "Cerrar caja"}
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">Apertura</div>
          <div className="text-xl font-bold text-blue-700">${cajon.saldoInicial.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Ingresos de caja</div>
          <div className="text-xl font-bold text-green-700">+${ingresosTotales.toLocaleString()}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium mb-1">Gastos de caja</div>
          <div className="text-xl font-bold text-red-700">-${gastosTotales.toLocaleString()}</div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setVista("ingreso"); setMovConceptoId(""); setMovMonto(""); setMovDescripcion(""); setError(""); }}
          className="bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
        >
          <span className="text-xl">↑</span> Registrar ingreso
        </button>
        <button
          onClick={() => { setVista("gasto"); setMovConceptoId(""); setMovMonto(""); setMovDescripcion(""); setError(""); }}
          className="bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
        >
          <span className="text-xl">↓</span> Registrar gasto
        </button>
      </div>

      <ResumenMovimientos movimientos={cajon.movimientos} />
    </div>
  );
}

// ── BALANCE COMPONENT ────────────────────────────────────────────────────────
function BalanceCierre({ cajon, pagos }: { cajon: Cajon; pagos: PagoRegistrado[] }) {
  const bal = calcBalance(cajon, pagos);
  const gastosDetalle = cajon.movimientos.filter((m) => m.tipo === "gasto");
  const ingresosDetalle = cajon.movimientos.filter((m) => m.tipo === "ingreso");
  const nEfectivo = pagos.filter((p) => p.metodoPago === "efectivo").length;
  const nTarjeta = pagos.filter((p) => p.metodoPago === "tarjeta").length;
  const nMercado = pagos.filter((p) => p.metodoPago === "mercadopago").length;

  return (
    <div className="space-y-3">
      {/* Cobros del día */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">Cobros del día</span>
          <span className="ml-2 text-xs text-gray-400">({pagos.length} cobros · total ${bal.totalCobrado.toLocaleString()})</span>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-green-700">Efectivo</span>
              <span className="ml-2 text-xs text-gray-400">{nEfectivo} cobro{nEfectivo !== 1 ? "s" : ""} · suma al cajón</span>
            </div>
            <span className="font-bold text-green-700">${bal.ventasEfectivo.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Tarjeta</span>
              <span className="ml-2 text-xs text-gray-400">{nTarjeta} cobro{nTarjeta !== 1 ? "s" : ""} · digital</span>
            </div>
            <span className="font-semibold text-gray-500">${bal.ventasTarjeta.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Mercado Pago</span>
              <span className="ml-2 text-xs text-gray-400">{nMercado} cobro{nMercado !== 1 ? "s" : ""} · digital</span>
            </div>
            <span className="font-semibold text-gray-500">${bal.ventasMercadopago.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Balance de caja */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">Balance de caja</span>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo inicial</span>
            <span className="font-medium">${cajon.saldoInicial.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>+ Cobros en efectivo</span>
            <span className="font-medium">${bal.ventasEfectivo.toLocaleString()}</span>
          </div>
          {ingresosDetalle.length > 0 && (
            <>
              <div className="flex justify-between text-green-700">
                <span>+ Otros ingresos</span>
                <span className="font-medium">${bal.ingresos.toLocaleString()}</span>
              </div>
              <div className="pl-4 space-y-1">
                {ingresosDetalle.map((m) => (
                  <div key={m.id} className="flex justify-between text-xs text-gray-500">
                    <span>{m.concepto?.nombre ?? m.descripcion ?? "—"}</span>
                    <span>${m.monto.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {gastosDetalle.length > 0 && (
            <>
              <div className="flex justify-between text-red-700">
                <span>− Gastos</span>
                <span className="font-medium">${bal.gastos.toLocaleString()}</span>
              </div>
              <div className="pl-4 space-y-1">
                {gastosDetalle.map((m) => (
                  <div key={m.id} className="flex justify-between text-xs text-gray-500">
                    <span>{m.concepto?.nombre ?? m.descripcion ?? "—"}</span>
                    <span>−${m.monto.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
            <span>Efectivo esperado en caja</span>
            <span className="text-gray-800">${bal.efectivoEsperado.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN VIEW ────────────────────────────────────────────────────────────────
function AdminCajonesView({
  cajones: cajonesIniciales,
  sesionesAbiertas: sesionesAbiertasIniciales,
}: {
  cajones: Cajon[];
  sesionesAbiertas: Cajon[];
}) {
  const [cajones, setCajones] = useState<Cajon[]>(cajonesIniciales);
  const [sesionesAbiertas, setSesionesAbiertas] = useState<Cajon[]>(sesionesAbiertasIniciales);
  const [desde, setDesde] = useState(new Date().toISOString().split("T")[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0]);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [loadingFiltro, setLoadingFiltro] = useState(false);

  // Force-close modal
  const [cierreModal, setCierreModal] = useState<Cajon | null>(null);
  const [cierreImporte, setCierreImporte] = useState("0");
  const [cierreSaving, setCierreSaving] = useState(false);
  const [cierreError, setCierreError] = useState("");

  // Lista de empleados únicos para el selector
  const empleados = Array.from(
    new Map(cajonesIniciales.map((c) => [c.userId, c.user?.name ?? c.userId])).entries()
  );

  async function aplicarFiltros() {
    setLoadingFiltro(true);
    const params = new URLSearchParams({ desde, hasta });
    if (empleadoFiltro) params.set("empleadoId", empleadoFiltro);
    const res = await fetch(`/api/cajon?${params}`);
    const data = await res.json();
    setCajones(data.cajones ?? []);
    setLoadingFiltro(false);
  }

  async function forzarCierre() {
    if (!cierreModal) return;
    setCierreSaving(true);
    setCierreError("");
    const res = await fetch(`/api/cajon/${cierreModal.id}/cierre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cierre: parseFloat(cierreImporte) || 0 }),
    });
    if (res.ok) {
      // Refrescar sesiones abiertas
      const refreshed = await fetch("/api/cajon").then((r) => r.json());
      setSesionesAbiertas(refreshed.sesionesAbiertas ?? []);
      setCajones(refreshed.cajones ?? cajones);
      setCierreModal(null);
    } else {
      const d = await res.json();
      setCierreError(d.error ?? "Error al cerrar");
    }
    setCierreSaving(false);
  }

  const abiertos = cajones.filter((c) => c.estado === "abierto");
  const cerrados = cajones.filter((c) => c.estado === "cerrado");

  // Sesiones abiertas atascadas = open sessions NOT in today's filtered list
  const idsEnLista = new Set(cajones.map((c) => c.id));
  const atascadas = sesionesAbiertas.filter((s) => !idsEnLista.has(s.id));

  function calcSaldoMovimientos(c: Cajon) {
    const ingresos = c.movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const gastos = c.movimientos.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
    return { ingresos, gastos };
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Cajones</h1>
        <Link
          href="/admin/analytics"
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          📊 Analítica
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          {empleados.length > 1 && (
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Empleado</label>
              <select
                value={empleadoFiltro}
                onChange={(e) => setEmpleadoFiltro(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              >
                <option value="">Todos</option>
                {empleados.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2 sm:col-span-1 flex items-end">
            <button
              onClick={aplicarFiltros}
              disabled={loadingFiltro}
              className="w-full sm:w-auto bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 min-h-[44px]"
            >
              {loadingFiltro ? "Cargando..." : "Filtrar"}
            </button>
          </div>
        </div>
      </div>

      {/* Cajas bloqueadas — open sessions from previous days */}
      {sesionesAbiertas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
            Cajas sin cerrar ({sesionesAbiertas.length})
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Estas sesiones están abiertas y bloquean a los empleados para iniciar una nueva caja.
          </p>
          <div className="space-y-3">
            {sesionesAbiertas.map((c) => {
              const diasAbierto = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
              return (
                <div key={c.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.user?.name ?? "—"}</p>
                    {c.user?.sucursal && <p className="text-xs text-gray-500">{c.user.sucursal.nombre}</p>}
                    <p className="text-xs text-red-600 mt-0.5">
                      Abierta el {new Date(c.createdAt).toLocaleDateString("es-AR")} a las{" "}
                      {new Date(c.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      {diasAbierto > 0 && ` · hace ${diasAbierto} día${diasAbierto !== 1 ? "s" : ""}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Saldo inicial: ${c.saldoInicial.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => { setCierreModal(c); setCierreImporte("0"); setCierreError(""); }}
                    className="bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 shrink-0 min-h-[44px]"
                  >
                    Cerrar caja
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cajones.length === 0 && sesionesAbiertas.length === 0 && (
        <div className="text-center text-gray-400 py-12">No hay cajones para el período seleccionado</div>
      )}

      {abiertos.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-2">En curso ({abiertos.length})</h2>
          <div className="space-y-3">
            {abiertos.map((c) => {
              const { ingresos, gastos } = calcSaldoMovimientos(c);
              return (
                <div key={c.id} className="bg-white border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.user?.name ?? "—"}</p>
                    {c.user?.sucursal && <p className="text-xs text-gray-500">{c.user.sucursal.nombre}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString("es-AR")} {new Date(c.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-500">Inicio: <span className="font-medium">${c.saldoInicial.toLocaleString()}</span></div>
                    {gastos > 0 && <div className="text-xs text-red-600">Gastos: −${gastos.toLocaleString()}</div>}
                    {ingresos > 0 && <div className="text-xs text-green-600">Ingresos: +${ingresos.toLocaleString()}</div>}
                    <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Abierto</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cerrados.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Cerrados ({cerrados.length})</h2>
          <div className="space-y-3">
            {cerrados.map((c) => {
              const gastos = c.movimientos.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.user?.name ?? "—"}</p>
                    {c.user?.sucursal && <p className="text-xs text-gray-500">{c.user.sucursal.nombre}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString("es-AR")} {new Date(c.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-500">Inicio: ${c.saldoInicial.toLocaleString()}</div>
                    {gastos > 0 && <div className="text-xs text-red-600">Gastos: −${gastos.toLocaleString()}</div>}
                    {c.saldoFinal !== null && <div className="text-xs text-gray-600">Contado: ${c.saldoFinal.toLocaleString()}</div>}
                    <Link href={`/cajon/${c.id}/reporte`} className="inline-block bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium">
                      Ver reporte
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal forzar cierre */}
      {cierreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">Cerrar caja manualmente</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Caja de <strong>{cierreModal.user?.name}</strong> abierta el{" "}
              {new Date(cierreModal.createdAt).toLocaleDateString("es-AR")}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Saldo final contado (dejá en 0 si no se puede verificar)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={cierreImporte}
                  onChange={(e) => setCierreImporte(e.target.value)}
                  className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-lg font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            {cierreError && <p className="text-red-600 text-sm">{cierreError}</p>}
            <div className="flex gap-3">
              <button
                onClick={forzarCierre}
                disabled={cierreSaving}
                className="flex-1 bg-red-600 text-white py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cierreSaving ? "Cerrando..." : "Confirmar cierre"}
              </button>
              <button
                onClick={() => setCierreModal(null)}
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

function ResumenMovimientos({ movimientos }: { movimientos: Movimiento[] }) {
  if (movimientos.length === 0) {
    return <div className="text-center text-gray-400 py-6 text-sm">Sin movimientos registrados</div>;
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="font-semibold text-sm">Movimientos del día</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {movimientos.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`text-lg ${m.tipo === "ingreso" ? "text-green-500" : "text-red-500"}`}>
                {m.tipo === "ingreso" ? "↑" : "↓"}
              </span>
              <div>
                <p className="text-sm font-medium">{m.concepto?.nombre ?? m.descripcion ?? "—"}</p>
                <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
            <span className={`font-semibold ${m.tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>
              {m.tipo === "ingreso" ? "+" : "−"}${m.monto.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
