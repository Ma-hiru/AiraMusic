package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func storeRoutes(app *gin.Engine) {
	app.Any("/api/store/async", handlers.StoreAsync)
	app.POST("/api/store/async/multi", handlers.StoreAsyncMulti)
}
