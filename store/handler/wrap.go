package handler

import (
	"io"
	"log"
	"net/http"
	"store/file"
	"strings"

	"github.com/gin-gonic/gin"
)

func Wrap(ctx *gin.Context) {
	var id, url = getRequireQuery(ctx)
	var update, timeLimit = getOptionQuery(ctx)
	// 检查文件是否已缓存
	var store = file.GetStore()
	var index, ok = store.Check(url)
	// 文件不存在、请求更新且文件已缓存或文件已过期
	var needUpdate = !ok || update || timeLimit > 0 && index.IsExpiredMill(timeLimit)

	// 需要更新或未缓存，进行代理
	if needUpdate {
		// 如果未缓存，则从源URL获取文件
		var httpClient = http.DefaultClient
		// 创建新请求 保留原始请求的方法和头
		var request, err = http.NewRequest(ctx.Request.Method, url, ctx.Request.Body)
		if err != nil {
			ctx.Status(http.StatusInternalServerError)
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
			ctx.Status(http.StatusInternalServerError)
			log.Println(err)
			return
		}
		defer resp.Body.Close()
		// 读取元数据
		var fileType = resp.Header.Get("Content-Type")
		var fileSize = resp.Header.Get("Content-Length")
		var fileMD5 = resp.Header.Get("Content-MD5")
		var lastModified = resp.Header.Get("Last-Modified")
		var fileDisposition = resp.Header.Get("Content-Disposition")
		var fileName = getNameFromURL(url)

		var etag string
		var reader io.Reader = resp.Body
		if fileMD5 != "" {
			etag = fileMD5
		} else {
			//预读取以计算ETag
			etag, reader, err = file.PeekForHash(resp.Body)
			if err != nil {
				ctx.Status(http.StatusInternalServerError)
				log.Println(err)
				return
			}
		}
		// 设置响应头并开始流式传输
		// 音频/视频 必须转发 206
		if resp.StatusCode >= 400 {
			buf, _ := io.ReadAll(resp.Body)
			ctx.JSON(resp.StatusCode, gin.H{
				"status": resp.StatusCode,
				"msg":    http.StatusText(resp.StatusCode),
				"body":   string(buf),
			})
			return
		}
		ctx.Status(resp.StatusCode)
		ctx.Header("Content-Type", fileType)
		ctx.Header("ETag", etag)
		ctx.Header("Cache-Control", "no-cache")
		// 设置Content-Disposition头
		if fileDisposition != "" {
			ctx.Header("Content-Disposition", fileDisposition)
		} else if !strings.Contains(fileType, "json") {
			ctx.Header("Content-Disposition", "inline; filename=\""+index.Name+"\"")
		}
		if fileSize != "" {
			ctx.Header("Content-Length", fileSize)
		}
		// 复制其他响应头
		for key, values := range resp.Header {
			if strings.ToLower(key) == "content-length" || strings.ToLower(key) == "content-type" || strings.ToLower(key) == "etag" || strings.ToLower(key) == "cache-control" || strings.ToLower(key) == "content-disposition" {
				continue
			}
			for _, value := range values {
				ctx.Header(key, value)
			}
		}
		// 开始缓存：使用 TeeReader
		var pr = io.TeeReader(reader, store.BeginWrite(url, fileName, fileType, fileSize, etag, lastModified))
		var buffer = make([]byte, 64*1024)

		_, err = io.CopyBuffer(ctx.Writer, pr, buffer)
		store.EndWrite(id, url, err == nil)

		return
	}

	// 如果文件已缓存，检查ETag以处理缓存验证
	if match := ctx.Request.Header.Get("If-None-Match"); match == index.ETag {
		ctx.Status(http.StatusNotModified)
		return
	}

	// 从缓存中获取文件并设置响应头
	var storeFile, err = store.Fetch(index)
	if err != nil {
		ctx.Status(http.StatusInternalServerError)
		log.Println(err)
		return
	}
	defer storeFile.Close()

	ctx.Status(http.StatusOK)
	ctx.Header("Content-Type", index.Type)
	ctx.Header("ETag", index.ETag)
	ctx.Header("Cache-Control", "no-cache")
	if index.Size != "" {
		ctx.Header("Content-Length", index.Size)
	}

	// 将缓存文件直接拷贝到响应
	var buffer = make([]byte, 32*1024)
	_, _ = io.CopyBuffer(ctx.Writer, storeFile, buffer)
}
