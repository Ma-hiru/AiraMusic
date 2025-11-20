package file

import (
	"context"
	"crypto/sha1"
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
	timeLimit   time.Duration
}

type Index struct {
	Url        string `json:"url"`
	Path       string `json:"path"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Size       string `json:"size"`
	CreateTime int64  `json:"createTime"`
	ETag       string `json:"eTag"`
}

var store *Store

func GetStore() *Store {
	return store
}

func InitStore(dir string, timeLimit time.Duration) error {
	dir = filepath.Join(dir, "mahiru")
	fmt.Printf("Store directory: %s\n", dir)
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
		timeLimit:   timeLimit,
	}

	var err = file.loadIndex()
	if err != nil {
		return err
	}

	store = &file
	return nil
}

func createIndex(path string, url string, size string, name string, fileType string, etag string) Index {
	var index = Index{
		Url:        url,
		Name:       name,
		Size:       size,
		Path:       path,
		Type:       fileType,
		CreateTime: getTime(),
		ETag:       etag,
	}

	return index
}

func randomFilename() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

func getTime() int64 {
	return time.Now().UnixNano()
}

func (Self *Store) Check(url string) (Index, bool) {
	var index, exist = Self.mappedIndex[url]
	return index, exist
}

func (Self *Store) Store(ctx context.Context, reader io.Reader, url string, name string, fileType string, size string) (Index, error) {
	if index, exist := Self.Check(url); exist {
		return index, nil
	}

	var filename = randomFilename()
	var path = filepath.Join(Self.storeDir, filename)
	var writtenSize, etag, err = write(ctx, path, reader)
	if err != nil {
		return Index{}, err
	}
	if strconv.FormatInt(writtenSize, 10) != size {
		fmt.Println("written size does not match expected size, removing file:", url)
		_ = os.Remove(path)
		return Index{}, fmt.Errorf("written size %d does not match expected size %s", writtenSize, size)
	}

	var index = createIndex(path, url, size, name, fileType, etag)
	Self.mappedIndex[url] = index
	_ = Self.appendIndex(index)
	return index, nil
}

func (Self *Store) Fetch(idx Index) io.Reader {
	var reader, err = read(idx.Path)
	if err != nil {
		return nil
	}
	return reader
}

func (Self *Store) Remove(idx Index) (bool, error) {
	var index, exits = Self.Check(idx.Url)
	if !exits {
		return false, nil
	}

	err := os.Remove(index.Path)
	if err != nil {
		return false, err
	}

	Self.indexMutex.Lock()
	defer Self.indexMutex.Unlock()
	delete(Self.mappedIndex, idx.Url)
	return true, nil
}

func (Self *Store) Clear() (int, error) {
	Self.indexMutex.Lock()
	defer Self.indexMutex.Unlock()

	for _, index := range Self.mappedIndex {
		_ = os.Remove(index.Path)
	}
	var count = len(Self.mappedIndex)
	Self.mappedIndex = make(map[string]Index)
	var path = filepath.Join(Self.storeDir, Self.indexName)
	return count, os.WriteFile(path, []byte("[]"), 0666)
}

func (Self *Store) Count() int {
	Self.indexMutex.RLock()
	defer Self.indexMutex.RUnlock()
	return len(Self.mappedIndex)
}

func (Self *Store) loadIndex() error {
	Self.indexMutex.RLock()
	defer Self.indexMutex.RUnlock()

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
	Self.indexMutex.Lock()
	defer Self.indexMutex.Unlock()

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

func (Self *Store) appendIndex(index Index) error {
	Self.indexMutex.Lock()
	defer Self.indexMutex.Unlock()
	var path = filepath.Join(Self.storeDir, Self.indexName)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.WriteFile(path, []byte("[]"), 0666); err != nil {
			return err
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var indexData = make([]Index, 0)
	if len(data) != 0 {
		if err := json.Unmarshal(data, &indexData); err != nil {
			return err
		}
	}

	indexData = append(indexData, index)

	storeData, err := json.Marshal(indexData)
	if err != nil {
		return err
	}

	return os.WriteFile(path, storeData, 0666)
}

func (Self *Store) Destroy() error {
	return Self.storeIndex()
}

func (Self *Store) ClearOutdate() error {
	Self.indexMutex.Lock()
	defer Self.indexMutex.Unlock()

	var now = getTime()
	for url, index := range Self.mappedIndex {
		if now-index.CreateTime > Self.timeLimit.Nanoseconds() {
			_ = os.Remove(index.Path)
			delete(Self.mappedIndex, url)
		}
	}
	return nil
}

const bufferSize = 1024 * 100

func write(ctx context.Context, path string, reader io.Reader) (int64, string, error) {
	var file, err = os.Create(path)
	if err != nil {
		return -1, "", err
	}
	defer file.Close()

	var buffer = make([]byte, bufferSize) // 100KB buffer
	var count int64 = 0
	var etag string
	for {
		if err := ctx.Err(); err != nil {
			file.Close()
			// 后面会根据错误和索引判断是否删除文件，如果源头已经删除，这里就不需要再删除一次，所以返回这里的err
			return count, etag, os.Remove(path)
		}

		var n, err = reader.Read(buffer)
		if err == io.EOF {
			break
		}
		if err != nil {
			_ = os.Remove(path)
			return count, etag, err
		}
		if n > 0 {
			var written, writeErr = file.Write(buffer[:n])
			count += int64(written)
			if writeErr != nil {
				_ = os.Remove(path)
				return count, etag, writeErr
			}
			if written != n {
				_ = os.Remove(path)
				return count, etag, io.ErrShortWrite
			}
			if count == int64(written) {
				var h = sha1.Sum(buffer[:n])
				etag = fmt.Sprintf("%x", h)
			}
		}
	}
	return count, etag, nil
}

func hash(path string) (string, error) {
	var buffer = make([]byte, bufferSize)
	var file, err = os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	n, err := file.Read(buffer)
	var h = sha1.Sum(buffer[:n])
	return fmt.Sprintf("%x", h), nil
}

func read(path string) (io.Reader, error) {
	var file, err = os.Open(path)
	if err != nil {
		return nil, err
	}
	return file, nil
}
