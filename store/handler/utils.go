package handler

import (
	"fmt"
	neturl "net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func getNameFromURL(url string) string {
	var token = strings.Split(url, "/")
	return token[len(token)-1]
}

func getRequireQuery(ctx *gin.Context) (id string, url string) {
	id = ctx.Query("id")
	url = ctx.Query("url")
	return handleURLAndID(id, url)
}

func handleURLAndID(id, url string) (string, string) {
	//  URL 解码
	if decoded, err := neturl.QueryUnescape(url); err == nil {
		url = decoded
	}
	if id == "" {
		id = url
	}
	return id, url
}

func getOptionQuery(ctx *gin.Context) (update bool, timeLimit int64) {
	update = ctx.Query("update") == "true"
	var tl = ctx.Query("timeLimit")
	if tl != "" {
		var _, err = fmt.Sscanf(tl, "%d", &timeLimit)
		if err != nil {
			timeLimit = 0
		}
	}
	return
}
