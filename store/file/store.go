package file

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"store/utils"
	"strconv"
	"strings"
	"time"
)

// Check 检查指定 id 的文件是否已存在于存储中，存在则返回对应的索引和 true，否则返回 false
func (Self *Store) Check(id string) (index Index, exist bool) {
	Self.indexMappedLock.RLock()
	index, exist = Self.indexMapped[id]
	Self.indexMappedLock.RUnlock()
	return
}

// Store 直接将数据存储到存储中，返回对应的索引信息或者错误
func (Self *Store) Store(id string, fileType string, data []byte) (Index, error) {
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

	var index = NewIndex(
		id,
		filePath,
		WithFileInfo("", fileName, fileType, strconv.Itoa(len(data))),
	)
	if err = Self.appendIndex(index); err != nil {
		_ = os.Remove(filePath)
		return Index{}, err
	}
	return index, nil
}

// Fetch 根据索引信息获取对应的文件读取句柄
func (Self *Store) Fetch(idx Index) (io.ReadCloser, error) {
	return os.Open(idx.Path)
}

// Remove 根据索引信息删除对应的文件，成功删除返回 true，否则返回 false
func (Self *Store) Remove(idx Index) (bool, error) {
	var index, exits = Self.Check(idx.ID)
	if !exits {
		return true, nil
	}

	var err = os.Remove(index.Path)
	if err != nil {
		return false, err
	}

	Self.indexMappedLock.Lock()
	delete(Self.indexMapped, idx.ID)
	Self.indexMappedLock.Unlock()
	// todo 没有立即更新索引文件，等待下一次启动时更新?
	return true, nil
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
	Self.forceUpdateIndex()
	return count, nil
}

// Count 返回当前存储的文件数量
func (Self *Store) Count() int {
	Self.indexMappedLock.RLock()
	defer Self.indexMappedLock.RUnlock()
	return len(Self.indexMapped)
}

// Path 返回存储目录路径
func (Self *Store) Path() string {
	return Self.meta.storeDir
}

// Destroy 销毁文件句柄，保存索引到文件
func (Self *Store) Destroy() error {
	return Self.storeIndex()
}

// Size 计算存储目录下所有文件的总大小，排除索引文件
func (Self *Store) Size() int64 {
	var dirEntries, err = os.ReadDir(Self.meta.storeDir)
	if err != nil {
		return 0
	}

	var varSize int64 = 0
	for _, entry := range dirEntries {
		if !entry.IsDir() && entry.Name() != Self.meta.indexName {
			var fileInfo, err = entry.Info()
			if err == nil {
				varSize += fileInfo.Size()
			}
		}
	}
	return varSize
}

