package utils

import (
	"bytes"
	"crypto/rand"
)

// alphaNumeric 包含用于生成随机字符串的字母和数字字符集。
const alphaNumeric = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// RandString 生成一个长度为 n 的随机字母数字字符串。
func RandString(n int) string {
	var randomBytes = make([]byte, n)
	_, _ = rand.Read(randomBytes)

	var index int
	for i := range n {
		index = int(randomBytes[i]) % len(alphaNumeric)
		randomBytes[i] = alphaNumeric[index]
	}

	return string(randomBytes)
}

func JoinJSON(items [][]byte) []byte {
	if len(items) == 0 {
		return []byte("[]")
	}

	var buf bytes.Buffer
	buf.WriteByte('[')
	for i, item := range items {
		if i > 0 {
			buf.WriteByte(',')
		}
		if item == nil {
			buf.WriteString("null")
		} else {
			buf.Write(item)
		}
	}
	buf.WriteByte(']')

	return buf.Bytes()
}
