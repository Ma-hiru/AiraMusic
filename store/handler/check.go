package handler

import (
	"fileServer/file"

	"github.com/gin-gonic/gin"
)

func Check(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	ctx.JSON(200, gin.H{
		"ok":    ok,
		"index": index,
	})
}

type CheckItem struct {
	Id string `json:"id" binding:"required"`
}

type CheckMutilShouldBind struct {
	Items []CheckItem `json:"items" binding:"required"`
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
	for _, item := range requestParam.Items {
		var index, ok = store.Check(item.Id)
		if ok {
			result = append(result, gin.H{
				"ok":    ok,
				"index": index,
			})
			continue
		}
		result = append(result, gin.H{
			"ok":    false,
			"index": file.Index{},
		})
	}
	ctx.JSON(200, gin.H{
		"ok":      true,
		"results": result,
	})
}
