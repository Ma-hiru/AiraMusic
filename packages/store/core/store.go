package core

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"store/utils"
	"strconv"
	"strings"
	"time"
)

const indexFlushDelay = 2 * time.Second

// #region CURD 操作

// CheckByID 检查指定 id 的文件是否已存在于存储中，存在则返回对应的索引和 true，否则返回 false
func (Self *Store) CheckByID(id string) (index Index, exist bool) {
	Self.indexMappedLock.RLock()
	index, exist = Self.indexMapped[id]
	Self.indexMappedLock.RUnlock()
	return
}

// CheckByIdx 检查指定 idx 的文件是否已存在于存储中，存在则返回对应的索引和 true，否则返回 false
func (Self *Store) CheckByIdx(idx Index) (index Index, exist bool) {
	return Self.CheckByID(idx.ID)
}

// StoreBytes 直接将数据存储到存储中，返回对应的索引信息或者错误
func (Self *Store) StoreBytes(id string, mimeType string, data []byte) (Index, error) {
	var fileName = utils.RandomFilename()
	var filePath = filepath.Join(Self.meta.storeDir, fileName)

	// 创建文件并写入数据
	var file, err = os.Create(filePath)
	if err != nil {
		return Index{}, err
	}

	// 写入数据
	_, err = file.Write(data)
	if err != nil {
		_ = file.Close()
		_ = os.Remove(filePath)
		return Index{}, err
	}

	// 同步数据
	if err = file.Sync(); err != nil {
		_ = file.Close()
		_ = os.Remove(filePath)
		return Index{}, err
	}

	// 关闭文件
	if err = file.Close(); err != nil {
		_ = os.Remove(filePath)
		return Index{}, err
	}

	// 创建索引并添加到存储中
	var index = NewIndex(
		id,
		filePath,
		WithFileInfo("", fileName, mimeType, strconv.Itoa(len(data))),
	)
	if err = Self.appendIndex(index); err != nil {
		_ = os.Remove(filePath)
		return Index{}, err
	}

	return index, nil
}

// FetchByReader 根据索引信息获取对应的文件读取句柄
func (Self *Store) FetchByReader(idx Index) (io.ReadCloser, error) {
	return os.Open(idx.Path)
}

// RemoveByID 根据 id 删除对应的文件，成功删除返回 true，否则返回 false
func (Self *Store) RemoveByID(id string) (bool, error) {
	var index, exits = Self.CheckByID(id)
	if !exits {
		return true, nil
	}

	var err = os.Remove(index.Path)
	if err != nil {
		return false, err
	}

	Self.indexMappedLock.Lock()
	delete(Self.indexMapped, id)
	Self.indexMappedLock.Unlock()
	Self.markIndexDirty()

	return true, nil
}

// RemoveByIdx 根据 idx 删除对应的文件，成功删除返回 true，否则返回 false
func (Self *Store) RemoveByIdx(idx Index) (bool, error) {
	return Self.RemoveByID(idx.ID)
}

// Clear 清空存储中的所有文件，返回被删除的文件数量
func (Self *Store) Clear() (int, error) {
	Self.indexMappedLock.Lock()
	var count = len(Self.indexMapped)
	for _, index := range Self.indexMapped {
		_ = os.Remove(index.Path)
	}
	Self.indexMapped = make(map[string]Index)
	Self.indexMappedLock.Unlock()
	Self.clearPendingIndexDirty()
	Self.updateIdxHandle()
	return count, nil
}

// BeginWrite 开始写入文件，返回写入句柄，如果已经有相同 URL 的写入在进行中，返回一个空的写入句柄
// 不用担心并发写入同一个 URL，因为调用此函数前会先检查索引是否存在，只有不存在时才会调用此函数
func (Self *Store) BeginWrite(url, name, fileType, size, etag, lastModified string) io.WriteCloser {
	Self.currentWriteMappedLock.RLock()
	if _, ok := Self.currentWriteMapped[url]; ok {
		Self.currentWriteMappedLock.RUnlock()
		return utils.BlankWriter
	}
	Self.currentWriteMappedLock.RUnlock()

	var tmpName = utils.RandomFilename() + ".tmp"
	var tmpPath = filepath.Join(utils.GetTempDir(), tmpName)

	var file, err = os.Create(tmpPath)
	if err != nil {
		return utils.BlankWriter
	}

	Self.currentWriteMappedLock.Lock()
	Self.currentWriteMapped[url] = &WritingFile{
		tmpPath,
		name,
		fileType,
		size,
		etag,
		lastModified,
		file,
	}
	Self.currentWriteMappedLock.Unlock()

	return file
}

