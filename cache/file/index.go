package file

func createIndex(id, path, url, size, name, fileType, etag, lastModified string) Index {
	return Index{
		ID:           id,
		Url:          url,
		Name:         name,
		Size:         size,
		Path:         path,
		Type:         fileType,
		CreateTime:   getTime(),
		ETag:         etag,
		LastModified: lastModified,
		File:         pathToFileURL(path),
	}
}

func (Self Index) IsExpiredMill(timeLimitMill int64) bool {
	var nowNano = getTime()
	var createNano = Self.CreateTime
	return nowNano-createNano > timeLimitMill*1e6
}

func (Self Index) IsExpiredNano(timeLimitNano int64) bool {
	var nowNano = getTime()
	var createNano = Self.CreateTime
	return nowNano-createNano > timeLimitNano
}
