package main

import (
	"fileServer/file"
	"fileServer/router"

	"github.com/gin-gonic/gin"
)

func main() {
	var err = file.InitStore(".")
	if err != nil {
		panic(err)
	}

	var app = gin.Default()
	router.SetRouter(app)
	if err := app.Run(":8824"); err != nil {
		panic(err)
	}
}