// UpdateWriteSize 更新正在写入文件的预期大小信息，适用于预期大小不准确的情况（预期大小不一致时会在 EndWrite 时删除文件并返回空索引），（Content-Length 不准确的情况（206））
func (Self *Store) UpdateWriteSize(url, size string) {
	Self.currentWriteMappedLock.Lock()
	defer Self.currentWriteMappedLock.Unlock()
	if wFile, ok := Self.currentWriteMapped[url]; ok {
		wFile.size = size
	}
}

// EndWrite 结束写入文件，如果成功则将临时文件重命名为最终文件并创建索引，返回索引信息，否则删除临时文件并返回空索引，移动失败或者索引写入失败都会删除文件并返回空索引
func (Self *Store) EndWrite(id, url string, success bool) Index {
	Self.currentWriteMappedLock.Lock()
	var wFile, ok = Self.currentWriteMapped[url]
	if !ok {
		Self.currentWriteMappedLock.Unlock()
		return Index{}
	}
	delete(Self.currentWriteMapped, url)
	Self.currentWriteMappedLock.Unlock()

	// 检查文件大小是否符合预期，如果不符合预期则删除临时文件并返回空索引
	var info, err = wFile.file.Stat()
	if err == nil {
		// [wFile.size] 为文件预期大小，不符合时会删除缓存文件，为空时，会被赋值为实际大小
		var actualSize = strconv.FormatInt(info.Size(), 10)
		if wFile.size == "" {
			wFile.size = actualSize
		} else if actualSize != wFile.size {
			success = false
		}
	} else {
		log.Println("Failed stating written file:", err)
	}
	_ = wFile.file.Close() //nolint:errcheck

	if !success {
		_ = os.Remove(wFile.tmpPath)
		return Index{}
	}

	var finalName = utils.RandomFilename()
	var finalPath = filepath.Join(Self.meta.storeDir, finalName)

	// 如果 newpath 已存在且不是目录，Rename 会替换它。
	// 如果 newpath 已存在且是目录，Rename 返回错误。
	// 当 oldpath 和 newpath 位于不同目录时，可能会受到特定于操作系统的限制。
	// 即便在同一个目录内，在非 Unix 平台上 Rename 也不是原子操作。
	if err := os.Rename(wFile.tmpPath, finalPath); err != nil {
		if info, statErr := os.Stat(finalPath); statErr == nil && info.IsDir() {
			// 1. 可能目标路径是目录
			// 生成新的目标路径
			finalName = utils.RandomFilename()
			finalPath = filepath.Join(Self.meta.storeDir, finalName)
			if err := os.Rename(wFile.tmpPath, finalPath); err != nil {
				log.Println("Failed to rename written file after retrying with new name:", err)
				_ = os.Remove(wFile.tmpPath) //nolint:errcheck
				return Index{}
			}
			// 2. 可能是跨设备移动导致的错误，尝试使用复制的方式移动文件
		} else if !utils.MoveFileByCopy(wFile.tmpPath, finalPath) {
			// 全部fallback失败
			log.Println("Failed to move written file by fallback method:", err)
			_ = os.Remove(wFile.tmpPath) //nolint:errcheck
			return Index{}
		}
	}

	// 如果 id 为空，则使用 url 作为 id
	if id == "" {
		id = url
	}

	var index = NewIndex(
		id,
		finalPath,
		WithFileInfo(url, wFile.name, wFile.fileType, wFile.size),
		WithETag(wFile.etag),
		WithLastModified(wFile.lastModified),
	)

	if err := Self.appendIndex(index); err != nil {
		// 文件移动成功，但是索引写入失败，删除文件
		log.Println("Failed to append index for written file:", err)
		_ = os.Remove(finalPath) //nolint:errcheck
		return Index{}
	}

	return index
}

