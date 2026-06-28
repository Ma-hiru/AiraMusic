package core

import (
	"mime"
	"os"
	"strings"
	"sync"
	"time"
)

type Store struct {
	meta   StoreMeta
	option StoreOption

	indexHandle     *IndexHandle
	indexMapped     map[string]Index // ID <-> Index
	indexMappedLock sync.RWMutex
	indexDirty      bool
	indexDirtyLock  sync.Mutex
	indexFlushLock  sync.Mutex
	indexFlushTimer *time.Timer

	currentWriteMapped     map[string]*WritingFile // URL <-> WritingFile
	currentWriteMappedLock sync.RWMutex

	// cancelList map[string]bool
}

type StoreMeta struct {
	storeDir   string
	indexName  string
	version    int
	createTime int64
	indexKey   string
}

type StoreOption struct {
	FileScheme     string
	FileSchemeHost string
	TimeLimit      time.Duration
	Capacity       uint64
	IndexKey       string
}

type StoreCategory = uint8

const (
	StoreCategoryImage StoreCategory = iota + 1
	StoreCategoryVideo
	StoreCategoryAudio
	StoreCategoryJSON
	StoreCategoryOther
)

type Index struct {
	ID           string        `json:"id"`                     // 存储ID，具备唯一性
	Url          string        `json:"url,omitempty"`          // 下载文件的URL
	Name         string        `json:"name,omitempty"`         // 原始（下载）文件名
	Mime         string        `json:"mime"`                   // MIME类型
	Size         int64         `json:"size"`                   // 文件大小
	CreateTime   int64         `json:"createTime"`             // 创建时间
	ETag         string        `json:"eTag,omitempty"`         // 下载时保存的ETag或计算得到的HASH
	LastModified string        `json:"lastModified,omitempty"` // 下载时保存的修改时间
	Category     StoreCategory `json:"category"`               // 分类
	Key          string        `json:"key"`                    // chunk的加密key
	Chunks       []string      `json:"chunks"`                 // 存储的chunk名
}

type WritingFile struct {
	tmpPath      string // 临时文件地址
	name         string
	mime         string
	size         string // size 为文件预期大小，不符时会删除缓存文件，为空时，会被赋值为实际大小
	etag         string
	lastModified string
	file         *os.File
	url          string
}

type MoveProgressChan struct {
	Total   int64 `json:"total"`
	Current int64 `json:"current"`
	Percent int64 `json:"percent"`
	Failed  int64 `json:"failed"`
}

type IndexHandle struct {
	file     *os.File
	indexKey string
	mutex    sync.Mutex
}

func MimeMatchCategory(contentType string) StoreCategory {
	mt, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		mt = contentType
	}

	mt = strings.ToLower(strings.TrimSpace(mt))

	switch {
	case strings.HasPrefix(mt, "image/"):
		return StoreCategoryImage
	case strings.HasPrefix(mt, "video/"):
		return StoreCategoryVideo
	case strings.HasPrefix(mt, "audio/"):
		return StoreCategoryAudio
	case mt == "application/json" || strings.HasSuffix(mt, "+json"):
		return StoreCategoryJSON
	default:
		return StoreCategoryOther
	}
}
