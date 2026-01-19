package env

import (
	"flag"
	"os"
	"path/filepath"
	"time"
)

var portFlag = flag.Int("port", 8824, "HTTP listen address")
var ttlFlag = flag.Duration("ttl", 7*24*time.Hour, "store TTL (e.g. 24h)")
var pathFlag = flag.String("path", filepath.Join(os.UserCacheDir(), "mahiru", "music"), "store path (if empty, use temp dir)")
var schemeFlag = flag.String("scheme", "file", "URL scheme to use for file paths")
var schemeHostnameFlag = flag.String("scheme-hostname", "local", "Hostname to use in the URL scheme")
var keyFlag = flag.String("key", "mahiru", "key for store access")

func init() {
	flag.Parse()
}

type Env struct {
	Port           int
	Ttl            time.Duration
	Path           string
	Scheme         string
	SchemeHostname string
	Key            string
}

func LoadFlags() Env {
	return Env{
		Port:           *portFlag,
		Ttl:            *ttlFlag,
		Path:           *pathFlag,
		Scheme:         *schemeFlag,
		SchemeHostname: *schemeHostnameFlag,
		Key:            *keyFlag,
	}
}
