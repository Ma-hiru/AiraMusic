package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"store/file"
	"store/jsonEditer"
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

type EditObjectRequest struct {
	Id            string                     `json:"id" binding:"required"`
	TimeLimit     int64                      `json:"timeLimit"`
	ObjType       string                     `json:"objType" binding:"required"`
	ObjOperations []jsonEditer.ObjOperations `json:"objOperations" binding:"required"`
	Save          bool                       `json:"save"`
}

func EditObject(ctx *gin.Context) {
	// 解析请求参数
	var requestParam = EditObjectRequest{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	// 获取文件内容
	var store = file.GetStore()
	var index, ok = store.Check(requestParam.Id)
	// 文件不存在
	if !ok {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file not found",
		})
		return
	}
	// 文件过期
	if requestParam.TimeLimit > 0 && index.IsExpiredMill(requestParam.TimeLimit) {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file expired",
		})
		_, _ = store.Remove(index)
		return
	}
	var storeFile, err = store.Fetch(index)
	// 读取文件失败
	if err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file read error",
		})
		_, _ = store.Remove(index)
		return
	}
	defer storeFile.Close()
	var objectData, readErr = io.ReadAll(storeFile)
	if readErr != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "file read error",
		})
		return
	}
	// 编辑 JSON 对象
	var resp = editJsonStr(objectData, requestParam.ObjType, requestParam.ObjOperations, requestParam.Save, requestParam.Id)
	ctx.JSON(200, resp)

}

func editJsonStr(objectData []byte, ObjType string, ObjOperations []jsonEditer.ObjOperations, Save bool, Id string) gin.H {
	// 解析 JSON 数据
	var payload any
	var store = file.GetStore()
	if err := json.Unmarshal(objectData, &payload); err != nil {
		return gin.H{
			"ok":    false,
			"error": "invalid json data",
		}
	}

	var editor = &jsonEditer.JSONEditor{Data: payload}
	resolvedType, err := jsonEditer.ResolveObjType(ObjType, editor.Data)
	if err != nil || (resolvedType != "object" && resolvedType != "array") {
		return gin.H{
			"ok":    false,
			"error": "invalid objType",
		}
	}
	if resolvedType == "object" {
		if _, ok := editor.Data.(map[string]any); !ok {
			return gin.H{
				"ok":    false,
				"error": "target is not object",
			}
		}
	} else if resolvedType == "array" {
		if _, ok := editor.Data.([]any); !ok {
			return gin.H{
				"ok":    false,
				"error": "target is not array",
			}
		}
	}

	summary := jsonEditer.NewEditSummary()
	result, err := jsonEditer.ApplyOperations(editor, resolvedType, ObjOperations, summary)
	if err != nil {
		return gin.H{
			"ok":    false,
			"error": err.Error(),
		}
	}

	if Save {
		var buffer, marshalErr = json.Marshal(editor.Data)
		if marshalErr != nil {
			return gin.H{
				"ok":    false,
				"error": "marshal json failed",
			}
		}
		_, storeErr := store.Store(Id, "application/json", buffer)
		if storeErr != nil {
			return gin.H{
				"ok":    false,
				"error": "store file failed",
			}
		}
	}

	respSummary := summary.Export()
	return gin.H{
		"ok":      true,
		"data":    result,
		"summary": respSummary,
	}
}
