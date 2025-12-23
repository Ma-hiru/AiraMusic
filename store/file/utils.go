package file

import (
	"bytes"
	"crypto/rand"
	"crypto/sha1"
	"fmt"
	"io"
	"net/url"
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

func randomFilename() string {
	return strconv.FormatInt(getTimeMilli(), 10) + "_" + randString(12)
}

// alphaNumeric 包含用于生成随机字符串的字母和数字字符集。
const alphaNumeric = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// randString 生成一个长度为 n 的随机字母数字字符串。
func randString(n int) string {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		panic(err)
	}

	for i := range n {
		b[i] = alphaNumeric[int(b[i])%len(alphaNumeric)]
	}

	return string(b)
}

// getTimeNano 获取当前时间的纳秒级时间戳。
func getTimeNano() int64 {
	return time.Now().UnixNano()
}

// getTimeMilli 获取当前时间的毫秒级时间戳。
func getTimeMilli() int64 {
	return time.Now().UnixMilli()
}

// pathToSchemeURL 将给定的文件路径转换为带有自定义方案的 URL。
func pathToSchemeURL(path, scheme, schemeHostname string) string {
	if strings.HasPrefix(path, scheme+"://") {
		return path
	}

	var normalized = strings.ReplaceAll(strings.TrimSpace(path), "\\", "/")
	var encoded = url.PathEscape(normalized)

	if encoded != "" {
		return fmt.Sprintf("%s://%s/%s", scheme, schemeHostname, encoded)
	}
	return encoded
}

// BlankWriter 是一个实现了 io.WriteCloser 接口但不执行任何写入操作的空写入器实例。
var BlankWriter = &blankWriter{}

// blankWriter 是一个实现了 io.WriteCloser 接口但不执行任何写入操作的空写入器。
type blankWriter struct{}

func (*blankWriter) Write(p []byte) (int, error) { return len(p), nil }
func (*blankWriter) Close() error                { return nil }