// Move 将存储目录下的所有文件移动到新的目录中，并更新索引中的路径信息，过程中通过 progress 通道报告进度
func (Self *Store) Move(path string, progress chan<- MoveProgressChan) error {
	if path == "" {
		return fmt.Errorf("target path is empty")
	}
	path = filepath.Clean(path)
	if path == Self.meta.storeDir {
		return fmt.Errorf("target path is the same as Current store path")
	}
	var info, err = os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("target path does not exist")
		}
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("target path is not a directory")
	}

	Self.indexMappedLock.Lock()
	Self.currentWriteMappedLock.Lock()
	Self.indexHandle.mutex.Lock()

	dirEntries, err := os.ReadDir(Self.meta.storeDir)
	if err != nil {
		Self.indexMappedLock.Unlock()
		Self.currentWriteMappedLock.Unlock()
		Self.indexHandle.mutex.Unlock()
		return err
	}

	var fileEntries = make([]os.DirEntry, 0, len(dirEntries))
	var errorCount int64 = 0
	var currentCount int64 = 0
	var percent int64
	for _, entry := range dirEntries {
		if entry.IsDir() {
			continue
		}
		fileEntries = append(fileEntries, entry)
	}
	sort.SliceStable(fileEntries, func(i, j int) bool {
		if fileEntries[i].Name() == Self.meta.indexName {
			return false
		}
		if fileEntries[j].Name() == Self.meta.indexName {
			return true
		}
		return false
	})
	var totalCount = int64(len(fileEntries))
	if totalCount == 0 {
		Self.indexMappedLock.Unlock()
		Self.currentWriteMappedLock.Unlock()
		Self.indexHandle.mutex.Unlock()
		return nil
	}
	// 移动文件时先关闭索引文件句柄，移动完成后再重新打开索引文件句柄，避免移动过程中索引文件被占用导致的错误
	_ = Self.indexHandle.file.Close() //nolint:errcheck

	type movedFile struct {
		src string
		dst string
	}
	var movedFiles = make([]movedFile, 0, len(fileEntries))
	var moveFile = func(srcPath string, destPath string) error {
		if err := os.Rename(srcPath, destPath); err != nil {
			if !utils.MoveFileByCopy(srcPath, destPath) {
				return err
			}
		}
		return nil
	}
	var reopenIndexHandle = func(dir string) error {
		var indexPath = filepath.Join(dir, Self.meta.indexName)
		var indexFile, err = os.OpenFile(indexPath, os.O_APPEND|os.O_RDWR, 0666)
		if err != nil {
			return err
		}
		Self.indexHandle.file = indexFile
		return nil
	}

	for _, entry := range fileEntries {
		var srcPath = filepath.Join(Self.meta.storeDir, entry.Name())
		var destPath = filepath.Join(path, entry.Name())
		err = moveFile(srcPath, destPath)
		currentCount += 1
		percent = (currentCount * 100) / totalCount
		if err != nil {
			errorCount += 1
		} else {
			movedFiles = append(movedFiles, movedFile{src: srcPath, dst: destPath})
		}
		if progress != nil {
			progress <- MoveProgressChan{
				Total:   totalCount,
				Current: currentCount,
				Percent: percent,
				Failed:  errorCount,
			}
		}
	}

	if errorCount > 0 {
		for i := len(movedFiles) - 1; i >= 0; i-- {
			if err := moveFile(movedFiles[i].dst, movedFiles[i].src); err != nil {
				log.Println("Failed to rollback moved file:", err)
			}
		}
		if err = reopenIndexHandle(Self.meta.storeDir); err != nil {
			Self.indexMappedLock.Unlock()
			Self.currentWriteMappedLock.Unlock()
			Self.indexHandle.mutex.Unlock()
			return fmt.Errorf("failed to move %d of %d files and failed to reopen index: %w", errorCount, totalCount, err)
		}
		Self.indexMappedLock.Unlock()
		Self.currentWriteMappedLock.Unlock()
		Self.indexHandle.mutex.Unlock()
		return fmt.Errorf("failed to move %d of %d files", errorCount, totalCount)
	}

	// 更新存储目录
	Self.meta.storeDir = filepath.Clean(path)
	// 更新索引中的路径信息
	for id, index := range Self.indexMapped {
		var fileName = filepath.Base(index.Path)
		index.Path = filepath.Join(Self.meta.storeDir, fileName)
		index.File = utils.FilePathToSchemeURL(
			index.Path,
			store.option.FileScheme,
			store.option.FileSchemeHost,
		)
		Self.indexMapped[id] = index
	}

	Self.indexMappedLock.Unlock()
	Self.currentWriteMappedLock.Unlock()
	Self.indexHandle.mutex.Unlock()

	Self.clearPendingIndexDirty()
	Self.updateIdxHandle()
	return nil
}

