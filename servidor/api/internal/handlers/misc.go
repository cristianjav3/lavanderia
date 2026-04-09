package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ── Sucursales ──

func (h *Handler) GetSucursales(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(),
		`SELECT id, nombre FROM "Sucursal" WHERE activa=true ORDER BY nombre`)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var id, nombre string
		rows.Scan(&id, &nombre)
		list = append(list, map[string]any{"id": id, "nombre": nombre})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

func (h *Handler) CreateSucursal(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	if user.Role != "admin" {
		writeError(w, 403, "Solo admins")
		return
	}
	var body struct {
		Nombre string `json:"nombre"`
	}
	if err := decode(r, &body); err != nil || body.Nombre == "" {
		writeError(w, 400, "Nombre requerido")
		return
	}

	id := uuid.New().String()
	_, err := h.db.Exec(r.Context(),
		`INSERT INTO "Sucursal" (id, nombre, activa, "createdAt") VALUES ($1,$2,true,NOW())`,
		id, body.Nombre)
	if err != nil {
		writeError(w, 500, "Error al crear sucursal")
		return
	}
	writeJSON(w, 201, map[string]any{"id": id, "nombre": body.Nombre})
}

func (h *Handler) DeleteSucursal(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	if user.Role != "admin" {
		writeError(w, 403, "Solo admins")
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := decode(r, &body); err != nil || body.ID == "" {
		writeError(w, 400, "ID requerido")
		return
	}

	h.db.Exec(r.Context(), `UPDATE "Sucursal" SET activa=false WHERE id=$1`, body.ID)
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ── Depósito ──

func (h *Handler) GetDeposito(w http.ResponseWriter, r *http.Request) {
	hace7Dias := time.Now().AddDate(0, 0, -7)

	// Auto-mover pedidos listos/en_sucursal con más de 7 días a depósito
	h.db.Exec(r.Context(), `
		UPDATE "Pedido"
		SET estado='deposito', "enDeposito"=true, "updatedAt"=NOW()
		WHERE estado IN ('listo','en_sucursal','no_entregado')
		  AND "updatedAt" < $1
		  AND "enDeposito"=false`, hace7Dias)

	rows, err := h.db.Query(r.Context(), `
		SELECT p.id, p.numero, p.estado, p.total, p.pagado, p."tipoEntrega",
		       p."updatedAt", p."createdAt",
		       c.id AS cid, c.nombre AS cnombre, c.telefono AS ctel
		FROM "Pedido" p
		JOIN "Cliente" c ON p."clienteId"=c.id
		WHERE p."enDeposito"=true
		ORDER BY p."updatedAt" ASC`)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var id, estado, tipoEntrega string
		var numero int
		var total, pagado float64
		var updatedAt, createdAt time.Time
		var cid, cnombre, ctel string
		rows.Scan(&id, &numero, &estado, &total, &pagado, &tipoEntrega,
			&updatedAt, &createdAt, &cid, &cnombre, &ctel)
		list = append(list, map[string]any{
			"id": id, "numero": numero, "estado": estado, "total": total,
			"pagado": pagado, "tipoEntrega": tipoEntrega,
			"updatedAt": updatedAt, "createdAt": createdAt,
			"cliente": map[string]string{"id": cid, "nombre": cnombre, "telefono": ctel},
		})
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

// ── Chofer ──

func (h *Handler) GetChofer(w http.ResponseWriter, r *http.Request) {
	fecha := r.URL.Query().Get("fecha")
	if fecha == "" {
		fecha = time.Now().Format("2006-01-02")
	}

	inicio, _ := time.Parse("2006-01-02T15:04:05", fecha+"T00:00:00")
	fin, _ := time.Parse("2006-01-02T15:04:05", fecha+"T23:59:59")

	// Retiros pendientes
	rrows, err := h.db.Query(r.Context(), `
		SELECT p.id, p.numero, p.estado, p."tipoEntrega", p."franjaHoraria",
		       p."fechaRetiro", p.total, p.pagado,
		       c.id AS cid, c.nombre, c.telefono, c.direccion
		FROM "Pedido" p
		JOIN "Cliente" c ON p."clienteId"=c.id
		WHERE p."tipoEntrega"='domicilio'
		  AND p.estado IN ('pendiente_recepcion','listo')
		  AND p."fechaRetiro" >= $1 AND p."fechaRetiro" <= $2
		ORDER BY p."franjaHoraria" ASC`, inicio, fin)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rrows.Close()

	var retiros []map[string]any
	for rrows.Next() {
		var id, estado, tipoEntrega string
		var numero int
		var franjaHoraria *string
		var fechaRetiro *time.Time
		var total, pagado float64
		var cid, cnombre, ctel string
		var cdir *string
		rrows.Scan(&id, &numero, &estado, &tipoEntrega, &franjaHoraria,
			&fechaRetiro, &total, &pagado, &cid, &cnombre, &ctel, &cdir)
		retiros = append(retiros, map[string]any{
			"id": id, "numero": numero, "estado": estado, "tipoEntrega": tipoEntrega,
			"franjaHoraria": franjaHoraria, "fechaRetiro": fechaRetiro,
			"total": total, "pagado": pagado,
			"cliente": map[string]any{"id": cid, "nombre": cnombre, "telefono": ctel, "direccion": cdir},
		})
	}

	// Entregas en reparto
	erows, err2 := h.db.Query(r.Context(), `
		SELECT p.id, p.numero, p.estado, p.total, p.pagado,
		       c.id AS cid, c.nombre, c.telefono, c.direccion
		FROM "Pedido" p
		JOIN "Cliente" c ON p."clienteId"=c.id
		WHERE p."tipoEntrega"='domicilio' AND p.estado='en_reparto'
		ORDER BY p."updatedAt" ASC`)
	if err2 != nil {
		writeError(w, 500, "Error")
		return
	}
	defer erows.Close()

	var entregas []map[string]any
	for erows.Next() {
		var id, estado string
		var numero int
		var total, pagado float64
		var cid, cnombre, ctel string
		var cdir *string
		erows.Scan(&id, &numero, &estado, &total, &pagado,
			&cid, &cnombre, &ctel, &cdir)
		entregas = append(entregas, map[string]any{
			"id": id, "numero": numero, "estado": estado,
			"total": total, "pagado": pagado,
			"cliente": map[string]any{"id": cid, "nombre": cnombre, "telefono": ctel, "direccion": cdir},
		})
	}

	if retiros == nil {
		retiros = []map[string]any{}
	}
	if entregas == nil {
		entregas = []map[string]any{}
	}
	writeJSON(w, 200, map[string]any{"retiros": retiros, "entregas": entregas})
}

// ── Admin: Usuarios ──

func (h *Handler) GetUsuarios(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	if user.Role != "admin" {
		writeError(w, 403, "Solo admins")
		return
	}

	rows, err := h.db.Query(r.Context(), `
		SELECT u.id, u.name, u.email, u.telefono, u.role, u.activo,
		       u."sucursalId", u."createdAt",
		       s.id AS sid, s.nombre AS snombre
		FROM "User" u
		LEFT JOIN "Sucursal" s ON u."sucursalId"=s.id
		ORDER BY u.name ASC`)
	if err != nil {
		writeError(w, 500, "Error")
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var id, name, email, role string
		var telefono, sucursalID *string
		var activo bool
		var createdAt time.Time
		var sid, snombre *string
		rows.Scan(&id, &name, &email, &telefono, &role, &activo,
			&sucursalID, &createdAt, &sid, &snombre)
		u := map[string]any{
			"id": id, "name": name, "email": email, "telefono": telefono,
			"role": role, "activo": activo, "sucursalId": sucursalID,
			"createdAt": createdAt,
		}
		if sid != nil {
			u["sucursal"] = map[string]string{"id": *sid, "nombre": *snombre}
		} else {
			u["sucursal"] = nil
		}
		list = append(list, u)
	}
	if list == nil {
		list = []map[string]any{}
	}
	writeJSON(w, 200, list)
}

func (h *Handler) CreateUsuario(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	if user.Role != "admin" {
		writeError(w, 403, "Solo admins")
		return
	}

	var body struct {
		Name       string  `json:"name"`
		Email      string  `json:"email"`
		Password   string  `json:"password"`
		Role       string  `json:"role"`
		SucursalID *string `json:"sucursalId"`
		Telefono   *string `json:"telefono"`
	}
	if err := decode(r, &body); err != nil || body.Name == "" || body.Email == "" || body.Password == "" {
		writeError(w, 400, "Nombre, email y contraseña son requeridos")
		return
	}

	// Verificar email único
	var existeID string
	if err := h.db.QueryRow(r.Context(), `SELECT id FROM "User" WHERE email=$1`, body.Email).Scan(&existeID); err == nil {
		writeError(w, 400, "Ya existe un usuario con ese email")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		writeError(w, 500, "Error interno")
		return
	}

	role := body.Role
	if role == "" {
		role = "empleado"
	}

	id := uuid.New().String()
	_, err = h.db.Exec(r.Context(), `
		INSERT INTO "User" (id, name, email, password, telefono, role, "sucursalId", activo, "createdAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW())`,
		id, body.Name, body.Email, string(hash), body.Telefono, role, body.SucursalID)
	if err != nil {
		writeError(w, 500, "Error al crear usuario")
		return
	}

	writeJSON(w, 201, map[string]any{
		"id": id, "name": body.Name, "email": body.Email,
		"telefono": body.Telefono, "role": role,
		"sucursalId": body.SucursalID, "activo": true,
	})
}

func (h *Handler) UpdateUsuario(w http.ResponseWriter, r *http.Request) {
	user := userFromReq(r)
	if user.Role != "admin" {
		writeError(w, 403, "Solo admins")
		return
	}

	id := chi.URLParam(r, "id")
	var body struct {
		Name       *string `json:"name"`
		Email      *string `json:"email"`
		Password   *string `json:"password"`
		Role       *string `json:"role"`
		SucursalID *string `json:"sucursalId"`
		Activo     *bool   `json:"activo"`
		Telefono   *string `json:"telefono"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Datos inválidos")
		return
	}

	// Build dynamic update
	setClauses := []string{}
	args := []any{}
	argIdx := 1

	if body.Name != nil {
		setClauses = append(setClauses, `name=$`+itoa(argIdx))
		args = append(args, *body.Name)
		argIdx++
	}
	if body.Email != nil {
		setClauses = append(setClauses, `email=$`+itoa(argIdx))
		args = append(args, *body.Email)
		argIdx++
	}
	if body.Role != nil {
		setClauses = append(setClauses, `role=$`+itoa(argIdx))
		args = append(args, *body.Role)
		argIdx++
	}
	if body.Activo != nil {
		setClauses = append(setClauses, `activo=$`+itoa(argIdx))
		args = append(args, *body.Activo)
		argIdx++
	}
	if body.Telefono != nil {
		setClauses = append(setClauses, `telefono=$`+itoa(argIdx))
		args = append(args, *body.Telefono)
		argIdx++
	}
	if body.SucursalID != nil {
		setClauses = append(setClauses, `"sucursalId"=$`+itoa(argIdx))
		if *body.SucursalID == "" {
			args = append(args, nil)
		} else {
			args = append(args, *body.SucursalID)
		}
		argIdx++
	}
	if body.Password != nil && *body.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(*body.Password), 10)
		setClauses = append(setClauses, `password=$`+itoa(argIdx))
		args = append(args, string(hash))
		argIdx++
	}

	if len(setClauses) == 0 {
		writeError(w, 400, "Nada que actualizar")
		return
	}

	query := `UPDATE "User" SET `
	for i, c := range setClauses {
		if i > 0 {
			query += ","
		}
		query += c
	}
	query += ` WHERE id=$` + itoa(argIdx)
	args = append(args, id)

	if _, err := h.db.Exec(r.Context(), query, args...); err != nil {
		writeError(w, 500, "Error al actualizar usuario")
		return
	}

	// Return updated user
	var name, email, role string
	var telefono, sucursalID *string
	var activo bool
	var createdAt time.Time
	h.db.QueryRow(r.Context(),
		`SELECT name, email, telefono, role, activo, "sucursalId", "createdAt" FROM "User" WHERE id=$1`, id,
	).Scan(&name, &email, &telefono, &role, &activo, &sucursalID, &createdAt)

	writeJSON(w, 200, map[string]any{
		"id": id, "name": name, "email": email, "telefono": telefono,
		"role": role, "activo": activo, "sucursalId": sucursalID, "createdAt": createdAt,
	})
}

// itoa is a small helper to avoid importing strconv just for Itoa
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	buf := [20]byte{}
	pos := len(buf)
	for n >= 10 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	pos--
	buf[pos] = byte('0' + n)
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}
