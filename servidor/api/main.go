package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"

	"lavanderia/api/internal/auth"
	"lavanderia/api/internal/db"
	"lavanderia/api/internal/handlers"
	mw "lavanderia/api/internal/middleware"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL no configurado")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "changeme-secret-key"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	pool, err := db.Connect(dsn)
	if err != nil {
		log.Fatalf("DB: %v", err)
	}
	defer pool.Close()

	jwtSvc := auth.NewJWTService(jwtSecret)
	h := handlers.New(pool, jwtSvc)
	authMw := mw.NewAuthMiddleware(jwtSvc)

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// CORS — allow panel + admin origins
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", os.Getenv("PANEL_URL"), os.Getenv("ADMIN_URL")},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})
	r.Use(corsHandler.Handler)

	// Public
	r.Post("/api/auth/login", h.Login)

	// Protected
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)

		// Pedidos
		r.Get("/api/pedidos", h.GetPedidos)
		r.Post("/api/pedidos", h.CreatePedido)
		r.Get("/api/pedidos/{id}", h.GetPedido)
		r.Patch("/api/pedidos/{id}", h.UpdatePedido)
		r.Post("/api/pedidos/{id}/estado", h.ChangeEstado)
		r.Get("/api/pedidos/{id}/estado", h.GetEstadoLogs)
		r.Post("/api/pedidos/{id}/pago", h.RegistrarPagoHandler)
		r.Post("/api/pedidos/{id}/entrega", h.MarcarEntrega)
		r.Post("/api/pedidos/{id}/paquetes", h.GenerarPaquetes)
		r.Post("/api/pedidos/{id}/recepcion", h.Recepcionar)
		r.Post("/api/pedidos/{id}/aceptar", h.AceptarPedido)
		r.Get("/api/pedidos/{id}/imprimir", h.GetPrintCount)
		r.Post("/api/pedidos/{id}/imprimir", h.IncrementPrintCount)

		// Clientes
		r.Get("/api/clientes", h.GetClientes)
		r.Post("/api/clientes", h.CreateCliente)
		r.Patch("/api/clientes/{id}", h.UpdateCliente)

		// Caja
		r.Get("/api/cajon", h.GetCajon)
		r.Post("/api/cajon", h.OpenCajon)
		r.Post("/api/cajon/{id}/movimiento", h.AddMovimiento)
		r.Post("/api/cajon/{id}/cierre", h.CerrarCajon)
		r.Get("/api/cajon/{id}/reporte", h.GetReporte)
		r.Get("/api/cajon/conceptos", h.GetConceptos)

		// Sucursales
		r.Get("/api/sucursales", h.GetSucursales)
		r.Post("/api/sucursales", h.CreateSucursal)
		r.Delete("/api/sucursales", h.DeleteSucursal)

		// Depósito
		r.Get("/api/deposito", h.GetDeposito)

		// Chofer
		r.Get("/api/chofer", h.GetChofer)

		// Admin: Usuarios
		r.Get("/api/admin/usuarios", h.GetUsuarios)
		r.Post("/api/admin/usuarios", h.CreateUsuario)
		r.Patch("/api/admin/usuarios/{id}", h.UpdateUsuario)
	})

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Servidor escuchando en %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
