package handler

import (
	"context"
	"fileServer/file"
	"fmt"
	"io"
	"log"
	"net/http"
	neturl "net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func Wrap(ctx *gin.Context) {
	// 获取URL参数
	var url = ctx.Query("url")
	var update = ctx.Query("update") == "true"
	var tl = ctx.Query("time_limit")
	var timeLimit = int64(0)
	if tl != "" {
		var _, err = fmt.Sscanf(tl, "%d", &timeLimit)
		if err != nil {
			ctx.Status(http.StatusBadRequest)
			log.Panicln(err)
			return
		}
	}
	if url == "" {
		ctx.Status(http.StatusNotFound)
		return
	}
	// 尝试对可能被百分号编码的 URL 解码
	if decoded, err := neturl.QueryUnescape(url); err == nil && decoded != "" {
		url = decoded
	} else if err != nil {
		ctx.Status(http.StatusBadRequest)
		log.Panicln(err)
		return
	}
	// 检查文件是否已缓存
	var store = file.GetStore()
	var index, ok = store.Check(url)
	// 文件不存在、请求更新且文件已缓存或文件已过期
	if !ok || (ok && update) || (ok && timeLimit > 0 && index.IsExpiredMill(timeLimit)) {
		// 如果未缓存，则从源URL获取文件
		var httpClient = http.DefaultClient
		// 创建新请求 保留原始请求的方法和头
		var request, err = http.NewRequest(ctx.Request.Method, url, ctx.Request.Body)
		if err != nil {
			ctx.Status(http.StatusInternalServerError)
			log.Panicln(err)
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
			log.Panicln(err)
			return
		}

		var fileType = resp.Header.Get("Content-Type")
		var fileSize = resp.Header.Get("Content-Length")
		var fileMD5 = resp.Header.Get("Content-MD5")
		var lastModified = resp.Header.Get("Last-Modified")
		var fileDisposition = resp.Header.Get("Content-Disposition")
		var fileName = getNameFromURL(url)

		var etag string
		var respBody io.Reader
		if fileMD5 != "" {
			etag = fileMD5
			respBody = resp.Body
		} else {
			//预读取以计算ETag
			etag, respBody, err = file.PeekForHash(resp.Body)
			if err != nil {
				ctx.Status(http.StatusInternalServerError)
				log.Panicln(err)
				return
			}
		}

		// 开始异步存储文件
		pr, pw := io.Pipe()
		// 创建可取消的上下文：使用独立的后台上下文，避免在 handler 返回时
		// request.Context() 被取消从而误触发存储协程的取消。
		// 只在发生传输错误时手动调用 cancel()。
		var cancelCtx, cancel = context.WithCancel(context.Background())
		go func() {
			// 文件存储失败或被取消时，不会创建索引，且会删除临时文件
			// 不要在存储协程中关闭 pr（reader），否则会导致主写入端报 ErrClosedPipe
			_, _ = store.Store(cancelCtx, pr, url, fileName, fileType, fileSize, etag, lastModified)
		}()

		// 设置响应头并开始流式传输
		setHeaders(ctx, file.Index{
			Type: fileType,
			Size: fileSize,
			ETag: etag,
		})
		// 设置Content-Disposition头
		if fileDisposition != "" {
			ctx.Header("Content-Disposition", fileDisposition)
		} else if !strings.Contains(fileType, "json") {
			ctx.Header("Content-Disposition", "inline; filename=\""+index.Name+"\"")
		}
		// 开始流式传输（io.Copy 会在读到 EOF 时返回 nil，返回 false 停止重复调用）
		ctx.Status(http.StatusOK)
		ctx.Stream(func(w io.Writer) bool {
			log.Println("streaming from source:", url)
			// 同时写入响应和管道写入端
			mw := io.MultiWriter(w, pw)
			_, err := io.Copy(mw, respBody)
			if err != nil {
				if err != io.EOF {
					// 如果传输过程中出错，取消存储操作
					fmt.Println("error during streaming:", err)
					cancel()
				}
			}
			// ctx.request关闭前关闭管道写入端，以通知存储协程传输结束，如果顺序颠倒，会导致协程误以为提前结束，进而删除文件
			_ = pw.Close()
			return false
		})
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
		log.Panicln(err)
		return
	}
	setHeaders(ctx, index)
	// 开始流式传输缓存的文件（主协程负责写入）
	ctx.Status(http.StatusOK)
	if flusher, ok := ctx.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
	// 将缓存文件直接拷贝到响应
	buf := make([]byte, 32*1024)
	_, err = io.CopyBuffer(ctx.Writer, storeFile, buf)
	if err != nil {
		fmt.Println("error during streaming (cached):", err)
	}
}
