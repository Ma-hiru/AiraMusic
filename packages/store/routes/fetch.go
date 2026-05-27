package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func fetchRoutes(app *gin.Engine) {
	app.GET("/api/fetch", handlers.Fetch)
}
