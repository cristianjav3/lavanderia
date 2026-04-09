package middleware

import (
	"context"
	"net/http"
	"strings"

	"lavanderia/api/internal/auth"
)

type contextKey string

const UserKey contextKey = "user"

type AuthMiddleware struct {
	jwt *auth.JWTService
}

func NewAuthMiddleware(jwt *auth.JWTService) *AuthMiddleware {
	return &AuthMiddleware{jwt: jwt}
}

func (m *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"No autorizado"}`, http.StatusUnauthorized)
			return
		}
		claims, err := m.jwt.Verify(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"Token inválido"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromCtx(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(UserKey).(*auth.Claims)
	return claims
}
