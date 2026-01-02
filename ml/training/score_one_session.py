import argparse
import json
import os
import joblib
import numpy as np
import pandas as pd

LEVELS = {
    0: "typical",
    1: "mild",
    2: "moderate",
    3: "high",
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to motor_sessions.csv")
    ap.add_argument("--outdir", required=True, help="Model output folder (e.g., ..\\model_registry\\motor\\1.0.0)")
    ap.add_argument("--sessionId", default=None, help="Pick a specific sessionId to score")
    ap.add_argument("--row", type=int, default=None, help="Or score by row index (0-based)")
    args = ap.parse_args()

    # Load report for feature order + metadata
    report_path = os.path.join(args.outdir, "reports", "training_report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)

    motor_cols = report["pca"]["motor_feature_columns"]
    model_version = report.get("modelA_motor_only", {}).get("version", "1.0.0")

    # Load artifacts
    model_path = os.path.join(args.outdir, "models", "modelA_motor_only.joblib")
    pca_scaler_path = os.path.join(args.outdir, "preprocess", "pca_scaler_motor.joblib")
    pca_path = os.path.join(args.outdir, "preprocess", "pca_pc1_motor.joblib")

    model = joblib.load(model_path)
    pca_scaler = joblib.load(pca_scaler_path)
    pca = joblib.load(pca_path)

    # Load dataset
    df = pd.read_csv(args.csv)

    # Pick row
    if args.sessionId is not None:
        matches = df.index[df["sessionId"] == args.sessionId].tolist()
        if not matches:
            raise SystemExit(f"No row found with sessionId={args.sessionId}")
        idx = matches[0]
    elif args.row is not None:
        idx = args.row
        if idx < 0 or idx >= len(df):
            raise SystemExit(f"--row out of range. Must be 0..{len(df)-1}")
    else:
        # Default: score the first row
        idx = 0

    row = df.iloc[idx]

    # Build feature vector (in exact training order)
    X = row[motor_cols].astype(float).values.reshape(1, -1)

    # Latent score (PC1)
    X_scaled = pca_scaler.transform(X)
    latent_score = float(pca.transform(X_scaled).reshape(-1)[0])

    # Predict level + confidence
    proba = model.predict_proba(X)[0]
    label = int(np.argmax(proba))
    confidence = float(np.max(proba))

    result = {
        "sessionId": str(row.get("sessionId", "")),
        "participantId": str(row.get("participantId", "")),
        "motor_profile": {
            "level": LEVELS[label],
            "confidence": round(confidence, 4),
            "latent_score": round(latent_score, 4),
        },
        "notes": [
            "Not a medical diagnosis.",
            "Represents functional interaction performance in this specific task."
        ]
    }

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()