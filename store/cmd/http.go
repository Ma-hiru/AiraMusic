package cmd

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var httpServer *http.Server

func InitHTTP(port string, key string, registerRoutes func(*gin.Engine)) {
	gin.SetMode(gin.ReleaseMode)
	var app = gin.Default()
	app.Use(cors.Default())
	app.Use(func(ctx *gin.Context) {
		if key == "" {
			ctx.Next()
			return
		}
		if ctx.GetHeader("Authorization") != key && ctx.Query("key") != key {
			ctx.AbortWithStatus(401)
			return
		}
		ctx.Next()
	})
	registerRoutes(app)
	fmt.Println("Initializing HTTP server at", port)
	httpServer = &http.Server{
		Addr:    port,
		Handler: app,
	}
	if err := httpServer.ListenAndServe(); err != nil {
		if errors.Is(err, http.ErrServerClosed) {
			fmt.Println("HTTP server stopped.")
		} else {
			panic(err)
		}
	}
}
