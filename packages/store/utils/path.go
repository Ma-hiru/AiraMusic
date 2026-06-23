package utils

import (
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// BlankWriter 是一个实现了 io.WriteCloser 接口但不执行任何写入操作的空写入器实例。
var BlankWriter = &blankWriter{}

// blankWriter 是一个实现了 io.WriteCloser 接口但不执行任何写入操作的空写入器。
type blankWriter struct{}

func (*blankWriter) Write(p []byte) (int, error) { return len(p), nil }
func (*blankWriter) Close() error                { return nil }

// EnsureDir 确保文件夹存在，若不存在则创建，并设置指定的权限。
func EnsureDir(dir string, perm os.FileMode) error {
	if err := os.MkdirAll(dir, perm); err != nil {
		return fmt.Errorf("failed to create directory: %v", err)
	}
	if err := os.Chmod(dir, perm); err != nil {
		return fmt.Errorf("failed to set directory permissions: %v", err)
	}
	return nil
}

// RandomFilename 生成一个随机文件名，格式为 "[GetTime]_[RandString]"
func RandomFilename() string {
	return strconv.FormatInt(GetTime(), 10) + "_" + RandString(12)
}

// FilePathToSchemeURL 将给定的文件路径转换为带有自定义方案的 URL。
func FilePathToSchemeURL(path, scheme, schemeHostname string) string {
	if strings.HasPrefix(path, scheme+"://") {
		return path
	}

	normalized := strings.ReplaceAll(strings.TrimSpace(path), "\\", "/")
	encoded := url.PathEscape(normalized)

	if encoded != "" {
		return fmt.Sprintf("%s://%s/%s", scheme, schemeHostname, encoded)
	}
	return encoded
}

// GetDefaultStorePath 获取默认的存储路径，通常位于用户的缓存目录下。
func GetDefaultStorePath() string {
	userCachePath, err := os.UserCacheDir()
	if err != nil {
		userCachePath = os.TempDir()
	}
	return filepath.Join(userCachePath, "mahiru", "music")
}

func GetTempDir() string {
	tempDir := os.TempDir()
	dir := filepath.Join(tempDir, "mahiru_music_temp")
	if err := EnsureDir(dir, 0o775); err != nil {
		return tempDir
	}
	return dir
}

// MoveFileByCopy 通过复制的方式移动文件，适用于跨设备移动文件的情况。如果失败，不会删除源文件。
func MoveFileByCopy(src, dst string) bool {
	input, err := os.Open(src)
	if err != nil {
		return false
	}
	defer input.Close() //nolint:errcheck

	output, err := os.Create(dst)
	if err != nil {
		return false
	}
	defer output.Close() //nolint:errcheck

	if _, err = io.Copy(output, input); err != nil {
		_ = os.Remove(dst) //nolint:errcheck
		return false
	}

	// 复制成功后删除源文件
	_ = os.Remove(src) //nolint:errcheck
	return true
}
