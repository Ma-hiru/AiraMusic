package handlers

import (
	"bytes"
	"errors"
	"log"
	"net/http"
	neturl "net/url"

	"store/core"
	"store/utils"

	"github.com/gin-gonic/gin"
)

func Read(ctx *gin.Context) {
	var id, err = neturl.QueryUnescape(ctx.Query("id"))
	if id == "" || err != nil {
		ctx.Status(http.StatusBadRequest)
		return
	}

	var store = core.GetStore()
	if store == nil {
		ctx.Status(http.StatusInternalServerError)
		return
	}

	var idx, ok = store.CheckByID(id)
	if !ok {
		ctx.Status(http.StatusNotFound)
		return
	}

	if err := idx.MergeChunk(ctx, store.Dir()); err != nil {
		if errors.Is(err, utils.ErrMergeChunkClientClosed) {
			return
		}
		if !ctx.Writer.Written() {
			log.Println(err)
			sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
			return
		}
		return
	}
}

type ReadJSONParam struct {
	IDs       []string `form:"ids" json:"ids" binding:"required"`
	TimeLimit int64    `form:"timeLimit" json:"timeLimit,omitempty"`
}

func ReadJSON(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &ReadJSONParam{}); ok {
		var data = make([]*string, 0, len(requestParam.IDs))
		for _, id := range requestParam.IDs {
			var idx, ok = store.CheckByID(id)
			if ok && (requestParam.TimeLimit <= 0 || !idx.IsExpiredMill(requestParam.TimeLimit)) {
				var buf bytes.Buffer
				err := utils.MergeChunk(
					ctx.Request.Context(),
					&buf,
					idx.Key,
					store.Dir(),
					idx.Chunks,
				)
				if err != nil {
					sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
					return
				}
				data = append(data, new(buf.String()))
			} else {
				data = append(data, nil)
			}
		}

		sendOkResponse(ctx, data)
	}
}

type DeleteParams struct {
	IDs []string `form:"ids" json:"ids" binding:"required"`
}

func Delete(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &DeleteParams{}); ok {
		for _, id := range requestParam.IDs {
			if idx, ok := store.CheckByID(id); ok {
				if err := store.RemoveByIdx(idx); err != nil {
					log.Println(err)
					sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
					return
				}
			}
		}
		sendOkResponse(ctx, nil)
	}
}
