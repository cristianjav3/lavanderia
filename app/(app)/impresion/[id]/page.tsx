"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ESTADO_LABELS, PAGO_COLORS, calcularCanastos } from "@/lib/constants";

type Item = { id: string; tipo: string; cantidad: number; precioUnitario: number };
type PedidoItem = { id: string; nombreProducto: string; precioUnitario: number; cantidad: number };
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
  createdAt: string;
  cliente: { nombre: string; telefono: string; direccion?: string };
  items: Item[];
  pedidoItems: PedidoItem[];
  recepcion?: { notas?: string };
  observaciones: { texto: string }[];
};

const TIPO_LABELS: Record<string, string> = {
  canasto: "Ropa (canastos)",
  acolchado: "Acolchado",
  zapatillas: "Zapatillas",
  secado: "Secado",
};

export default function ImpresionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [printCount, setPrintCount] = useState<number | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/pedidos/${id}`)
      .then((r) => r.json())
      .then((data: Pedido) => {
        setPedido(data);
        setLoading(false);
        if (typeof window !== "undefined" && sessionStorage.getItem(`imprimir_${id}`)) {
          sessionStorage.removeItem(`imprimir_${id}`);
          setShowPrintPrompt(true);
        }
      });
    fetch(`/api/pedidos/${id}/imprimir`)
      .then((r) => r.json())
      .then((data) => setPrintCount(data.printCount ?? 0));
  }, [id]);

  async function registrarImpresion() {
    const res = await fetch(`/api/pedidos/${id}/imprimir`, { method: "POST" });
    const data = await res.json();
    setPrintCount(data.printCount);
    window.print();
  }

  function enviarTicketWA() {
    if (!pedido) return;
    const tel = pedido.cliente.telefono.replace(/\D/g, "");
    const fecha = new Date(pedido.createdAt);
    const fechaStr = fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaStr = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const itemsTexto = [
      ...pedido.items.map((item) => {
        const unidades = item.tipo === "canasto" ? calcularCanastos(item.cantidad) : item.cantidad;
        const sub = unidades * item.precioUnitario;
        const label = item.tipo === "canasto"
          ? `${unidades} canasto${unidades > 1 ? "s" : ""} (${item.cantidad} prendas)`
          : `${unidades} ${TIPO_LABELS[item.tipo] ?? item.tipo}`;
        return `• ${label}: $${sub.toLocaleString()}`;
      }),
      ...(pedido.pedidoItems ?? []).map((pi) =>
        `• ${pi.cantidad > 1 ? `${pi.cantidad}x ` : ""}${pi.nombreProducto}: $${(pi.precioUnitario * pi.cantidad).toLocaleString()}`
      ),
    ].join("\n");

    const entregaTexto = pedido.tipoEntrega === "domicilio"
      ? `🚚 Entrega a domicilio${pedido.fechaRetiro ? `\n📅 Fecha: ${new Date(pedido.fechaRetiro).toLocaleDateString("es-AR")}` : ""}${pedido.franjaHoraria ? `\n🕐 Horario: ${pedido.franjaHoraria}` : ""}${pedido.cliente.direccion ? `\n📍 Dirección: ${pedido.cliente.direccion}` : ""}`
      : `🏪 Retiro en sucursal${pedido.sucursal ? `: ${pedido.sucursal}` : ""}`;

    const observacionesTexto = pedido.observaciones.length > 0
      ? `\n\n📝 *OBSERVACIONES*\n${pedido.observaciones.map((o) => `• ${o.texto}`).join("\n")}`
      : "";

    const pagoEstado = pedido.estadoPago === "pagado"
      ? "✅ PAGADO"
      : pedido.estadoPago === "parcial"
      ? "⚠️ PAGO PARCIAL"
      : "❌ PAGO PENDIENTE";

    const msg = encodeURIComponent(
      `🧺 *TICKET LAVANDERÍA #${pedido.numero}*\n` +
      `📅 ${fechaStr} — 🕐 ${horaStr}\n` +
      `──────────────────\n\n` +
      `👤 *CLIENTE*\n` +
      `Nombre: ${pedido.cliente.nombre}\n` +
      `Tel: ${pedido.cliente.telefono}\n\n` +
      `📦 *SERVICIOS*\n${itemsTexto}\n\n` +
      `🚀 *ENTREGA*\n${entregaTexto}` +
      observacionesTexto + `\n\n` +
      `──────────────────\n` +
      `💰 *RESUMEN DE PAGO*\n` +
      `Total: $${pedido.total.toLocaleString()}\n` +
      `Pagado: $${pedido.pagado.toLocaleString()}\n` +
      (pedido.saldo > 0 ? `Saldo pendiente: *$${pedido.saldo.toLocaleString()}*\n` : "") +
      `Estado: ${pagoEstado}\n\n` +
      `¡Gracias por confiar en nosotros! 🙏`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>;
  if (!pedido) return <div className="p-8 text-red-500">Pedido no encontrado</div>;

  const fechaOp = new Date(pedido.createdAt);
  const qrData = `Pedido #${pedido.numero} | ${pedido.cliente.nombre} | ${pedido.cliente.telefono} | Total: $${pedido.total.toLocaleString()}`;

  return (
    <div>
      {/* Prompt de impresión al llegar desde confirmar */}
      {showPrintPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">¿Imprimir el ticket?</h2>
            <p className="text-sm text-gray-500">El pedido fue aceptado. ¿Querés imprimir el ticket ahora?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPrintPrompt(false); registrarImpresion(); }}
                className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700"
              >
                Sí, imprimir
              </button>
              <button
                onClick={() => { setShowPrintPrompt(false); router.push(`/pedidos/${id}`); }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded font-medium hover:bg-gray-200"
              >
                No, omitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controles (no se imprimen) */}
      <div className="no-print flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={registrarImpresion}
          className="bg-gray-800 text-white px-5 py-2 rounded font-medium hover:bg-gray-900 flex items-center gap-2"
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={enviarTicketWA}
          className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700 flex items-center gap-2 text-sm"
        >
          📱 Enviar ticket por WhatsApp
        </button>
        <button
          onClick={() => router.push(`/pedidos/${id}`)}
          className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 text-sm"
        >
          ← Volver al pedido
        </button>
        {printCount !== null && (
          <span className="text-sm text-gray-500 ml-auto">
            Ticket impreso: <strong>{printCount}</strong> {printCount === 1 ? "vez" : "veces"}
          </span>
        )}
      </div>

      {/* Ticket */}
      <div className="ticket-wrapper">
        <div className="ticket" ref={ticketRef}>
          {/* Header: logo + QR */}
          <div className="ticket-header-row">
            <div className="ticket-logo">
              <div className="logo-placeholder">🧺</div>
              <div className="logo-nombre">LAVANDERÍA</div>
              <div className="logo-sub">Sistema de gestión</div>
            </div>
            <div className="ticket-qr">
              <QRCodeSVG value={qrData} size={80} level="M" />
              <div className="qr-label">#{pedido.numero}</div>
            </div>
          </div>

          <div className="ticket-divider" />

          {/* Número y fecha */}
          <div className="ticket-section ticket-center">
            <div className="ticket-numero">TICKET #{pedido.numero}</div>
            <div className="ticket-fecha">
              {fechaOp.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
              {" — "}
              {fechaOp.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          <div className="ticket-divider" />

          {/* Cliente */}
          <div className="ticket-section">
            <div className="ticket-label-section">CLIENTE</div>
            <div className="ticket-cliente-nombre">{pedido.cliente.nombre}</div>
            <div className="ticket-row-info">
              <span className="ticket-key">Tel:</span>
              <span>{pedido.cliente.telefono}</span>
            </div>
            {pedido.cliente.direccion && (
              <div className="ticket-row-info">
                <span className="ticket-key">Dir:</span>
                <span>{pedido.cliente.direccion}</span>
              </div>
            )}
          </div>

          <div className="ticket-divider" />

          {/* Servicios */}
          <div className="ticket-section">
            <div className="ticket-label-section">SERVICIOS</div>
            {pedido.items.map((item) => {
              const unidades = item.tipo === "canasto" ? calcularCanastos(item.cantidad) : item.cantidad;
              const subtotal = unidades * item.precioUnitario;
              return (
                <div key={item.id} className="ticket-row-precio">
                  <span>
                    {item.tipo === "canasto"
                      ? `${unidades} canasto${unidades > 1 ? "s" : ""} (${item.cantidad} prendas)`
                      : `${unidades} ${TIPO_LABELS[item.tipo] ?? item.tipo}`}
                  </span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
              );
            })}
            {pedido.pedidoItems?.map((pi) => (
              <div key={pi.id} className="ticket-row-precio">
                <span>{pi.cantidad > 1 ? `${pi.cantidad}x ` : ""}{pi.nombreProducto}</span>
                <span>${(pi.precioUnitario * pi.cantidad).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="ticket-divider" />

          {/* Entrega */}
          <div className="ticket-section">
            <div className="ticket-label-section">ENTREGA</div>
            <div className="ticket-row-info">
              <span className="ticket-key">Tipo:</span>
              <span className="capitalize">{pedido.tipoEntrega}</span>
            </div>
            {pedido.sucursal && (
              <div className="ticket-row-info">
                <span className="ticket-key">Sucursal:</span>
                <span>{pedido.sucursal}</span>
              </div>
            )}
            {pedido.fechaRetiro && (
              <div className="ticket-row-info">
                <span className="ticket-key">Fecha retiro:</span>
                <span>
                  {new Date(pedido.fechaRetiro).toLocaleDateString("es-AR")}
                  {pedido.franjaHoraria && ` — ${pedido.franjaHoraria}`}
                </span>
              </div>
            )}
          </div>

          <div className="ticket-divider" />

          {/* Pago */}
          <div className="ticket-section">
            <div className="ticket-label-section">PAGO</div>
            <div className="ticket-row-precio ticket-total">
              <span>TOTAL</span>
              <span>${pedido.total.toLocaleString()}</span>
            </div>
            <div className="ticket-row-precio">
              <span>Pagado</span>
              <span className="ticket-pagado">${pedido.pagado.toLocaleString()}</span>
            </div>
            {pedido.saldo > 0 && (
              <div className="ticket-row-precio ticket-saldo-row">
                <span>SALDO PENDIENTE</span>
                <span>${pedido.saldo.toLocaleString()}</span>
              </div>
            )}
            <div className="ticket-estado-pago">
              {pedido.estadoPago === "pagado"
                ? "✓ PAGADO"
                : pedido.estadoPago === "parcial"
                ? "⚠ PAGO PARCIAL"
                : "✗ PAGO PENDIENTE"}
            </div>
          </div>

          {/* Observaciones */}
          {pedido.observaciones.length > 0 && (
            <>
              <div className="ticket-divider" />
              <div className="ticket-section">
                <div className="ticket-label-section">OBSERVACIONES</div>
                {pedido.observaciones.map((o, i) => (
                  <p key={i} className="ticket-obs">{o.texto}</p>
                ))}
              </div>
            </>
          )}

          <div className="ticket-divider" />

          {/* Estado */}
          <div className="ticket-section ticket-center">
            <div className="ticket-estado-badge">
              {ESTADO_LABELS[pedido.estado] ?? pedido.estado}
            </div>
            <div className="ticket-gracias">¡Gracias por su confianza!</div>
          </div>
        </div>
      </div>

      <style>{`
        @page {
          size: 58mm auto;
          margin: 0;
        }

        @media print {
          .no-print { display: none !important; }
          body {
            width: 58mm;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .ticket-wrapper {
            display: block;
            padding: 0;
            margin: 0;
          }
          .ticket {
            width: 58mm;
            border: none;
            border-radius: 0;
            box-shadow: none;
          }
        }

        .ticket-wrapper {
          display: flex;
          justify-content: flex-start;
        }

        .ticket {
          width: 320px;
          background: white;
          border: 2px solid #1f2937;
          border-radius: 8px;
          overflow: hidden;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .ticket-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #1f2937;
          color: white;
        }

        .logo-placeholder {
          font-size: 28px;
          line-height: 1;
        }

        .logo-nombre {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 2px;
          margin-top: 2px;
        }

        .logo-sub {
          font-size: 9px;
          opacity: 0.6;
          letter-spacing: 1px;
        }

        .ticket-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: white;
          padding: 6px;
          border-radius: 4px;
        }

        .qr-label {
          font-size: 10px;
          font-weight: bold;
          color: #1f2937;
        }

        .ticket-section {
          padding: 10px 14px;
        }

        .ticket-center {
          text-align: center;
        }

        .ticket-numero {
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 2px;
        }

        .ticket-fecha {
          font-size: 11px;
          color: #555;
          margin-top: 2px;
        }

        .ticket-label-section {
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 2px;
          color: #888;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .ticket-cliente-nombre {
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 3px;
        }

        .ticket-row-info {
          display: flex;
          gap: 6px;
          font-size: 11px;
          margin: 2px 0;
          color: #333;
        }

        .ticket-key {
          color: #888;
          min-width: 28px;
        }

        .ticket-row-precio {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin: 3px 0;
        }

        .ticket-total {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
        }

        .ticket-pagado {
          color: #16a34a;
          font-weight: 600;
        }

        .ticket-saldo-row {
          font-weight: bold;
          color: #dc2626;
          border-top: 1px dashed #ccc;
          padding-top: 4px;
          margin-top: 4px;
        }

        .ticket-estado-pago {
          margin-top: 8px;
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          padding: 5px;
          border-radius: 4px;
          background: #f3f4f6;
          letter-spacing: 1px;
        }

        .ticket-obs {
          font-size: 11px;
          color: #555;
          margin: 2px 0;
          font-style: italic;
        }

        .ticket-divider {
          border-top: 1px dashed #d1d5db;
          margin: 0 14px;
        }

        .ticket-estado-badge {
          display: inline-block;
          background: #f3f4f6;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ticket-gracias {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 6px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
