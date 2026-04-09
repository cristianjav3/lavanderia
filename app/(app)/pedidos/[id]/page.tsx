"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ESTADO_LABELS, ESTADO_COLORS, PAGO_COLORS, calcularCanastos } from "@/lib/constants";

type Pedido = {
  id: string;
  numero: number;
  estado: string;
  estadoPago: string;
  total: number;
  pagado: number;
  saldo: number;
  tipoEntrega: string;
  sucursal?: string;
  franjaHoraria?: string;
  fechaRetiro?: string;
  direccionEntrega?: string | null;
  telefonoContacto?: string | null;
  observacionEntrega?: string | null;
  createdAt: string;
  updatedAt: string;
  cliente: { id: string; nombre: string; telefono: string; direccion?: string };
  items: { id: string; tipo: string; cantidad: number; precioUnitario: number }[];
  paquetes: { id: string; tipo: string; numero: number; totalPaquetes: number }[];
  recepcion?: { notas?: string; requiereValidacion: boolean; empleado: { name: string } };
  observaciones: { id: string; texto: string; createdAt: string }[];
  entregas: { id: string; resultado: string; fechaIntento: string; recargo: number }[];
};

type Franja = { desde: string; hasta: string };
type DiaConfig = { dia: number; activo: boolean; franjas: Franja[] };

function jsDayToDia(jsDay: number): number {
  return (jsDay + 6) % 7;
}

const ESTADOS_PROGRESO = [
  "pendiente_recepcion", "por_lavar", "listo", "en_reparto", "entregado",
];

const ESTADOS_SIN_RETIRO = ["listo", "en_sucursal", "no_entregado"];

type LogEntry = {
  id: string;
  estadoAnterior: string;
  estadoNuevo: string;
  userName: string;
  motivo: string | null;
  createdAt: string;
};