//#endregion

// #region 统计操作

// ItemCount 返回当前存储的文件数量
func (Self *Store) ItemCount() int {
	Self.indexMappedLock.RLock()
	defer Self.indexMappedLock.RUnlock()
	return len(Self.indexMapped)
}

// TotalBytes 计算存储目录下所有文件的总大小，排除索引文件
func (Self *Store) TotalBytes() uint64 {
	var dirEntries, err = os.ReadDir(Self.meta.storeDir)
	if err != nil {
		return 0
	}

	var varSize uint64 = 0
	for _, entry := range dirEntries {
		if !entry.IsDir() && entry.Name() != Self.meta.indexName {
			var fileInfo, err = entry.Info()
			if err == nil {
				varSize += uint64(fileInfo.Size())
			}
		}
	}
	return varSize
}

// TotalBytesByCategory 计算不同类型文件的总大小，按照 MIME 类型的前缀进行分类，返回图片、音频、视频和其他类型的大小总和
func (Self *Store) TotalBytesByCategory() (image uint64, audio uint64, video uint64, other uint64) {
	Self.indexMappedLock.RLock()
	defer Self.indexMappedLock.RUnlock()

	for _, index := range Self.indexMapped {
		size, err := strconv.ParseInt(index.Size, 10, 64)
		if err != nil {
			continue
		}
		if strings.HasPrefix(index.Type, "image/") {
			image += uint64(size)
		} else if strings.HasPrefix(index.Type, "audio/") {
			audio += uint64(size)
		} else if strings.HasPrefix(index.Type, "video/") {
			video += uint64(size)
		} else {
			other += uint64(size)
		}
	}

	return
}

// #endregion

// #region 生命周期操作

// Destroy 销毁文件句柄，保存索引到文件
func (Self *Store) Destroy() error {
	Self.clearPendingIndexDirty()
	Self.indexFlushLock.Lock()
	defer Self.indexFlushLock.Unlock()

	return Self.destroyIdxHandle()
}

