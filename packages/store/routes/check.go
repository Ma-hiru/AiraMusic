package routes

import (
	"github.com/gin-gonic/gin"

	"store/handlers"
)

func checkRoutes(app *gin.Engine) {
	app.GET("/api/check", handlers.Check)
	app.POST("/api/check/multi", handlers.CheckMulti)
}
