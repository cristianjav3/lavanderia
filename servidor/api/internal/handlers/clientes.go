package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) GetClientes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	stats := r.URL.Query().Get("stats")

	if stats == "1" {
		user := userFromReq(r)
		if user.Role != "admin" {
			writeError(w, 403, "Solo admins")
			return
		}
		rows, err := h.db.Query(r.Context(), `
			SELECT c.id, c.nombre, c.telefono,
			       COUNT(p.id) AS total_pedidos,
			       COALESCE(SUM(p.total), 0) AS total_gastado,
			       MAX(p."createdAt") AS ultima_compra
			FROM "Cliente" c
			LEFT JOIN "Pedido" p ON p."clienteId" = c.id
			GROUP BY c.id, c.nombre, c.telefono
			ORDER BY COUNT(p.id) DESC, c.nombre ASC`)
		if err != nil {
			writeError(w, 500, "Error")
			return
		}
		defer rows.Close()

		var list []map[string]any
		for rows.Next() {
			var id, nombre, tel string
			var totalPedidos int64
			var totalGastado float64
			var ultimaCompra *time.Time
			rows.Scan(&id, &nombre, &tel, &totalPedidos, &totalGastado, &ultimaCompra)
			list = append(list, map[string]any{
				"id": id, "nombre": nombre, "telefono": tel,
				"totalPedidos": totalPedidos, "totalGastado": totalGastado,
				"ultimaCompra": ultimaCompra,
			})
		}
		if list == nil {
			list = []map[string]any{}
		}
		writeJSON(w, 200, list)
		return
	}

	var rows interface{ Next() bool; Scan(...any) error; Close() }
	var err error
	if q != "" {
		rows, err = h.db.Query(r.Context(),
			`SELECT id, nombre, telefono, direccion, "createdAt" FROM "Cliente" WHERE nombre ILIKE $1 OR telefono LIKE $2 ORDER BY nombre`,
			"%"+q+"%", "%"+q+"%")
	} else {
		rows, err = h.db.Query(r.Context(),
			`SELECT id, nombre, telefono, direccion, "createdAt" FROM "Cliente" ORDER BY nombre`)
	}
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var id, nombre, tel string
		var dir *string
		var cat time.Time
		rows.Scan(&id, &nombre, &tel, &dir, &cat)
		list = append(list, map[string]any{
			"id": id, "nombre": nombre, "telefono": tel, "direccion": dir, "createdAt": cat,
		})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

func (h *Handler) CreateCliente(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nombre   string  `json:"nombre"`
		Telefono string  `json:"telefono"`
		Direccion *string `json:"direccion"`
	}
	if err := decode(r, &body); err != nil || body.Nombre == "" || body.Telefono == "" {
		writeError(w, 400, "Nombre y teléfono son requeridos")
		return
	}

	id := uuid.New().String()
	_, err := h.db.Exec(r.Context(),
		`INSERT INTO "Cliente" (id, nombre, telefono, direccion, "createdAt") VALUES ($1,$2,$3,$4,NOW())`,
		id, body.Nombre, body.Telefono, body.Direccion)
	if err != nil {
		writeError(w, 500, "Error al crear cliente")
		return
	}

	writeJSON(w, 201, map[string]any{
		"id": id, "nombre": body.Nombre, "telefono": body.Telefono, "direccion": body.Direccion,
	})
}

func (h *Handler) UpdateCliente(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Telefono string `json:"telefono"`
	}
	if err := decode(r, &body); err != nil || body.Telefono == "" {
		writeError(w, 400, "Teléfono requerido")
		return
	}

	_, err := h.db.Exec(r.Context(), `UPDATE "Cliente" SET telefono=$1 WHERE id=$2`, body.Telefono, id)
	if err != nil {
		writeError(w, 500, "Error al actualizar")
		return
	}

	var nombre, tel string
	var dir *string
	h.db.QueryRow(r.Context(), `SELECT nombre, telefono, direccion FROM "Cliente" WHERE id=$1`, id).
		Scan(&nombre, &tel, &dir)
	writeJSON(w, 200, map[string]any{"id": id, "nombre": nombre, "telefono": tel, "direccion": dir})
}
