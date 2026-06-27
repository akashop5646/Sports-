import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/stadium-night";

let globalMongoClient: MongoClient | undefined;
let cachedDb: Db | undefined;

export async function connectToDatabase() {
  if (cachedDb && globalMongoClient) {
    return { client: globalMongoClient, db: cachedDb };
  }

  if (typeof window !== "undefined") {
    throw new Error("Cannot connect to MongoDB from the client!");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  globalMongoClient = client;
  cachedDb = db;

  return { client, db };
}
export { globalMongoClient };
