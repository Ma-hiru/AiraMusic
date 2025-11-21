package file

import (
	"os"
	"sync"
	"time"
)

type Store struct {
	storeDir         string
	indexName        string
	indexFile        *os.File
	indexMapped      map[string]Index
	indexMappedMutex sync.RWMutex
	indexFileMutex   sync.Mutex
	timeLimit        time.Duration
	version          int
	crateTime        int64
}

type Index struct {
	Url          string `json:"url"`  // 真实存储路径
	Path         string `json:"path"` // 原始文件名
	Name         string `json:"name"`
	Type         string `json:"type"`
	Size         string `json:"size"`
	CreateTime   int64  `json:"createTime"`
	ETag         string `json:"eTag"`
	LastModified string `json:"lastModified,omitempty"`
}

func createIndex(path string, url string, size string, name string, fileType string, etag string, lastModified string) Index {
	return Index{
		Url:          url,
		Name:         name,
		Size:         size,
		Path:         path,
		Type:         fileType,
		CreateTime:   getTime(),
		ETag:         etag,
		LastModified: lastModified,
	}
}
