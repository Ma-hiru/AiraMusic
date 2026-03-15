package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"store/file"
	"store/utils"
	"strconv"

	"github.com/gin-gonic/gin"
)

type StoreObjectShouldBind struct {
	Id   string `json:"id" binding:"required"`
	Data string `json:"data" binding:"required"`
}

func StoreObject(ctx *gin.Context) {
	var requestParam = StoreObjectShouldBind{}
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

type StoreObjectMultiShouldBind struct {
	Items []StoreObjectShouldBind `json:"items" binding:"required"`
}

func StoreObjectMulti(ctx *gin.Context) {
	var requestParam = StoreObjectMultiShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	var store = file.GetStore()

	for _, item := range requestParam.Items {
		var _, err = store.Store(item.Id, "application/json", []byte(item.Data))
		if err != nil {
			log.Println(err)
		}
	}

	ctx.JSON(200, gin.H{
		"ok": true,
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
			// field == index
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

	index.FillHeader(ctx)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}

type FetchObjectMultiShouldBind struct {
	IDs []string `json:"ids" binding:"required"`
}

func FetchObjectMulti(ctx *gin.Context) {
	var requestParam = FetchObjectMultiShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	var store = file.GetStore()

	var result [][]byte
	for _, id := range requestParam.IDs {
		var index, ok = store.Check(id)
		if !ok {
			result = append(result, []byte("null"))
			continue
		}

		var storeFile, err = store.Fetch(index)
		if err != nil {
			result = append(result, []byte("null"))
			log.Println(err)
			continue
		}

		data, err := io.ReadAll(storeFile)
		if err != nil {
			result = append(result, []byte("null"))
			log.Println(err)
			continue
		}
		storeFile.Close()
		result = append(result, data)
	}

	ctx.Data(200, "application/json", utils.JoinJSON(result))
}
