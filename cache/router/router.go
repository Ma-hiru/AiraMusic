package router

import (
	"context"
	"fileServer/file"
	"fmt"
	"io"
	"log"
	"net/http"
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
		var fileSize = resp.Header.Get("Content-Length")
		var fileName = getNameFromURL(url)
		index, err := store.Store(context.Background(), resp.Body, url, fileName, fileType, fileSize)
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
		ctx.Header("Content-Length", index.Size)
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
	app.GET("/api/wrap", func(ctx *gin.Context) {
		var url = ctx.Query("url")
		if url == "" {
			ctx.Status(404)
			return
		}
		var store = file.GetStore()
		var index, ok = store.Check(url)
		if !ok {
			var httpClint = http.DefaultClient
			var resp, err = httpClint.Get(url)
			if err != nil {
				ctx.Status(500)
				log.Panicln(err)
				return
			}
			var fileType = resp.Header.Get("Content-Type")
			var fileSize = resp.Header.Get("Content-Length")
			var fileDisposition = resp.Header.Get("Content-Disposition")
			var fileName = getNameFromURL(url)
			fmt.Println("file not found in store, fetching from source:", url)

			pr, pw := io.Pipe()
			var cancelCtx, cancel = context.WithCancel(ctx)
			go func() {
				defer pr.Close()
				fmt.Println("storing file to store:", url)
				_, err := store.Store(cancelCtx, pr, url, fileName, fileType, fileSize)
				if err != nil || cancelCtx.Err() != nil {
					var index, ok = store.Check(url)
					if ok {
						_, _ = store.Remove(index)
					}
				}
			}()

			if fileDisposition != "" {
				ctx.Header("Content-Disposition", fileDisposition)
			} else {
				ctx.Header("Content-Disposition", "inline; filename=\""+fileName+"\"")
			}
			ctx.Header("Content-Type", fileType)
			ctx.Header("Content-Length", fileSize)
			ctx.Header("Cache-Control", "public, max-age=31536000, immutable")
			ctx.Stream(func(w io.Writer) bool {
				fmt.Println("streaming file to client from source:", url)
				// copy resp.Body into both the client writer and the pipe writer
				mw := io.MultiWriter(w, pw)
				_, err := io.Copy(mw, resp.Body)
				if err != nil {
					fmt.Println("error during streaming:", err)
					cancel()
				}
				_ = pw.Close()
				return err == nil
			})
			return
		}
		if match := ctx.Request.Header.Get("If-None-Match"); match == index.ETag {
			ctx.Status(http.StatusNotModified)
			return
		}
		fmt.Println("file found in store, fetching from store:", url)
		var storeFile = store.Fetch(index)
		ctx.Header("Content-Disposition", "inline; filename=\""+index.Name+"\"")
		ctx.Header("Cache-Control", "public, max-age=31536000, immutable")
		ctx.Header("Content-Type", index.Type)
		ctx.Header("Content-Length", index.Size)
		ctx.Stream(func(w io.Writer) bool {
			_, err := io.Copy(w, storeFile)
			return err == nil
		})
	})
}

func getNameFromURL(url string) string {
	var token = strings.Split(url, "/")
	return token[len(token)-1]
}
