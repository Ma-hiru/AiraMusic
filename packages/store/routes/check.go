package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func checkRoutes(app *gin.Engine) {
	app.GET("/api/check", handlers.Check)
	app.POST("/api/check/multi", handlers.CheckMulti)
}