// SizeByCategory 计算不同类型文件的总大小，按照 MIME 类型的前缀进行分类，返回图片、音频、视频和其他类型的大小总和
func (Self *Store) SizeByCategory() (image int64, audio int64, video int64, other int64) {
	Self.indexMappedLock.RLock()
	defer Self.indexMappedLock.RUnlock()

	for _, index := range Self.indexMapped {
		size, err := strconv.ParseInt(index.Size, 10, 64)
		if err != nil {
			continue
		}
		if strings.HasPrefix(index.Type, "image/") {
			image += size
		} else if strings.HasPrefix(index.Type, "audio/") {
			audio += size
		} else if strings.HasPrefix(index.Type, "video/") {
			video += size
		} else {
			other += size
		}
	}

	return
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
	var notExist = make(map[string]struct{})
	// 收集所有临时文件、空文件、存储所有文件名到 notExist 初始化
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
			// 添加所有存在的文件初始化
			notExist[info.Name()] = struct{}{}
		}
	}
	// 对于临时文件，检查是否正在写入，否则删除，临时文件一定不会有索引管理，直接删除
	for _, temp := range temps {
		var fpath = filepath.Join(Self.meta.storeDir, temp)
		var getSize = func() (int64, error) {
			file, err := os.Open(fpath)
			if err != nil {
				return -1, err
			}
			info, err := file.Stat()
			if err != nil {
				_ = file.Close()
				return -1, err
			}
			var size = info.Size()
			_ = file.Close()
			return size, nil
		}

		// 如果文件大小在一定时间内没有变化，认为是无效文件，删除
		var size, err = getSize()
		if err != nil {
			continue
		}
		time.Sleep(time.Second)
		var newSize, err2 = getSize()
		if err2 != nil {
			continue
		}

		if size == newSize {
			_ = os.Remove(fpath)
		}
	}
	// 对于空文件，应该全部删除，删除前，查看是否有对应索引存在，有索引删除索引，同时检查notExist的文件是否被管理
	var shouldDeleteIndexes = make([]string, 0)
	Self.indexMappedLock.RLock()
	for _, index := range Self.indexMapped {
		var fileName = filepath.Base(index.Path)
		if _, exist := blanks[fileName]; exist {
			// 先删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.ID)
			// notExist > blanks ，满足blanks的文件一定在notExist中
			// 这条分支说明文件本地存在且有索引管理，但是由于是空文件，所以索引和文件都会被删除，移除notExist中的记录
			delete(notExist, fileName)
		} else if _, exist := notExist[fileName]; !exist {
			// 这条分支说明索引存在、本地文件不存在，删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.ID)
		} else {
			// 这条分支说明文件本地存在且有索引管理，正常文件，移除notExist中的记录
			delete(notExist, fileName)
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
	// 最后删除所有没有索引管理的文件
	for fileName := range notExist {
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
	Self.forceUpdateIndex()
	var duration = time.Since(start)
	fmt.Printf("Clearing invalid files completed in %s.\n", duration.String())
	return nil
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
	var tmpPath = filepath.Join(Self.meta.storeDir, tmpName)

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

// UpdateWriteSize 更新正在写入文件的预期大小信息，适用于预期大小不准确的情况，（Content-Length 不准确的情况（206））
func (Self *Store) UpdateWriteSize(url, size string) {
	Self.currentWriteMappedLock.Lock()
	defer Self.currentWriteMappedLock.Unlock()
	if wFile, ok := Self.currentWriteMapped[url]; ok {
		wFile.size = size
	}
}

// EndWrite 结束写入文件，如果成功则将临时文件重命名为最终文件并创建索引，返回索引信息，否则删除临时文件并返回空索引
func (Self *Store) EndWrite(id, url string, success bool) Index {
	Self.currentWriteMappedLock.Lock()
	var wFile, ok = Self.currentWriteMapped[url]
	if !ok {
		Self.currentWriteMappedLock.Unlock()
		return Index{}
	}
	delete(Self.currentWriteMapped, url)
	Self.currentWriteMappedLock.Unlock()

	var info, err = wFile.file.Stat()
	if err == nil {
		// [wFile.size] 为文件预期大小，不符时会删除缓存文件，为空时，会被赋值为实际大小
		var actualSize = strconv.FormatInt(info.Size(), 10)
		if wFile.size == "" {
			wFile.size = actualSize
		} else if actualSize != wFile.size {
			success = false
		}
	} else {
		log.Println("Failed stating written file:", err)
	}
	wFile.file.Close()

	if !success {
		_ = os.Remove(wFile.tmpPath)
		return Index{}
	}

	var finalName = utils.RandomFilename()
	var finalPath = filepath.Join(Self.meta.storeDir, finalName)

	if err := os.Rename(wFile.tmpPath, finalPath); err != nil {
		_ = os.Remove(wFile.tmpPath)
		return Index{}
	}
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
	_ = Self.appendIndex(index)
	return index
}

type MoveProgressChan struct {
	Total   int64 `json:"total"`
	Current int64 `json:"current"`
	Percent int64 `json:"percent"`
	Failed  int64 `json:"failed"`
}

// Move 将存储目录下的所有文件移动到新的目录中，并更新索引中的路径信息，过程中通过 progress 通道报告进度
func (Self *Store) Move(path string, progress chan<- MoveProgressChan) error {
	if path == "" {
		return fmt.Errorf("target path is empty")
	}
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
	Self.indexFileLock.Lock()

	dirEntries, err := os.ReadDir(Self.meta.storeDir)
	if err != nil {
		Self.indexMappedLock.Unlock()
		Self.currentWriteMappedLock.Unlock()
		Self.indexFileLock.Unlock()
		return err
	}

	var totalCount int64 = 0
	var errorCount int64 = 0
	var currentCount int64 = 0
	var percent int64 = 0
	for _, entry := range dirEntries {
		if entry.IsDir() {
			continue
		}
		totalCount += 1
	}
	Self.indexFile.Close()
	for _, entry := range dirEntries {
		if entry.IsDir() {
			continue
		}
		var srcPath = filepath.Join(Self.meta.storeDir, entry.Name())
		var destPath = filepath.Join(path, entry.Name())
		err = os.Rename(srcPath, destPath)
		currentCount += 1
		percent = (currentCount * 100) / totalCount
		if err != nil {
			errorCount += 1
		}
		if progress != nil {
			percent = (currentCount * 100) / totalCount
			progress <- MoveProgressChan{
				Total:   totalCount,
				Current: currentCount,
				Percent: percent,
				Failed:  errorCount,
			}
		}
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
	Self.indexFileLock.Unlock()

	_ = Self.storeIndex()
	Self.forceUpdateIndex()
	return nil
}

// 从索引文件加载索引到内存，这里使用index参数传入的是只读的 io.Reader 初始化之后 Self.indexFile 还未赋值，只读完毕，再重新追加读写打开赋值，所以本函数只能在初始化时调用
func (Self *Store) loadIndex(index io.Reader) {
	for _, idx := range readIndexFile(index) {
		Self.indexMapped[idx.ID] = idx
	}
}

// 以追加写入的方式写入单条 JSON（加换行），本函数在运行时执行
func (Self *Store) appendIndex(index Index) error {
	var indexData, err = json.Marshal(index)
	if err != nil {
		return err
	}

	Self.indexMappedLock.RLock()
	var oldIndex, exist = Self.indexMapped[index.ID]
	Self.indexMappedLock.RUnlock()
	if exist {
		_, _ = Self.Remove(oldIndex)
	}

	Self.indexMappedLock.Lock()
	Self.indexMapped[index.ID] = index
	Self.indexMappedLock.Unlock()

	Self.indexFileLock.Lock()
	defer Self.indexFileLock.Unlock()
	_, err = Self.indexFile.Write(append(indexData, '\n'))
	if err != nil {
		return err
	}

	return Self.indexFile.Sync()
}

// 将内存中的索引全部写入索引文件，覆盖写入，由于会销毁 os.File 本函数在销毁存储时执行
func (Self *Store) storeIndex() error {
	var indexData = make([]Index, 0)
	Self.indexMappedLock.RLock()
	for _, index := range Self.indexMapped {
		indexData = append(indexData, index)
	}
	Self.indexMappedLock.RUnlock()

	_ = Self.indexFile.Close()
	var path = filepath.Join(Self.meta.storeDir, Self.meta.indexName)
	var file, err = os.OpenFile(path, os.O_TRUNC|os.O_WRONLY, 0666)
	if err != nil {
		return err
	}
	defer file.Close()

	// 写入版本和创建时间
	err = writeIndexFileMeta(file, &Self.meta)
	if err != nil {
		return err
	}
	// 写入所有索引
	err = writeIndexFileData(file, indexData)
	if err != nil {
		return err
	}

	return nil
}

// 强制更新存储索引并重建索引文件句柄，如果失败，由于无法继续使用存储，直接 panic
func (Self *Store) forceUpdateIndex() {
	// Self.storeIndex() 内部不会lock
	Self.indexFileLock.Lock()
	defer Self.indexFileLock.Unlock()

	var err = Self.storeIndex()
	if err != nil {
		// todo 索引损坏
		panic(err)
	}

	// 重新以追加读写方式打开索引文件
	var indexPath = filepath.Join(Self.meta.storeDir, Self.meta.indexName)
	indexFile, err := os.OpenFile(indexPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		// 无法打开索引文件
		panic(err)
	}

	Self.indexFile = indexFile
}
