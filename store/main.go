package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"store/env"
	"store/file"
	"store/router"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	handleExit()
	go initStore(env.Ttl, env.Path)
	initHTTP("127.0.0.1:" + fmt.Sprint(env.Port))
}

func initStore(timeLimit time.Duration, storePath string) {
	fmt.Println("Initializing local store...")
	var localStorePath = filepath.Join(os.TempDir(), "mahiru")
	if storePath != "" {
		localStorePath = storePath
	}
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
	fmt.Println("Initializing HTTP server at", port)
	gin.SetMode(gin.ReleaseMode)
	var app = gin.Default()
	app.Use(cors.Default())
	router.RegisterRoutes(app)
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
