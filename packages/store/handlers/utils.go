package handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	neturl "net/url"
	"store/core"
	"store/utils"
	"strconv"
	"strings"
	"time"

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
	var token = strings.Split(url, "/")
	return token[len(token)-1]
}

func getRequireQuery(ctx *gin.Context) (id string, url string) {
	id = ctx.Query("id")
	url = ctx.Query("url")
	return handleURLAndID(id, url)
}

func handleURLAndID(id, url string) (string, string) {
	//  URL 解码
	if decoded, err := neturl.QueryUnescape(url); err == nil {
		url = decoded
	}
	if id == "" {
		id = url
	}
	return id, url
}

func getOptionQuery(ctx *gin.Context) (update bool, timeLimit int64) {
	update = ctx.Query("update") == "true"
	var tl = ctx.Query("timeLimit")
	if tl != "" {
		var _, err = fmt.Sscanf(tl, "%d", &timeLimit)
		if err != nil {
			timeLimit = 0
		}
	}
	return
}

func queueDownload(id, url, method string, body io.Reader, header http.Header) {
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
		download(id, url, method, requestBody, requestHeader)
	}()
}

func download(id, url, method string, body io.Reader, header http.Header) core.Index {
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
		etag, reader, err = utils.PeekForHash(resp.Body)
		if err != nil {
			log.Println(err)
			return core.Index{}
		}
	}
	// 开始缓存
	var store = core.GetStore()
	var buffer = make([]byte, 32*1024)
	var writer = store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified)
	if writer == utils.BlankWriter {
		log.Println("already exits writing for:", url)
		return core.Index{}
	}

	written, err := io.CopyBuffer(writer, reader, buffer)
	if err != nil {
		store.EndWrite(id, url, false)
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
				store.EndWrite(id, url, false)
				log.Println("range request error:", err)
				return core.Index{}
			}

			n, err := io.CopyBuffer(writer, rangeResp.Body, buffer)
			rangeResp.Body.Close() //nolint:errcheck

			if err != nil {
				store.EndWrite(id, url, false)
				log.Println("range write error:", err)
				return core.Index{}
			}

			written += n
		}
		log.Println("resumed download completed:", url)
	}

	store.UpdateWriteSize(url, strconv.FormatInt(written, 10))
	var idx = store.EndWrite(id, url, true)
	return idx
}

func fetch(ctx *gin.Context) {
	var id, _ = getRequireQuery(ctx)
	var store = core.GetStore()
	var index, ok = store.CheckByID(id)
	if !ok {
		ctx.Status(404)
		return
	}
	// 如果文件已缓存，检查ETag以处理缓存验证
	if match := ctx.Request.Header.Get("If-None-Match"); match == index.ETag {
		ctx.Status(http.StatusNotModified)
		return
	}
	var storeFile, err = store.FetchByReader(index)
	if err != nil {
		ctx.Status(500)
		log.Println(err)
		return
	}
	defer storeFile.Close() //nolint:errcheck
	ctx.Status(200)
	index.FillHeader(ctx)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
