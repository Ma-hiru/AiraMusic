package handler

import (
	"fileServer/file"
	"io"
	"log"
	"net/http"
	neturl "net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

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
	return idx
}
