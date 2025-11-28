package env

import (
	"flag"
	"fmt"
	"time"
)

var Port int
var Ttl time.Duration
var Path string
var Scheme string

func init() {
	var portFlag = flag.Int("port", 8824, "HTTP listen address")
	var ttlFlag = flag.Duration("ttl", 7*24*time.Hour, "store TTL (e.g. 24h)")
	var pathFlag = flag.String("path", "", "store path (if empty, use temp dir)")
	var schemeFlag = flag.String("scheme", "file", "URL scheme to use for file paths")
	flag.Parse()
	Port = *portFlag
	Ttl = *ttlFlag
	Path = *pathFlag
	Scheme = *schemeFlag
	fmt.Println("received config - port:", Port, "ttl:", Ttl, "path:", Path, "scheme:", Scheme)
}
