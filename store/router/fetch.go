package router

import (
	"fileServer/handler"

	"github.com/gin-gonic/gin"
)

func fetchRoutes(app *gin.Engine) {
	app.GET("/api/fetch", handler.Fetch)
	app.GET("/api/fetch/object", handler.FetchObject)
}
