package router

import (
	"fileServer/handler"
	"net/http"

	"github.com/gin-gonic/gin"
)

func SetRouter(app *gin.Engine) {
	app.GET("/api/check", handler.Check)
	app.GET("/api/store", handler.Store)
	app.GET("/api/fetch", handler.Fetch)
	app.GET("/api/remove", handler.Remove)
	app.GET("/api/clear", handler.Clear)
	app.GET("/api/count", handler.Count)
	app.GET("/api/info", handler.Info)
	app.GET("/api/wrap", handler.Wrap)
	app.GET("/.well-known/appspecific/com.chrome.devtools.json", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
}
