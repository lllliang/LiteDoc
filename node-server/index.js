const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");

const port = process.env.PORT || 4000;
const routes = require("./routes/index");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const registers = {
  1: { isLocked: false, owner: "Roger", queue: [], data: "servertest1" },
  2: { isLocked: false, owner: null, queue: [], data: "servertest2" },
  3: { isLocked: false, owner: null, queue: [], data: "servertest3" }
};

const cassandra = require("cassandra-driver");

const authProvider = new cassandra.auth.PlainTextAuthProvider(
  'ma20010218',
  '8P3KU9RDn9zeP5SF1fHOaDgD1x4JZhAUjqV3ofVQDQ2HZinBUTWPPs5K3GxAESL6Cj0ApRqbDCj9ACDbYzAnDw=='
);

const client = new cassandra.Client({
  contactPoints: ["ma20010218.cassandra.cosmos.azure.com:10350"],
  localDataCenter: "East Asia",
  authProvider: authProvider,
  sslOptions: {
    secureProtocol: "TLSv1_2_method"
  }
});
// console.log(client);
const query = "SELECT * FROM uprofile.user";
client.execute(query).then(result => console.log(result));

io.on("connection", socket => {
  const name = socket.handshake.query.name;
  console.log(`Client Joined: ${name}`);

  socket.on("getRegisterUpdate", () => {
    io.to(`${socket.id}`).emit("registerUpdate", registers);
  });

  socket.on("lockRegister", data => {
    const { name, registerId } = data;
    if (!registers[registerId].isLocked) {
      registers[registerId].isLocked = true;
      registers[registerId].owner = name;
      console.log("User " + name + " has locked register " + registerId);
    }
    io.emit("registerUpdate", registers);
  });

  socket.on("unlockRegister", data => {
    const { name, registerId } = data;
    const isLocked = registers[registerId].isLocked;
    const isOwner = name === registers[registerId].owner;
    if (isLocked && isOwner) {
      registers[registerId].isLocked = false;
      registers[registerId].owner = null;
      console.log("User " + name + " has unlocked register " + registerId);
    }
    io.emit("registerUpdate", registers);
  });

  socket.on("writeToRegister", res => {
    const { registerId, data } = res;
    registers[registerId].data = data;
    console.log(data);
    io.emit("registerUpdate", registers);
  });

  socket.on("disconnect", () => {
    console.log(`Client Disconnected: ${socket.id}`);
  });
});

app.use(express.static(path.join(__dirname, "../client/build")));
app.use(routes);


server.listen(port, () => console.log(`Listening on port ${port}`));
