package handler

import (
	"fileServer/file"
	"strings"

	"github.com/gin-gonic/gin"
)

func setHeaders(ctx *gin.Context, index file.Index) {
	ctx.Header("Cache-Control", "no-cache")
	if index.Name != "" {
		ctx.Header("Content-Disposition", "inline; filename=\""+index.Name+"\"")
	}
	if index.ETag != "" {
		ctx.Header("ETag", index.ETag)
	}
	if index.Type != "" {
		ctx.Header("Content-Type", index.Type)
	}
	if index.Size != "" {
		ctx.Header("Content-Length", index.Size)
	}
}

func getNameFromURL(url string) string {
	var token = strings.Split(url, "/")
	return token[len(token)-1]
}
