package handlers

import (
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &body); err != nil || body.Email == "" || body.Password == "" {
		writeError(w, 400, "Email y contraseña requeridos")
		return
	}

	type UserRow struct {
		ID       string
		Name     string
		Email    string
		Password string
		Role     string
		Activo   bool
	}
	var u UserRow
	err := h.db.QueryRow(r.Context(),
		`SELECT id, name, email, password, role, activo FROM "User" WHERE email = $1`,
		body.Email,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.Role, &u.Activo)
	if err != nil {
		writeError(w, 401, "Credenciales inválidas")
		return
	}
	if !u.Activo {
		writeError(w, 401, "Usuario inactivo")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.Password)); err != nil {
		writeError(w, 401, "Credenciales inválidas")
		return
	}

	token, err := h.jwt.Sign(u.ID, u.Name, u.Email, u.Role)
	if err != nil {
		writeError(w, 500, "Error al generar token")
		return
	}

	writeJSON(w, 200, map[string]any{
		"token": token,
		"user": map[string]string{
			"id":    u.ID,
			"name":  u.Name,
			"email": u.Email,
			"role":  u.Role,
		},
	})
}
