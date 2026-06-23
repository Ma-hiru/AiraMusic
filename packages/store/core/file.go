package core

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"store/utils"
)

var (
	store               *Store
	ErrStoreExist       = errors.New("store exist")
	CurrentStoreVersion = 1
	StoreIndexName      = "index"
)

func GetStore() *Store {
	return store
}

func CreateLocalStore(dir string) (*StoreMeta, error) {
	dir = filepath.Clean(dir)
	if err := utils.EnsureDir(dir, 0775); err != nil {
		return nil, err
	}

	var indexPath = filepath.Join(dir, StoreIndexName)
	var fileInfo, err = os.Stat(indexPath)
	var meta = StoreMeta{
		storeDir:   dir,
		indexName:  StoreIndexName,
		version:    CurrentStoreVersion,
		createTime: utils.GetTime(),
	}

	// 发生错误
	if err != nil {
		if os.IsNotExist(err) {
			// 创建索引文件
			if err = createIndexFile(&meta); err != nil {
				return nil, fmt.Errorf("failed to initialize index file: %v", err)
			}
			return &meta, nil
		}
		return nil, fmt.Errorf("failed to stat index file: %v", err)
	}

	if fileInfo.IsDir() {
		StoreIndexName = StoreIndexName + "_" + utils.RandString(8)
	}
	return &meta, ErrStoreExist
}

func LoadLocalStore(meta *StoreMeta, opt StoreOption) (*Store, error) {
	// 检查索引文件
	var err = checkIndexFile(meta)
	if err != nil {
		return nil, fmt.Errorf("failed to check index file: %v", err)
	}
	// 打开索引文件
	var indexPath = filepath.Join(meta.storeDir, meta.indexName)
	indexFile, err := os.Open(indexPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open index file: %v", err)
	}
	// 创建store实例
	store = &Store{
		meta:   *meta,
		option: opt,

		indexHandle:     &IndexHandle{file: indexFile, mutex: sync.Mutex{}},
		indexMapped:     make(map[string]Index),
		indexMappedLock: sync.RWMutex{},

		currentWriteMapped:     make(map[string]*WritingFile),
		currentWriteMappedLock: sync.RWMutex{},
	}
	// 加载索引数据
	store.loadIndex()
	// 以追加模式重新打开索引文件
	_ = store.indexHandle.file.Close() //nolint:errcheck
	indexFile, err = os.OpenFile(indexPath, os.O_APPEND|os.O_RDWR, 0666)
	if err != nil {
		return nil, fmt.Errorf("failed to open index file for appending: %v", err)
	}
	store.indexHandle.file = indexFile
	return store, nil
}
