package core

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"store/utils"

	"github.com/gin-gonic/gin"
)

const encryptedIndexPrefix = "idx: "

type IndexOption func(*Index)

func NewIndex(options ...IndexOption) Index {
	var idx = &Index{
		CreateTime: utils.GetTime(),
	}

	for _, opt := range options {
		opt(idx)
	}

	return *idx
}

func IndexRequiredInfo(
	id,
	mime string,
	size int64,
) IndexOption {
	return func(i *Index) {
		i.ID = id
		i.Mime = mime
		i.Size = size
		i.Category = MimeMatchCategory(mime)
	}
}

func IndexRequiredSlices(key string, slice []string) IndexOption {
	return func(i *Index) {
		i.Key = key
		i.Chunks = slice
	}
}

func IndexOptionalURL(url, name string) IndexOption {
	return func(i *Index) {
		i.Url = url
		i.Name = name
	}
}

func IndexOptionalETag(etag string) IndexOption {
	return func(i *Index) {
		i.ETag = etag
	}
}

func IndexOptionalLastModified(lm string) IndexOption {
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

func (Self Index) FillHeader(ctx *gin.Context, partial bool) {
	if Self.ETag != "" {
		ctx.Header("Cache-Control", "no-cache")
		ctx.Header("ETag", Self.ETag)
	}
	if Self.Mime != "" {
		ctx.Header("Content-Type", Self.Mime)
	}
	if Self.Size >= 0 {
		ctx.Header("Content-Length", strconv.FormatInt(Self.Size, 10))
	}
	if Self.LastModified != "" {
		ctx.Header("Last-Modified", Self.LastModified)
	}
	if Self.Name != "" {
		ctx.Header("Content-Disposition", "attachment; filename=\""+Self.Name+"\"")
	}
	if partial {
		ctx.Header("Accept-Ranges", "bytes")
	}
}

func (Self Index) MergeChunk(ctx *gin.Context, dir string) error {
	if ctx.Request.Header.Get("Range") != "" && Self.Size > 0 {
		Self.FillHeader(ctx, true)
		ctx.Header("Content-Range", fmt.Sprintf("bytes 0-%d/%d", Self.Size-1, Self.Size))
		ctx.Header("Content-Length", strconv.FormatInt(Self.Size, 10))
		ctx.Status(http.StatusPartialContent)
	} else {
		Self.FillHeader(ctx, false)
		ctx.Status(http.StatusOK)
	}
	return utils.MergeChunk(
		ctx.Request.Context(),
		ctx.Writer,
		Self.Key,
		dir,
		Self.Chunks,
	)
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
	var handle = &IndexHandle{file: indexFile, indexKey: meta.indexKey}
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
	return writeIdxs(Self.file, Self.indexKey, idxs)
}

func writeIdxs(file *os.File, indexKey string, idxs []Index) error {
	for _, index := range idxs {
		var line, err = marshalIndexLine(indexKey, index)
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

// ReadIdxs 读取index文件索引信息，带锁
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

		var idx, ok = parseIndexLine(Self.indexKey, line)
		if !ok {
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

// AppendIdx 追加索引到index文件末尾，带锁
func (Self *IndexHandle) AppendIdx(idx Index) error {
	Self.mutex.Lock()
	defer Self.mutex.Unlock()
	var line, err = marshalIndexLine(Self.indexKey, idx)
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
	if err = writeIdxs(file, meta.indexKey, idxs); err != nil {
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

func marshalIndexLine(indexKey string, idx Index) ([]byte, error) {
	plain, err := json.Marshal(idx)
	if err != nil {
		return nil, err
	}
	if indexKey == "" {
		return plain, nil
	}

	nonce := nextIndexCryptNonce()
	encrypted, err := utils.Crypt(indexKey, plain, nonce)
	if err != nil {
		return nil, err
	}

	line := encryptedIndexPrefix + strconv.Itoa(nonce) + ":" + base64.StdEncoding.EncodeToString(encrypted)
	return []byte(line), nil
}

func parseIndexLine(indexKey string, line string) (Index, bool) {
	var raw []byte
	if strings.HasPrefix(line, encryptedIndexPrefix) {
		if indexKey == "" {
			return Index{}, false
		}

		payload := strings.TrimPrefix(line, encryptedIndexPrefix)
		nonceRaw, encryptedRaw, ok := strings.Cut(payload, ":")
		if !ok {
			return Index{}, false
		}

		nonce, err := strconv.Atoi(nonceRaw)
		if err != nil {
			return Index{}, false
		}

		encrypted, err := base64.StdEncoding.DecodeString(encryptedRaw)
		if err != nil {
			return Index{}, false
		}

		raw, err = utils.Crypt(indexKey, encrypted, nonce)
		if err != nil {
			return Index{}, false
		}
	} else {
		raw = []byte(line)
	}

	var idx Index
	if err := json.Unmarshal(raw, &idx); err != nil {
		return Index{}, false
	}
	return idx, true
}

func nextIndexCryptNonce() int {
	var buf [8]byte
	var maxInt = uint64(math.MaxInt)

	if _, err := rand.Read(buf[:]); err == nil {
		return int(binary.BigEndian.Uint64(buf[:]) & maxInt)
	}

	return int(uint64(utils.GetTimeNano()) & maxInt)
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
