package ws

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
)

type Message struct {
	Id   string `json:"id"`
	File string `json:"file"`
}

type Hub struct {
	Clients    map[*websocket.Conn]bool
	Broadcast  chan Message
	Register   chan *websocket.Conn
	Unregister chan *websocket.Conn
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[*websocket.Conn]bool),
		Broadcast:  make(chan Message),
		Register:   make(chan *websocket.Conn),
		Unregister: make(chan *websocket.Conn),
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (Self *Hub) Run() {
	for {
		select {
		case conn := <-Self.Register:
			Self.Clients[conn] = true
		case conn := <-Self.Unregister:
			delete(Self.Clients, conn)
			_ = conn.Close()
		case message := <-Self.Broadcast:
			var data, _ = json.Marshal(message)
			for conn := range Self.Clients {
				err := conn.WriteMessage(websocket.TextMessage, data)
				if err != nil {
					delete(Self.Clients, conn)
					_ = conn.Close()
				}
			}

		}
	}
}

func (Self *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	Self.Register <- conn

	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				Self.Unregister <- conn
				break
			}
		}
	}()
}

var instance *Hub

func GetInstance() *Hub {
	return instance
}

func init() {
	instance = NewHub()
	go instance.Run()
}
