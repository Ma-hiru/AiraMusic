package handler

import (
	"encoding/json"
	"fileServer/file"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func Fetch(ctx *gin.Context) {
	fetch(ctx)
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
	setHeaders(ctx, index)

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

	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}

type ObjOperations struct {
	Name           string `json:"name" binding:"required"`
	Value          any    `json:"value"`
	ItemOperations struct {
		ObjType       string          `json:"objType" binding:"required"`
		ObjField      string          `json:"objField"`
		ObjOperations []ObjOperations `json:"objOperations" binding:"required"`
	} `json:"itemOperations"`
}

type EditObjectRequest struct {
	Id            string          `json:"id" binding:"required"`
	TimeLimit     int64           `json:"timeLimit"`
	ObjType       string          `json:"objType" binding:"required"`
	ObjField      string          `json:"objField"`
	ObjOperations []ObjOperations `json:"objOperations" binding:"required"`
	Save          bool            `json:"save"`
}

func EditObject(ctx *gin.Context) {
	var requestParam = EditObjectRequest{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}

	var store = file.GetStore()
	var index, ok = store.Check(requestParam.Id)
	if !ok {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file not found",
		})
		return
	}
	if requestParam.TimeLimit > 0 && index.IsExpiredMill(requestParam.TimeLimit) {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file expired",
		})
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
	// TODO
}

func fetch(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.Status(404)
		return
	}
	// 如果文件已缓存，检查ETag以处理缓存验证
	if match := ctx.Request.Header.Get("If-None-Match"); match == index.ETag {
		ctx.Status(http.StatusNotModified)
		return
	}
	var storeFile, err = store.Fetch(index)
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	defer storeFile.Close()
	ctx.Status(200)
	setHeaders(ctx, index)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
