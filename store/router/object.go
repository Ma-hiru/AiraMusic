package router

import (
	"fileServer/handler"

	"github.com/gin-gonic/gin"
)

func objectRoutes(app *gin.Engine) {
	app.POST("/api/object/store", handler.StoreObject)
	app.GET("/api/object/fetch", handler.FetchObject)
	app.POST("/api/object/edit", handler.EditObject)
}
