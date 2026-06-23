package routes

import (
	"github.com/gin-gonic/gin"

	"store/handlers"
)

func fetchRoutes(app *gin.Engine) {
	app.GET("/api/fetch", handlers.Fetch)
}
