package routes

import (
	"github.com/gin-gonic/gin"

	"store/handlers"
)

func checkStoreRoutes(app *gin.Engine) {
	app.Any("/api/check-store", handlers.CheckOrStoreAsync)
	app.POST("/api/check-store/multi", handlers.CheckOrStoreAsyncMulti)
}
