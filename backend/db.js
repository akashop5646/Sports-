import { MongoClient } from "mongodb";

let globalMongoClient;
let cachedDb;

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

  return { client, db };
}

export { globalMongoClient };
