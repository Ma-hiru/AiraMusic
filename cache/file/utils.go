package file

import (
	"bytes"
	"context"
	"crypto/sha1"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"
)

// BufferSize 定义了用于读取和写入文件时的缓冲区大小，单位为字节。
const BufferSize = 1024 * 100

// PeekForHash 从 reader 中读取前 BufferSize 字节的数据，计算其 SHA1 哈希值，并返回哈希值和一个新的 reader。
// 新的 reader 会先返回已读取的数据，随后继续返回原 reader 中剩余的数据。
func PeekForHash(reader io.Reader) (string, io.Reader, error) {
	var peek, newReader, err = Peek(reader, BufferSize)
	if err != nil {
		return "", newReader, err
	}

	return Hash(peek, len(peek)), newReader, nil
}

// Hash 计算 buffer 前 len 字节的 SHA1 哈希值，并以十六进制字符串形式返回。
func Hash(buffer []byte, len int) string {
	return fmt.Sprintf("%x", sha1.Sum(buffer[:len]))
}

// Peek 从 reader 中读取 size 字节的数据，并返回读取的数据和一个新的 reader。
// 新的 reader 会先返回已读取的数据，随后继续返回原 reader 中剩余的数据。
func Peek(reader io.Reader, size int) ([]byte, io.Reader, error) {
	var buffer = make([]byte, size)
	var n, err = reader.Read(buffer)

	if err == io.EOF {
		err = nil
	}

	return buffer[:n], io.MultiReader(bytes.NewReader(buffer[:n]), reader), err
}

// write 将 reader 中的数据写入指定路径的文件中，并返回写入的字节数和计算得到的 ETag。
// 如果在写入过程中上下文被取消，函数会停止写入并删除临时文件。
func write(ctx context.Context, path string, reader io.Reader) (int64, string, error) {
	var tmpPath = path + ".tmp"
	var file, err = os.Create(tmpPath)
	if err != nil {
		return -1, "", err
	}

	var buffer = make([]byte, BufferSize) // 100KB buffer
	var count int64 = 0
	var etag string
	for {
		if err := ctx.Err(); err != nil {
			fmt.Println("context cancelled, removing file:", tmpPath)
			_ = file.Close()
			_ = os.Remove(tmpPath)
			return count, etag, err
		}

		var n, err = reader.Read(buffer)
		if err == io.EOF {
			break
		}
		if err != nil {
			_ = file.Close()
			_ = os.Remove(tmpPath)
			return count, etag, err
		}
		if n > 0 {
			var written, writeErr = file.Write(buffer[:n])
			count += int64(written)
			if writeErr != nil {
				_ = file.Close()
				_ = os.Remove(tmpPath)
				return count, etag, writeErr
			}
			if written != n {
				_ = file.Close()
				_ = os.Remove(tmpPath)
				return count, etag, io.ErrShortWrite
			}
			if count == int64(written) {
				etag = Hash(buffer, n)
			}
		}
	}
	// 空文件不允许存储
	if count == 0 {
		_ = file.Close()
		_ = os.Remove(tmpPath)
		return count, etag, fmt.Errorf("no data written to file")
	}
	// 刷盘并关闭，然后重命名临时文件为目标文件
	if err := file.Sync(); err != nil {
		_ = file.Close()
		_ = os.Remove(tmpPath)
		return count, etag, err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return count, etag, err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return count, etag, err
	}

	return count, etag, nil
}

// randomFilename 生成一个基于当前时间戳的随机文件名字符串。
func randomFilename() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

// getTime 获取当前时间的纳秒级时间戳。
func getTime() int64 {
	return time.Now().UnixNano()
}

type nopCloseWriter struct{}

func (*nopCloseWriter) Write(p []byte) (int, error) { return len(p), nil }
func (*nopCloseWriter) Close() error                { return nil }
