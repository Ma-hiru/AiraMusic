package handler

import (
	"fmt"
	"io"
	"log"
	"net/http"
	neturl "net/url"
	"store/file"
	"store/utils"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

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
		etag, reader, err = utils.PeekForHash(resp.Body)
		if err != nil {
			log.Println(err)
			return file.Index{}
		}
	}
	// 开始缓存
	var store = file.GetStore()
	var buffer = make([]byte, 32*1024)
	var writer = store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified)
	if writer == utils.BlankWriter {
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
	index.FillHeader(ctx)
	var buffer = make([]byte, 24*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
