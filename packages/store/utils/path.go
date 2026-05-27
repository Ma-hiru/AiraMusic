package utils

import (
	"fmt"
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

	var normalized = strings.ReplaceAll(strings.TrimSpace(path), "\\", "/")
	var encoded = url.PathEscape(normalized)

	if encoded != "" {
		return fmt.Sprintf("%s://%s/%s", scheme, schemeHostname, encoded)
	}
	return encoded
}

// GetDefaultStorePath 获取默认的存储路径，通常位于用户的缓存目录下。
func GetDefaultStorePath() string {
	var userCachePath, err = os.UserCacheDir()
	if err != nil {
		userCachePath = os.TempDir()
	}
	return filepath.Join(userCachePath, "mahiru", "music")
}
