package handler

import (
	"fileServer/file"
	"log"

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
	var image, audio, video, other = store.SizeCategory()
	ctx.JSON(200, gin.H{
		"ok":    true,
		"image": image,
		"audio": audio,
		"video": video,
		"other": other,
	})
}
