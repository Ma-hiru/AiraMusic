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
	var err error

	if meta, err = core.CreateLocalStore(storePath); err != nil {
		if !errors.Is(err, core.ErrStoreExist) {
			fmt.Println("Failed to create local store:", err)
			os.Exit(114514)
		}
		fmt.Println("Local store already exists, loading existing store...")
	}
	if err := core.LoadLocalStore(meta); err != nil {
		fmt.Println("Failed to load local store:", err)
		os.Exit(114514)
	}
	core.SetStoreOption(storeOption)
	fmt.Println("Local store initialized at:", storePath)

	fmt.Println("Clearing invalid files from store...")
	err = core.GetStore().ClearInvalidFile()
	if err != nil {
		fmt.Println("Error clearing invalid files:", err)
	}
}
