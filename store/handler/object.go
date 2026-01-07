package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"store/file"
	"strconv"

	"github.com/gin-gonic/gin"
)

func StoreObject(ctx *gin.Context) {
	var requestParam = StoreShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	var store = file.GetStore()
	var index, err = store.Store(requestParam.Id, "application/json", []byte(requestParam.Data))
	if err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "store file failed",
		})
		log.Println(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    true,
		"index": index,
	})
}

func FetchObject(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var _, timeLimit = getOptionQuery(ctx)
	var objType = ctx.Query("objType")   // object / array
	var objField = ctx.Query("objField") // field / index / length
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.Status(http.StatusNoContent)
		return
	}
	if timeLimit > 0 && index.IsExpiredMill(timeLimit) {
		ctx.Status(http.StatusNoContent)
		_, _ = store.Remove(index)
		return
	}
	var storeFile, err = store.Fetch(index)
	if err != nil {
		ctx.Status(http.StatusNoContent)
		log.Println(err)
		_, _ = store.Remove(index)
		return
	}
	defer storeFile.Close()
	ctx.Status(200)

	if objType != "" && objField != "" {
		decoder := json.NewDecoder(storeFile)
		switch objType {
		case "object":
			var obj map[string]any
			if err := decoder.Decode(&obj); err != nil {
				ctx.Status(http.StatusNoContent)
				return
			}
			val, ok := obj[objField]
			if !ok {
				ctx.Status(http.StatusNoContent)
				return
			}
			ctx.JSON(200, val)
			return
		case "array":
			if objField == "length" {
				var arr []any
				if err := decoder.Decode(&arr); err != nil {
					ctx.Status(http.StatusNoContent)
					return
				}
				ctx.JSON(200, len(arr))
				return
			}
			idx, err := strconv.Atoi(objField)
			if err != nil {
				ctx.Status(http.StatusNoContent)
				return
			}
			var arr []any
			if err := decoder.Decode(&arr); err != nil {
				ctx.Status(http.StatusNoContent)
				return
			}
			if idx < 0 || idx >= len(arr) {
				ctx.Status(http.StatusNoContent)
				return
			}
			ctx.JSON(200, arr[idx])
			return
		}
	}
	setHeaders(ctx, index)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
