package routes

import (
	"store/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(app *gin.Engine) {
	app.POST("/api/check/readonly", handlers.CheckIdx)
	app.POST("/api/check/store", handlers.CheckIdxOrStore)

	app.POST("/api/save/url", handlers.SaveFromURL)
	app.POST("/api/save/json", handlers.SaveFromJSON)

	app.GET("/api/read", handlers.Read)
	app.POST("/api/read/json", handlers.ReadJSON)
	app.POST("/api/delete", handlers.Delete)

	app.GET("/api/clear/all", handlers.Clear)
	app.GET("/api/clear/invalid", handlers.ClearInvalid)
	app.GET("/api/categories", handlers.Categories)
	app.GET("/api/info", handlers.Info)
	app.GET("/api/exit", handlers.Exit)
	app.GET("/api/ping", handlers.Ping)
	app.GET("/api/move", handlers.Move)
}
