package file

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
