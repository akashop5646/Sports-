import { MongoClient } from "mongodb";

let globalMongoClient;
let cachedDb;

async function initIndexes(db) {
  try {
    await Promise.all([
      db.collection("users").createIndex({ id: 1 }, { unique: true }),
      db.collection("users").createIndex({ googleId: 1 }),
      db.collection("users").createIndex({ playerCode: 1 }, { unique: true, sparse: true }),
      db.collection("sessions").createIndex({ userId: 1 }),
      db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("tournaments").createIndex({ id: 1 }, { unique: true }),
      db.collection("teams").createIndex({ id: 1 }, { unique: true }),
      db.collection("players").createIndex({ id: 1 }, { unique: true }),
      db.collection("matches").createIndex({ id: 1 }, { unique: true }),
      db.collection("matches").createIndex({ tournamentId: 1 }),
      db.collection("notifications").createIndex({ recipientId: 1 }),
    ]);
    console.log("Database indexes verified/created successfully.");
  } catch (err) {
    console.error("Error creating database indexes:", err);
  }
}

export async function connectToDatabase() {
  if (cachedDb && globalMongoClient) {
    return { client: globalMongoClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/stadium-night";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  globalMongoClient = client;
  cachedDb = db;

  // Initialize indexes asynchronously
  initIndexes(db);

  return { client, db };
}

export { globalMongoClient };
