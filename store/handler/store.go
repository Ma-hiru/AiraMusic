package handler

import (
	"fileServer/file"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type StoreShouldBind struct {
	Id   string `json:"id" binding:"required"`
	Data string `json:"data" binding:"required"`
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
	if url == "" {
		return file.Index{}
	}
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
	var fileEtag = resp.Header.Get("ETag")
	var lastModified = resp.Header.Get("Last-Modified")
	var fileName = getNameFromURL(url)
	if contentRange := resp.Header.Get("Content-Range"); contentRange != "" {
		if parts := strings.Split(contentRange, "/"); len(parts) == 2 {
			if total, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
				fileSize = strconv.FormatInt(total, 10)
			}
		}
	}
	// 计算ETag
	var etag string
	var reader io.Reader = resp.Body
	if fileMD5 != "" {
		etag = fileMD5
	} else if fileEtag != "" {
		etag = fileEtag
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
	var buffer = make([]byte, 32*1024)
	var writer = store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified)
	if writer == file.BlankWriter {
		log.Println("already exits writing for:", url)
		return file.Index{}
	}

	written, err := io.CopyBuffer(writer, reader, buffer)
	if err != nil {
		store.EndWrite(id, url, false)
		log.Println("error storing file:", err)
		return file.Index{}
	}

	// 处理断点续传
	if resp.StatusCode == http.StatusPartialContent {
		var contentRange = resp.Header.Get("Content-Range")
		var total int64

		if parts := strings.Split(contentRange, "/"); len(parts) == 2 {
			total, _ = strconv.ParseInt(parts[1], 10, 64)
		}

		for written < total {
			var rangeReq, _ = http.NewRequest(method, url, nil)
			// 复制请求头
			for key, values := range header {
				for _, value := range values {
					rangeReq.Header.Add(key, value)
				}
			}
			rangeReq.Header.Set("Range", fmt.Sprintf("bytes=%d-", written))
			var rangeResp, err = httpClient.Do(rangeReq)
			if err != nil {
				store.EndWrite(id, url, false)
				log.Println("range request error:", err)
				return file.Index{}
			}

			n, err := io.CopyBuffer(writer, rangeResp.Body, buffer)
			rangeResp.Body.Close()

			if err != nil {
				store.EndWrite(id, url, false)
				log.Println("range write error:", err)
				return file.Index{}
			}

			written += n
		}
		log.Println("resumed download completed:", url)
	}

	store.UpdateWriteSize(url, strconv.FormatInt(written, 10))
	var idx = store.EndWrite(id, url, true)
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
