package handler

import (
	"store/file"

	"github.com/gin-gonic/gin"
)

func CheckOrStoreAsync(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	var update, timeLimit = getOptionQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	var needUpdate = !ok || update || timeLimit > 0 && index.IsExpiredMill(timeLimit)
	if needUpdate {
		go download(id, url, ctx.Request.Method, ctx.Request.Body, ctx.Request.Header)
		ctx.JSON(200, gin.H{
			"ok":    false,
			"index": file.Index{},
		})
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    true,
		"index": index,
	})
}

func CheckOrStoreAsyncMulti(ctx *gin.Context) {
	var requestParam = StoreMultiShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":      false,
			"results": []gin.H{},
			"error":   "invalid parameters",
		})
		return
	}

	var store = file.GetStore()
	var result = make([]gin.H, 0, len(requestParam.Items))
	for _, item := range requestParam.Items {
		var index, ok = store.Check(item.Id)
		var needUpdate = !ok || item.Update || item.TimeLimit > 0 && index.IsExpiredMill(item.TimeLimit)
		if needUpdate {
			item.Id, item.Url = handleURLAndID(item.Id, item.Url)
			if item.Url != "" {
				go download(item.Id, item.Url, requestParam.Method, nil, ctx.Request.Header)
			}
			result = append(result, gin.H{
				"ok":    false,
				"index": file.Index{},
			})
			continue
		}
		result = append(result, gin.H{
			"ok":    ok,
			"index": index,
		})
	}

	ctx.JSON(200, gin.H{
		"ok":      true,
		"results": result,
	})
}
