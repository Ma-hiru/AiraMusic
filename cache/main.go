package main

import (
	"context"
	"fileServer/file"
	"fileServer/router"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	var err = file.InitStore(os.TempDir(), time.Hour*24*3)
	if err != nil {
		panic(err)
	}
	go handleExit()

	var app = gin.Default()
	gin.SetMode(gin.ReleaseMode)
	app.Use(cors.Default())
	router.SetRouter(app)
	if err := app.Run("127.0.0.1:8824"); err != nil {
		panic(err)
	}
}

func handleExit() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	if s := file.GetStore(); s != nil {
		done := make(chan struct{})
		go func() {
			_ = s.Destroy()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
		}
	}
	os.Exit(0)
}
