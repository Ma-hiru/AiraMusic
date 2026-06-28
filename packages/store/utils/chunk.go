package utils

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
)

var ErrMergeChunkClientClosed = errors.New("[merge chunk] client closed connection")

func SplitChunk(data io.Reader, size int64, chunkCount int, outDir string) (string, []string, error) {
	if size < 0 {
		return "", nil, errors.New("[split chunk] size cannot be negative")
	}
	if chunkCount <= 0 {
		return "", nil, errors.New("[split chunk] chunkCount must be greater than 0")
	}
	if size == 0 {
		key := RandomFilename("0")
		return key, []string{}, nil
	}
	if int64(chunkCount) > size {
		chunkCount = int(size)
	}

	var (
		remaining   = size
		chunkSize   = (size + int64(chunkCount) - 1) / int64(chunkCount)
		chunksName  = make([]string, 0, chunkCount)
		chunksPath  = make([]string, 0, chunkCount)
		key         = RandomFilename(strconv.FormatInt(chunkSize, 10))
		clearChunks = func() {
			for _, path := range chunksPath {
				_ = os.Remove(path)
			}
		}
	)

	for idx := 0; idx < chunkCount && remaining > 0; idx++ {
		// 计算当前chunk最大大小
		currentSize := chunkSize
		if remaining < chunkSize {
			currentSize = remaining
		}
		var buf = make([]byte, currentSize)
		// 读取文件
		if _, err := io.ReadFull(data, buf); err != nil {
			clearChunks()
			return "", nil, fmt.Errorf("[split chunk] read chunk %d failed: %w", idx, err)
		}
		// 加密
		encryption, err := Crypt(key, buf, idx)
		if err != nil {
			clearChunks()
			return "", nil, fmt.Errorf("[split chunk] encrypt chunk %d failed: %w", idx, err)
		}
		//  写入文件
		chunkName := RandomFilename(strconv.Itoa(idx))
		chunkPath := filepath.Join(outDir, chunkName)
		chunksName = append(chunksName, chunkName)
		chunksPath = append(chunksPath, chunkPath)

		if err := os.WriteFile(chunkPath, encryption, 0644); err != nil {
			clearChunks()
			return "", nil, fmt.Errorf("[split chunk] write chunk %d failed: %w", idx, err)
		}

		remaining -= currentSize
	}

	if remaining != 0 {
		clearChunks()
		return "", nil, errors.New("[split chunk] unexpected remaining data")
	}

	return key, chunksName, nil
}

func MergeChunk(
	ctx context.Context,
	out io.Writer,
	key string,
	chunksDir string,
	chunksName []string,
) error {
	if key == "" {
		return errors.New("[merge chunk] key is empty")
	}
	if out == nil {
		return errors.New("[merge chunk] writer is nil")
	}
	if len(chunksName) == 0 {
		return nil
	}

	for idx, chunkName := range chunksName {
		// 检查是否被取消
		select {
		case <-ctx.Done():
			return ErrMergeChunkClientClosed
		default:
		}

		if filepath.Base(chunkName) != chunkName {
			return fmt.Errorf("[merge chunk] invalid chunk name: %s", chunkName)
		}

		file, err := os.Open(filepath.Join(chunksDir, chunkName))
		if err != nil {
			return fmt.Errorf("[merge chunk] open chunk %d failed: %w", idx, err)
		}

		_, err = CryptStream(key, idx, file, out, ctx)
		if err != nil {
			_ = file.Close()
			if ctx.Err() != nil {
				return ErrMergeChunkClientClosed
			}
			return fmt.Errorf("[merge chunk] decrypt chunk %d failed: %w", idx, err)
		}

		err = file.Close()
		if err != nil {
			return fmt.Errorf("[merge chunk] close chunk %d failed: %w", idx, err)
		}
	}

	return nil
}
