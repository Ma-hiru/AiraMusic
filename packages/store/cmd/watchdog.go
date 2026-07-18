package cmd

import (
	"fmt"
	"os"
)

// WatchParent 阻塞读取 stdin，读到 EOF/错误即认为父进程已退出，触发优雅关闭。
// 父进程无论以何种方式退出（包括被 SIGKILL 强杀），stdin 管道都会关闭，
// 以此兜底防止本进程成为孤儿进程继续占用端口。
// 需要父进程以 stdio pipe 方式启动本进程，并通过 --watch-parent 显式开启。
func WatchParent() {
	var buf [256]byte
	for {
		if _, err := os.Stdin.Read(buf[:]); err != nil {
			fmt.Println("stdin closed (parent process exited), shutting down...")
			Shutdown()
			return
		}
	}
}
