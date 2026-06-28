package cmd

const (
	ExitCodeNormal int = iota
	ExitCodeFailedCreatedStore
	ExitCodeFailedLoadedStore
	ExitCodeFailedStartServer
	ExitCodeFailedShutdownServer
	ExitCodeFailedShutdownStore
)
