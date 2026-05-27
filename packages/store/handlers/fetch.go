package handlers

import (
	"github.com/gin-gonic/gin"
)

func Fetch(ctx *gin.Context) {
	fetch(ctx)
}
