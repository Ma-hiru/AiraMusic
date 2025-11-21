package file

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var store *Store

var ErrStoreExist = errors.New("store exist")

func GetStore() *Store {
	return store
}

func CreateLocalStore(dir string, version int) error {
	dir = filepath.Clean(dir)
	iPath := filepath.Join(dir, "index")
	if err := os.MkdirAll(dir, 0666); err != nil {
		return fmt.Errorf("failed to create directory: %v", err)
	}
	var fileInfo, err = os.Stat(iPath)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to stat index file: %v", err)
	}
	if err == nil {
		if fileInfo.IsDir() {
			return fmt.Errorf("index path is a directory")
		}
		return ErrStoreExist
	}
	if err != nil && os.IsNotExist(err) {
		var iFile, err = os.Create(iPath)
		if err != nil {
			return fmt.Errorf("failed to create index file: %v", err)
		}
		_, err = iFile.Write([]byte("version: " + strconv.Itoa(version) + "\n"))
		if err != nil {
			return fmt.Errorf("failed to write version to index file: %v", err)
		}
		_, err = iFile.Write([]byte("createTime: " + strconv.FormatInt(getTime(), 10) + "\n"))
		if err != nil {
			return fmt.Errorf("failed to write create time to index file: %v", err)
		}
		err = iFile.Sync()
		if err != nil {
			return fmt.Errorf("failed to sync index file: %v", err)
		}
		return iFile.Close()
	}

	return ErrStoreExist
}

func LoadLocalStore(dir string, timeLimit time.Duration) error {
	// 处理路径
	dir = filepath.Clean(dir)
	var dirInfo, err = os.Stat(dir)
	var iPath = filepath.Join(dir, "index")
	// 检查目录是否存在
	if err != nil || !dirInfo.IsDir() {
		return fmt.Errorf("directory does not exist or is not a directory")
	}
	// 打开索引文件
	iFile, err := os.Open(iPath)
	if err != nil {
		return fmt.Errorf("failed to open index file: %v", err)
	}
	// 读取版本和创建时间
	var scanner = bufio.NewScanner(iFile)
	var version int
	var createTime int64
	for scanner.Scan() {
		var line = scanner.Text()
		if strings.HasPrefix(line, "version: ") {
			version, err = strconv.Atoi(strings.TrimPrefix(line, "version: "))
			if err != nil {
				_ = iFile.Close()
				return fmt.Errorf("failed to parse version from index file: %v", err)
			}
		} else if strings.HasPrefix(line, "createTime: ") {
			createTime, err = strconv.ParseInt(strings.TrimPrefix(line, "createTime: "), 10, 64)
			if err != nil {
				_ = iFile.Close()
				return fmt.Errorf("failed to parse create time from index file: %v", err)
			}
		} else {
			break
		}
	}
	if version == 0 || createTime == 0 {
		_ = iFile.Close()
		return fmt.Errorf("invalid index file format")
	}
	// 初始化存储结构
	store = &Store{
		storeDir:         dir,
		indexName:        "index",
		indexMapped:      make(map[string]Index),
		indexMappedMutex: sync.RWMutex{},
		indexFileMutex:   sync.Mutex{},
		timeLimit:        timeLimit,
		version:          version,
		crateTime:        createTime,
	}
	// 重置文件指针到开头，准备加载索引
	if _, err := iFile.Seek(0, io.SeekStart); err != nil {
		_ = iFile.Close()
		return fmt.Errorf("failed to seek index file: %v", err)
	}

	store.loadIndex(iFile)
	// 以追加模式重新打开索引文件
	iFile, err = os.OpenFile(iPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		return fmt.Errorf("failed to open index file for appending: %v", err)
	}
	store.indexFile = iFile
	return nil
}
