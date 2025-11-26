package router

import (
	"fileServer/handler"

	"github.com/gin-gonic/gin"
)

func storeRoutes(app *gin.Engine) {
	app.POST("/api/store", handler.Store)
	app.Any("/api/store/async", handler.StoreAsync)
	app.POST("/api/store/async/mutil", handler.StoreAsyncMutil)
}
