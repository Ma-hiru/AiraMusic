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

	//cancelList map[string]bool
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
	ID           string `json:"id"`                     // 存储ID，具备唯一性
	Url          string `json:"url"`                    // 下载文件的URL
	Path         string `json:"path"`                   // 文件在本地存储的路径
	File         string `json:"file"`                   // 由文件路径转换成的自定义协议地址
	Name         string `json:"name"`                   // 原始（下载）文件名
	Type         string `json:"type"`                   // MIME类型
	Size         string `json:"size"`                   // 文件大小
	CreateTime   int64  `json:"createTime"`             // 创建时间
	ETag         string `json:"eTag"`                   // 下载时保存的ETag或计算得到的HASH
	LastModified string `json:"lastModified,omitempty"` // 下载时保存的修改时间
}

type WritingFile struct {
	tmpPath      string // 临时文件地址
	name         string
	fileType     string
	size         string // size 为文件预期大小，不符时会删除缓存文件，为空时，会被赋值为实际大小
	etag         string
	lastModified string
	file         *os.File
}
