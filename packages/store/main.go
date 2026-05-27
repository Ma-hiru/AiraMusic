package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"store/args"
	"store/cmd"
	"store/core"
	"store/routes"
	"syscall"
)

func main() {
	var flags = args.LoadArgs()

	go cmd.InitStore(flags.Path, core.StoreOption{
		FileScheme:     flags.Scheme,
		FileSchemeHost: flags.AssetsHostname,
		TimeLimit:      flags.Ttl,
		Capacity:       flags.Capacity,
	})

	go cmd.InitHTTP("127.0.0.1:"+fmt.Sprint(flags.Port), flags.Key, routes.RegisterRoutes)

	var ctx, stop = signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	cmd.Shutdown()
}
