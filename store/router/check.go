package router

import (
	"fileServer/handler"

	"github.com/gin-gonic/gin"
)

func checkRoutes(app *gin.Engine) {
	app.GET("/api/check", handler.Check)
	app.POST("/api/check/mutil", handler.CheckMutil)
}
