package file

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"store/utils"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type IndexOption func(*Index)

func NewIndex(id, path string, options ...IndexOption) Index {
	var idx = &Index{
		ID:   id,
		Path: path,
		Type: "application/octet-stream",
		File: utils.FilePathToSchemeURL(
			path,
			store.option.FileScheme,
			store.option.FileSchemeHost,
		),
		CreateTime: utils.GetTime(),
	}

	for _, opt := range options {
		opt(idx)
	}

	return *idx
}

func WithFileInfo(
	url,
	name,
	fileType,
	size string,
) IndexOption {
	return func(i *Index) {
		i.Url = url
		i.Name = name
		i.Type = fileType
		i.Size = size
	}
}

func WithETag(etag string) IndexOption {
	return func(i *Index) {
		i.ETag = etag
	}
}

func WithLastModified(lm string) IndexOption {
	return func(i *Index) {
		i.LastModified = lm
	}
}

func (Self Index) IsExpiredMill(timeLimitMill int64) bool {
	var nowNano = utils.GetTime()
	var createNano = Self.CreateTime

	return nowNano-createNano > timeLimitMill*1e6
}

func (Self Index) IsExpiredNano(timeLimitNano int64) bool {
	var nowNano = utils.GetTime()
	var createNano = Self.CreateTime

	return nowNano-createNano > timeLimitNano
}

func (Self Index) FillHeader(ctx *gin.Context) {
	if Self.ETag != "" {
		ctx.Header("Cache-Control", "no-cache")
		ctx.Header("ETag", Self.ETag)
	}
	if Self.Type != "" {
		ctx.Header("Content-Type", Self.Type)
	}
	if Self.Size != "" {
		ctx.Header("Content-Length", Self.Size)
	}
	if Self.LastModified != "" {
		ctx.Header("Last-Modified", Self.LastModified)
	}
	if Self.Name != "" {
		ctx.Header("Content-Disposition", "attachment; filename=\""+Self.Name+"\"")
	}
}

// 创建index文件
func createIndexFile(meta *StoreMeta) error {
	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	var indexFile, err = os.Create(indexPath)
	if err != nil {
		return fmt.Errorf("failed to create index file: %v", err)
	}
	defer func() {
		indexFile.Close()
		if err != nil {
			_ = os.Remove(indexPath)
		}
	}()
	err = writeIndexFileMeta(indexFile, meta)
	return err
}

// 写入index文件meta
func writeIndexFileMeta(indexFile *os.File, meta *StoreMeta) error {
	_, err := indexFile.Write([]byte("version: " + strconv.Itoa(meta.version) + "\n"))
	if err != nil {
		return err
	}
	_, err = indexFile.Write([]byte("createTime: " + strconv.FormatInt(meta.createTime, 10) + "\n"))
	if err != nil {
		return err
	}
	return indexFile.Sync()
}

// 写入index文件索引信息
func writeIndexFileData(indexFile *os.File, indexData []Index) error {
	for _, index := range indexData {
		var line, err = json.Marshal(index)
		if err != nil {
			return err
		}
		_, err = indexFile.Write(append(line, '\n'))
		if err != nil {
			return err
		}
	}
	return indexFile.Sync()
}

// 检查路径和读取version
func checkIndexFile(meta *StoreMeta) error {
	// 处理路径
	var storeDirInfo, err = os.Stat(meta.storeDir)
	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	// 检查目录是否存在
	if err != nil || !storeDirInfo.IsDir() {
		return fmt.Errorf("directory does not exist or is not a directory")
	}
	// 打开索引文件
	indexFile, err := os.Open(indexPath)
	if err != nil {
		return fmt.Errorf("failed to open index file: %v", err)
	}
	defer indexFile.Close()
	// 读取版本和创建时间
	var scanner = bufio.NewScanner(indexFile)
	for scanner.Scan() {
		var line = scanner.Text()
		if strings.HasPrefix(line, "version: ") {
			meta.version, err = strconv.Atoi(strings.TrimPrefix(line, "version: "))
			if err != nil {
				return fmt.Errorf("failed to parse version from index file: %v", err)
			}
		} else if strings.HasPrefix(line, "createTime: ") {
			meta.createTime, err = strconv.ParseInt(strings.TrimPrefix(line, "createTime: "), 10, 64)
			if err != nil {
				return fmt.Errorf("failed to parse create time from index file: %v", err)
			}
		} else {
			break
		}
	}
	if meta.version == 0 || meta.createTime == 0 {
		return fmt.Errorf("invalid index file format")
	}
	return nil
}

// 读取index文件索引信息
func readIndexFile(indexFile io.Reader) []Index {
	var scanner = bufio.NewScanner(indexFile)
	var indices []Index
	for scanner.Scan() {
		var line = scanner.Text()
		// 跳过空行、版本和创建时间行
		if len(line) == 0 || strings.HasPrefix(line, "version: ") || strings.HasPrefix(line, "createTime: ") {
			continue
		}

		var idx Index
		if err := json.Unmarshal([]byte(line), &idx); err != nil {
			continue
		}

		indices = append(indices, idx)
	}
	return indices
}
