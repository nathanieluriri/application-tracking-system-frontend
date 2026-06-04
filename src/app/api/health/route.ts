import { withEnvelope } from "@server/http/with-envelope";
import { getDb } from "@server/core/database";

interface ServiceHealth {
  status: "healthy" | "unhealthy";
  latency_ms?: number;
  message?: string;
}

async function pingMongo(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return {
      status: "healthy",
      latency_ms: Math.round((performance.now() - start) * 100) / 100,
      message: "MongoDB ping successful",
    };
  } catch (err) {
    return { status: "unhealthy", message: String(err) };
  }
}

export const GET = withEnvelope(
  async () => {
    const mongo = await pingMongo();
    const status = mongo.status === "healthy" ? "healthy" : "degraded";
    return {
      status,
      timestamp: new Date().toISOString(),
      services: { mongo },
    };
  },
  { message: "Health check completed" },
);
