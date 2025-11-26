package router

import (
	"fileServer/ws"

	"github.com/gin-gonic/gin"
)

func wsRoutes(app *gin.Engine) {
	app.GET("/ws", func(ctx *gin.Context) {
		ws.GetInstance().HandleWS(ctx.Writer, ctx.Request)
	})
}
