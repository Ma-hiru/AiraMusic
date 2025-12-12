package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func storeRoutes(app *gin.Engine) {
	app.Any("/api/store/async", handler.StoreAsync)
	app.POST("/api/store/async/mutil", handler.StoreAsyncMutil)
}
