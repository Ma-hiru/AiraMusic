package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"store/env"
	"store/file"
	"store/router"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	var flags = env.LoadFlags()
	go initStore(flags.Path, file.StoreOption{
		FileScheme:     flags.Scheme,
		FileSchemeHost: flags.SchemeHostname,
		TimeLimit:      flags.Ttl,
	})
	go initHTTP("127.0.0.1:"+fmt.Sprint(flags.Port), flags.Key)
	handleExit()
}

func initStore(storePath string, storeOption file.StoreOption) {
	fmt.Println("Initializing local store...")
	var meta *file.StoreMeta
	var err error

	if meta, err = file.CreateLocalStore(storePath); err != nil {
		if !errors.Is(err, file.ErrStoreExist) {
			fmt.Println("Failed to create local store:", err)
			os.Exit(114514)
		}
		fmt.Println("Local store already exists, loading existing store...")
	}
	if err := file.LoadLocalStore(meta); err != nil {
		fmt.Println("Failed to load local store:", err)
		os.Exit(114514)
	}
	file.SetStoreOption(storeOption)
	fmt.Println("Local store initialized at:", storePath)

	fmt.Println("Clearing invalid files from store...")
	err = file.GetStore().ClearInvalidFile()
	if err != nil {
		fmt.Println("Error clearing invalid files:", err)
	}
}

func initHTTP(port string, key string) {
	fmt.Println("Initializing HTTP server at", port)
	gin.SetMode(gin.ReleaseMode)
	var app = gin.Default()
	app.Use(cors.Default())
	app.Use(func(ctx *gin.Context) {
		if key == "" {
			ctx.Next()
			return
		}
		if ctx.Query("key") != key && ctx.GetHeader("Authorization") != key {
			ctx.AbortWithStatus(401)
			return
		}
		ctx.Next()
	})
	router.RegisterRoutes(app)
	if err := app.Run(port); err != nil {
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
			fmt.Println("Shutting down store...")
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
