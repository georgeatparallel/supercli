import {Pinecone} from "@pinecone-database/pinecone"

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_DB_API_KEY!
})

export const pineconeIndex = pinecone.index({
  name: "supercode-vector-embeddings-v5",
  host: "https://supercode-vector-embeddings-v5-y8wqt4m.svc.aped-4627-b74a.pinecone.io"
})