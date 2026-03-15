package handler

import (
	"encoding/json"
	"log"
	"store/file"

	"github.com/gin-gonic/gin"
)

func Remove(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"index": file.Index{},
		})
		return
	}
	success, err := store.Remove(index)
	if err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"index": file.Index{},
		})
		log.Println(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    success,
		"index": index,
	})
}

func RemoveAsync(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.JSON(200, gin.H{
			"ok": false,
		})
		return
	}
	go func() {
		_, err := store.Remove(index)
		if err != nil {
			log.Println(err)
		}
	}()
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

type RemoveMultiShouldBind struct {
	Ids []string `json:"ids" binding:"required"`
}

func RemoveMulti(ctx *gin.Context) {
	var requestParam = RemoveMultiShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	var store = file.GetStore()
	var results = make([]gin.H, 0, len(requestParam.Ids))
	for _, id := range requestParam.Ids {
		var index, ok = store.Check(id)
		if !ok {
			results = append(results, gin.H{
				"ok":    false,
				"index": file.Index{},
			})
			continue
		}
		success, err := store.Remove(index)
		if err != nil {
			results = append(results, gin.H{
				"ok":    false,
				"index": file.Index{},
			})
			log.Println(err)
			continue
		}
		results = append(results, gin.H{
			"ok":    success,
			"index": index,
		})
	}
	ctx.JSON(200, gin.H{
		"ok":      true,
		"results": results,
	})

}

func Clear(ctx *gin.Context) {
	var store = file.GetStore()
	count, err := store.Clear()
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    true,
		"count": count,
	})
}

func Count(ctx *gin.Context) {
	var store = file.GetStore()
	var count = store.Count()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"count": count,
	})
}

func Info(ctx *gin.Context) {
	var store = file.GetStore()
	var size = store.Size()
	var count = store.Count()
	var path = store.Path()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"size":  size,
		"count": count,
		"path":  path,
	})
}

func RemoveInvalid(ctx *gin.Context) {
	var store = file.GetStore()
	var err = store.ClearInvalidFile()
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

func Size(ctx *gin.Context) {
	var store = file.GetStore()
	var size = store.Size()
	ctx.JSON(200, gin.H{
		"ok":   true,
		"size": size,
	})
}

func SizeCategories(ctx *gin.Context) {
	var store = file.GetStore()
	var image, audio, video, other = store.SizeByCategory()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"image": image,
		"audio": audio,
		"video": video,
		"other": other,
	})
}

func Move(ctx *gin.Context) {
	var newPath = ctx.Query("path")
	if newPath == "" {
		ctx.SSEvent("done", "missing path parameter")
		return
	}
	var store = file.GetStore()
	var progress = make(chan file.MoveProgressChan, 100)
	go func() {
		var err = store.Move(newPath, progress)
		if err != nil {
			log.Println(err)
		}
		close(progress)
	}()
	for p := range progress {
		var data, _ = json.Marshal(p)
		ctx.SSEvent("message", string(data))
	}
	ctx.SSEvent("done", "")
}
