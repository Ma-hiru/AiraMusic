package handler

import (
	"fileServer/file"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Fetch(ctx *gin.Context) {
	fetch(ctx)
}

func fetch(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.Status(404)
		return
	}
	// 如果文件已缓存，检查ETag以处理缓存验证
	if match := ctx.Request.Header.Get("If-None-Match"); match == index.ETag {
		ctx.Status(http.StatusNotModified)
		return
	}
	var storeFile, err = store.Fetch(index)
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	defer storeFile.Close()
	ctx.Status(200)
	setHeaders(ctx, index)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
