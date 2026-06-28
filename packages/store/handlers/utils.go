package handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"store/core"
	"store/utils"

	"github.com/gin-gonic/gin"
)

const maxConcurrentDownloads = 16

var downloadSlots = make(chan struct{}, maxConcurrentDownloads)

// 限制连接建立与等待响应头的时间，避免无响应的服务器长时间占满并发
// 不设置整体 Timeout，以免正常的大文件（音频/视频）下载被中断
// TODO 发完响应头后可能反而卡死，等待队列无限制，可能堆积 goroutine
var httpClient = &http.Client{
	Transport: &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	},
}

func getNameFromURL(url string) string {
	token := strings.Split(url, "/")
	return token[len(token)-1]
}

func queueDownload(id, url, method string, body io.Reader, header http.Header, category core.StoreCategory) {
	if url == "" {
		return
	}
	var bodyData []byte
	if body != nil {
		var err error
		bodyData, err = io.ReadAll(body)
		if err != nil {
			log.Println("failed to read download request body:", err)
			return
		}
	}
	var requestHeader = header.Clone()

	go func() {
		downloadSlots <- struct{}{}
		defer func() {
			<-downloadSlots
		}()

		var requestBody io.Reader
		if bodyData != nil {
			requestBody = bytes.NewReader(bodyData)
		}
		download(id, url, method, requestBody, requestHeader, category)
	}()
}

func download(id, url, method string, body io.Reader, header http.Header, category core.StoreCategory) core.Index {
	if url == "" {
		return core.Index{}
	}
	// 创建新请求 保留原始请求的方法和头
	var request, err = http.NewRequest(method, url, body)
	if err != nil {
		log.Println(err)
		return core.Index{}
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
		return core.Index{}
	}
	defer resp.Body.Close() //nolint:errcheck
	// 读取元数据
	var fileMime = resp.Header.Get("Content-Type")
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
		etag = strconv.FormatInt(utils.GetTime(), 10)
	}
	// 开始缓存
	var store = core.GetStore()
	if store == nil {
		log.Println("store is nil")
		return core.Index{}
	}

	var chunkCount = matchCategoryChunkCount(category)
	var buffer = make([]byte, 32*1024)
	var writer = store.BeginWrite(url, fileName, fileMime, fileSize, etag, lastModified)
	if writer == utils.BlankWriter {
		log.Println("already exits writing for:", url)
		return core.Index{}
	}

	written, err := io.CopyBuffer(writer, reader, buffer)
	if err != nil {
		store.EndWrite(id, url, false, chunkCount)
		log.Println("error storing file:", err)
		return core.Index{}
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
				store.EndWrite(id, url, false, chunkCount)
				log.Println("range request error:", err)
				return core.Index{}
			}

			n, err := io.CopyBuffer(writer, rangeResp.Body, buffer)
			rangeResp.Body.Close() //nolint:errcheck

			if err != nil {
				store.EndWrite(id, url, false, chunkCount)
				log.Println("range write error:", err)
				return core.Index{}
			}

			written += n
		}
		log.Println("resumed download completed:", url)
	}

	store.UpdateWriteSize(url, strconv.FormatInt(written, 10))
	var idx = store.EndWrite(id, url, true, chunkCount)
	return idx
}

func matchCategoryChunkCount(category core.StoreCategory) int {
	switch category {
	case core.StoreCategoryAudio:
		return 5
	case core.StoreCategoryImage:
		return 1
	case core.StoreCategoryVideo:
		return 5
	case core.StoreCategoryJSON:
		return 1
	case core.StoreCategoryOther:
		return 1
	default:
		return 1
	}
}

func sendOkResponse(ctx *gin.Context, data any) {
	ctx.JSON(http.StatusOK, gin.H{
		"code": http.StatusOK,
		"data": data,
	})
}

func sendErrResponse(ctx *gin.Context, code int, err string) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":  code,
		"error": err,
	})
}

func bindingCheck[T any](ctx *gin.Context, requestParam T) (T, *core.Store, bool) {
	if err := ctx.ShouldBindJSON(requestParam); err != nil {
		sendErrResponse(ctx, http.StatusBadRequest, "invalid parameters")
		return requestParam, nil, false
	}

	var store = core.GetStore()
	if store == nil {
		sendErrResponse(ctx, http.StatusInternalServerError, "store not initialized")
		return requestParam, nil, false
	}

	return requestParam, store, true
}

func storeCheck(ctx *gin.Context) (*core.Store, bool) {
	if store := core.GetStore(); store == nil {
		sendErrResponse(ctx, http.StatusInternalServerError, "store not initialized")
		return nil, false
	} else {
		return store, true
	}
}

func checkNotModified(ctx *gin.Context, etag string, lastModified string) bool {
	if etag != "" && ctx.GetHeader("If-None-Match") == etag {
		return true
	}
	if lastModified != "" {
		ifModifiedSince := ctx.GetHeader("If-Modified-Since")
		if ifModifiedSince != "" {
			reqTime, reqErr := http.ParseTime(ifModifiedSince)
			fileTime, fileErr := http.ParseTime(lastModified)
			if reqErr == nil && fileErr == nil && !fileTime.After(reqTime) {
				return true
			}
		}
	}
	return false
}
