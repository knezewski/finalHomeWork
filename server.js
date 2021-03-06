const express = require('express')
const path = require('path')
const app = express()
const http = require('http')
const server = http.createServer(app)
const io = require('socket.io')(server)
const routerApi = require('./api')
const { connected } = require('process')
require('dotenv').config()

require('./models/connection')

const PORT = process.env.PORT || 3000

// parse application/json
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Public Folder
app.use(express.static(path.join(__dirname, 'public')));

//set cors
app.use(function (_, res, next) {
   res.header('Access-Control-Allow-Origin', '*')
   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
   res.header(
     'Access-Control-Allow-Headers',
     'Origin, X-Requested-With, Content-Type, Accept',
   )
   next()
 })

 app.use(express.static(path.join(__dirname, "build")));
 app.use(express.static(path.join(__dirname, "upload")));

 require('./auth/passport')

app.use('/api', routerApi)

app.use("*", (_req, res) => {
    const file = path.resolve(__dirname, "build", "index.html")
    res.sendFile(file)
   })

app.use((err, _, res, __,) => {
   console.log(err.stack);
   res.status(500).json({
      code: 500,
      message: err.message
   })
})

server.listen(PORT, function() {
   console.log('Environement', process.env.NODE_ENV);
   console.log(`Server running. Use our API on port: ${PORT}`);
})

// IDs of users
const connectedUsers = {}
const historyMessage = {}

io.on('connection', (socket) => {
   const socketId = socket.id
   socket.on('users:connect', function (data) {
     // { userId: '5e9483d6d96b341ba80bc28e', username: 'krab' }
     const user = { ...data, socketId, activeRoom: null }
     connectedUsers[socketId] = user
     socket.emit('users:list', Object.values(connectedUsers))
     socket.broadcast.emit('users:add', user)
   })
   socket.on('message:add', function (data) {
     // {senderId: '5e9483d6d96b341ba80bc28e', recipientId: '5e9483d6d96b341ba80bc28e', text: 'Hi'}
     console.log('message:add')
     console.log(data)
     const { senderId, recipientId } = data
     socket.emit('message:add', data)
     socket.broadcast.to(data.roomId).emit('message:add', data)
     addMessageToHistory(senderId, recipientId, data)
     if (senderId !== recipientId) {
       addMessageToHistory(recipientId, senderId, data)
     }
   })
   socket.on('message:history', function (data) {
     // {recipientId: '5e9483d6d96b341ba80bc28e', userId: '5e9483d6d96b341ba80bc28e'}
     console.log('message:history')
     console.log(data)
     // console.log(historyMessage)
     if (
       historyMessage[data.userId] &&
       historyMessage[data.userId][data.recipientId]
     ) {
       socket.emit(
         'message:history',
         historyMessage[data.userId][data.recipientId],
       )
       // console.log(historyMessage[data.userId][data.recipientId])
     }
   })
   socket.on('disconnect', function (data) {
     delete connectedUsers[socketId]
     socket.broadcast.emit('users:leave', socketId)
   })
 })

 const addMessageToHistory = (senderId, recipientId, data) => {
   if (historyMessage[senderId]) {
     if (historyMessage[senderId][recipientId]) {
       if (historyMessage[senderId][recipientId].length > 10) {
         historyMessage[senderId][recipientId].shift()
       }
       historyMessage[senderId][recipientId].push(data)
     } else {
       historyMessage[senderId][recipientId] = []
       historyMessage[senderId][recipientId].push(data)
     }
   } else {
     historyMessage[senderId] = {}
     historyMessage[senderId][recipientId] = []
     historyMessage[senderId][recipientId].push(data)
   }
 }

module.exports = { app: app, server: server }
