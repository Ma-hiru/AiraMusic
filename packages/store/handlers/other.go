package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"store/cmd"
	"store/core"

	"github.com/gin-gonic/gin"
)

func Clear(ctx *gin.Context) {
	if store, ok := storeCheck(ctx); ok {
		if count, err := store.Clear(); err != nil {
			log.Println(err)
			sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
			return
		} else {
			sendOkResponse(ctx, count)
		}
	}
}

func Info(ctx *gin.Context) {
	if store, ok := storeCheck(ctx); ok {
		sendOkResponse(ctx, gin.H{
			"size":  store.TotalBytes(),
			"count": store.ItemCount(),
			"path":  store.Dir(),
		})
	}
}

func ClearInvalid(ctx *gin.Context) {
	if store, ok := storeCheck(ctx); ok {
		if err := store.ClearInvalidFile(); err != nil {
			log.Println(err)
			sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
			return
		}
		sendOkResponse(ctx, nil)
	}
}

func Categories(ctx *gin.Context) {
	if store, ok := storeCheck(ctx); ok {
		var categories = store.TotalBytesByCategory()
		sendOkResponse(ctx, categories)
	}
}

func Move(ctx *gin.Context) {
	var newPath = ctx.Query("path")
	if newPath == "" {
		ctx.SSEvent("done", "missing path parameter")
		return
	}

	var store = core.GetStore()
	if store == nil {
		ctx.SSEvent("done", "store not initialized")
		return
	}

	var progress = make(chan core.MoveProgressChan, 100)
	var moveErr = make(chan error, 1)

	go func() {
		var err = store.Move(newPath, progress)
		if err != nil {
			log.Println(err)
		}
		moveErr <- err
		close(progress)
	}()

	for p := range progress {
		var data, _ = json.Marshal(p)
		ctx.SSEvent("message", string(data))
	}
	if err := <-moveErr; err != nil {
		ctx.SSEvent("done", err.Error())
		return
	}

	ctx.SSEvent("done", "")
}

func Exit(ctx *gin.Context) {
	sendOkResponse(ctx, "shutdown requested")
	go cmd.Shutdown()
}

func Ping(ctx *gin.Context) {
	ctx.Data(http.StatusOK, "text/plain", []byte("ok"))
}
