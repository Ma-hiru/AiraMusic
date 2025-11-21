package file

import (
	"os"
	"sync"
	"time"
)

type Store struct {
	storeDir  string
	indexName string
	version   int
	crateTime int64
	timeLimit time.Duration

	indexFile        *os.File
	indexMapped      map[string]Index
	indexMappedMutex sync.RWMutex
	indexFileMutex   sync.Mutex

	muWrite      sync.Mutex
	currentWrite map[string]*writingFile
}

type Index struct {
	Url          string `json:"url"`
	Path         string `json:"path"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Size         string `json:"size"`
	CreateTime   int64  `json:"createTime"`
	ETag         string `json:"eTag"`
	LastModified string `json:"lastModified,omitempty"`
}

type writingFile struct {
	tmpPath      string
	finalName    string
	fileType     string
	size         string
	etag         string
	lastModified string
	file         *os.File
}
