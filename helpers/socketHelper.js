const { WebSocketServer } = require("ws");
const { guildConnections } = require("./guildHelper");

console.log("Starting WebSocket server...");
const server = new WebSocketServer({ port: 8081 });

let sockets = [];
let subscriptions = new Map();

server.on("listening", () => {
  console.log("WebSocket server is listening on port 8081.");
});

server.on("connection", (socket) => {
  sockets.push(socket);
  socket.on("message", (message) => {
    let data = {};
    try {
      data = JSON.parse(message);
    } catch (e) {
      socket.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!data.type) {
      socket.send(JSON.stringify({ error: "No type specified" }));
      return;
    }

    if (data.type == "ping") {
      socket.send(JSON.stringify({ type: "pong" }));
    }

    if (data.type == "subscribe") {
      if (!data.guildId) {
        socket.send(
          JSON.stringify({ type: "subscribe", error: "No guildId specified" })
        );
        return;
      }

      if (
        subscriptions.has(data.guildId) &&
        subscriptions.get(data.guildId).includes(socket)
      ) {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            success: false,
            error: "Already subscribed to this guild",
          })
        );
        return;
      }

      if (!guildConnections.has(data.guildId)) {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            success: false,
            error: "No active caption generations in this guild",
          })
        );
        return;
      }

      if (!subscriptions.has(data.guildId)) {
        subscriptions.set(data.guildId, []);
      }

      if (!subscriptions.get(data.guildId).includes(socket)) {
        subscriptions.get(data.guildId).push(socket);
        socket.send(
          JSON.stringify({
            type: "subscribe",
            success: true,
            message: "Subscribed to guild",
          })
        );
      }
    }

    if (data.type == "unsubscribe") {
      if (!data.guildId) {
        socket.send(
          JSON.stringify({ type: "unsubscribe", error: "No guildId specified" })
        );
        return;
      }

      if (
        subscriptions.has(data.guildId) &&
        subscriptions.get(data.guildId).includes(socket)
      ) {
        subscriptions.set(
          data.guildId,
          subscriptions.get(data.guildId).filter((s) => s != socket)
        );
        socket.send(
          JSON.stringify({
            type: "unsubscribe",
            success: true,
            message: "Unsubscribed from guild",
          })
        );
      } else {
        socket.send(
          JSON.stringify({
            type: "unsubscribe",
            success: false,
            error: "Not subscribed to this guild",
          })
        );
      }
    }

    if (data.type == "info") {
      if (!data.guildId) {
        socket.send(
          JSON.stringify({
            type: "info",
            success: false,
            error: "No guildId specified",
          })
        );
        return;
      }

      if (!guildConnections.has(data.guildId)) {
        socket.send(
          JSON.stringify({
            type: "info",
            success: false,
            error: "No active caption generations in this guild",
          })
        );
        return;
      }

      const connection = guildConnections.get(data.guildId);
      const channel = connection.channel;
      const guild = channel.guild;
      const members = channel.members;

      socket.send(
        JSON.stringify({
          type: "info",
          success: true,
          guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
          },
          channel: {
            id: channel.id,
            name: channel.name,
          },
        })
      );
    }

    if (data.type == "member") {
      if (!data.guildId) {
        socket.send(
          JSON.stringify({
            type: "member",
            success: false,
            error: "No guildId specified",
          })
        );
        return;
      }

      if (!data.memberId) {
        socket.send(
          JSON.stringify({
            type: "member",
            success: false,
            error: "No memberId specified",
          })
        );
        return;
      }

      if (!guildConnections.has(data.guildId)) {
        socket.send(
          JSON.stringify({
            type: "member",
            success: false,
            error: "No active caption generations in this guild",
          })
        );
        return;
      }

      const connection = guildConnections.get(data.guildId);
      const channel = connection.channel;
      const members = channel.members;

      if (!members.has(data.memberId)) {
        socket.send(
          JSON.stringify({
            type: "member",
            success: false,
            error: "Member not found in this voice channel",
          })
        );
        return;
      }

      const member = members.get(data.memberId);
      socket.send(
        JSON.stringify({
          type: "member",
          success: true,
          member: {
            id: member.id,
            name: member.nickname || member.displayName || member.user.username,
            avatar: member.user.avatarURL(),
          },
        })
      );
    }

    console.log("Received message:", JSON.stringify(data));
  });
  socket.on("close", () => {
    sockets = sockets.filter((s) => s != socket);
    for (let [guildId, subs] of subscriptions) {
      subscriptions.set(
        guildId,
        subs.filter((s) => s != socket)
      );
    }
  });
});

function sendFromGuild(guildId, content) {
  if (subscriptions.has(guildId)) {
    for (let i = 0; i < subscriptions.get(guildId).length; i++) {
      subscriptions.get(guildId)[i].send(JSON.stringify(content));
    }
  }
}

function unsubscribeGuild(guildId) {
  if (subscriptions.has(guildId)) {
    for (let i = 0; i < subscriptions.get(guildId).length; i++) {
      subscriptions.get(guildId)[i].send(
        JSON.stringify({
          type: "stopped",
          guildId,
        })
      );
    }
    subscriptions.delete(guildId);
  }
}

module.exports = {
  sendFromGuild,
  unsubscribeGuild,
};
