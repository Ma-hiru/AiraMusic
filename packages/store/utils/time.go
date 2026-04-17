package utils

import "time"

// GetTimeNano 获取当前时间的纳秒级时间戳。
func GetTimeNano() int64 {
	return time.Now().UnixNano()
}

// GetTimeMilli 获取当前时间的毫秒级时间戳。
func GetTimeMilli() int64 {
	return time.Now().UnixMilli()
}

// GetTime 默认获取时间戳方式
func GetTime() int64 {
	return GetTimeNano()
}
