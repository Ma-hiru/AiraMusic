package cmd

import (
	"errors"
	"fmt"
	"os"
	"store/file"
)

func InitStore(storePath string, storeOption file.StoreOption) {
	fmt.Println("Initializing local store...")
	var meta *file.StoreMeta
	var err error

	if meta, err = file.CreateLocalStore(storePath); err != nil {
		if !errors.Is(err, file.ErrStoreExist) {
			fmt.Println("Failed to create local store:", err)
			os.Exit(114514)
		}
		fmt.Println("Local store already exists, loading existing store...")
	}
	if err := file.LoadLocalStore(meta); err != nil {
		fmt.Println("Failed to load local store:", err)
		os.Exit(114514)
	}
	file.SetStoreOption(storeOption)
	fmt.Println("Local store initialized at:", storePath)

	fmt.Println("Clearing invalid files from store...")
	err = file.GetStore().ClearInvalidFile()
	if err != nil {
		fmt.Println("Error clearing invalid files:", err)
	}
}
