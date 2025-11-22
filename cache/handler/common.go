package handler

import (
	"fileServer/file"
	"io"
	"log"
	"net/http"

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

func Store(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	go func() {
		var httpClient = http.DefaultClient
		// 创建新请求 保留原始请求的方法和头
		var request, err = http.NewRequest(ctx.Request.Method, url, ctx.Request.Body)
		if err != nil {
			log.Println(err)
			return
		}
		// 复制请求头
		for key, values := range ctx.Request.Header {
			for _, value := range values {
				request.Header.Add(key, value)
			}
		}
		resp, err := httpClient.Do(request)
		if err != nil {
			log.Println(err)
			return
		}
		defer resp.Body.Close()
		// 读取元数据
		var fileType = resp.Header.Get("Content-Type")
		var fileSize = resp.Header.Get("Content-Length")
		var fileMD5 = resp.Header.Get("Content-MD5")
		var lastModified = resp.Header.Get("Last-Modified")
		var fileName = getNameFromURL(url)
		var etag string
		var reader io.Reader = resp.Body
		if fileMD5 != "" {
			etag = fileMD5
		} else {
			//预读取以计算ETag
			etag, reader, err = file.PeekForHash(resp.Body)
			if err != nil {
				log.Println(err)
				return
			}
		}
		// 开始缓存
		var store = file.GetStore()
		var buffer = make([]byte, 24*1024)
		_, err = io.CopyBuffer(store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified), reader, buffer)
		store.EndWrite(id, url, err == nil)
		if err != nil {
			log.Println("error storing file:", err)
			return
		}
	}()

	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

func Fetch(ctx *gin.Context) {
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

func Remove(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = file.GetStore()
	var index, ok = store.Check(id)
	if !ok {
		ctx.Status(404)
		return
	}
	success, err := store.Remove(index)
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	ctx.JSON(200, gin.H{
		"ok":    success,
		"index": index,
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
