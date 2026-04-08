package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"store/cmd"
	"store/env"
	"store/file"
	"store/router"
	"syscall"
)

func main() {
	var flags = env.LoadFlags()

	go cmd.InitStore(flags.Path, file.StoreOption{
		FileScheme:     flags.Scheme,
		FileSchemeHost: flags.SchemeHostname,
		TimeLimit:      flags.Ttl,
	})

	go cmd.InitHTTP("127.0.0.1:"+fmt.Sprint(flags.Port), flags.Key, router.RegisterRoutes)

	var ctx, stop = signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	cmd.Shutdown()
}