// ClearInvalidFile 清理无效文件：包括空文件、未被使用的临时文件、没有索引的文件、过期文件
func (Self *Store) ClearInvalidFile() error {
	var start = time.Now()
	var entries, err = os.ReadDir(Self.meta.storeDir)
	if err != nil {
		return err
	}
	// 空文件
	var blanks = make(map[string]struct{})
	// 临时文件
	var temps = make([]string, 0)
	// 不存在索引的文件，初始化为所有文件，后续会移除被索引管理的文件
	var actualExist = make(map[string]struct{})
	// 收集所有临时文件、空文件、存储所有文件名到 actualExist 初始化
	for _, entry := range entries {
		// 跳过目录和索引文件
		if entry.IsDir() || entry.Name() == Self.meta.indexName {
			continue
		}
		// 获取文件信息
		var info, err = entry.Info()
		if err != nil || info.IsDir() {
			continue
		}
		if info.Name() != Self.meta.indexName {
			// 筛选无效文件：临时文件或大小为0的文件
			if info.Size() == 0 {
				blanks[info.Name()] = struct{}{}
				// 文件写入完毕，存储索引时，不会存储临时文件名，可能是异常中断导致的残留文件或者正在写入的文件
			} else if strings.HasSuffix(info.Name(), ".tmp") {
				temps = append(temps, info.Name())
			}
			// 添加所有存在的文件来初始化
			actualExist[info.Name()] = struct{}{}
		}
	}
	// temp 文件直接删除
	for _, temp := range temps {
		var fpath = filepath.Join(Self.meta.storeDir, temp)
		_ = os.Remove(fpath) //nolint:errcheck
	}
	// 对于空文件，应该全部删除，删除前，查看是否有对应索引存在，有索引删除索引，同时检查actualExist的文件是否被管理
	var shouldDeleteIndexes = make([]string, 0)
	Self.indexMappedLock.RLock()
	for _, index := range Self.indexMapped {
		var fileName = filepath.Base(index.Path)
		if _, exist := blanks[fileName]; exist {
			// 先删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.ID)
			// actualExist > blanks ，满足blanks的文件一定在actualExist中
			// 这条分支说明文件本地存在且有索引管理，但是由于是空文件，所以索引和文件都会被删除，移除actualExist中的记录
			delete(actualExist, fileName)
		} else if _, exist := actualExist[fileName]; !exist {
			// 这条分支说明索引存在、本地文件不存在，删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.ID)
		} else {
			// 这条分支说明文件本地存在且有索引管理，正常文件，移除actualExist中的记录
			delete(actualExist, fileName)
		}
	}
	Self.indexMappedLock.RUnlock()
	// 先删除所有需要删除的索引
	Self.indexMappedLock.Lock()
	for _, id := range shouldDeleteIndexes {
		delete(Self.indexMapped, id)
	}
	Self.indexMappedLock.Unlock()
	// 后删除所有的空文件
	for blank := range blanks {
		var fpath = filepath.Join(Self.meta.storeDir, blank)
		_ = os.Remove(fpath)
	}
	// 最后删除所有没有索引管理的文件,有管理的文件已经从 actualExist 中移除，剩下的就是没有索引管理的文件
	for fileName := range actualExist {
		var fpath = filepath.Join(Self.meta.storeDir, fileName)
		_ = os.Remove(fpath)
	}
	// 清理过期文件
	var now = utils.GetTime()
	Self.indexMappedLock.Lock()
	for id, index := range Self.indexMapped {
		if now-index.CreateTime > Self.option.TimeLimit.Nanoseconds() {
			_ = os.Remove(index.Path)
			delete(Self.indexMapped, id)
		}
	}
	Self.indexMappedLock.Unlock()
	// 最后更新存储索引，然后重建索引文件句柄
	Self.clearPendingIndexDirty()
	Self.updateIdxHandle()
	var duration = time.Since(start)
	fmt.Printf("Clearing invalid files completed in %s.\n", duration.String())
	return nil
}

// LimitCapacity 当存储容量超过限制时，删除最早创建的文件，直到容量满足限制
func (Self *Store) LimitCapacity() error {
	var capacity = Self.option.Capacity // 以字节为单位
	// capacity == 0 表示不限制容量
	if capacity == 0 {
		fmt.Println("Capacity limit is set to 0, skipping capacity check.")
		return nil
	}

	var currentSize = Self.TotalBytes()
	// 当前容量未超过限制，无需删除文件
	if currentSize <= capacity {
		return nil
	}

	// 获取所有索引并按照创建时间排序，优先删除最早创建的文件
	var indexes []Index
	Self.indexMappedLock.RLock()
	for _, index := range Self.indexMapped {
		indexes = append(indexes, index)
	}
	Self.indexMappedLock.RUnlock()
	// 按照创建时间排序，升序，最早创建的文件排在前面
	sort.Slice(indexes, func(i, j int) bool {
		return indexes[i].CreateTime < indexes[j].CreateTime
	})

	var deletedSize uint64 = 0
	var deletedCount = 0
	for _, index := range indexes {
		// 删除文件后，如果容量已满足限制，则停止删除
		if currentSize-deletedSize <= capacity {
			break
		}

		// 删除文件和索引，如果删除失败，继续尝试删除下一个文件
		var err error
		deleted, err := Self.RemoveByIdx(index)
		if err != nil || !deleted {
			continue
		}

		// 累加已删除的文件大小和数量
		size, err := strconv.ParseInt(index.Size, 10, 64)
		if err != nil {
			continue
		}
		deletedSize += uint64(size)
		deletedCount += 1
	}

	if deletedCount >= 0 {
		fmt.Printf("Deleted %d files to limit capacity, freed %d bytes.\n", deletedCount, deletedSize)
	}
	if deletedCount > 0 {
		Self.flushDirtyIndex()
	}

	return nil
}

