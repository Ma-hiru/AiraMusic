package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func checkStoreRoutes(app *gin.Engine) {
	app.GET("/api/check-store", handler.CheckOrStoreAsync)
	app.POST("/api/check-store/multi", handler.CheckOrStoreAsyncMulti)
}
