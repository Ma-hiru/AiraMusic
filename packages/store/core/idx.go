package core

import (
	"bufio"
	"encoding/json"
	"fmt"
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
	mimeType,
	size string,
) IndexOption {
	return func(i *Index) {
		i.Url = url
		i.Name = name
		i.Type = mimeType
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
func createIndexFile(meta *StoreMeta) (err error) {
	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	indexFile, err := os.Create(indexPath)
	if err != nil {
		return fmt.Errorf("failed to create index file: %v", err)
	}
	defer func() {
		_ = indexFile.Close() //nolint:errcheck
		if err != nil {
			_ = os.Remove(indexPath)
		}
	}()
	var handle = &IndexHandle{file: indexFile}
	handle.mutex.Lock()
	defer handle.mutex.Unlock()
	return handle.WriteMeta(meta)
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
	defer indexFile.Close() //nolint:errcheck
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
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read index file: %v", err)
	}
	if meta.version == 0 || meta.createTime == 0 {
		return fmt.Errorf("invalid index file format")
	}
	return nil
}

// WriteMeta 写入index文件meta，无锁
func (Self *IndexHandle) WriteMeta(meta *StoreMeta) error {
	_, err := Self.file.Write([]byte("version: " + strconv.Itoa(meta.version) + "\n"))
	if err != nil {
		return err
	}
	_, err = Self.file.Write([]byte("createTime: " + strconv.FormatInt(meta.createTime, 10) + "\n"))
	if err != nil {
		return err
	}
	return Self.file.Sync()
}

// WriteIdxs 写入index文件索引信息，无锁
func (Self *IndexHandle) WriteIdxs(idxs []Index) error {
	for _, index := range idxs {
		var line, err = json.Marshal(index)
		if err != nil {
			return err
		}
		_, err = Self.file.Write(append(line, '\n'))
		if err != nil {
			return err
		}
	}
	return Self.file.Sync()
}

// ReadIdxs 读取index文件索引信息
func (Self *IndexHandle) ReadIdxs() []Index {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	var scanner = bufio.NewScanner(Self.file)
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
	if err := scanner.Err(); err != nil {
		fmt.Printf("failed to read index file: %v\n", err)
		return make([]Index, 0)
	}
	return indices
}

// AppendIdx 追加索引到index文件末尾
func (Self *IndexHandle) AppendIdx(idx Index) error {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	var line, err = json.Marshal(idx)
	if err != nil {
		return err
	}
	_, err = Self.file.Write(append(line, '\n'))
	if err != nil {
		return err
	}
	return Self.file.Sync()
}

// Destroy 销毁索引文件，存储meta和idxs
func (Self *IndexHandle) Destroy(meta *StoreMeta, idxs []Index) error {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	// 先销毁索引文件句柄，覆盖索引，清空文件
	_ = Self.file.Close()
	var path = filepath.Join(meta.storeDir, meta.indexName)
	// 以覆盖写入的方式重新创建索引文件，如果索引文件不存在则创建，存在则清空内容后写入
	var file, err = os.OpenFile(path, os.O_TRUNC|os.O_WRONLY, 0666)
	if err != nil {
		return err
	}
	Self.file = file
	defer Self.file.Close() //nolint:errcheck

	// 写入版本和创建时间
	err = Self.WriteMeta(meta)
	if err != nil {
		return err
	}

	// 写入所有索引
	err = Self.WriteIdxs(idxs)
	if err != nil {
		return err
	}

	return nil
}
