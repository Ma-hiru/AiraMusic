package routes

import (
	"github.com/gin-gonic/gin"

	"store/handlers"
)

func storeRoutes(app *gin.Engine) {
	app.Any("/api/store/async", handlers.StoreAsync)
	app.POST("/api/store/async/multi", handlers.StoreAsyncMulti)
}
