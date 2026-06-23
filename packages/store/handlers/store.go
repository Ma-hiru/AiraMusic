package handlers

import (
	"store/core"

	"github.com/gin-gonic/gin"
)

func StoreAsync(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	var update, timeLimit = getOptionQuery(ctx)
	var store = core.GetStore()
	// 已缓存且未要求强制更新、未过期时直接跳过
	// 避免重复下载并在 appendIndex 时删除正在播放的缓存文件
	if index, ok := store.CheckByID(id); ok && !update && !(timeLimit > 0 && index.IsExpiredMill(timeLimit)) {
		ctx.JSON(200, gin.H{
			"ok": true,
		})
		return
	}
	queueDownload(id, url, ctx.Request.Method, ctx.Request.Body, ctx.Request.Header)
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
	var store = core.GetStore()
	for _, item := range requestParam.Items {
		item.Id, item.Url = handleURLAndID(item.Id, item.Url)
		if item.Url == "" {
			continue
		}
		// 同 StoreAsync
		if index, ok := store.CheckByID(item.Id); ok && !item.Update && !(item.TimeLimit > 0 && index.IsExpiredMill(item.TimeLimit)) {
			continue
		}
		queueDownload(item.Id, item.Url, requestParam.Method, nil, ctx.Request.Header)
	}
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}
