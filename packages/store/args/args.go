package args

import (
	"flag"
	"time"

	"store/utils"
)

var (
	portFlag        = flag.Int("port", 8824, "HTTP listen address")
	capacityFlag    = flag.Uint64("capacity", 0, "store capacity (0 for unlimited)")
	pathFlag        = flag.String("path", utils.GetDefaultStorePath(), "store path (if empty, use temp dir)")
	keyFlag         = flag.String("key", "mahiru", "key for store access")
	ttlFlag         = flag.Duration("ttl", 7*24*time.Hour, "store TTL (e.g. 24h)")
	indexKeyFlag    = flag.String("index-key", "mahiru", "key for index access")
	watchParentFlag = flag.Bool("watch-parent", false, "shutdown when stdin is closed (parent process exited)")
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
	IndexKey       string
	WatchParent    bool
}

func LoadArgs() Args {
	return Args{
		Port:        *portFlag,
		Ttl:         *ttlFlag,
		Path:        *pathFlag,
		Key:         *keyFlag,
		Capacity:    *capacityFlag,
		IndexKey:    *indexKeyFlag,
		WatchParent: *watchParentFlag,
	}
}
