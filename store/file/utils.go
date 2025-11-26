package file

import (
	"bytes"
	"crypto/sha1"
	"fmt"
	"io"
	"strconv"
	"strings"
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

// randomFilename 生成一个基于当前时间戳的随机文件名字符串。
func randomFilename() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

// getTime 获取当前时间的纳秒级时间戳。
func getTime() int64 {
	return time.Now().UnixNano()
}

func pathToFileURL(path string) string {
	var normalized = strings.TrimSpace(path)
	if normalized == "" {
		return ""
	}

	var isWindowsPath = strings.Contains(normalized, "\\") || (len(normalized) > 1 && normalized[1] == ':')
	if isWindowsPath {
		normalized = strings.ReplaceAll(normalized, "\\", "/")
		if len(normalized) > 2 && normalized[1] == ':' {
			normalized = "/" + normalized
		}
	}
	if strings.HasPrefix(normalized, "file://") {
		return normalized
	}

	if strings.HasSuffix(normalized, "/") {
		return "file://" + normalized
	}

	return "file:///" + normalized
}

type nopCloseWriter struct{}

func (*nopCloseWriter) Write(p []byte) (int, error) { return len(p), nil }
func (*nopCloseWriter) Close() error                { return nil }
