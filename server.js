const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { myapi, myapi2 } = require('./myapi');

const fs = require('fs');
const { promisify } = require('util');
const { SpeechClient } = require('@google-cloud/speech').v1p1beta1;
const fetch = require('node-fetch');
const multer = require('multer');
const upload = multer();
require('dotenv').config();
const OpenAI = require('openai').OpenAI;
const openai = new OpenAI(process.env.OPENAI_API_KEY);



// Inside your route handler
app.get("/index", (req, res) => {
  res.render("index");
});


app.get("/home", (req, res) => {
  res.render("home");
});

app.post("/openai", async (req, res) => { // Change to POST method since you're sending data
  try {
    const alltext = req.body.alltext; // Extract alltext from the request body
    console.log("openai route")
    const response = await myapi(alltext); // Pass alltext to myapi function
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/question_ans", async (req, res) => { // Change to POST method since you're sending data
  try {
    const questionAnswerPairs = req.body.questionAnswerPairs; // Extract alltext from the request body
    console.log("openai route")
    const response = await myapi2(questionAnswerPairs); // Pass alltext to myapi function
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Endpoint to process the audio URL
app.post('/process_audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Audio data is missing in the request');
    }

    // Or log specific properties of interest
    console.log('File:', req.file); // Log uploaded file
    console.log('Body:', req.body);

    const audioBuffer = req.file.buffer; // Get the audio data buffer from req.file
    console.log(audioBuffer);
    const audioFilePath = `${__dirname}/audios/uploads/audio.wav`; // Define the file path
    try {
      await fs.promises.writeFile(audioFilePath, audioBuffer); // Write the file using fs.promises.writeFile()
      console.log('Audio file saved successfully:', audioFilePath);
    } catch (writeError) {
      console.error('Error saving audio file:', writeError);
      throw new Error('Error saving audio file');
    }

    // Convert audio data to text using OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream("./audios/uploads/audio.wav"),
      model: 'whisper-1', // Use Whisper model for speech recognition
      response_format: "text",
    });
    console.log(transcription);
    // Extract transcription from response
    

    // Send the text transcription back to the client
    res.json(transcription);
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Error processing audio' });
  }
});
const rooms = [
  "75cf7c66",
  "75cf7f7c",
  "75cf80e4",
  "75cf865c",
  "75cf87d8",
  "75cf8936",
  "75cf8ae4",
  "75cf8c24",
  "75cf8d50",
  "75cf8e86",
];

// Object to keep track of the number of users in each room
const usersInRooms = {};

// Object to keep track of skipped users in each room
const skippedUsers = {};

// Initialize the number of users in each room to 0
rooms.forEach((room) => {
  usersInRooms[room] = 0;
  skippedUsers[room] = [];
});

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  let randomRoom = null;
  // Check if there is any room with one user, if yes then join that room
  const roomWithOneUser= Object.keys(usersInRooms).find(
    (room) => usersInRooms[room] === 1 && skippedUsers[room].length === 0
  );
  if (roomWithOneUser) {
    randomRoom = roomWithOneUser;
  } else {
    // If no room has one user, then join a random room
    randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
  }
  res.redirect(`/${randomRoom}`);
});

app.get("/:room", (req, res) => {
  const roomId = req.params.room;
  const numUsers = usersInRooms[roomId];
  if (numUsers < 2 && skippedUsers[roomId].length === 0) {
    res.render("room", { roomId });
  } else {
    res.redirect("/");
  }
});

app.get("/home", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId, callback) => {
    if (usersInRooms[roomId] < 2 && skippedUsers[roomId].length === 0) {
      socket.join(roomId);
      usersInRooms[roomId]++;
      if (usersInRooms[roomId] === 1) {
        socket.emit("waiting");
      } else if (usersInRooms[roomId] === 2) {
        io.to(roomId).emit("ready");
      }
      socket.to(roomId).broadcast.emit("user-connected", userId);
      socket.on("disconnect", () => {
        usersInRooms[roomId]--;
        socket.to(roomId).broadcast.emit("user-disconnected", userId);
        if (usersInRooms[roomId] === 1) {
          io.to(roomId).emit("waiting");
        }
      });
    } else {
      // Room already full or user skipped
      callback("Room is full");
    }
    socket.on("video-state", (roomId, videoEnabled) => {
      socket
        .to(roomId)
        .broadcast.emit("video-state-changed", userId, videoEnabled);
    });

    socket.on("send-message", (roomId, message) => {
      socket.to(roomId).broadcast.emit("receive-message", userId, message);
    });

    socket.on("mic-state-changed", (userId, micEnabled) => {
      const videoElement = document.querySelector(
        `video[data-user-id="${userId}"]`
      );
      if (videoElement) {
        videoElement.srcObject.getAudioTracks()[0].enabled = micEnabled;
      }
    });

    // ...
  });

  socket.on("skip", (roomId) => {
    if (roomId && usersInRooms[roomId] > 0 && usersInRooms[roomId] < 2) {
      const skippedUserId = socket.id;
      skippedUsers[roomId].push(skippedUserId);
      socket.leave(roomId);
      usersInRooms[roomId]--;

      // Emit "user-skipped" event to the room
      io.to(roomId).emit("user-skipped", skippedUserId);
    }
  });
});



const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
