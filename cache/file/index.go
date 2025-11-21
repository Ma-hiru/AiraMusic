package file

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
