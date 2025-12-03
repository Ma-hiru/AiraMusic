package router

import (
	"fileServer/handler"
	"net/http"

	"github.com/gin-gonic/gin"
)

func otherRoutes(app *gin.Engine) {
	app.GET("/api/remove", handler.Remove)
	app.GET("/api/remove/async", handler.RemoveAsync)
	app.GET("/api/clear", handler.Clear)
	app.GET("/api/count", handler.Count)
	app.GET("/api/size", handler.Size)
	app.GET("/api/size/categories", handler.SizeCategories)
	app.GET("/api/info", handler.Info)
	app.GET("/api/remove/invalid", handler.RemoveInvalid)
	app.GET("/.well-known/appspecific/com.chrome.devtools.json", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
}
