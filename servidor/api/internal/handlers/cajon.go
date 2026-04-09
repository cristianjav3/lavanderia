package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) GetCajon(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)

	hoyInicio := time.Now().Truncate(24 * time.Hour)
	hoyFin := hoyInicio.Add(24*time.Hour - time.Second)

	if user.Role == "admin" {
		// Admin: todas las sesiones de hoy
		rows, err := h.db.Query(r.Context(), `
			SELECT cs.id, cs."userId", cs."saldoInicial", cs."saldoFinal",
			       cs."fechaCierre", cs.estado, cs."createdAt", u.name
			FROM "CajaSesion" cs
			JOIN "User" u ON cs."userId" = u.id
			WHERE cs."createdAt" >= $1 AND cs."createdAt" <= $2
			ORDER BY cs."createdAt" DESC`, hoyInicio, hoyFin)
		if err != nil {
			writeError(w, 500, "Error")
			return
		}
		defer rows.Close()

		var cajones []map[string]any
		for rows.Next() {
			cs := parseSesionRow(rows)
			if cs != nil {
				cajones = append(cajones, cs)
			}
		}
		if cajones == nil {
			cajones = []map[string]any{}
		}
		writeJSON(w, 200, map[string]any{"admin": true, "cajones": cajones})
		return
	}

	// Empleado: sesión activa o última cerrada del día
	rows, err := h.db.Query(r.Context(), `
		SELECT cs.id, cs."userId", cs."saldoInicial", cs."saldoFinal",
		       cs."fechaCierre", cs.estado, cs."createdAt", u.name
		FROM "CajaSesion" cs
		JOIN "User" u ON cs."userId" = u.id
		WHERE cs."userId" = $1
		  AND cs."createdAt" >= $2 AND cs."createdAt" <= $3
		ORDER BY cs.estado ASC, cs."createdAt" DESC
		LIMIT 1`, user.UserID, hoyInicio, hoyFin)
	if err != nil || !rows.Next() {
		if rows != nil {
			rows.Close()
		}
		writeJSON(w, 200, nil)
		return
	}
	sesion := parseSesionRow(rows)
	rows.Close()
	if sesion == nil {
		writeJSON(w, 200, nil)
		return
	}

	sesion = h.enriquecerSesion(r.Context(), sesion)
	writeJSON(w, 200, sesion)
}

func (h *Handler) OpenCajon(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	var body struct {
		Apertura float64 `json:"apertura"`
	}
	if err := decode(r, &body); err != nil || body.Apertura < 0 {
		writeError(w, 400, "Monto de apertura inválido")
		return
	}

	// Bloquear si ya hay sesión abierta
	var existeID string
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM "CajaSesion" WHERE "userId"=$1 AND estado='abierto' LIMIT 1`,
		user.UserID).Scan(&existeID)
	if err == nil {
		writeError(w, 400, "Ya hay una caja abierta")
		return
	}

	// Sucursal del usuario
	var sucursalID *string
	var sid string
	if e := h.db.QueryRow(r.Context(), `SELECT "sucursalId" FROM "User" WHERE id=$1`, user.UserID).Scan(&sid); e == nil && sid != "" {
		sucursalID = &sid
	}

	id := uuid.New().String()
	_, err = h.db.Exec(r.Context(), `
		INSERT INTO "CajaSesion" (id,"userId","sucursalId","saldoInicial",estado,"createdAt")
		VALUES ($1,$2,$3,$4,'abierto',NOW())`,
		id, user.UserID, sucursalID, body.Apertura)
	if err != nil {
		writeError(w, 500, "Error al abrir caja")
		return
	}

	rows, _ := h.db.Query(r.Context(), `
		SELECT cs.id, cs."userId", cs."saldoInicial", cs."saldoFinal",
		       cs."fechaCierre", cs.estado, cs."createdAt", u.name
		FROM "CajaSesion" cs JOIN "User" u ON cs."userId"=u.id WHERE cs.id=$1`, id)
	if rows == nil || !rows.Next() {
		writeError(w, 500, "Error")
		return
	}
	sesion := parseSesionRow(rows)
	rows.Close()
	sesion = h.enriquecerSesion(r.Context(), sesion)
	writeJSON(w, 201, sesion)
}

func (h *Handler) AddMovimiento(w http.ResponseWriter, r *http.Request) {
	sesionID := chi.URLParam(r, "id")
	var body struct {
		Tipo       string  `json:"tipo"`
		Monto      float64 `json:"monto"`
		ConceptoID *string `json:"conceptoId"`
		Descripcion *string `json:"descripcion"`
	}
	if err := decode(r, &body); err != nil || body.Monto <= 0 {
		writeError(w, 400, "Datos inválidos")
		return
	}

	// Verificar sesión abierta
	var estado string
	if err := h.db.QueryRow(r.Context(), `SELECT estado FROM "CajaSesion" WHERE id=$1`, sesionID).Scan(&estado); err != nil || estado != "abierto" {
		writeError(w, 400, "Sesión no disponible")
		return
	}

	movID := uuid.New().String()
	_, err := h.db.Exec(r.Context(), `
		INSERT INTO "MovimientoCaja" (id,"sesionId",tipo,"conceptoId",descripcion,monto,"createdAt")
		VALUES ($1,$2,$3::\"TipoMovimiento\",$4,$5,$6,NOW())`,
		movID, sesionID, body.Tipo, body.ConceptoID, body.Descripcion, body.Monto)
	if err != nil {
		writeError(w, 500, "Error al registrar movimiento")
		return
	}

	writeJSON(w, 201, map[string]any{
		"id": movID, "sesionId": sesionID, "tipo": body.Tipo,
		"monto": body.Monto, "conceptoId": body.ConceptoID, "descripcion": body.Descripcion,
	})
}

