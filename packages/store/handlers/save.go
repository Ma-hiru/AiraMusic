package handlers

import (
	"log"
	"net/http"

	"store/core"

	"github.com/gin-gonic/gin"
)

type SaveURLItem struct {
	Id        string             `form:"id" json:"id" binding:"required"`
	Url       string             `form:"url" json:"url" binding:"required"`
	Category  core.StoreCategory `form:"category" json:"category" binding:"required"`
	Update    bool               `form:"update" json:"update,omitempty"`
	TimeLimit int64              `form:"timeLimit" json:"timeLimit,omitempty"`
}

type SaveURLParams struct {
	Items  []SaveURLItem `form:"items" json:"items" binding:"required"`
	Method string        `form:"method" json:"method" binding:"required"`
}

// SaveFromURL 下载数据
func SaveFromURL(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &SaveURLParams{}); ok {
		go saveFromURL(requestParam, store, ctx.Request.Header.Clone())
		sendOkResponse(ctx, nil)
	}
}

type SaveJsonItem struct {
	Id        string `form:"id" json:"id" binding:"required"`
	Data      string `form:"data" json:"data" binding:"required"`
	Update    bool   `form:"update" json:"update,omitempty"`
	TimeLimit int64  `form:"timeLimit" json:"timeLimit,omitempty"`
}

type SaveJsonParams struct {
	Items []SaveJsonItem `form:"items" json:"items" binding:"required"`
}

// SaveFromJSON 保存json
func SaveFromJSON(ctx *gin.Context) {
	if requestParam, store, ok := bindingCheck(ctx, &SaveJsonParams{}); ok {
		if err := saveFromJSON(requestParam, store); err != nil {
			log.Println(err)
			sendErrResponse(ctx, http.StatusInternalServerError, err.Error())
			return
		}
		sendOkResponse(ctx, nil)
	}
}

func saveFromURL(requestParam *SaveURLParams, store *core.Store, header http.Header) {
	for _, item := range requestParam.Items {
		if item.Url == "" || item.Id == "" {
			continue
		}

		if !item.Update {
			index, ok := store.CheckByID(item.Id)
			if ok && (item.TimeLimit <= 0 || !index.IsExpiredMill(item.TimeLimit)) {
				continue
			}
		}

		queueDownload(item.Id, item.Url, requestParam.Method, nil, header, item.Category)
	}
}

func saveFromJSON(requestParam *SaveJsonParams, store *core.Store) error {
	for _, item := range requestParam.Items {
		if item.Id == "" {
			continue
		}

		if !item.Update {
			index, ok := store.CheckByID(item.Id)
			if ok && (item.TimeLimit <= 0 || !index.IsExpiredMill(item.TimeLimit)) {
				continue
			}
		}

		data := []byte(item.Data)
		_, err := store.StoreBytes(
			core.IndexRequiredInfo(
				item.Id,
				"application/json",
				int64(len(data)),
			),
			1,
			data,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
