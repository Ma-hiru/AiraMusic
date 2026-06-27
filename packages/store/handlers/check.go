package handlers

import (
	"store/core"

	"github.com/gin-gonic/gin"
)

type CheckItem struct {
	Id        string `form:"id" json:"id" binding:"required"`
	TimeLimit int64  `form:"timeLimit" json:"timeLimit,omitempty"`
}

type CheckIdxParams struct {
	Items []CheckItem `form:"items" json:"items" binding:"required"`
}

type CheckRes struct {
	Ok  bool       `json:"ok"`
	Idx core.Index `json:"idx"`
}

// CheckIdx 检查文件是否存在
func CheckIdx(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &CheckIdxParams{}); ok {
		sendOkResponse(ctx, checkIdx(requestParam, store))
	}
}

// CheckIdxOrStore 检查文件是否存在，不存在则存储
func CheckIdxOrStore(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &SaveURLParams{}); ok {
		var Items = make([]CheckItem, 0, len(requestParam.Items))
		for _, i := range requestParam.Items {
			Items = append(Items, CheckItem{
				Id:        i.Id,
				TimeLimit: i.TimeLimit,
			})
		}

		var res = checkIdx(&CheckIdxParams{Items}, store)
		var needSave = make([]SaveURLItem, 0, len(requestParam.Items))
		for i, r := range res {
			if !r.Ok {
				needSave = append(needSave, requestParam.Items[i])
			}
		}

		saveFromURL(&SaveURLParams{Items: needSave, Method: requestParam.Method}, store, ctx.Request.Header.Clone())
		sendOkResponse(ctx, res)
	}
}

func checkIdx(requestParam *CheckIdxParams, store *core.Store) []CheckRes {
	var res = make([]CheckRes, 0, len(requestParam.Items))

	for _, item := range requestParam.Items {
		var idx, ok = store.CheckByID(item.Id)
		if !ok || (item.TimeLimit > 0 && idx.IsExpiredMill(item.TimeLimit)) {
			res = append(res, CheckRes{
				Ok:  false,
				Idx: core.Index{},
			})
			continue
		}
		res = append(res, CheckRes{
			Ok:  true,
			Idx: idx,
		})
	}

	return res
}
