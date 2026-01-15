package file

import (
	"os"
	"sync"
	"time"
)

type Store struct {
	meta   StoreMeta
	option StoreOption

	indexFile       *os.File
	indexFileLock   sync.Mutex
	indexMapped     map[string]Index // ID <-> Index
	indexMappedLock sync.RWMutex

	currentWriteMapped     map[string]*WritingFile // URL <-> WritingFile
	currentWriteMappedLock sync.RWMutex

	cancelList map[string]bool
}

type StoreMeta struct {
	storeDir   string
	indexName  string
	version    int
	createTime int64
}

type StoreOption struct {
	FileScheme     string
	FileSchemeHost string
	TimeLimit      time.Duration
}

type Index struct {
	ID           string `json:"id"`
	Url          string `json:"url"`
	Path         string `json:"path"`
	File         string `json:"file"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Size         string `json:"size"`
	CreateTime   int64  `json:"createTime"`
	ETag         string `json:"eTag"`
	LastModified string `json:"lastModified,omitempty"`
}

type WritingFile struct {
	tmpPath      string
	finalName    string
	fileType     string
	size         string
	etag         string
	lastModified string
	file         *os.File
}
