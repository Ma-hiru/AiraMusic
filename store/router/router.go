package router

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(app *gin.Engine) {
	checkRoutes(app)
	storeRoutes(app)
	fetchRoutes(app)
	otherRoutes(app)
	objectRoutes(app)
	checkStoreRoutes(app)
}
