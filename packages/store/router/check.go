package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func checkRoutes(app *gin.Engine) {
	app.GET("/api/check", handler.Check)
	app.POST("/api/check/multi", handler.CheckMulti)
}
