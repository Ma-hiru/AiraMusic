package file

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

var store *Store
var ErrStoreExist = errors.New("store exist")
var CurrentStoreVersion = 1
var StoreIndexName = "index"

func GetStore() *Store {
	return store
}

func CreateLocalStore(dir string) (*StoreMeta, error) {
	dir = filepath.Clean(dir)
	var indexPath = filepath.Join(dir, StoreIndexName)
	// 创建目录
	if err := os.MkdirAll(dir, 0777); err != nil {
		return nil, fmt.Errorf("failed to create directory: %v", err)
	}
	if err := os.Chmod(dir, 0775); err != nil {
		return nil, fmt.Errorf("failed to set directory permissions: %v", err)
	}
	var meta = StoreMeta{
		storeDir:   dir,
		indexName:  StoreIndexName,
		version:    CurrentStoreVersion,
		createTime: getTimeNano(),
	}

	// 检查索引文件是否存在
	var fileInfo, err = os.Stat(indexPath)
	// 文件存在
	if err == nil {
		if fileInfo.IsDir() {
			return nil, fmt.Errorf("index path is a directory")
		}
		return &meta, ErrStoreExist
	}
	// 发生错误
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("failed to stat index file: %v", err)
	}
	// 创建索引文件
	if err != nil && os.IsNotExist(err) {
		if err = initIndexFile(&meta); err != nil {
			return nil, fmt.Errorf("failed to initialize index file: %v", err)
		}
		return &meta, nil
	}

	return &meta, ErrStoreExist
}

func LoadLocalStore(meta *StoreMeta) error {
	var err = checkIndexFileMeta(meta)
	if err != nil {
		return fmt.Errorf("failed to read index file: %v", err)
	}

	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	indexFile, err := os.Open(indexPath)
	if err != nil {
		return fmt.Errorf("failed to open index file: %v", err)
	}
	defer indexFile.Close()

	// 初始化存储结构
	store = &Store{
		meta: *meta,

		indexFile:       indexFile,
		indexFileLock:   sync.Mutex{},
		indexMapped:     make(map[string]Index),
		indexMappedLock: sync.RWMutex{},

		currentWriteMapped:     make(map[string]*WritingFile),
		currentWriteMappedLock: sync.RWMutex{},
	}

	store.loadIndex(indexFile)
	// 以追加模式重新打开索引文件
	indexFile, err = os.OpenFile(indexPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		return fmt.Errorf("failed to open index file for appending: %v", err)
	}
	store.indexFile = indexFile
	return nil
}

func SetStoreOption(opt StoreOption) {
	if store != nil {
		store.option = opt
	}
}
