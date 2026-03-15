package handler

import (
	"github.com/gin-gonic/gin"
)

func StoreAsync(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	go download(id, url, ctx.Request.Method, ctx.Request.Body, ctx.Request.Header)
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

type StoreItem struct {
	Id        string `json:"id"`
	Url       string `json:"url" binding:"required"`
	Update    bool   `json:"update"`
	TimeLimit int64  `json:"timeLimit"`
}

type StoreMultiShouldBind struct {
	Items  []StoreItem `json:"items" binding:"required"`
	Method string      `json:"method" binding:"required"`
}

func StoreAsyncMulti(ctx *gin.Context) {
	var requestParam = StoreMultiShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	for _, item := range requestParam.Items {
		item.Id, item.Url = handleURLAndID(item.Id, item.Url)
		if item.Url == "" {
			continue
		}
		// todo 控制下载数目
		go download(item.Id, item.Url, requestParam.Method, nil, ctx.Request.Header)
	}
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}
