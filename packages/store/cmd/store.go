package cmd

import (
	"errors"
	"fmt"
	"os"
	"store/core"
)

func InitStore(storePath string, storeOption core.StoreOption) {
	fmt.Println("Initializing local store...")
	var meta *core.StoreMeta
	var store *core.Store
	var err error

	if meta, err = core.CreateLocalStore(storePath); !errors.Is(err, core.ErrStoreExist) && err != nil {
		fmt.Println("Failed to create local store:", err)
		os.Exit(114514)
	}

	if store, err = core.LoadLocalStore(meta, storeOption); err != nil {
		fmt.Println("Failed to load local store:", err)
		os.Exit(114514)
	}

	fmt.Println("Clearing invalid files from store...")
	err = store.ClearInvalidFile()
	if err != nil {
		fmt.Println("Error clearing invalid files:", err)
	}

	fmt.Println("Limiting store capacity...")
	err = store.LimitCapacity()
	if err != nil {
		fmt.Println("Error limiting store capacity:", err)
	}

	fmt.Println("Local store initialized at:", storePath)
}
