package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"store/args"
	"store/cmd"
	"store/core"
	"store/routes"
)

func main() {
	flags := args.LoadArgs()

	go cmd.InitStore(flags.Path, core.StoreOption{
		FileScheme:     flags.Scheme,
		FileSchemeHost: flags.AssetsHostname,
		TimeLimit:      flags.Ttl,
		Capacity:       flags.Capacity,
		IndexKey:       flags.IndexKey,
	})

	go cmd.InitHTTP("127.0.0.1:"+fmt.Sprint(flags.Port), flags.Key, routes.RegisterRoutes)

	if flags.WatchParent {
		go cmd.WatchParent()
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	cmd.Shutdown()
}
