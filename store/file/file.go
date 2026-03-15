package file

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"store/utils"
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

func LoadLocalStore(meta *StoreMeta) error {
	var err = checkIndexFile(meta)
	if err != nil {
		return fmt.Errorf("failed to check index file: %v", err)
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
