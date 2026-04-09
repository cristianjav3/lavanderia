package handlers

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ────────────────────────────────────────────────────────────
// GET /pedidos
// ────────────────────────────────────────────────────────────
func (h *Handler) GetPedidos(w http.ResponseWriter, r *http.Request) {
	estado := r.URL.Query().Get("estado")
	q := r.URL.Query().Get("q")
	fecha := r.URL.Query().Get("fecha")

	sql := `
		SELECT p.id, p.numero, p.estado, p."estadoPago", p.total, p.pagado, p.saldo,
		       p."tipoEntrega", p.sucursal, p."fechaRetiro", p."franjaHoraria",
		       p."enDeposito", p."printCount", p."createdAt", p."updatedAt",
		       c.id, c.nombre, c.telefono, c.direccion
		FROM "Pedido" p
		JOIN "Cliente" c ON p."clienteId" = c.id
		WHERE 1=1`
	args := []any{}
	i := 1

	if estado != "" {
		sql += ` AND p.estado = $` + strconv.Itoa(i) + `::"EstadoPedido"`
		args = append(args, estado)
		i++
	}
	if q != "" {
		sql += ` AND (c.nombre ILIKE $` + strconv.Itoa(i) + ` OR c.telefono LIKE $` + strconv.Itoa(i+1) + `)`
		args = append(args, "%"+q+"%", "%"+q+"%")
		i += 2
	}
	if fecha != "" {
		sql += ` AND p."fechaRetiro" >= $` + strconv.Itoa(i) + ` AND p."fechaRetiro" <= $` + strconv.Itoa(i+1)
		args = append(args, fecha+"T00:00:00Z", fecha+"T23:59:59Z")
		i += 2
	}
	sql += ` ORDER BY p."createdAt" DESC`

	rows, err := h.db.Query(r.Context(), sql, args...)
	if err != nil {
		writeError(w, 500, "Error al obtener pedidos")
		return
	}
	defer rows.Close()

	type PedidoRow struct {
		ID           string
		Numero       int
		Estado       string
		EstadoPago   string
		Total        float64
		Pagado       float64
		Saldo        float64
		TipoEntrega  string
		Sucursal     *string
		FechaRetiro  *time.Time
		FranjaHoraria *string
		EnDeposito   bool
		PrintCount   int
		CreatedAt    time.Time
		UpdatedAt    time.Time
		ClienteID    string
		ClienteNombre string
		ClienteTel   string
		ClienteDir   *string
	}

	var list []map[string]any
	for rows.Next() {
		var p PedidoRow
		if err := rows.Scan(
			&p.ID, &p.Numero, &p.Estado, &p.EstadoPago, &p.Total, &p.Pagado, &p.Saldo,
			&p.TipoEntrega, &p.Sucursal, &p.FechaRetiro, &p.FranjaHoraria,
			&p.EnDeposito, &p.PrintCount, &p.CreatedAt, &p.UpdatedAt,
			&p.ClienteID, &p.ClienteNombre, &p.ClienteTel, &p.ClienteDir,
		); err != nil {
			continue
		}
		list = append(list, map[string]any{
			"id": p.ID, "numero": p.Numero, "estado": p.Estado, "estadoPago": p.EstadoPago,
			"total": p.Total, "pagado": p.Pagado, "saldo": p.Saldo,
			"tipoEntrega": p.TipoEntrega, "sucursal": p.Sucursal,
			"fechaRetiro": p.FechaRetiro, "franjaHoraria": p.FranjaHoraria,
			"enDeposito": p.EnDeposito, "printCount": p.PrintCount,
			"createdAt": p.CreatedAt, "updatedAt": p.UpdatedAt,
			"cliente": map[string]any{
				"id": p.ClienteID, "nombre": p.ClienteNombre,
				"telefono": p.ClienteTel, "direccion": p.ClienteDir,
			},
		})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

// ────────────────────────────────────────────────────────────
// POST /pedidos
// ────────────────────────────────────────────────────────────
func (h *Handler) CreatePedido(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	var body struct {
		ClienteID     string                         `json:"clienteId"`
		Items         []struct{ Tipo string; Cantidad int } `json:"items"`
		TipoEntrega   string                         `json:"tipoEntrega"`
		Sucursal      *string                        `json:"sucursal"`
		FechaRetiro   *string                        `json:"fechaRetiro"`
		FranjaHoraria *string                        `json:"franjaHoraria"`
		Pagado        string                         `json:"pagado"`
		MetodoPago    string                         `json:"metodoPago"`
	}
	if err := decode(r, &body); err != nil || body.ClienteID == "" || len(body.Items) == 0 {
		writeError(w, 400, "Datos incompletos")
		return
	}

	total, itemsData := calcularTotalItems(body.Items, body.TipoEntrega)
	pagadoNum, _ := strconv.ParseFloat(body.Pagado, 64)
	saldo := total - pagadoNum
	if saldo < 0 {
		saldo = 0
	}
	estadoPago := calcularEstadoPago(pagadoNum, total)

	var fechaRetiro *time.Time
	if body.FechaRetiro != nil && *body.FechaRetiro != "" {
		t, err := time.Parse("2006-01-02", *body.FechaRetiro)
		if err == nil {
			fechaRetiro = &t
		}
	}

	pedidoID := uuid.New().String()
	_, err := h.db.Exec(r.Context(), `
		INSERT INTO "Pedido" (id, "clienteId", estado, "estadoPago", total, pagado, saldo,
		                      "tipoEntrega", sucursal, "fechaRetiro", "franjaHoraria",
		                      "enDeposito", "printCount", "createdAt", "updatedAt")
		VALUES ($1,$2,'pendiente_recepcion',$3,$4,$5,$6,$7,$8,$9,$10,false,0,NOW(),NOW())`,
		pedidoID, body.ClienteID, estadoPago, total, pagadoNum, saldo,
		body.TipoEntrega, body.Sucursal, fechaRetiro, body.FranjaHoraria,
	)
	if err != nil {
		writeError(w, 500, "Error al crear pedido")
		return
	}

	// Insertar items
	for _, item := range itemsData {
		itemID := uuid.New().String()
		h.db.Exec(r.Context(), `
			INSERT INTO "Item" (id, "pedidoId", tipo, cantidad, "precioUnitario")
			VALUES ($1,$2,$3::\"TipoItem\",$4,$5)`,
			itemID, pedidoID, item.tipo, item.cantidad, item.precio,
		)
	}

	// Registrar pago inicial
	if pagadoNum > 0 {
		metodoPago := body.MetodoPago
		if metodoPago == "" {
			metodoPago = "efectivo"
		}
		h.registrarPago(r.Context(), user.UserID, pedidoID, pagadoNum, metodoPago)
	}

	pedido := h.getPedidoCompleto(r.Context(), pedidoID)
	if pedido == nil {
		writeError(w, 500, "Error al obtener pedido")
		return
	}
	writeJSON(w, 201, pedido)
}

// ────────────────────────────────────────────────────────────
// GET /pedidos/:id
// ────────────────────────────────────────────────────────────
func (h *Handler) GetPedido(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	pedido := h.getPedidoCompleto(r.Context(), id)
	if pedido == nil {
		writeError(w, 404, "No encontrado")
		return
	}
	writeJSON(w, 200, pedido)
}

// ────────────────────────────────────────────────────────────
// PATCH /pedidos/:id
// ────────────────────────────────────────────────────────────
func (h *Handler) UpdatePedido(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Datos inválidos")
		return
	}

	if te, ok := body["tipoEntrega"].(string); ok {
		h.db.Exec(r.Context(), `UPDATE "Pedido" SET "tipoEntrega"=$1::"TipoEntrega","updatedAt"=NOW() WHERE id=$2`, te, id)
	}

	pedido := h.getPedidoCompleto(r.Context(), id)
	if pedido == nil {
		writeError(w, 404, "No encontrado")
		return
	}
	writeJSON(w, 200, pedido)
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/estado  — cambia estado y registra audit log
// GET  /pedidos/:id/estado  — devuelve audit logs
// ────────────────────────────────────────────────────────────
func (h *Handler) ChangeEstado(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := userFromReq(r)

	var body struct {
		Estado string  `json:"estado"`
		Motivo *string `json:"motivo"`
	}
	if err := decode(r, &body); err != nil || body.Estado == "" {
		writeError(w, 400, "Estado requerido")
		return
	}

	// Leer estado anterior
	var estadoAnterior string
	err := h.db.QueryRow(r.Context(), `SELECT estado FROM "Pedido" WHERE id=$1`, id).Scan(&estadoAnterior)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}

	// Actualizar estado
	_, err = h.db.Exec(r.Context(),
		`UPDATE "Pedido" SET estado=$1::"EstadoPedido","updatedAt"=NOW() WHERE id=$2`,
		body.Estado, id)
	if err != nil {
		writeError(w, 500, "Error al cambiar estado")
		return
	}

	// Insertar log
	logID := uuid.New().String()
	var motivo *string
	if body.Motivo != nil && *body.Motivo != "" {
		motivo = body.Motivo
	}
	h.db.Exec(r.Context(), `
		INSERT INTO "LogEstadoPedido" (id,"pedidoId","estadoAnterior","estadoNuevo","userId","userName",motivo,"createdAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
		logID, id, estadoAnterior, body.Estado, user.UserID, user.Name, motivo,
	)

	pedido := h.getPedidoCompleto(r.Context(), id)
	writeJSON(w, 200, pedido)
}

func (h *Handler) GetEstadoLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.db.Query(r.Context(), `
		SELECT id,"estadoAnterior","estadoNuevo","userName",motivo,"createdAt"
		FROM "LogEstadoPedido" WHERE "pedidoId"=$1 ORDER BY "createdAt" ASC`, id)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	type LogRow struct {
		ID             string
		EstadoAnterior string
		EstadoNuevo    string
		UserName       string
		Motivo         *string
		CreatedAt      time.Time
	}
	var list []map[string]any
	for rows.Next() {
		var l LogRow
		if err := rows.Scan(&l.ID, &l.EstadoAnterior, &l.EstadoNuevo, &l.UserName, &l.Motivo, &l.CreatedAt); err != nil {
			continue
		}
		list = append(list, map[string]any{
			"id": l.ID, "estadoAnterior": l.EstadoAnterior, "estadoNuevo": l.EstadoNuevo,
			"userName": l.UserName, "motivo": l.Motivo, "createdAt": l.CreatedAt,
		})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/pago
// ────────────────────────────────────────────────────────────
func (h *Handler) RegistrarPagoHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := userFromReq(r)

	var body struct {
		Monto      string `json:"monto"`
		MetodoPago string `json:"metodoPago"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Datos inválidos")
		return
	}

	montoNum, _ := strconv.ParseFloat(body.Monto, 64)
	if montoNum <= 0 {
		writeError(w, 400, "Monto inválido")
		return
	}

	var total, pagado float64
	err := h.db.QueryRow(r.Context(), `SELECT total, pagado FROM "Pedido" WHERE id=$1`, id).Scan(&total, &pagado)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}

	nuevoPagado := pagado + montoNum
	nuevoSaldo := total - nuevoPagado
	if nuevoSaldo < 0 {
		nuevoSaldo = 0
	}
	estadoPago := calcularEstadoPago(nuevoPagado, total)

	h.db.Exec(r.Context(), `
		UPDATE "Pedido" SET pagado=$1, saldo=$2, "estadoPago"=$3::"EstadoPago","updatedAt"=NOW() WHERE id=$4`,
		nuevoPagado, nuevoSaldo, estadoPago, id)

	metodoPago := body.MetodoPago
	if metodoPago == "" {
		metodoPago = "efectivo"
	}
	h.registrarPago(r.Context(), user.UserID, id, montoNum, metodoPago)

	pedido := h.getPedidoCompleto(r.Context(), id)
	writeJSON(w, 200, pedido)
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/entrega
// ────────────────────────────────────────────────────────────
func (h *Handler) MarcarEntrega(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := userFromReq(r)

	var body struct {
		Resultado       string  `json:"resultado"`
		CambiarASucursal bool   `json:"cambiarASucursal"`
		MetodoPago      string  `json:"metodoPago"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Datos inválidos")
		return
	}

	var total, pagado, saldoActual float64
	var estadoActual string
	err := h.db.QueryRow(r.Context(),
		`SELECT total, pagado, saldo, estado FROM "Pedido" WHERE id=$1`, id,
	).Scan(&total, &pagado, &saldoActual, &estadoActual)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}

	recargo := 0.0
	nuevoTotal := total
	nuevoEstado := body.Resultado
	if body.Resultado == "no_entregado" {
		recargo = PrecioReintento
		nuevoTotal = total + recargo
	}
	if body.CambiarASucursal {
		nuevoEstado = "en_sucursal"
	}

	entregaID := uuid.New().String()
	h.db.Exec(r.Context(), `
		INSERT INTO "Entrega" (id,"pedidoId","fechaIntento",resultado,recargo)
		VALUES ($1,$2,NOW(),$3::\"ResultadoEntrega\",$4)`,
		entregaID, id, body.Resultado, recargo)

	var nuevoPagado, nuevoSaldo float64
	var estadoPago string
	if body.Resultado == "entregado" {
		nuevoPagado = nuevoTotal
		nuevoSaldo = 0
		estadoPago = "pagado"
		// Registrar saldo pendiente en caja
		if saldoActual > 0 {
			metodoPago := body.MetodoPago
			if metodoPago == "" {
				metodoPago = "efectivo"
			}
			h.registrarPago(r.Context(), user.UserID, id, saldoActual, metodoPago)
		}
	} else {
		nuevoPagado = pagado
		nuevoSaldo = nuevoTotal - pagado
		estadoPago = calcularEstadoPago(pagado, nuevoTotal)
	}

	h.db.Exec(r.Context(), `
		UPDATE "Pedido" SET estado=$1::"EstadoPedido", total=$2, pagado=$3, saldo=$4,
		"estadoPago"=$5::"EstadoPago","updatedAt"=NOW() WHERE id=$6`,
		nuevoEstado, nuevoTotal, nuevoPagado, nuevoSaldo, estadoPago, id)

	// Log de estado
	logID := uuid.New().String()
	h.db.Exec(r.Context(), `
		INSERT INTO "LogEstadoPedido" (id,"pedidoId","estadoAnterior","estadoNuevo","userId","userName",motivo,"createdAt")
		VALUES ($1,$2,$3,$4,$5,$6,NULL,NOW())`,
		logID, id, estadoActual, nuevoEstado, user.UserID, user.Name)

	pedido := h.getPedidoCompleto(r.Context(), id)
	writeJSON(w, 200, pedido)
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/paquetes
// ────────────────────────────────────────────────────────────
func (h *Handler) GenerarPaquetes(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	rows, err := h.db.Query(r.Context(), `SELECT tipo, cantidad FROM "Item" WHERE "pedidoId"=$1`, id)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	type ItemRow struct{ Tipo string; Cantidad int }
	var items []ItemRow
	for rows.Next() {
		var it ItemRow
		rows.Scan(&it.Tipo, &it.Cantidad)
		items = append(items, it)
	}

	// Borrar paquetes existentes
	h.db.Exec(r.Context(), `DELETE FROM "Paquete" WHERE "pedidoId"=$1`, id)

	total := 0
	for _, item := range items {
		switch item.Tipo {
		case "canasto":
			n := int(math.Ceil(float64(item.Cantidad) / PrendasPorCanasto))
			for i := 1; i <= n; i++ {
				pid := uuid.New().String()
				h.db.Exec(r.Context(), `INSERT INTO "Paquete" (id,"pedidoId",tipo,numero,"totalPaquetes") VALUES ($1,$2,'canasto',$3,$4)`,
					pid, id, i, n)
				total++
			}
		case "acolchado":
			for i := 1; i <= item.Cantidad; i++ {
				pid := uuid.New().String()
				h.db.Exec(r.Context(), `INSERT INTO "Paquete" (id,"pedidoId",tipo,numero,"totalPaquetes") VALUES ($1,$2,'acolchado',$3,$4)`,
					pid, id, i, item.Cantidad)
				total++
			}
		}
	}

	writeJSON(w, 200, map[string]int{"paquetes": total})
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/recepcion
// ────────────────────────────────────────────────────────────
func (h *Handler) Recepcionar(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := userFromReq(r)

	var body struct {
		Items              []struct{ Tipo string; Cantidad int } `json:"items"`
		Notas              *string `json:"notas"`
		Observaciones      *string `json:"observaciones"`
		RequiereValidacion bool    `json:"requiereValidacion"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Datos inválidos")
		return
	}

	var tipoEntrega string
	var pagado float64
	err := h.db.QueryRow(r.Context(), `SELECT "tipoEntrega", pagado FROM "Pedido" WHERE id=$1`, id).
		Scan(&tipoEntrega, &pagado)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}

	nuevoTotal, itemsData := calcularTotalItems(body.Items, tipoEntrega)
	saldo := nuevoTotal - pagado
	if saldo < 0 {
		saldo = 0
	}
	estadoPago := calcularEstadoPago(pagado, nuevoTotal)

	nuevoEstado := "por_lavar"
	if body.RequiereValidacion {
		nuevoEstado = "validacion"
	}

	// Reemplazar items
	h.db.Exec(r.Context(), `DELETE FROM "Item" WHERE "pedidoId"=$1`, id)
	for _, item := range itemsData {
		iid := uuid.New().String()
		h.db.Exec(r.Context(), `INSERT INTO "Item" (id,"pedidoId",tipo,cantidad,"precioUnitario") VALUES ($1,$2,$3::\"TipoItem\",$4,$5)`,
			iid, id, item.tipo, item.cantidad, item.precio)
	}

	// Crear recepción
	recID := uuid.New().String()
	h.db.Exec(r.Context(), `INSERT INTO "Recepcion" (id,"pedidoId","empleadoId",notas,"requiereValidacion","createdAt") VALUES ($1,$2,$3,$4,$5,NOW())`,
		recID, id, user.UserID, body.Notas, body.RequiereValidacion)

	if body.Observaciones != nil && *body.Observaciones != "" {
		obsID := uuid.New().String()
		h.db.Exec(r.Context(), `INSERT INTO "Observacion" (id,"pedidoId",texto,"createdAt") VALUES ($1,$2,$3,NOW())`,
			obsID, id, *body.Observaciones)
	}

	h.db.Exec(r.Context(), `UPDATE "Pedido" SET estado=$1::"EstadoPedido",total=$2,saldo=$3,"estadoPago"=$4::"EstadoPago","updatedAt"=NOW() WHERE id=$5`,
		nuevoEstado, nuevoTotal, saldo, estadoPago, id)

	writeJSON(w, 200, map[string]string{"ok": "true"})
}

// ────────────────────────────────────────────────────────────
// POST /pedidos/:id/aceptar — recepción automática → por_lavar
// ────────────────────────────────────────────────────────────
func (h *Handler) AceptarPedido(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := userFromReq(r)

	recID := uuid.New().String()
	h.db.Exec(r.Context(), `INSERT INTO "Recepcion" (id,"pedidoId","empleadoId",notas,"requiereValidacion","createdAt") VALUES ($1,$2,$3,NULL,false,NOW())`,
		recID, id, user.UserID)

	h.db.Exec(r.Context(), `UPDATE "Pedido" SET estado='por_lavar'::"EstadoPedido","updatedAt"=NOW() WHERE id=$1`, id)

	logID := uuid.New().String()
	h.db.Exec(r.Context(), `INSERT INTO "LogEstadoPedido" (id,"pedidoId","estadoAnterior","estadoNuevo","userId","userName",motivo,"createdAt") VALUES ($1,$2,'pendiente_recepcion','por_lavar',$3,$4,NULL,NOW())`,
		logID, id, user.UserID, user.Name)

	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ────────────────────────────────────────────────────────────
// GET/POST /pedidos/:id/imprimir
// ────────────────────────────────────────────────────────────
func (h *Handler) GetPrintCount(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var count int
	err := h.db.QueryRow(r.Context(), `SELECT "printCount" FROM "Pedido" WHERE id=$1`, id).Scan(&count)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}
	writeJSON(w, 200, map[string]int{"printCount": count})
}

func (h *Handler) IncrementPrintCount(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var count int
	err := h.db.QueryRow(r.Context(),
		`UPDATE "Pedido" SET "printCount"="printCount"+1,"updatedAt"=NOW() WHERE id=$1 RETURNING "printCount"`, id,
	).Scan(&count)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}
	writeJSON(w, 200, map[string]int{"printCount": count})
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

type itemData struct {
	tipo     string
	cantidad int
	precio   float64
}

func calcularTotalItems(items []struct{ Tipo string; Cantidad int }, tipoEntrega string) (float64, []itemData) {
	total := 0.0
	var data []itemData
	for _, item := range items {
		var precio float64
		switch strings.ToLower(item.Tipo) {
		case "canasto":
			precio = PrecioCanasto
			total += calcularCanastos(float64(item.Cantidad)) * PrecioCanasto
		case "acolchado":
			precio = PrecioAcolchado
			total += float64(item.Cantidad) * PrecioAcolchado
		default:
			precio = PrecioCanasto
			total += float64(item.Cantidad) * PrecioCanasto
		}
		data = append(data, itemData{tipo: item.Tipo, cantidad: item.Cantidad, precio: precio})
	}
	if strings.ToLower(tipoEntrega) == "domicilio" {
		total += PrecioRetiro
	}
	return total, data
}

func (h *Handler) registrarPago(ctx context.Context, userID, pedidoID string, monto float64, metodoPago string) {
	// Buscar sesión activa
	var sesionID *string
	var sid string
	err := h.db.QueryRow(ctx,
		`SELECT id FROM "CajaSesion" WHERE "userId"=$1 AND estado='abierto' ORDER BY "createdAt" DESC LIMIT 1`,
		userID).Scan(&sid)
	if err == nil {
		sesionID = &sid
	}

	pagoID := uuid.New().String()
	h.db.Exec(ctx, `
		INSERT INTO "RegistroPago" (id,"pedidoId","sesionId",monto,"metodoPago","createdAt")
		VALUES ($1,$2,$3,$4,$5::\"MetodoPago\",NOW())`,
		pagoID, pedidoID, sesionID, monto, metodoPago)
}

func (h *Handler) getPedidoCompleto(ctx context.Context, id string) map[string]any {
	type PRow struct {
		ID            string
		Numero        int
		Estado        string
		EstadoPago    string
		Total         float64
		Pagado        float64
		Saldo         float64
		TipoEntrega   string
		Sucursal      *string
		FechaRetiro   *time.Time
		FranjaHoraria *string
		EnDeposito    bool
		PrintCount    int
		CreatedAt     time.Time
		UpdatedAt     time.Time
		ClienteID     string
		ClienteNombre string
		ClienteTel    string
		ClienteDir    *string
	}
	var p PRow
	err := h.db.QueryRow(ctx, `
		SELECT p.id,p.numero,p.estado,p."estadoPago",p.total,p.pagado,p.saldo,
		       p."tipoEntrega",p.sucursal,p."fechaRetiro",p."franjaHoraria",
		       p."enDeposito",p."printCount",p."createdAt",p."updatedAt",
		       c.id,c.nombre,c.telefono,c.direccion
		FROM "Pedido" p JOIN "Cliente" c ON p."clienteId"=c.id WHERE p.id=$1`, id,
	).Scan(&p.ID, &p.Numero, &p.Estado, &p.EstadoPago, &p.Total, &p.Pagado, &p.Saldo,
		&p.TipoEntrega, &p.Sucursal, &p.FechaRetiro, &p.FranjaHoraria,
		&p.EnDeposito, &p.PrintCount, &p.CreatedAt, &p.UpdatedAt,
		&p.ClienteID, &p.ClienteNombre, &p.ClienteTel, &p.ClienteDir)
	if err != nil {
		return nil
	}

	// Items
	irows, _ := h.db.Query(ctx, `SELECT id,tipo,cantidad,"precioUnitario" FROM "Item" WHERE "pedidoId"=$1`, id)
	var items []map[string]any
	if irows != nil {
		defer irows.Close()
		for irows.Next() {
			var iid, itipo string
			var icant int
			var iprecio float64
			irows.Scan(&iid, &itipo, &icant, &iprecio)
			items = append(items, map[string]any{"id": iid, "tipo": itipo, "cantidad": icant, "precioUnitario": iprecio})
		}
	}

	// Paquetes
	prows, _ := h.db.Query(ctx, `SELECT id,tipo,numero,"totalPaquetes" FROM "Paquete" WHERE "pedidoId"=$1`, id)
	var paquetes []map[string]any
	if prows != nil {
		defer prows.Close()
		for prows.Next() {
			var pid, ptipo string
			var pnum, ptot int
			prows.Scan(&pid, &ptipo, &pnum, &ptot)
			paquetes = append(paquetes, map[string]any{"id": pid, "tipo": ptipo, "numero": pnum, "totalPaquetes": ptot})
		}
	}

	// Recepción
	type RecRow struct {
		ID     string; Notas *string; RequiereVal bool
		EmpNombre string
	}
	var rec *RecRow
	var rr RecRow
	errRec := h.db.QueryRow(ctx, `
		SELECT r.id,r.notas,r."requiereValidacion",u.name
		FROM "Recepcion" r JOIN "User" u ON r."empleadoId"=u.id WHERE r."pedidoId"=$1`, id,
	).Scan(&rr.ID, &rr.Notas, &rr.RequiereVal, &rr.EmpNombre)
	if errRec == nil {
		rec = &rr
	}

	// Observaciones
	obsRows, _ := h.db.Query(ctx, `SELECT id,texto,"createdAt" FROM "Observacion" WHERE "pedidoId"=$1 ORDER BY "createdAt"`, id)
	var obs []map[string]any
	if obsRows != nil {
		defer obsRows.Close()
		for obsRows.Next() {
			var oid, otxt string
			var oat time.Time
			obsRows.Scan(&oid, &otxt, &oat)
			obs = append(obs, map[string]any{"id": oid, "texto": otxt, "createdAt": oat})
		}
	}

	// Entregas
	erows, _ := h.db.Query(ctx, `SELECT id,resultado,"fechaIntento",recargo FROM "Entrega" WHERE "pedidoId"=$1 ORDER BY "fechaIntento"`, id)
	var entregas []map[string]any
	if erows != nil {
		defer erows.Close()
		for erows.Next() {
			var eid, eres string
			var efecha time.Time
			var erec float64
			erows.Scan(&eid, &eres, &efecha, &erec)
			entregas = append(entregas, map[string]any{"id": eid, "resultado": eres, "fechaIntento": efecha, "recargo": erec})
		}
	}

	result := map[string]any{
		"id": p.ID, "numero": p.Numero, "estado": p.Estado, "estadoPago": p.EstadoPago,
		"total": p.Total, "pagado": p.Pagado, "saldo": p.Saldo,
		"tipoEntrega": p.TipoEntrega, "sucursal": p.Sucursal,
		"fechaRetiro": p.FechaRetiro, "franjaHoraria": p.FranjaHoraria,
		"enDeposito": p.EnDeposito, "printCount": p.PrintCount,
		"createdAt": p.CreatedAt, "updatedAt": p.UpdatedAt,
		"cliente": map[string]any{
			"id": p.ClienteID, "nombre": p.ClienteNombre,
			"telefono": p.ClienteTel, "direccion": p.ClienteDir,
		},
		"items": items, "paquetes": paquetes, "observaciones": obs, "entregas": entregas,
	}
	if rec != nil {
		result["recepcion"] = map[string]any{
			"notas": rec.Notas, "requiereValidacion": rec.RequiereVal,
			"empleado": map[string]string{"name": rec.EmpNombre},
		}
	} else {
		result["recepcion"] = nil
	}
	if items == nil {
		result["items"] = []any{}
	}
	if paquetes == nil {
		result["paquetes"] = []any{}
	}
	if obs == nil {
		result["observaciones"] = []any{}
	}
	if entregas == nil {
		result["entregas"] = []any{}
	}

	_ = pgx.ErrNoRows // import used
	return result
}
