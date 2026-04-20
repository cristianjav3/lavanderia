"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRECIOS, calcularCanastos } from "@/lib/constants";

type ItemForm = {
  tipo: "canasto" | "acolchado" | "zapatillas" | "secado";
  cantidad: number;
};

type PedidoItemForm = {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
};

type ClienteResult = {
  id: string;
  nombre: string;
  telefono: string;
  direccion?: string;
};

type Producto = {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  unidad: string | null;
};

type Sucursal = { id: string; nombre: string };
type Franja = { desde: string; hasta: string };
type DiaConfig = { dia: number; activo: boolean; franjas: Franja[] };

const SUCURSAL_DEFAULT_KEY = "lavanderia_sucursal_default";

function jsDayToDia(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export default function NuevoPedidoPage() {
  const router = useRouter();

  // ── Cliente: flujo teléfono primero ─────────────────────────────────────
  const [telefono, setTelefono] = useState("");
  const [busquedaResultados, setBusquedaResultados] = useState<ClienteResult[]>([]);
  const [clienteConfirmado, setClienteConfirmado] = useState<ClienteResult | null>(null);
  const [modoNuevoCliente, setModoNuevoCliente] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Items clásicos ───────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemForm[]>([]);

  // ── Productos de empresa ─────────────────────────────────────────────────
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidoItems, setPedidoItems] = useState<PedidoItemForm[]>([]);

  // ── Entrega ──────────────────────────────────────────────────────────────
  const [tipoEntrega, setTipoEntrega] = useState<"sucursal" | "domicilio">("sucursal");
  const [sucursal, setSucursal] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [fechaRetiro, setFechaRetiro] = useState("");
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [observacionEntrega, setObservacionEntrega] = useState("");
  const [choferConfigs, setChoferConfigs] = useState<DiaConfig[]>([]);
  const [franjasDisponibles, setFranjasDisponibles] = useState<Franja[]>([]);

  // ── Pago ─────────────────────────────────────────────────────────────────
  const [pagado, setPagado] = useState("0");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "tarjeta" | "mercadopago">("efectivo");

  // ── Observación del cliente ──────────────────────────────────────────────
  const [observacionCliente, setObservacionCliente] = useState("");

  // ── Estado general ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sucursales")
      .then((r) => r.json())
      .then((data: Sucursal[]) => {
        setSucursales(data);
        const saved = localStorage.getItem(SUCURSAL_DEFAULT_KEY);
        if (saved && data.find((s) => s.nombre === saved)) {
          setSucursal(saved);
        } else if (data.length > 0) {
          setSucursal(data[0].nombre);
        }
      });
    fetch("/api/admin/chofer-config")
      .then((r) => r.json())
      .then((data: DiaConfig[]) => setChoferConfigs(data));
    fetch("/api/admin/productos?activos=1")
      .then((r) => r.json())
      .then((data: Producto[]) => {
        if (Array.isArray(data)) setProductos(data);
      });
  }, []);

  useEffect(() => {
    if (!fechaRetiro) { setFranjasDisponibles([]); return; }
    const jsDay = new Date(fechaRetiro + "T12:00:00").getDay();
    const dia = jsDayToDia(jsDay);
    const config = choferConfigs.find((c) => c.dia === dia);
    if (config && config.activo && Array.isArray(config.franjas)) {
      setFranjasDisponibles(config.franjas);
    } else {
      setFranjasDisponibles([]);
    }
    setFranjaHoraria("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaRetiro, choferConfigs]);

  // ── Búsqueda por teléfono con debounce ──────────────────────────────────
  function handleTelefonoChange(val: string) {
    setTelefono(val);
    setClienteConfirmado(null);
    setModoNuevoCliente(false);
    setBusquedaResultados([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const digits = val.replace(/\D/g, "");
    if (digits.length < 6) { setBusqueda(false); return; }

    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setBusquedaResultados(Array.isArray(data) ? data : []);
      } catch {
        setBusquedaResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 400);
  }

  function setBusqueda(val: boolean) {
    setBuscando(val);
  }

  function confirmarCliente(c: ClienteResult) {
    setClienteConfirmado(c);
    setBusquedaResultados([]);
    if (c.direccion) setDireccionEntrega(c.direccion);
    setTelefonoContacto(c.telefono);
  }

  function iniciarNuevoCliente() {
    setModoNuevoCliente(true);
    setBusquedaResultados([]);
    setNombreNuevo("");
    setDireccionNueva("");
    setTelefonoContacto(telefono);
  }

  function resetCliente() {
    setClienteConfirmado(null);
    setModoNuevoCliente(false);
    setBusquedaResultados([]);
    setTelefono("");
  }

  // ── PedidoItems (productos) ─────────────────────────────────────────────
  function agregarProducto(p: Producto) {
    const exists = pedidoItems.findIndex((pi) => pi.productoId === p.id);
    if (exists >= 0) {
      const copy = [...pedidoItems];
      copy[exists].cantidad += 1;
      setPedidoItems(copy);
    } else {
      setPedidoItems([...pedidoItems, { productoId: p.id, nombre: p.nombre, precioUnitario: p.precio, cantidad: 1 }]);
    }
  }

  function cambiarCantidadProducto(idx: number, delta: number) {
    const copy = [...pedidoItems];
    copy[idx].cantidad = Math.max(1, copy[idx].cantidad + delta);
    setPedidoItems(copy);
  }

  function quitarProducto(idx: number) {
    setPedidoItems(pedidoItems.filter((_, i) => i !== idx));
  }

  // ── Cálculo de total ─────────────────────────────────────────────────────
  function calcularTotal() {
    let total = 0;
    for (const item of items) {
      if (item.tipo === "canasto") {
        total += calcularCanastos(item.cantidad) * PRECIOS.canasto;
      } else if (item.tipo === "acolchado") {
        total += item.cantidad * PRECIOS.acolchado;
      } else {
        total += item.cantidad * PRECIOS.canasto;
      }
    }
    for (const pi of pedidoItems) {
      total += pi.precioUnitario * pi.cantidad;
    }
    if (tipoEntrega === "domicilio") total += PRECIOS.retiro;
    return total;
  }

  const total = calcularTotal();
  const pagadoNum = parseFloat(pagado) || 0;
  const saldo = total - pagadoNum;
  const tieneItems = items.length > 0 || pedidoItems.length > 0;

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let idCliente = clienteConfirmado?.id ?? "";

      if (modoNuevoCliente) {
        if (!nombreNuevo.trim()) { setError("Nombre requerido"); setLoading(false); return; }
        if (!telefono.trim()) { setError("Teléfono requerido"); setLoading(false); return; }
        const res = await fetch("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: nombreNuevo.trim(), telefono: telefono.trim(), direccion: direccionNueva.trim() || undefined }),
        });
        if (!res.ok) { setError("Error al crear cliente"); setLoading(false); return; }
        const c = await res.json();
        idCliente = c.id;
      }

      if (!idCliente) { setError("Seleccioná un cliente"); setLoading(false); return; }
      if (!tieneItems) { setError("Agregá al menos un item o producto"); setLoading(false); return; }

      if (tipoEntrega === "domicilio") {
        if (pagadoNum < PRECIOS.retiro) {
          setError(`Se requiere mínimo $${PRECIOS.retiro.toLocaleString()} para retiro a domicilio`);
          setLoading(false); return;
        }
        if (!direccionEntrega.trim()) {
          setError("La dirección de entrega es obligatoria para envío a domicilio");
          setLoading(false); return;
        }
        if (!telefonoContacto.trim()) {
          setError("El teléfono de contacto es obligatorio para envío a domicilio");
          setLoading(false); return;
        }
      }

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: idCliente,
          items,
          pedidoItems,
          tipoEntrega,
          sucursal,
          fechaRetiro,
          franjaHoraria,
          pagado,
          metodoPago,
          direccionEntrega: tipoEntrega === "domicilio" ? direccionEntrega.trim() : null,
          telefonoContacto: tipoEntrega === "domicilio" ? telefonoContacto.trim() : null,
          observacionEntrega: tipoEntrega === "domicilio" ? observacionEntrega.trim() || null : null,
          observacionCliente: observacionCliente.trim() || null,
        }),
      });

      if (!res.ok) { setError("Error al crear pedido"); setLoading(false); return; }
      const pedido = await res.json();
      if (tipoEntrega === "sucursal") {
        router.push(`/pedidos/${pedido.id}/confirmar`);
      } else {
        router.push(`/pedidos/${pedido.id}`);
      }
    } catch {
      setError("Error inesperado");
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">Nuevo pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── CLIENTE (teléfono primero) ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Cliente</h2>

          {/* Paso 1: teléfono confirmado o cliente confirmado */}
          {clienteConfirmado ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div>
                <p className="font-medium text-green-800">{clienteConfirmado.nombre}</p>
                <p className="text-xs text-green-600">{clienteConfirmado.telefono}</p>
              </div>
              <button type="button" onClick={resetCliente} className="text-xs text-gray-400 hover:underline">
                Cambiar
              </button>
            </div>
          ) : modoNuevoCliente ? (
            /* Paso 3b: nuevo cliente */
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <span className="text-blue-700 text-sm font-medium">Teléfono:</span>
                <span className="text-blue-900 text-sm">{telefono}</span>
              </div>
              <input
                autoFocus
                placeholder="Nombre del cliente *"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                placeholder="Dirección (opcional)"
                value={direccionNueva}
                onChange={(e) => setDireccionNueva(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <button type="button" onClick={resetCliente} className="text-gray-400 text-xs hover:underline">
                ← Cambiar teléfono
              </button>
            </div>
          ) : (
            /* Paso 1: ingresar teléfono */
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="tel"
                  autoFocus
                  value={telefono}
                  onChange={(e) => handleTelefonoChange(e.target.value)}
                  placeholder="Número de teléfono..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {buscando && (
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>
                )}
              </div>

              {/* Paso 2: resultados encontrados */}
              {busquedaResultados.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <p className="text-xs text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    ¿Es alguno de estos clientes?
                  </p>
                  {busquedaResultados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => confirmarCliente(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-gray-400 ml-2 text-xs">{c.telefono}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={iniciarNuevoCliente}
                    className="w-full text-left px-3 py-2 text-blue-600 text-sm hover:bg-blue-50 font-medium"
                  >
                    + No es ninguno — crear nuevo cliente
                  </button>
                </div>
              )}

              {/* Sin resultados después de buscar */}
              {!buscando && telefono.replace(/\D/g, "").length >= 6 && busquedaResultados.length === 0 && (
                <button
                  type="button"
                  onClick={iniciarNuevoCliente}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Cliente nuevo con este teléfono
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── PRODUCTOS DE EMPRESA ───────────────────────────────────────── */}
        {productos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">Productos</h2>

            {/* Lista de productos disponibles */}
            <div className="grid grid-cols-2 gap-2">
              {productos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{p.nombre}</p>
                    {p.unidad && <p className="text-xs text-gray-400">{p.unidad}</p>}
                  </div>
                  <span className="text-sm font-semibold text-blue-700">${p.precio.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ITEMS CLÁSICOS ─────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Servicios</h2>
            <button
              type="button"
              onClick={() => setItems([...items, { tipo: "canasto", cantidad: 12 }])}
              className="text-blue-600 text-sm hover:underline"
            >
              + Agregar
            </button>
          </div>

          {items.length === 0 && pedidoItems.length === 0 && (
            <p className="text-xs text-gray-400">Agregá servicios o seleccioná productos arriba.</p>
          )}

          {/* Productos seleccionados desde la grilla */}
          {pedidoItems.map((pi, i) => (
            <div key={`prod-${i}`} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded px-3 py-2">
              <span className="text-sm font-medium flex-1">{pi.nombre}</span>
              <span className="text-xs text-gray-500">${pi.precioUnitario.toLocaleString()} c/u</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => cambiarCantidadProducto(i, -1)}
                  className="w-5 h-5 rounded bg-white border border-gray-300 text-xs font-bold hover:bg-gray-50 flex items-center justify-center">−</button>
                <span className="text-sm font-medium w-4 text-center">{pi.cantidad}</span>
                <button type="button" onClick={() => cambiarCantidadProducto(i, 1)}
                  className="w-5 h-5 rounded bg-white border border-gray-300 text-xs font-bold hover:bg-gray-50 flex items-center justify-center">+</button>
              </div>
              <span className="text-sm font-semibold text-blue-700 w-20 text-right">
                ${(pi.precioUnitario * pi.cantidad).toLocaleString()}
              </span>
              <button type="button" onClick={() => quitarProducto(i)} className="text-red-400 text-xs hover:text-red-600">✕</button>
            </div>
          ))}

          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={item.tipo}
                onChange={(e) => {
                  const copy = [...items];
                  copy[i].tipo = e.target.value as ItemForm["tipo"];
                  setItems(copy);
                }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="canasto">Canasto (ropa)</option>
                <option value="acolchado">Acolchado</option>
                <option value="zapatillas">Zapatillas</option>
                <option value="secado">Secado</option>
              </select>
              <input
                type="number"
                min={1}
                value={item.cantidad}
                onChange={(e) => {
                  const copy = [...items];
                  copy[i].cantidad = parseInt(e.target.value) || 1;
                  setItems(copy);
                }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20"
              />
              <span className="text-xs text-gray-500">
                {item.tipo === "canasto"
                  ? `${calcularCanastos(item.cantidad)} canasto(s) × $${PRECIOS.canasto.toLocaleString()}`
                  : item.tipo === "acolchado"
                  ? `$${(item.cantidad * PRECIOS.acolchado).toLocaleString()}`
                  : `$${(item.cantidad * PRECIOS.canasto).toLocaleString()}`}
              </span>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-red-400 text-xs hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* ── ENTREGA ───────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Entrega</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="sucursal" checked={tipoEntrega === "sucursal"} onChange={() => setTipoEntrega("sucursal")} />
              Retiro en sucursal
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="domicilio" checked={tipoEntrega === "domicilio"} onChange={() => setTipoEntrega("domicilio")} />
              A domicilio (+${PRECIOS.retiro.toLocaleString()})
            </label>
          </div>

          {tipoEntrega === "sucursal" && (
            <div className="space-y-2">
              {sucursales.length > 0 ? (
                <select value={sucursal} onChange={(e) => setSucursal(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">-- Seleccionar sucursal --</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              ) : (
                <input placeholder="Nombre de sucursal" value={sucursal} onChange={(e) => setSucursal(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              )}
              {sucursal && (
                <button type="button" onClick={() => localStorage.setItem(SUCURSAL_DEFAULT_KEY, sucursal)}
                  className="text-xs text-gray-500 hover:underline">
                  Guardar como mi sucursal por defecto
                </button>
              )}
            </div>
          )}

          {tipoEntrega === "domicilio" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="date" value={fechaRetiro} onChange={(e) => setFechaRetiro(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm" />
                <select value={franjaHoraria} onChange={(e) => setFranjaHoraria(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm" disabled={!fechaRetiro}>
                  <option value="">-- Franja horaria --</option>
                  {franjasDisponibles.length === 0 && fechaRetiro && (
                    <option disabled value="">Sin franjas disponibles</option>
                  )}
                  {franjasDisponibles.map((f, i) => (
                    <option key={i} value={`${f.desde} - ${f.hasta}`}>{f.desde} – {f.hasta}</option>
                  ))}
                </select>
              </div>
              {fechaRetiro && franjasDisponibles.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  El chofer no tiene franjas configuradas para ese día. Igualmente podés continuar con el pedido.
                </p>
              )}
              <input placeholder="Dirección de entrega *" value={direccionEntrega}
                onChange={(e) => setDireccionEntrega(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input placeholder="Teléfono de contacto *" value={telefonoContacto}
                onChange={(e) => setTelefonoContacto(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Observaciones para el chofer (opcional)" value={observacionEntrega}
                onChange={(e) => setObservacionEntrega(e.target.value)}
                rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none" />
            </div>
          )}
        </div>

        {/* ── OBSERVACIONES DEL CLIENTE ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <h2 className="font-semibold">Observaciones del cliente</h2>
          <textarea
            value={observacionCliente}
            onChange={(e) => setObservacionCliente(e.target.value)}
            placeholder="Exigencias, alergias, instrucciones especiales... (opcional)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* ── PAGO ──────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Pago</h2>
          <div className="flex gap-4 items-center">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold">${total.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Monto recibido</label>
              <input type="number" min={0} max={total} value={pagado} onChange={(e) => setPagado(e.target.value)}
                className="ml-2 border border-gray-300 rounded px-3 py-1.5 text-sm w-32" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo</p>
              <p className={`font-bold ${saldo > 0 ? "text-red-600" : "text-green-600"}`}>${saldo.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPagado("0")}
              className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">Sin pago</button>
            <button type="button" onClick={() => setPagado(String(total / 2))}
              className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">50%</button>
            <button type="button" onClick={() => setPagado(String(total))}
              className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">Total</button>
          </div>
          {pagadoNum > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Método de cobro</p>
              <div className="flex gap-2">
                {(["efectivo", "tarjeta", "mercadopago"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMetodoPago(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${metodoPago === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"}`}>
                    {m === "efectivo" ? "Efectivo" : m === "tarjeta" ? "Tarjeta" : "Mercado Pago"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Creando..." : "Crear pedido"}
        </button>
      </form>
    </div>
  );
}
