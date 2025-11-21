package file

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"time"
)

// Check 检查指定 URL 的文件是否已存在于存储中，存在则返回对应的索引和 true，否则返回 false
func (Self *Store) Check(url string) (Index, bool) {
	var index, exist = Self.indexMapped[url]
	return index, exist
}

// Store 存储文件到本地存储中，若文件已存在则直接返回对应索引
func (Self *Store) Store(ctx context.Context, reader io.Reader, url string, name string, fileType string, size string, hash string, lastModified string) (Index, error) {
	if index, exist := Self.Check(url); exist {
		return index, nil
	}

	var filename = randomFilename()
	var path = filepath.Join(Self.storeDir, filename)
	var writtenSize, etag, err = write(ctx, path, reader)
	if err != nil {
		return Index{}, err
	}

	// 检查写入的文件大小是否与预期大小匹配，write 函数不知道预期大小，在这里进行检查
	if strconv.FormatInt(writtenSize, 10) != size {
		fmt.Println("written size does not match expected size, removing file:", url)
		_ = os.Remove(path)
		return Index{}, fmt.Errorf("written size %d does not match expected size %s", writtenSize, size)
	}
	// 如果提供了 hash(md5)，则使用 hash 作为 etag
	if hash != "" && etag != hash {
		etag = hash
	}
	var index = createIndex(path, url, size, name, fileType, etag, lastModified)
	err = Self.appendIndex(index)
	if err != nil {
		// 写入索引失败，删除已写入的文件
		_ = os.Remove(path)
		Self.indexMappedMutex.Lock()
		delete(Self.indexMapped, url)
		Self.indexMappedMutex.Unlock()
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
	var index, exits = Self.Check(idx.Url)
	if !exits {
		return false, nil
	}
	err := os.Remove(index.Path)
	if err != nil {
		return false, err
	}
	Self.indexMappedMutex.Lock()
	delete(Self.indexMapped, idx.Url)
	Self.indexMappedMutex.Unlock()
	// 没有立即更新索引文件，等待下一次 启动时 时更新
	return true, nil
}

// Clear 清空存储中的所有文件，返回被删除的文件数量
func (Self *Store) Clear() (int, error) {
	Self.indexMappedMutex.Lock()
	var count = len(Self.indexMapped)
	for _, index := range Self.indexMapped {
		_ = os.Remove(index.Path)
	}
	Self.indexMapped = make(map[string]Index)
	Self.indexMappedMutex.Unlock()
	Self.forceUpdateIndex()
	return count, nil
}

// Count 返回当前存储的文件数量
func (Self *Store) Count() int {
	Self.indexMappedMutex.RLock()
	defer Self.indexMappedMutex.RUnlock()
	return len(Self.indexMapped)
}

// Destroy 销毁文件句柄，保存索引到文件
func (Self *Store) Destroy() error {
	return Self.storeIndex()
}

// ClearInvalidFile 清理无效文件：包括空文件、未被使用的临时文件、没有索引的文件、过期文件
func (Self *Store) ClearInvalidFile() error {
	var entries, err = os.ReadDir(Self.storeDir)
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
		if entry.IsDir() || entry.Name() == Self.indexName {
			continue
		}
		// 获取文件信息
		var info, err = entry.Info()
		if err != nil || info.IsDir() {
			continue
		}
		if info.Name() != Self.indexName {
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
		var fpath = filepath.Join(Self.storeDir, temp)
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
	Self.indexMappedMutex.RUnlock()
	for _, index := range Self.indexMapped {
		var fileName = filepath.Base(index.Path)
		if _, exist := blanks[fileName]; exist {
			// 先删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.Url)
			// notExist > blanks ，满足blanks的文件一定在notExist中
			// 这条分支说明文件本地存在且有索引管理，但是由于是空文件，所以索引和文件都会被删除，移除notExist中的记录
			delete(notExist, fileName)
		} else if _, exist := notExist[fileName]; !exist {
			// 这条分支说明索引存在、本地文件不存在，删除索引
			shouldDeleteIndexes = append(shouldDeleteIndexes, index.Url)
		} else {
			// 这条分支说明文件本地存在且有索引管理，正常文件，移除notExist中的记录
			delete(notExist, fileName)
		}
	}
	Self.indexMappedMutex.RUnlock()
	// 先删除所有需要删除的索引
	Self.indexMappedMutex.Lock()
	for _, url := range shouldDeleteIndexes {
		delete(Self.indexMapped, url)
	}
	Self.indexMappedMutex.Unlock()
	// 后删除所有的空文件
	for blank := range blanks {
		var fpath = filepath.Join(Self.storeDir, blank)
		_ = os.Remove(fpath)
	}
	// 最后删除所有没有索引管理的文件
	for fileName := range notExist {
		var fpath = filepath.Join(Self.storeDir, fileName)
		_ = os.Remove(fpath)
	}
	// 清理过期文件
	var now = getTime()
	Self.indexMappedMutex.Lock()
	for url, index := range Self.indexMapped {
		if now-index.CreateTime > Self.timeLimit.Nanoseconds() {
			_ = os.Remove(index.Path)
			delete(Self.indexMapped, url)
		}
	}
	Self.indexMappedMutex.Unlock()
	// 最后更新存储索引，然后重建索引文件句柄
	Self.forceUpdateIndex()
	return nil
}

// Size 计算存储目录下所有文件的总大小，排除索引文件
func (Self *Store) Size() int64 {
	var dirEntries, err = os.ReadDir(Self.storeDir)
	if err != nil {
		return 0
	}

	var varSize int64 = 0
	for _, entry := range dirEntries {
		if !entry.IsDir() && entry.Name() != Self.indexName {
			var fileInfo, err = entry.Info()
			if err == nil {
				varSize += fileInfo.Size()
			}
		}
	}
	return varSize
}

// Path 返回存储目录路径
func (Self *Store) Path() string {
	return Self.storeDir
}

// 从索引文件加载索引到内存，这里使用index参数传入的是只读的 io.Reader 初始化之后 Self.indexFile 还未赋值，只读完毕，再重新追加读写打开赋值，所以本函数只能在初始化时调用
func (Self *Store) loadIndex(index io.Reader) error {
	var scanner = bufio.NewScanner(index)
	for scanner.Scan() {
		var line = scanner.Text()
		// 跳过版本和创建时间行
		if strings.HasPrefix(line, "version: ") || strings.HasPrefix(line, "createTime: ") {
			continue
		}
		var index Index
		var err = json.Unmarshal([]byte(line), &index)
		if err != nil {
			return err
		}
		Self.indexMapped[index.Url] = index
	}
	return nil
}

// 以追加写入的方式写入单条 JSON（加换行），本函数在运行时执行
func (Self *Store) appendIndex(index Index) error {
	b, err := json.Marshal(index)
	if err != nil {
		return err
	}
	Self.indexFileMutex.Lock()
	defer Self.indexFileMutex.Unlock()
	_, err = Self.indexFile.Write(append(b, '\n'))
	if err != nil {
		return err
	}

	Self.indexMappedMutex.Lock()
	Self.indexMapped[index.Url] = index
	Self.indexMappedMutex.Unlock()

	return Self.indexFile.Sync()
}

// 将内存中的索引全部写入索引文件，覆盖写入，由于会销毁 os.File 本函数在销毁存储时执行
func (Self *Store) storeIndex() error {
	var indexData = make([]Index, 0)
	Self.indexMappedMutex.RLock()
	for _, index := range Self.indexMapped {
		indexData = append(indexData, index)
	}
	Self.indexMappedMutex.RUnlock()

	_ = Self.indexFile.Close()
	var path = filepath.Join(Self.storeDir, Self.indexName)
	var file, err = os.OpenFile(path, os.O_TRUNC|os.O_WRONLY, 0666)
	if err != nil {
		return err
	}
	// 写入版本和创建时间
	_, err = file.Write([]byte("version: " + strconv.Itoa(Self.version) + "\n"))
	if err != nil {
		_ = file.Close()
		return err
	}
	_, err = file.Write([]byte("createTime: " + strconv.FormatInt(Self.crateTime, 10) + "\n"))
	if err != nil {
		_ = file.Close()
		return err
	}
	// 写入所有索引
	for _, index := range indexData {
		var line, err = json.Marshal(index)
		if err != nil {
			_ = file.Close()
			return err
		}
		_, err = file.Write(append(line, '\n'))
		if err != nil {
			_ = file.Close()
			return err
		}
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return err
	}

	return file.Close()
}

// 强制更新存储索引并重建索引文件句柄，如果失败，由于无法继续使用存储，直接 panic
func (Self *Store) forceUpdateIndex() {
	Self.indexFileMutex.Lock()
	var err = Self.storeIndex()
	if err != nil {
		// 索引损坏
		panic(err)
	}
	// 重新以追加读写方式打开索引文件
	var iPath = filepath.Join(Self.storeDir, Self.indexName)
	iFile, err := os.OpenFile(iPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		// 无法打开索引文件
		panic(err)
	}
	Self.indexFile = iFile
	Self.indexFileMutex.Unlock()
}
