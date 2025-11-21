package handler

import (
	"context"
	"fileServer/file"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Wrap(ctx *gin.Context) {
	// 获取URL参数
	var url = ctx.Query("url")
	var update = ctx.Query("update") == "true"
	if url == "" {
		ctx.Status(404)
		return
	}
	// 检查文件是否已缓存
	var store = file.GetStore()
	var index, ok = store.Check(url)
	// 如果请求更新且文件已缓存
	if ok && update {
		// 请求URL，如果是304，则继续使用缓存，否则删除缓存并重新下载
		var httpClint = http.DefaultClient
		var req, reqErr = http.NewRequest("GET", url, nil)
		if reqErr != nil {
			ctx.Status(500)
			log.Panicln(reqErr)
			return
		}
		req.Header.Set("If-None-Match", index.ETag)
		req.Header.Set("If-Modified-Since", index.LastModified)
		var resp, err = httpClint.Do(req)
		if err != nil {
			ctx.Status(500)
			log.Panicln(err)
			return
		}
		// 如果服务器返回非304，说明文件已更新
		if resp.StatusCode != http.StatusNotModified {
			// 删除过期缓存
			_, err = store.Remove(index)
			if err != nil {
				ctx.Status(500)
				log.Panicln(err)
				return
			}
			// 从请求 URL 中删除 `update` 参数，防止递归时重复触发更新分支
			q := ctx.Request.URL.Query()
			q.Del("update")
			ctx.Request.URL.RawQuery = q.Encode()
			Wrap(ctx)
		} else {
			// 服务器返回304，继续使用缓存
			ctx.Status(http.StatusNotModified)
		}
		return
	}
	if !ok {
		// 如果未缓存，则从源URL获取文件
		var httpClint = http.DefaultClient
		var resp, err = httpClint.Get(url)
		if err != nil {
			ctx.Status(500)
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
				ctx.Status(500)
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
			defer pr.Close()
			// 文件存储失败或被取消时，不会创建索引，且会删除临时文件
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
		} else {
			ctx.Header("Content-Disposition", "inline; filename=\""+index.Name+"\"")
		}
		// 开始流式传输（io.Copy 会在读到 EOF 时返回 nil，返回 false 停止重复调用）
		ctx.Stream(func(w io.Writer) bool {
			mw := io.MultiWriter(w, pw)
			_, err := io.Copy(mw, respBody)
			if err != nil {
				// 如果传输过程中出错，取消存储操作
				fmt.Println("error during streaming:", err)
				cancel()
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
		ctx.Status(500)
		log.Panicln(err)
		return
	}
	setHeaders(ctx, index)
	// 开始流式传输缓存的文件
	ctx.Stream(func(w io.Writer) bool {
		_, err := io.Copy(w, storeFile)
		if err != nil {
			fmt.Println("error during streaming (cached):", err)
		}
		return false
	})
}