// #endregion

// #region 其他操作

// Path 返回存储目录路径
func (Self *Store) Path() string {
	return Self.meta.storeDir
}

// #endregion

// #region inner 操作
// 从索引文件加载索引到内存
func (Self *Store) loadIndex() {
	for _, idx := range Self.indexHandle.ReadIdxs() {
		Self.indexMapped[idx.ID] = idx
	}
}

// 以追加写入的方式写入单条 JSON（加换行），本函数在运行时执行
func (Self *Store) appendIndex(idx Index) error {
	Self.indexMappedLock.RLock()
	var oldIndex, exist = Self.indexMapped[idx.ID]
	Self.indexMappedLock.RUnlock()
	if exist {
		_, _ = Self.RemoveByIdx(oldIndex)
	}

	Self.indexMappedLock.Lock()
	Self.indexMapped[idx.ID] = idx
	Self.indexMappedLock.Unlock()

	if err := Self.indexHandle.AppendIdx(idx); err != nil {
		Self.indexMappedLock.Lock()
		delete(Self.indexMapped, idx.ID)
		Self.indexMappedLock.Unlock()
		return err
	}

	return nil
}

// 标记索引文件需要覆盖刷新，短时间内多次删除只触发一次刷新
func (Self *Store) markIndexDirty() {
	Self.indexDirtyLock.Lock()
	defer Self.indexDirtyLock.Unlock()

	Self.indexDirty = true
	if Self.indexFlushTimer == nil {
		Self.indexFlushTimer = time.AfterFunc(indexFlushDelay, func() {
			Self.flushDirtyIndex()
		})
		return
	}
	Self.indexFlushTimer.Reset(indexFlushDelay)
}

func (Self *Store) clearPendingIndexDirty() {
	Self.indexDirtyLock.Lock()
	defer Self.indexDirtyLock.Unlock()

	Self.indexDirty = false
	if Self.indexFlushTimer != nil {
		Self.indexFlushTimer.Stop()
		Self.indexFlushTimer = nil
	}
}

func (Self *Store) flushDirtyIndex() {
	Self.indexDirtyLock.Lock()
	if !Self.indexDirty {
		Self.indexFlushTimer = nil
		Self.indexDirtyLock.Unlock()
		return
	}
	Self.indexDirty = false
	if Self.indexFlushTimer != nil {
		Self.indexFlushTimer.Stop()
		Self.indexFlushTimer = nil
	}
	Self.indexDirtyLock.Unlock()

	Self.updateIdxHandle()
}

// 快照当前内存中的索引
func (Self *Store) snapshotIdxs() []Index {
	Self.indexMappedLock.RLock()
	defer Self.indexMappedLock.RUnlock()
	var indexData = make([]Index, 0, len(Self.indexMapped))
	for _, index := range Self.indexMapped {
		indexData = append(indexData, index)
	}
	return indexData
}

// 将内存中的索引全部写入索引文件，覆盖写入并关闭 indexHandle，本函数在销毁存储时执行
func (Self *Store) destroyIdxHandle() error {
	return Self.indexHandle.Destroy(&Self.meta, Self.snapshotIdxs())
}

// 强制更新存储索引并原子重建索引文件句柄，如果失败，由于无法继续使用存储，直接 panic
func (Self *Store) updateIdxHandle() {
	Self.indexFlushLock.Lock()
	defer Self.indexFlushLock.Unlock()

	// Rebuild 全程持有 indexHandle.mutex，覆盖写入并重开句柄，
	// 避免出现 file == nil 的中间窗口与并发 AppendIdx 抢写
	if err := Self.indexHandle.Rebuild(&Self.meta, Self.snapshotIdxs()); err != nil {
		// 索引损坏
		panic(err)
	}
}

// #endregion
