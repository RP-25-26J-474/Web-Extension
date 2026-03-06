const path = require("path");
const { spawnSync } = require("child_process");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.PROD_MONGO_URI;
const COLLECTION_NAME = process.env.IMPAIRMENT_PROFILES_COLLECTION || "impairmentprofiles";
function resolvePythonBin() {
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) {
    return process.env.PYTHON;
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const serverRoot = path.resolve(__dirname, "..");
  const candidates = [
    path.join(repoRoot, ".venv", "Scripts", "python.exe"),
    path.join(serverRoot, ".venv", "Scripts", "python.exe"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python";
}

function parseArgs(argv) {
  const out = { limit: null, outFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit") {
      out.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--out") {
      out.outFile = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function runScoreForUser(userId) {
  const pythonBin = resolvePythonBin();
  const scriptPath = path.resolve(__dirname, "..", "..", "ml", "training", "score_one_session.py");
  const csvPath = path.resolve(__dirname, "..", "..", "ml", "datasets", "final", "motor_sessions.csv");
  const outDir = path.resolve(__dirname, "..", "..", "ml", "model_registry", "motor", "1.0.0");

  const result = spawnSync(
    pythonBin,
    ["-u", scriptPath, "--csv", csvPath, "--outdir", outDir, "--userId", String(userId)],
    { encoding: "utf8" }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.trim() : "";
    const stdout = result.stdout ? result.stdout.trim() : "";
    const combined = stderr || stdout;
    if (combined.includes("No rows found with userId")) {
      return { skipped: true };
    }
    throw new Error(`score_one_session.py failed for userId=${userId}\n${combined}`);
  }

  const stdout = result.stdout ? result.stdout.trim() : "";
  if (!stdout) {
    throw new Error(`No output from score_one_session.py for userId=${userId}`);
  }

  return { skipped: false, result: JSON.parse(stdout) };
}

function toPlainObject(doc) {
  const plain = JSON.parse(JSON.stringify(doc));
  delete plain._id;
  return plain;
}

async function main() {
  if (!MONGO_URI) {
    throw new Error("Missing PROD_MONGO_URI in environment.");
  }

  const { limit, outFile } = parseArgs(process.argv.slice(2));
  const outputPath = outFile
    ? path.resolve(process.cwd(), outFile)
    : path.resolve(__dirname, "impairement_profiles.json");
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const db = client.db();
    const collection = db.collection(COLLECTION_NAME);
    const cursor = collection.find({});
    if (limit && Number.isFinite(limit)) {
      cursor.limit(limit);
    }

    const results = [];
    const skippedUserIds = new Set();
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) {
        break;
      }

      const resolvedUserId = doc.user_id;
      if (!resolvedUserId) {
        continue;
      }

      const score = runScoreForUser(resolvedUserId);
      if (score.skipped) {
        skippedUserIds.add(String(resolvedUserId));
        continue;
      }
      const impairmentScore = score.result?.motor_profile?.impairment_score;
      const delayed_reaction_ms = score.result?.reaction_analysis?.delayed_reaction_ms;

      const profile = toPlainObject(doc);
      profile.user_id = profile.user_id || String(resolvedUserId);
      profile.impairment_probs = profile.impairment_probs || {};
      profile.impairment_probs.motor = profile.impairment_probs.motor || {};
      profile.impairment_probs.motor.delayed_reaction = delayed_reaction_ms;
      profile.impairment_probs.motor.impairment_score = impairmentScore;

      results.push(profile);
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`Wrote ${results.length} profiles to ${outputPath}`);
    if (skippedUserIds.size > 0) {
      console.log(`Skipped users (${skippedUserIds.size}): ${Array.from(skippedUserIds).join(", ")}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
