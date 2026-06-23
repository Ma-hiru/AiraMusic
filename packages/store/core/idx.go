package core

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"store/utils"

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
	return writeMeta(Self.file, meta)
}

func writeMeta(file *os.File, meta *StoreMeta) error {
	_, err := file.Write([]byte("version: " + strconv.Itoa(meta.version) + "\n"))
	if err != nil {
		return err
	}
	_, err = file.Write([]byte("createTime: " + strconv.FormatInt(meta.createTime, 10) + "\n"))
	if err != nil {
		return err
	}
	return file.Sync()
}

// WriteIdxs 写入index文件索引信息，无锁
func (Self *IndexHandle) WriteIdxs(idxs []Index) error {
	return writeIdxs(Self.file, idxs)
}

func writeIdxs(file *os.File, idxs []Index) error {
	for _, index := range idxs {
		var line, err = json.Marshal(index)
		if err != nil {
			return err
		}
		_, err = file.Write(append(line, '\n'))
		if err != nil {
			return err
		}
	}
	return file.Sync()
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

// Destroy 覆盖写入索引并关闭句柄（终态，调用后 file 为 nil）
func (Self *IndexHandle) Destroy(meta *StoreMeta, idxs []Index) error {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	return Self.rewriteLocked(meta, idxs)
}

// Rebuild 覆盖写入索引并原子重建句柄，全程持有 mutex
func (Self *IndexHandle) Rebuild(meta *StoreMeta, idxs []Index) error {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	if err := Self.rewriteLocked(meta, idxs); err != nil {
		return err
	}
	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	var indexFile, err = os.OpenFile(indexPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		return fmt.Errorf("failed to reopen index file: %w", err)
	}
	Self.file = indexFile
	return nil
}

// rewriteLocked 以临时文件 + 原子替换的方式覆盖写入索引，调用方需持有 mutex，
// 完成后 Self.file 为 nil（句柄已关闭）
func (Self *IndexHandle) rewriteLocked(meta *StoreMeta, idxs []Index) error {
	var path = filepath.Join(meta.storeDir, meta.indexName)
	var tempPath = path + ".tmp"
	var backupPath = path + ".bak"

	if Self.file != nil {
		_ = Self.file.Close()
		Self.file = nil
	}
	if err := os.Remove(tempPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove old temporary index file: %w", err)
	}

	var file, err = os.OpenFile(tempPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0666)
	if err != nil {
		return fmt.Errorf("failed to create temporary index file: %w", err)
	}

	if err = writeMeta(file, meta); err != nil {
		_ = file.Close()
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to write index metadata: %w", err)
	}
	if err = writeIdxs(file, idxs); err != nil {
		_ = file.Close()
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to write index data: %w", err)
	}
	if err = file.Close(); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to close temporary index file: %w", err)
	}

	if err = replaceIndexFile(path, tempPath, backupPath); err != nil {
		return err
	}
	return nil
}

func replaceIndexFile(path, tempPath, backupPath string) error {
	if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to remove old backup index file: %w", err)
	}

	var hasOldIndex bool
	if _, err := os.Stat(path); err == nil {
		hasOldIndex = true
		if err = os.Rename(path, backupPath); err != nil {
			_ = os.Remove(tempPath)
			return fmt.Errorf("failed to backup index file: %w", err)
		}
	} else if !os.IsNotExist(err) {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to stat index file: %w", err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		if hasOldIndex {
			if restoreErr := os.Rename(backupPath, path); restoreErr != nil {
				_ = os.Remove(tempPath)
				return fmt.Errorf("failed to replace index file: %w; failed to restore backup: %v", err, restoreErr)
			}
		}
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to replace index file: %w", err)
	}

	if hasOldIndex {
		_ = os.Remove(backupPath)
	}
	return nil
}
