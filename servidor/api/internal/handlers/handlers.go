package handlers

import (
	"encoding/json"
	"math"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"lavanderia/api/internal/auth"
	mw "lavanderia/api/internal/middleware"
)

// Precios (mismo que lib/constants.ts)
const (
	PrecioCanasto  = 10000.0
	PrecioAcolchado = 25000.0
	PrecioRetiro   = 5000.0
	PrecioReintento = 2500.0
	PrendasPorCanasto = 12.0
)

type Handler struct {
	db  *pgxpool.Pool
	jwt *auth.JWTService
}

func New(db *pgxpool.Pool, jwt *auth.JWTService) *Handler {
	return &Handler{db: db, jwt: jwt}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func userFromReq(r *http.Request) *auth.Claims {
	return mw.UserFromCtx(r.Context())
}

func calcularCanastos(prendas float64) float64 {
	return math.Ceil(prendas / PrendasPorCanasto)
}

func calcularEstadoPago(pagado, total float64) string {
	if pagado >= total {
		return "pagado"
	}
	if pagado > 0 {
		return "parcial"
	}
	return "pendiente"
}
