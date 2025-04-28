const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = "tableflow";

let client;
let db;

async function connectToMongo() {
  if (db) return db;

  client = new MongoClient(uri, {});
  await client.connect();
  db = client.db(dbName);

  console.log("✅ Connected to MongoDB");
  return db;
}

function getDb() {
  if (!db) throw new Error("MongoDB not connected yet.");
  return db;
}

function closeMongoConnection() {
  if (client) return client.close();
}

module.exports = {
  connectToMongo,
  getDb,
  closeMongoConnection,
};
