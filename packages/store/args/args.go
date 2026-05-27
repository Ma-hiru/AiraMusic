package args

import (
	"flag"
	"store/utils"
	"time"
)

var (
	portFlag           = flag.Int("port", 8824, "HTTP listen address")
	capacityFlag       = flag.Uint64("capacity", 0, "store capacity (0 for unlimited)")
	pathFlag           = flag.String("path", utils.GetDefaultStorePath(), "store path (if empty, use temp dir)")
	schemeFlag         = flag.String("scheme", "file", "URL scheme to use for file paths")
	keyFlag            = flag.String("key", "mahiru", "key for store access")
	assetsHostnameFlag = flag.String("assets-hostname", "local", "Hostname to use in the URL scheme")
	ttlFlag            = flag.Duration("ttl", 7*24*time.Hour, "store TTL (e.g. 24h)")
)

func init() {
	flag.Parse()
}

type Args struct {
	Port           int
	Capacity       uint64
	Key            string
	Path           string
	Scheme         string
	AssetsHostname string
	Ttl            time.Duration
}

func LoadArgs() Args {
	return Args{
		Port:           *portFlag,
		Ttl:            *ttlFlag,
		Path:           *pathFlag,
		Scheme:         *schemeFlag,
		AssetsHostname: *assetsHostnameFlag,
		Key:            *keyFlag,
		Capacity:       *capacityFlag,
	}
}
