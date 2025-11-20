package handler

import (
	"context"
	"fileServer/file"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Check(ctx *gin.Context) {
	var url = ctx.Query("url")
	var store = file.GetStore()
	var index, ok = store.Check(url)
	ctx.JSON(200, gin.H{
		"ok":    ok,
		"index": index,
	})
}
func Store(ctx *gin.Context) {
	var url = ctx.Query("url")
	var httpClint = http.DefaultClient
	var resp, err = httpClint.Get(url)
	if err != nil {
		ctx.Status(500)
		log.Panicln(err)
		return
	}

	var store = file.GetStore()
	var fileType = resp.Header.Get("Content-Type")
	var fileSize = resp.Header.Get("Content-Length")
	var fileMD5 = resp.Header.Get("Content-MD5")
	var lastModified = resp.Header.Get("Last-Modified")
	var fileName = getNameFromURL(url)
	index, err := store.Store(context.Background(), resp.Body, url, fileName, fileType, fileSize, fileMD5, lastModified)
	if err != nil {
		ctx.Status(500)
		log.Panicln(err)
		return
	}

	ctx.JSON(200, gin.H{
		"ok":    true,
		"index": index,
	})
}
func Fetch(ctx *gin.Context) {
	var url = ctx.Query("url")
	var store = file.GetStore()
	var index, ok = store.Check(url)
	if !ok {
		ctx.Status(404)
		return
	}
	var storeFile = store.Fetch(index)
	setHeaders(ctx, index)
	ctx.Stream(func(w io.Writer) bool {
		_, err := io.Copy(w, storeFile)
		if err != nil {
			log.Println("error streaming fetch:", err)
		}
		return false
	})
}
func Remove(ctx *gin.Context) {
	var url = ctx.Query("url")
	var store = file.GetStore()
	var index, ok = store.Check(url)
	if !ok {
		ctx.Status(404)
		return
	}
	success, err := store.Remove(index)
	if err != nil {
		ctx.Status(500)
		log.Panicln(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    success,
		"index": index,
	})
}
func Clear(ctx *gin.Context) {
	var store = file.GetStore()
	count, err := store.Clear()
	if err != nil {
		ctx.Status(500)
		log.Panicln(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    true,
		"count": count,
	})
}
func Count(ctx *gin.Context) {
	var store = file.GetStore()
	var count = store.Count()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"count": count,
	})
}
func Info(ctx *gin.Context) {
	var store = file.GetStore()
	var size = store.Size()
	var count = store.Count()
	var path = store.Path()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"size":  size,
		"count": count,
		"path":  path,
	})
}
