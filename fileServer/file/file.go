package file

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

type Store struct {
	storeDir    string
	indexName   string
	mappedIndex map[string]Index
	indexMutex  sync.RWMutex
}

type Index struct {
	Url        string `json:"url"`
	Path       string `json:"path"`
	Name       string
	CreateTime int64 `json:"createTime"`
	Size       int64 `json:"size"`
}

var store *Store

func GetStore() *Store {
	return store
}

func InitStore(dir string) error {
	if fileInfo, err := os.Stat(dir); os.IsNotExist(err) {
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			return err
		}
	} else if !fileInfo.IsDir() {
		return fmt.Errorf("path %s is not a directory", dir)
	}

	var file = Store{
		storeDir:    filepath.Clean(dir),
		indexName:   "index",
		mappedIndex: make(map[string]Index),
		indexMutex:  sync.RWMutex{},
	}

	var err = file.loadIndex()
	if err != nil {
		return err
	}

	store = &file
	return nil
}

func createIndex(path string, url string, size int64, name string) Index {
	var createTime = time.Now().Unix()
	var index = Index{
		url,
		path,
		name,
		createTime,
		size,
	}

	return index
}

func (Self *Store) randomFilename() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

func (Self *Store) Check(url string) (Index, bool) {
	var index, exist = Self.mappedIndex[url]
	return index, exist
}

func (Self *Store) Store(reader io.Reader, url string, name string) (Index, error) {
	var filename = Self.randomFilename()
	var path = filepath.Join(Self.storeDir, filename)
	var lens, err = write(path, reader)
	if err != nil {
		return Index{}, err
	}
	return createIndex(path, url, lens, name), nil
}

func (Self *Store) Fetch(idx Index) io.Reader {
	var reader, err = read(idx.Path)
	if err != nil {
		return nil
	}
	return reader
}

func (Self *Store) loadIndex() error {
	var path = filepath.Join(Self.storeDir, Self.indexName)
	var idxFile, err = os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0666)
	defer idxFile.Close()
	if err != nil {
		return err
	}

	idx, err := io.ReadAll(idxFile)
	if err != nil {
		return err
	}
	if len(idx) == 0 {
		_, err := idxFile.WriteString("[]")
		if err != nil {
			return err
		}
		idx = []byte("[]")
	}

	var indexData = make([]Index, 0)
	err = json.Unmarshal(idx, &indexData)
	if err != nil {
		return err
	}

	for _, index := range indexData {
		Self.mappedIndex[index.Url] = index
	}

	return err
}

func (Self *Store) storeIndex() error {
	var indexData = make([]Index, 0)
	for _, index := range Self.mappedIndex {
		indexData = append(indexData, index)
	}

	var storeData, err = json.Marshal(indexData)
	if err != nil {
		return err
	}

	var path = filepath.Join(Self.storeDir, Self.indexName)
	return os.WriteFile(path, storeData, 0666)
}

func (Self *Store) Destroy() error {
	return Self.storeIndex()
}

func write(path string, data io.Reader) (int64, error) {
	var file, err = os.Create(path)
	if err != nil {
		return -1, err
	}
	defer file.Close()

	n, err := io.Copy(file, data)
	if err != nil {
		return -1, err
	}
	return n, nil
}

func read(path string) (io.Reader, error) {
	var file, err = os.Open(path)
	if err != nil {
		return nil, err
	}
	return file, nil
}
