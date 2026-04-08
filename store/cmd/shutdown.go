package cmd

import (
	"context"
	"fmt"
	"os"
	"store/file"
	"sync"
	"time"
)

var stopOnce sync.Once

func Shutdown() {
	stopOnce.Do(func() {
		var wg = sync.WaitGroup{}

		if httpServer != nil {
			wg.Go(func() {
				var ctx, cancel = context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				// ListenAndServe 在接收到 Shutdown 信号后会立即返回 http.ErrServerClosed 错误
				// 因此这里的 Shutdown 调用是同步的，会等待所有连接关闭后才返回
				fmt.Println("Shutting down HTTP server...")
				if err := httpServer.Shutdown(ctx); err != nil {
					fmt.Println("HTTP server shutdown error:", err)
				}
			})
		}

		if store := file.GetStore(); store != nil {
			wg.Go(func() {
				fmt.Println("Shutting down store...")
				_ = store.Destroy()
				fmt.Println("Store saved.")
			})
		}

		wg.Wait()
		fmt.Println("All shutdown operations completed.")
		os.Exit(0)
	})
}