export default function PedidoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [pago, setPago] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "tarjeta" | "mercadopago">("efectivo");
  const [accion, setAccion] = useState(false);
  const [printCount, setPrintCount] = useState<number | null>(null);

  // Phone edit state
  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [guardandoTel, setGuardandoTel] = useState(false);

  // Payment confirmation modal
  const [modalPago, setModalPago] = useState(false);

  // Manual state override
  const [estadoOverride, setEstadoOverride] = useState("");
  const [motivoOverride, setMotivoOverride] = useState("");
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Audit log
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mostrarLogs, setMostrarLogs] = useState(false);

  // Reagendar
  const [mostrarReagendar, setMostrarReagendar] = useState(false);
  const [reagFecha, setReagFecha] = useState("");
  const [reagFranja, setReagFranja] = useState("");
  const [reagDireccion, setReagDireccion] = useState("");
  const [reagTelefono, setReagTelefono] = useState("");
  const [reagObservacion, setReagObservacion] = useState("");
  const [reagGuardando, setReagGuardando] = useState(false);
  const [reagError, setReagError] = useState("");
  const [choferConfigs, setChoferConfigs] = useState<DiaConfig[]>([]);
  const [reagFranjasDisponibles, setReagFranjasDisponibles] = useState<Franja[]>([]);

  async function fetchPedido() {
    const res = await fetch(`/api/pedidos/${id}`);
    const data = await res.json();
    setPedido(data);
    setLoading(false);
  }

  async function fetchPrintCount() {
    const res = await fetch(`/api/pedidos/${id}/imprimir`);
    const data = await res.json();
    setPrintCount(data.printCount ?? 0);
  }

  async function fetchLogs() {
    const res = await fetch(`/api/pedidos/${id}/estado`);
    const data = await res.json();
    setLogs(data);
  }

  async function imprimirTicket() {
    const res = await fetch(`/api/pedidos/${id}/imprimir`, { method: "POST" });
    const data = await res.json();
    setPrintCount(data.printCount);
    router.push(`/impresion/${id}`);
  }

  useEffect(() => {
    fetchPedido();
    fetchPrintCount();
    fetchLogs();
    fetch("/api/admin/chofer-config")
      .then((r) => r.json())
      .then((data: DiaConfig[]) => setChoferConfigs(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Update available slots when reagendar date changes
  useEffect(() => {
    if (!reagFecha) { setReagFranjasDisponibles([]); return; }
    const jsDay = new Date(reagFecha + "T12:00:00").getDay();
    const dia = jsDayToDia(jsDay);
    const config = choferConfigs.find((c) => c.dia === dia);
    if (config && config.activo && Array.isArray(config.franjas)) {
      setReagFranjasDisponibles(config.franjas);
    } else {
      setReagFranjasDisponibles([]);
    }
    setReagFranja("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reagFecha, choferConfigs]);

  async function cambiarEstado(estado: string, motivo?: string) {
    setAccion(true);
    await fetch(`/api/pedidos/${id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, motivo }),
    });
    await fetchPedido();
    await fetchLogs();
    setAccion(false);
  }

  // Opens the confirmation modal instead of posting directly
  function solicitarPago() {
    if (!pago || parseFloat(pago) <= 0) return;
    setModalPago(true);
  }

  async function confirmarPago() {
    setModalPago(false);
    setAccion(true);
    await fetch(`/api/pedidos/${id}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: pago, metodoPago }),
    });
    setPago("");
    await fetchPedido();
    setAccion(false);
  }

  async function aplicarOverrideEstado() {
    if (!estadoOverride) return;
    setCambiandoEstado(true);
    await cambiarEstado(estadoOverride, motivoOverride.trim() || "Corrección manual");
    setEstadoOverride("");
    setMotivoOverride("");
    setCambiandoEstado(false);
  }

  async function generarPaquetes() {
    setAccion(true);
    const res = await fetch(`/api/pedidos/${id}/paquetes`, { method: "POST" });
    const data = await res.json();
    alert(`${data.paquetes} paquetes generados`);
    await fetchPedido();
    setAccion(false);
  }

  async function marcarEntrega(resultado: string, cambiarASucursal?: boolean) {
    if (resultado === "entregado" && pedido?.estadoPago !== "pagado") {
      const ok = confirm(`Hay un saldo pendiente de $${pedido?.saldo.toLocaleString()}. ¿El cliente está pagando ahora al retirar?`);
      if (!ok) return;
    }
    setAccion(true);
    await fetch(`/api/pedidos/${id}/entrega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado, cambiarASucursal, metodoPago }),
    });
    await fetchPedido();
    await fetchLogs();
    setAccion(false);
  }

  async function guardarTelefono() {
    if (!pedido || !nuevoTelefono.trim()) return;
    setGuardandoTel(true);
    await fetch(`/api/clientes/${pedido.cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: nuevoTelefono.trim() }),
    });
    setEditandoTelefono(false);
    setGuardandoTel(false);
    await fetchPedido();
  }

  // WhatsApp helpers
  function abrirWA(mensaje: string) {
    if (!pedido) return;
    const tel = pedido.cliente.telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, "_blank");
  }

  function waRecordatorio() {
    if (!pedido) return;
    abrirWA(`Hola ${pedido.cliente.nombre}, le recordamos que tiene un pedido de lavandería en proceso. Total: $${pedido.total.toLocaleString()}.`);
  }

  function waEstadoLavado() {
    if (!pedido) return;
    abrirWA(`Hola ${pedido.cliente.nombre}, su ropa está siendo lavada. Le avisamos cuando esté lista para retirar.`);
  }

  function waListoParaRetiro() {
    if (!pedido) return;
    abrirWA(
      `Hola ${pedido.cliente.nombre}, su pedido de lavandería está LISTO para retirar. Total: $${pedido.total.toLocaleString()}. Saldo pendiente: $${pedido.saldo.toLocaleString()}.`
    );
  }

  function waRecordarRetiroPendiente() {
    if (!pedido) return;
    const dias = Math.floor((Date.now() - new Date(pedido.updatedAt).getTime()) / 86400000);
    abrirWA(
      `Hola ${pedido.cliente.nombre}, su ropa lleva ${dias} día${dias !== 1 ? "s" : ""} lista en nuestra lavandería. Por favor pase a retirarla. Saldo pendiente: $${pedido.saldo.toLocaleString()}.`
    );
  }

  function waTicket() {
    if (!pedido) return;
    const fecha = new Date(pedido.createdAt).toLocaleDateString("es-AR");
    const itemsTexto = pedido.items
      .map((item) => {
        const unidades = item.tipo === "canasto" ? calcularCanastos(item.cantidad) : item.cantidad;
        const sub = unidades * item.precioUnitario;
        return `• ${item.tipo === "canasto" ? `${unidades} canasto(s) (${item.cantidad} prendas)` : `${unidades} ${item.tipo}`}: $${sub.toLocaleString()}`;
      })
      .join("\n");
    abrirWA(
      `*TICKET LAVANDERÍA #${pedido.numero}*\n` +
      `Fecha: ${fecha}\n\n` +
      `*SERVICIOS:*\n${itemsTexto}\n\n` +
      `*Total: $${pedido.total.toLocaleString()}*\n` +
      `Pagado: $${pedido.pagado.toLocaleString()}\n` +
      (pedido.saldo > 0 ? `Saldo pendiente: $${pedido.saldo.toLocaleString()}\n` : "") +
      `\n¡Gracias por su confianza!`
    );
  }

  if (loading) return <div className="p-4 text-gray-400">Cargando...</div>;
  if (!pedido) return <div className="p-4 text-red-500">Pedido no encontrado</div>;

  const canGenPaquetes = ["por_lavar", "listo"].includes(pedido.estado);
  const diasSinRetiro = Math.floor((Date.now() - new Date(pedido.updatedAt).getTime()) / 86400000);
  const necesitaDeposito = ESTADOS_SIN_RETIRO.includes(pedido.estado) && diasSinRetiro >= 7;

  async function enviarADomicilio() {
    setAccion(true);
    await fetch(`/api/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoEntrega: "domicilio" }),
    });
    await cambiarEstado("en_reparto");
    setAccion(false);
  }

  function abrirReagendar() {
    if (!pedido) return;
    setReagFecha(pedido.fechaRetiro ? pedido.fechaRetiro.split("T")[0] : "");
    setReagFranja(pedido.franjaHoraria ?? "");
    setReagDireccion(pedido.direccionEntrega ?? pedido.cliente.direccion ?? "");
    setReagTelefono(pedido.telefonoContacto ?? pedido.cliente.telefono ?? "");
    setReagObservacion(pedido.observacionEntrega ?? "");
    setReagError("");
    setMostrarReagendar(true);
  }

  async function confirmarReagendar() {
    if (!reagFecha) { setReagError("La fecha es obligatoria"); return; }
    if (!reagDireccion.trim()) { setReagError("La dirección es obligatoria"); return; }
    setReagGuardando(true);
    setReagError("");
    const res = await fetch(`/api/pedidos/${id}/reagendar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fechaRetiro: reagFecha,
        franjaHoraria: reagFranja || null,
        direccionEntrega: reagDireccion.trim(),
        telefonoContacto: reagTelefono.trim() || null,
        observacionEntrega: reagObservacion.trim() || null,
      }),
    });
    if (res.ok) {
      await fetchPedido();
      setMostrarReagendar(false);
    } else {
      setReagError("Error al reagendar");
    }
    setReagGuardando(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Pedido #{pedido.numero}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[pedido.estado]}`}>
              {ESTADO_LABELS[pedido.estado]}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAGO_COLORS[pedido.estadoPago]}`}>
              {pedido.estadoPago}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{new Date(pedido.createdAt).toLocaleString("es-AR")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          {pedido.estado === "pendiente_recepcion" && (
            <Link href={`/recepcion/${id}`} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 min-h-[44px] flex items-center">
              Recepcionar
            </Link>
          )}
          <div className="flex flex-col items-start sm:items-end gap-1">
            <button
              onClick={imprimirTicket}
              className="bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-gray-800 flex items-center gap-1.5 min-h-[44px]"
            >
              🖨️ {printCount !== null && printCount > 0 ? "Reimprimir ticket" : "Imprimir ticket"}
            </button>
            {printCount !== null && (
              <span className="text-xs text-gray-400">
                Impreso: <strong className="text-gray-600">{printCount}</strong> {printCount === 1 ? "vez" : "veces"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerta 7 días sin retiro */}
      {necesitaDeposito && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-800">Pedido sin retirar hace {diasSinRetiro} días</p>
            <p className="text-sm text-amber-700 mt-0.5">Se recomienda mover a depósito y notificar al cliente.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={waRecordarRetiroPendiente}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
            >
              📱 Recordar
            </button>
            <button
              onClick={() => cambiarEstado("deposito")}
              disabled={accion}
              className="bg-amber-600 text-white px-3 py-1.5 rounded text-sm hover:bg-amber-700 disabled:opacity-50"
            >
              Mover a depósito
            </button>
          </div>
        </div>
      )}

      {/* Datos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cliente */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">Cliente</h2>
          <p className="font-bold">{pedido.cliente.nombre}</p>

          {/* Teléfono editable */}
          {editandoTelefono ? (
            <div className="flex gap-1.5 mt-1">
              <input
                type="tel"
                value={nuevoTelefono}
                onChange={(e) => setNuevoTelefono(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                autoFocus
              />
              <button
                onClick={guardarTelefono}
                disabled={guardandoTel}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditandoTelefono(false)}
                className="border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm">{pedido.cliente.telefono}</p>
              <button
                onClick={() => { setNuevoTelefono(pedido.cliente.telefono); setEditandoTelefono(true); }}
                className="text-xs text-blue-500 hover:underline"
              >
                Editar
              </button>
            </div>
          )}

          {pedido.cliente.direccion && <p className="text-sm text-gray-500 mt-0.5">{pedido.cliente.direccion}</p>}

          {/* WhatsApp buttons */}
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">WhatsApp</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={waRecordatorio} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 min-h-[36px]">
                Recordatorio
              </button>
              <button onClick={waEstadoLavado} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 min-h-[36px]">
                Estado de lavado
              </button>
              <button onClick={waListoParaRetiro} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 min-h-[36px]">
                Listo para retiro
              </button>
              <button onClick={waRecordarRetiroPendiente} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 min-h-[36px]">
                Retiro pendiente
              </button>
              <button onClick={waTicket} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 min-h-[36px]">
                Enviar ticket
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">Pago</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Total</span><strong>${pedido.total.toLocaleString()}</strong></div>
            <div className="flex justify-between"><span>Pagado</span><span className="text-green-600">${pedido.pagado.toLocaleString()}</span></div>
            <div className="flex justify-between border-t pt-1"><span>Saldo</span><strong className="text-red-600">${pedido.saldo.toLocaleString()}</strong></div>
          </div>
          {pedido.saldo > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {(["efectivo", "tarjeta", "mercadopago"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[36px] ${metodoPago === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"}`}
                  >
                    {m === "efectivo" ? "Efectivo" : m === "tarjeta" ? "Tarjeta" : "Mercado Pago"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Monto"
                  value={pago}
                  onChange={(e) => setPago(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm flex-1 min-h-[44px]"
                />
                <button onClick={solicitarPago} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
                  Registrar pago
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Items</h2>
        <div className="space-y-2">
          {pedido.items.map((item) => {
            const unidades = item.tipo === "canasto" ? calcularCanastos(item.cantidad) : item.cantidad;
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium capitalize">{item.tipo}</p>
                  <p className="text-xs text-gray-500">
                    {item.tipo === "canasto"
                      ? `${item.cantidad} prendas → ${unidades} canasto${unidades !== 1 ? "s" : ""}`
                      : `${item.cantidad} unidad${item.cantidad !== 1 ? "es" : ""}`}
                    {" · "}${item.precioUnitario.toLocaleString()} c/u
                  </p>
                </div>
                <span className="text-sm font-semibold shrink-0">${(unidades * item.precioUnitario).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entrega */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Entrega</h2>
          {pedido.tipoEntrega === "domicilio" && (
            <button
              onClick={abrirReagendar}
              className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100"
            >
              Reagendar
            </button>
          )}
        </div>
        <p className="text-sm"><strong>Tipo:</strong> {pedido.tipoEntrega}</p>
        {pedido.sucursal && <p className="text-sm"><strong>Sucursal:</strong> {pedido.sucursal}</p>}
        {pedido.fechaRetiro && (
          <p className="text-sm">
            <strong>Fecha retiro:</strong> {new Date(pedido.fechaRetiro).toLocaleDateString("es-AR")}{" "}
            {pedido.franjaHoraria && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs ml-1">{pedido.franjaHoraria}</span>}
          </p>
        )}
        {pedido.tipoEntrega === "domicilio" && (
          <div className="mt-2 space-y-0.5 text-sm">
            {(pedido.direccionEntrega || pedido.cliente.direccion) && (
              <p><strong>Dirección:</strong> {pedido.direccionEntrega ?? pedido.cliente.direccion}</p>
            )}
            {(pedido.telefonoContacto || pedido.cliente.telefono) && (
              <p><strong>Teléfono contacto:</strong> {pedido.telefonoContacto ?? pedido.cliente.telefono}</p>
            )}
            {pedido.observacionEntrega && (
              <p className="text-gray-600 italic"><strong>Obs.:</strong> {pedido.observacionEntrega}</p>
            )}
          </div>
        )}
      </div>

      {/* Modal: Reagendar */}
      {mostrarReagendar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">Reagendar entrega</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={reagFecha}
                    onChange={(e) => setReagFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Franja horaria</label>
                  <select
                    value={reagFranja}
                    onChange={(e) => setReagFranja(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    disabled={!reagFecha}
                  >
                    <option value="">-- Sin franja --</option>
                    {reagFranjasDisponibles.map((f, i) => (
                      <option key={i} value={`${f.desde} - ${f.hasta}`}>
                        {f.desde} – {f.hasta}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dirección de entrega *</label>
                <input
                  type="text"
                  value={reagDireccion}
                  onChange={(e) => setReagDireccion(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Teléfono de contacto</label>
                <input
                  type="tel"
                  value={reagTelefono}
                  onChange={(e) => setReagTelefono(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones para el chofer</label>
                <textarea
                  value={reagObservacion}
                  onChange={(e) => setReagObservacion(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                />
              </div>
              {reagError && <p className="text-red-600 text-sm">{reagError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmarReagendar}
                disabled={reagGuardando}
                className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {reagGuardando ? "Guardando..." : "Confirmar"}
              </button>
              <button
                onClick={() => setMostrarReagendar(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded font-medium hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paquetes */}
      {pedido.paquetes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2">Paquetes ({pedido.paquetes.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pedido.paquetes.map((p) => (
              <span key={p.id} className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm">
                {p.tipo} {p.numero}/{p.totalPaquetes}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recepción info */}
      {pedido.recepcion && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2">Recepción</h2>
          <p className="text-sm"><strong>Empleado:</strong> {pedido.recepcion.empleado.name}</p>
          {pedido.recepcion.notas && <p className="text-sm"><strong>Notas:</strong> {pedido.recepcion.notas}</p>}
          {pedido.recepcion.requiereValidacion && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Requiere validación</span>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Acciones</h2>
        <div className="flex flex-wrap gap-2.5">

          {canGenPaquetes && pedido.paquetes.length === 0 && (
            <button onClick={generarPaquetes} disabled={accion} className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]">
              Generar paquetes
            </button>
          )}

          {pedido.estado === "por_lavar" && (
            <button onClick={() => cambiarEstado("listo")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
              ✓ Listo para retirar
            </button>
          )}

          {pedido.estado === "listo" && pedido.tipoEntrega === "sucursal" && (
            <>
              <button onClick={() => marcarEntrega("entregado")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
                ✓ Retirado en local
              </button>
              <button onClick={enviarADomicilio} disabled={accion} className="bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 min-h-[44px]">
                Enviar a domicilio
              </button>
              <button onClick={() => cambiarEstado("validacion")} disabled={accion} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 min-h-[44px]">
                Validar con cliente
              </button>
            </>
          )}

          {pedido.estado === "listo" && pedido.tipoEntrega === "domicilio" && (
            <>
              <button onClick={() => cambiarEstado("en_reparto")} disabled={accion} className="bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 min-h-[44px]">
                Enviar a reparto
              </button>
              <button onClick={() => cambiarEstado("validacion")} disabled={accion} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 min-h-[44px]">
                Validar con cliente
              </button>
            </>
          )}

          {pedido.estado === "en_reparto" && (
            <>
              <button onClick={() => marcarEntrega("entregado")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
                ✓ Entregado
              </button>
              <button onClick={() => marcarEntrega("no_entregado")} disabled={accion} className="bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 min-h-[44px]">
                ✗ No entregado (+$2.500)
              </button>
              <button onClick={() => marcarEntrega("no_entregado", true)} disabled={accion} className="bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 min-h-[44px]">
                Devolver a sucursal
              </button>
            </>
          )}

          {pedido.estado === "en_sucursal" && (
            <>
              <button onClick={() => marcarEntrega("entregado")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
                ✓ Retirado en local
              </button>
              <button onClick={() => cambiarEstado("validacion")} disabled={accion} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 min-h-[44px]">
                Validar con cliente
              </button>
            </>
          )}

          {pedido.estado === "deposito" && (
            <button onClick={() => marcarEntrega("entregado")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
              ✓ Retirado de depósito
            </button>
          )}

          {pedido.estado === "validacion" && (
            <button onClick={() => cambiarEstado("listo")} disabled={accion} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px]">
              ✓ Validado — marcar listo
            </button>
          )}

        </div>

        {pedido.entregas.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-gray-500 mb-1">Historial de entregas</p>
            {pedido.entregas.map((e) => (
              <p key={e.id} className="text-xs">
                {new Date(e.fechaIntento).toLocaleString("es-AR")} — {e.resultado}
                {e.recargo > 0 && ` (recargo $${e.recargo.toLocaleString()})`}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Corrección de estado */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold mb-1">Corrección de estado</h2>
        <p className="text-xs text-gray-400 mb-3">Para corregir errores. El cambio queda registrado en la auditoría.</p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nuevo estado</label>
            <select
              value={estadoOverride}
              onChange={(e) => setEstadoOverride(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            >
              <option value="">— Seleccionar —</option>
              <option value="por_lavar">Por lavar</option>
              <option value="listo">Listo</option>
              <option value="en_reparto">En reparto</option>
              <option value="no_entregado">No entregado</option>
              <option value="en_sucursal">En sucursal</option>
              <option value="deposito">Depósito</option>
              <option value="validacion">Validación</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">Motivo (recomendado)</label>
            <input
              type="text"
              value={motivoOverride}
              onChange={(e) => setMotivoOverride(e.target.value)}
              placeholder="Ej: Error al marcar estado"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <button
            onClick={aplicarOverrideEstado}
            disabled={!estadoOverride || cambiandoEstado}
            className="bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 min-h-[44px]"
          >
            Aplicar cambio
          </button>
        </div>
      </div>

      {/* Auditoría de cambios de estado */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <button
          onClick={() => setMostrarLogs(!mostrarLogs)}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="font-semibold">Auditoría de estados</h2>
          <span className="text-xs text-gray-400">{logs.length} registro{logs.length !== 1 ? "s" : ""} {mostrarLogs ? "▲" : "▼"}</span>
        </button>
        {mostrarLogs && (
          <div className="mt-3 space-y-1.5">
            {logs.length === 0 && (
              <p className="text-xs text-gray-400">Sin registros aún.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-t pt-1.5">
                <span className="text-gray-400 w-32 shrink-0">
                  {new Date(log.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-gray-500 shrink-0">{log.userName}</span>
                <span className="text-gray-400 shrink-0">
                  <span className="bg-gray-100 px-1 rounded">{ESTADO_LABELS[log.estadoAnterior] ?? log.estadoAnterior}</span>
                  {" → "}
                  <span className="bg-blue-50 text-blue-700 px-1 rounded">{ESTADO_LABELS[log.estadoNuevo] ?? log.estadoNuevo}</span>
                </span>
                {log.motivo && <span className="text-gray-400 italic">{log.motivo}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: confirmación de cobro */}
      {modalPago && pedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">Confirmar cobro</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente</span>
                <span className="font-medium">{pedido.cliente.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monto</span>
                <span className="font-bold text-green-700 text-base">${parseFloat(pago).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Método</span>
                <span className="font-medium capitalize">
                  {metodoPago === "efectivo" ? "Efectivo" : metodoPago === "tarjeta" ? "Tarjeta" : "Mercado Pago"}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">Saldo restante</span>
                <span className="font-medium text-red-600">
                  ${Math.max(0, pedido.saldo - parseFloat(pago)).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={confirmarPago}
                className="flex-1 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700"
              >
                Confirmar
              </button>
              <button
                onClick={() => setModalPago(false)}
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
