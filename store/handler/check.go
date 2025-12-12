package handler

import (
	"store/file"

	"github.com/gin-gonic/gin"
)

func Check(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var _, timeLimit = getOptionQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok || timeLimit > 0 && index.IsExpiredMill(timeLimit) {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"index": file.Index{},
		})
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    ok,
		"index": index,
	})
}

type CheckItem struct {
	Id        string `json:"id" binding:"required"`
	TimeLimit int64  `json:"timeLimit"`
}

type CheckMutilShouldBind struct {
	Items     []CheckItem `json:"items" binding:"required"`
	TimeLimit int64       `json:"timeLimit"`
}

func CheckMutil(ctx *gin.Context) {
	var requestParam = CheckMutilShouldBind{}
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
	var timeLimit = requestParam.TimeLimit
	for _, item := range requestParam.Items {
		var index, ok = store.Check(item.Id)
		if !ok {
			result = append(result, gin.H{
				"ok":    false,
				"index": file.Index{},
			})
			continue
		}
		var needUpdate = item.TimeLimit > 0 && index.IsExpiredMill(item.TimeLimit) || timeLimit > 0 && index.IsExpiredMill(timeLimit)
		if needUpdate {
			result = append(result, gin.H{
				"ok":    false,
				"index": file.Index{},
			})
			continue
		}
		result = append(result, gin.H{
			"ok":    true,
			"index": index,
		})
	}
	ctx.JSON(200, gin.H{
		"ok":      true,
		"results": result,
	})
}
