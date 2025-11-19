package router

import (
	"fileServer/file"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func SetRouter(app *gin.Engine) {
	app.GET("/api/check", func(ctx *gin.Context) {
		var url = ctx.Query("url")
		var store = file.GetStore()
		var index, ok = store.Check(url)
		ctx.JSON(200, gin.H{
			"ok":    ok,
			"index": index,
		})
	})
	app.GET("/api/store", func(ctx *gin.Context) {
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
		var fileName = getNameFromURL(url)
		index, err := store.Store(resp.Body, url, fileName, fileType)
		if err != nil {
			ctx.Status(500)
			log.Panicln(err)
			return
		}

		ctx.JSON(200, gin.H{
			"ok":    true,
			"index": index,
		})
	})
	app.GET("/api/fetch", func(ctx *gin.Context) {
		var url = ctx.Query("url")
		var store = file.GetStore()
		var index, ok = store.Check(url)
		if !ok {
			ctx.Status(404)
			return
		}
		var storeFile = store.Fetch(index)
		ctx.Header("Content-Disposition", "attachment; filename=\""+index.Name+"\"")
		ctx.Header("Content-Type", index.Type)

		ctx.Header("Content-Length", strconv.FormatInt(index.Size, 10))
		ctx.Stream(func(w io.Writer) bool {
			_, err := io.Copy(w, storeFile)
			return err == nil
		})
	})
	app.GET("/api/remove", func(ctx *gin.Context) {
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
	})
	app.GET("/api/clear", func(ctx *gin.Context) {
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
	})
	app.GET("/api/count", func(ctx *gin.Context) {
		var store = file.GetStore()
		var count = store.Count()
		ctx.JSON(200, gin.H{
			"ok":    true,
			"count": count,
		})
	})
}

func getNameFromURL(url string) string {
	var token = strings.Split(url, "/")
	return token[len(token)-1]
}
