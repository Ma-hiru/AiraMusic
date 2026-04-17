package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func objectRoutes(app *gin.Engine) {
	app.POST("/api/object/store", handler.StoreObject)
	app.POST("/api/object/store/multi", handler.StoreObjectMulti)
	app.GET("/api/object/fetch", handler.FetchObject)
	app.POST("/api/object/fetch/multi", handler.FetchObjectMulti)
}
