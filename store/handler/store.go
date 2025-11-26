package handler

import (
	"fileServer/file"
	"fileServer/ws"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type StoreShouldBind struct {
	Id   string `json:"id" binding:"required"`
	Data string `json:"data" binding:"required"`
}

func Store(ctx *gin.Context) {
	var requestParam = StoreShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	var store = file.GetStore()
	var index, err = store.Store(requestParam.Id, "text/plain", []byte(requestParam.Data))
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

func StoreAsync(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	go download(id, url, ctx.Request.Method, ctx.Request.Body, ctx.Request.Header)
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

type StoreItem struct {
	Id        string `json:"id"`
	Url       string `json:"url" binding:"required"`
	Update    bool   `json:"update"`
	TimeLimit int64  `json:"timeLimit"`
}

type StoreMutilShouldBind struct {
	Items  []StoreItem `json:"items" binding:"required"`
	Method string      `json:"method" binding:"required"`
}

func StoreAsyncMutil(ctx *gin.Context) {
	var requestParam = StoreMutilShouldBind{}
	if err := ctx.ShouldBindJSON(&requestParam); err != nil {
		ctx.JSON(200, gin.H{
			"ok":    false,
			"error": "invalid parameters",
		})
		return
	}
	for _, item := range requestParam.Items {
		item.Id, item.Url = handleURLAndID(item.Id, item.Url)
		if item.Url == "" {
			continue
		}
		go download(item.Id, item.Url, requestParam.Method, nil, ctx.Request.Header)
	}
	ctx.JSON(200, gin.H{
		"ok": true,
	})
}

func download(id, url, method string, body io.Reader, header http.Header) file.Index {
	var httpClient = http.DefaultClient
	// 创建新请求 保留原始请求的方法和头
	var request, err = http.NewRequest(method, url, body)
	if err != nil {
		log.Println(err)
		return file.Index{}
	}
	// 复制请求头
	for key, values := range header {
		for _, value := range values {
			request.Header.Add(key, value)
		}
	}
	resp, err := httpClient.Do(request)
	if err != nil {
		log.Println(err)
		return file.Index{}
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
			return file.Index{}
		}
	}
	// 开始缓存
	var store = file.GetStore()
	var buffer = make([]byte, 24*1024)
	_, err = io.CopyBuffer(store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified), reader, buffer)
	var idx = store.EndWrite(id, url, err == nil)
	if err != nil {
		log.Println("error storing file:", err)
		return file.Index{}
	}
	ws.GetInstance().Broadcast <- ws.Message{
		Id:   id,
		File: idx.File,
	}
	return idx
}

func setHeaders(ctx *gin.Context, index file.Index) {
	ctx.Header("Cache-Control", "no-cache")
	if index.ETag != "" {
		ctx.Header("ETag", index.ETag)
	}
	if index.Type != "" {
		ctx.Header("Content-Type", index.Type)
	}
	if index.Size != "" {
		ctx.Header("Content-Length", index.Size)
	}
}