func (h *Handler) CerrarCajon(w http.ResponseWriter, r *http.Request) {
	sesionID := chi.URLParam(r, "id")
	var body struct {
		Cierre float64 `json:"cierre"`
	}
	if err := decode(r, &body); err != nil || body.Cierre < 0 {
		writeError(w, 400, "Monto inválido")
		return
	}

	var estado string
	if err := h.db.QueryRow(r.Context(), `SELECT estado FROM "CajaSesion" WHERE id=$1`, sesionID).Scan(&estado); err != nil || estado == "cerrado" {
		writeError(w, 400, "Sesión no disponible")
		return
	}

	h.db.Exec(r.Context(), `
		UPDATE "CajaSesion" SET "saldoFinal"=$1,"fechaCierre"=NOW(),estado='cerrado' WHERE id=$2`,
		body.Cierre, sesionID)

	rows, _ := h.db.Query(r.Context(), `
		SELECT cs.id, cs."userId", cs."saldoInicial", cs."saldoFinal",
		       cs."fechaCierre", cs.estado, cs."createdAt", u.name
		FROM "CajaSesion" cs JOIN "User" u ON cs."userId"=u.id WHERE cs.id=$1`, sesionID)
	if rows == nil || !rows.Next() {
		writeError(w, 500, "Error")
		return
	}
	sesion := parseSesionRow(rows)
	rows.Close()
	sesion = h.enriquecerSesion(r.Context(), sesion)
	writeJSON(w, 200, sesion)
}

func (h *Handler) GetReporte(w http.ResponseWriter, r *http.Request) {
	sesionID := chi.URLParam(r, "id")

	type SesionRow struct {
		ID          string
		SaldoInicial float64
		SaldoFinal  *float64
		Estado      string
		FechaCierre *time.Time
		CreatedAt   time.Time
		UserName    string
	}
	var s SesionRow
	err := h.db.QueryRow(r.Context(), `
		SELECT cs.id, cs."saldoInicial", cs."saldoFinal", cs.estado, cs."fechaCierre", cs."createdAt", u.name
		FROM "CajaSesion" cs JOIN "User" u ON cs."userId"=u.id WHERE cs.id=$1`, sesionID,
	).Scan(&s.ID, &s.SaldoInicial, &s.SaldoFinal, &s.Estado, &s.FechaCierre, &s.CreatedAt, &s.UserName)
	if err != nil {
		writeError(w, 404, "No encontrado")
		return
	}

	// Movimientos
	mrows, _ := h.db.Query(r.Context(), `
		SELECT mc.id, mc.tipo, mc."conceptoId", cc.nombre, mc.descripcion, mc.monto, mc."createdAt"
		FROM "MovimientoCaja" mc
		LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId"=cc.id
		WHERE mc."sesionId"=$1 ORDER BY mc."createdAt"`, sesionID)
	var movs []map[string]any
	if mrows != nil {
		defer mrows.Close()
		for mrows.Next() {
			var mid, mtipo string
			var mcid, ccnombre, mdesc *string
			var mmonto float64
			var mcat time.Time
			mrows.Scan(&mid, &mtipo, &mcid, &ccnombre, &mdesc, &mmonto, &mcat)
			movs = append(movs, map[string]any{
				"id": mid, "tipo": mtipo, "monto": mmonto, "descripcion": mdesc, "createdAt": mcat,
				"concepto": func() any {
					if ccnombre != nil {
						return map[string]any{"id": mcid, "nombre": ccnombre}
					}
					return nil
				}(),
			})
		}
	}

	// Pagos
	prows, _ := h.db.Query(r.Context(), `
		SELECT rp.id, rp.monto, rp."metodoPago", rp."createdAt",
		       p.numero, p.total, c.nombre
		FROM "RegistroPago" rp
		JOIN "Pedido" p ON rp."pedidoId"=p.id
		JOIN "Cliente" c ON p."clienteId"=c.id
		WHERE rp."sesionId"=$1 ORDER BY rp."createdAt"`, sesionID)
	var pagos []map[string]any
	if prows != nil {
		defer prows.Close()
		for prows.Next() {
			var pid, pmet string
			var pmonto, ptotal float64
			var pnum int
			var pcat time.Time
			var cnombre string
			prows.Scan(&pid, &pmonto, &pmet, &pcat, &pnum, &ptotal, &cnombre)
			pagos = append(pagos, map[string]any{
				"id": pid, "monto": pmonto, "metodoPago": pmet, "createdAt": pcat,
				"pedido": map[string]any{
					"numero": pnum, "total": ptotal,
					"cliente": map[string]string{"nombre": cnombre},
				},
			})
		}
	}

	if movs == nil {
		movs = []map[string]any{}
	}
	if pagos == nil {
		pagos = []map[string]any{}
	}

	cajon := map[string]any{
		"id": s.ID, "saldoInicial": s.SaldoInicial, "saldoFinal": s.SaldoFinal,
		"estado": s.Estado, "fechaCierre": s.FechaCierre, "createdAt": s.CreatedAt,
		"user":        map[string]string{"name": s.UserName},
		"movimientos": movs,
	}
	writeJSON(w, 200, map[string]any{"cajon": cajon, "pagos": pagos})
}

