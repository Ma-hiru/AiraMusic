package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func fetchRoutes(app *gin.Engine) {
	app.GET("/api/fetch", handler.Fetch)
}
