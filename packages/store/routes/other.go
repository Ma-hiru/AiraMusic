package routes

import (
	"net/http"
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func otherRoutes(app *gin.Engine) {
	app.GET("/api/remove", handlers.Remove)
	app.GET("/api/remove/async", handlers.RemoveAsync)
	app.POST("/api/remove/multi", handlers.RemoveMulti)
	app.GET("/api/remove/invalid", handlers.RemoveInvalid)
	app.GET("/api/size", handlers.Size)
	app.GET("/api/size/categories", handlers.SizeCategories)
	app.GET("/api/clear", handlers.Clear)
	app.GET("/api/count", handlers.Count)
	app.GET("/api/info", handlers.Info)
	app.GET("/api/move", handlers.Move)
	app.GET("/api/cancel", handlers.Cancel)
	app.POST("/api/cancel/multi", handlers.CancelMulti)
	app.GET("/api/exit", handlers.Exit)
	app.GET("/api/ping", handlers.Ping)
	app.GET("/.well-known/appspecific/com.chrome.devtools.json", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
}
