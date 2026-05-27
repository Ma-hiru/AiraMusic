package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func objectRoutes(app *gin.Engine) {
	app.POST("/api/object/store", handlers.StoreObject)
	app.POST("/api/object/store/multi", handlers.StoreObjectMulti)
	app.GET("/api/object/fetch", handlers.FetchObject)
	app.POST("/api/object/fetch/multi", handlers.FetchObjectMulti)
}
