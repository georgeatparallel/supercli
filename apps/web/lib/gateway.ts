import { createOpenAI } from "@ai-sdk/openai";

export const gateway = createOpenAI({
  baseURL: "https://api-gateway.merge.dev/v1",
  apiKey: process.env.MERGE_GATEWAY_API_KEY!,
});