func (h *Handler) GetConceptos(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(),
		`SELECT id, nombre, tipo FROM "ConceptoCaja" WHERE activo=true ORDER BY nombre`)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var id, nombre, tipo string
		rows.Scan(&id, &nombre, &tipo)
		list = append(list, map[string]any{"id": id, "nombre": nombre, "tipo": tipo})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

// ── helpers ──

type sesionRowScanner interface {
	Scan(...any) error
}

func parseSesionRow(rows sesionRowScanner) map[string]any {
	var id, userID, userName string
	var saldoInicial float64
	var saldoFinal *float64
	var fechaCierre *time.Time
	var estado string
	var createdAt time.Time

	if err := rows.Scan(&id, &userID, &saldoInicial, &saldoFinal, &fechaCierre, &estado, &createdAt, &userName); err != nil {
		return nil
	}
	return map[string]any{
		"id": id, "userId": userID, "saldoInicial": saldoInicial, "saldoFinal": saldoFinal,
		"fechaCierre": fechaCierre, "estado": estado, "createdAt": createdAt,
		"user": map[string]string{"name": userName},
		"movimientos": []any{},
	}
}

func (h *Handler) enriquecerSesion(ctx interface{ Deadline() (time.Time, bool); Done() <-chan struct{}; Err() error; Value(any) any }, sesion map[string]any) map[string]any {
	id, _ := sesion["id"].(string)
	mrows, _ := h.db.Query(ctx.(interface {
		Deadline() (time.Time, bool)
		Done() <-chan struct{}
		Err() error
		Value(any) any
	}), `
		SELECT mc.id, mc."sesionId", mc.tipo, mc."conceptoId", cc.nombre, mc.descripcion, mc.monto, mc."createdAt"
		FROM "MovimientoCaja" mc
		LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId"=cc.id
		WHERE mc."sesionId"=$1 ORDER BY mc."createdAt"`, id)

	var movs []map[string]any
	if mrows != nil {
		defer mrows.Close()
		for mrows.Next() {
			var mid, msid, mtipo string
			var mcid, ccnombre, mdesc *string
			var mmonto float64
			var mcat time.Time
			mrows.Scan(&mid, &msid, &mtipo, &mcid, &ccnombre, &mdesc, &mmonto, &mcat)
			movs = append(movs, map[string]any{
				"id": mid, "sesionId": msid, "tipo": mtipo, "monto": mmonto,
				"descripcion": mdesc, "createdAt": mcat,
				"concepto": func() any {
					if ccnombre != nil {
						return map[string]any{"id": mcid, "nombre": ccnombre}
					}
					return nil
				}(),
			})
		}
	}
	if movs == nil {
		movs = []map[string]any{}
	}
	sesion["movimientos"] = movs
	return sesion
}
