package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func checkStoreRoutes(app *gin.Engine) {
	app.Any("/api/check-store", handlers.CheckOrStoreAsync)
	app.POST("/api/check-store/multi", handlers.CheckOrStoreAsyncMulti)
}
