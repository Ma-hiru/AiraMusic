package handler

import (
	"fileServer/file"
	neturl "net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func setHeaders(ctx *gin.Context, index file.Index) {
	ctx.Header("Cache-Control", "no-cache")
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

func getRequireQuery(ctx *gin.Context) (id string, url string) {
	id = ctx.Query("id")
	url = ctx.Query("url")
	//  URL 解码
	if decoded, err := neturl.QueryUnescape(url); err == nil {
		url = decoded
	}
	if id == "" {
		id = url
	}
	return
}
