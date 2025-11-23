package main

import (
	"context"
	"errors"
	"fileServer/file"
	"fileServer/router"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	handleExit()
	go initStore(time.Hour * 24 * 7)
	initHTTP("127.0.0.1:8824")
}

func initStore(timeLimit time.Duration) {
	fmt.Println("Initializing local store...")
	var localStorePath = filepath.Join(os.TempDir(), "mahiru")
	if err := file.CreateLocalStore(localStorePath, 1); err != nil {
		if !errors.Is(err, file.ErrStoreExist) {
			fmt.Println("Failed to create local store:", err)
			os.Exit(114514)
		}
		fmt.Println("Local store already exists, loading existing store...")
	}
	if err := file.LoadLocalStore(localStorePath, timeLimit); err != nil {
		fmt.Println("Failed to load local store:", err)
		os.Exit(114514)
	}
	fmt.Println("Local store initialized at:", localStorePath)
	go func() {
		var store = file.GetStore()
		fmt.Println("Clearing invalid files from store...")
		err := store.ClearInvalidFile()
		if err != nil {
			fmt.Println("Error clearing invalid files:", err)
		}
	}()
}

func initHTTP(port string) {
	fmt.Println("Initializing HTTP server...")
	gin.SetMode(gin.ReleaseMode)
	var app = gin.Default()
	app.Use(cors.Default())
	router.SetRouter(app)
	if err := app.Run(port); err != nil {
		panic(err)
	}
}

func handleExit() {
	go func() {
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
	}()
}
