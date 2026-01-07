package router

import (
	"store/handler"

	"github.com/gin-gonic/gin"
)

func objectRoutes(app *gin.Engine) {
	app.POST("/api/object/store", handler.StoreObject)
	app.GET("/api/object/fetch", handler.FetchObject)
}
