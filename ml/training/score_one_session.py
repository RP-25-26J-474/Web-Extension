import argparse
import json
import os
import joblib
import numpy as np
import pandas as pd

ID_COLS = ["sessionId", "userId"]

EXCLUDE_FROM_MOTOR = {
    "r1_speedPxPerFrame", "r2_speedPxPerFrame", "r3_speedPxPerFrame",
    "r1_spawnIntervalMs", "r2_spawnIntervalMs", "r3_spawnIntervalMs",
}

def clamp01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))

def percentile_from_sorted(sorted_vals: np.ndarray, x: float) -> float:
    """
    Compute percentile in [0,1] for value x given sorted training distribution.
    """
    idx = np.searchsorted(sorted_vals, x, side="left")
    if len(sorted_vals) <= 1:
        return 0.5
    return float(idx / (len(sorted_vals) - 1))

def infer_motor_cols_from_report(report: dict):
    return report["pca"]["motor_feature_columns"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to motor_sessions.csv")
    ap.add_argument("--outdir", required=True, help="Model output folder (e.g., ..\\model_registry\\motor\\1.0.0)")
    ap.add_argument("--sessionId", default=None, help="Pick a specific sessionId to score")
    ap.add_argument("--userId", default=None, help="Pick the first row for a specific userId to score")
    ap.add_argument("--row", type=int, default=None, help="Or score by row index (0-based)")
    args = ap.parse_args()

    # Load training report
    report_path = os.path.join(args.outdir, "reports", "training_report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)

    motor_cols = infer_motor_cols_from_report(report)
    ctx_num_cols = report["modelB2_motor_plus_context"]["context_numeric_columns"]
    ctx_cat_cols = report["modelB2_motor_plus_context"]["context_categorical_columns"]

    pc1_flip_applied = bool(report["pca"].get("pc1_flipped", False))

    # Load artifacts
    pca_scaler = joblib.load(os.path.join(args.outdir, "preprocess", "pca_scaler_motor.joblib"))
    pca = joblib.load(os.path.join(args.outdir, "preprocess", "pca_pc1_motor.joblib"))
    pc1_sorted = joblib.load(os.path.join(args.outdir, "preprocess", "pc1_sorted.npy"))

    modelB1 = joblib.load(os.path.join(args.outdir, "models", "modelB1_reg_motor_only.joblib"))
    modelB2 = joblib.load(os.path.join(args.outdir, "models", "modelB2_reg_motor_plus_context.joblib"))

    # Load imputers (Fix 1)
    med_path = os.path.join(args.outdir, "preprocess", "impute_medians.json")
    with open(med_path, "r", encoding="utf-8") as f:
        med = json.load(f)
    motor_medians = med.get("motor", {})
    ctx_num_medians = med.get("context_numeric", {})

    # Load dataset
    df = pd.read_csv(args.csv)

    # Pick row
    if args.sessionId is not None:
        matches = df.index[df["sessionId"].astype(str) == str(args.sessionId)].tolist()
        if not matches:
            raise SystemExit(f"No row found with sessionId={args.sessionId}")
        idx = matches[0]
    elif args.userId is not None:
        matches = df.index[df["userId"].astype(str) == str(args.userId)].tolist()
        if not matches:
            raise SystemExit(f"No row found with userId={args.userId}")
        idx = matches[0]
    elif args.row is not None:
        idx = args.row
        if idx < 0 or idx >= len(df):
            raise SystemExit(f"--row out of range. Must be 0..{len(df)-1}")
    else:
        idx = 0

    row = df.iloc[idx].copy()

    # --------------------
    # Apply Fix 1 imputations (match training)
    # --------------------
    for c in motor_cols:
        if c in row.index and (pd.isna(row[c]) or row[c] is None):
            row[c] = motor_medians.get(c, 0.0)

    for c in ctx_num_cols:
        if c in row.index and (pd.isna(row[c]) or row[c] is None):
            row[c] = ctx_num_medians.get(c, 0.0)

    for c in ctx_cat_cols:
        if c in row.index:
            v = row[c]
            if pd.isna(v) or v is None:
                row[c] = "unknown"
            else:
                row[c] = str(v)
        else:
            row[c] = "unknown"

    # --------------------
    # A) Compute impairment_score_A from PC1 percentile
    # --------------------
    X_motor = row[motor_cols].astype(float).values.reshape(1, -1)
    X_motor_scaled = pca_scaler.transform(X_motor)
    pc1 = float(pca.transform(X_motor_scaled).reshape(-1)[0])

    # ✅ CRITICAL: apply the same sign convention as training
    if pc1_flip_applied:
        pc1 = -pc1

    pct = percentile_from_sorted(pc1_sorted, pc1)  # 0..1, low->0 high->1
    impairment_A = clamp01(1.0 - pct)              # 0 good, 1 assistance

    # Confidence heuristic A: distance from middle (research-safe)
    conf_A = clamp01(abs(impairment_A - 0.5) * 2.0)

    # --------------------
    # B) Predict impairment_score using regressors
    # --------------------
    pred_B1 = clamp01(float(modelB1.predict(X_motor)[0]))

    # Build B2 input (motor + context)
    b2_dict = {}
    for c in (motor_cols + ctx_num_cols + ctx_cat_cols):
        b2_dict[c] = row.get(c, np.nan)
    X_B2 = pd.DataFrame([b2_dict])

    for c in ctx_cat_cols:
        X_B2[c] = X_B2[c].astype(str).fillna("unknown").replace({"nan": "unknown", "None": "unknown"})

    pred_B2 = clamp01(float(modelB2.predict(X_B2)[0]))

    # Confidence heuristic B: agreement with A
    diff = abs(pred_B2 - impairment_A)
    conf_B = clamp01(1.0 - (diff / 0.5))

    # Final selection: use B2 if it agrees with A; otherwise fallback to A
    use_B2 = diff <= 0.25
    impairment_final = pred_B2 if use_B2 else impairment_A
    confidence_final = conf_B if use_B2 else conf_A

    result = {
        "sessionId": str(row.get("sessionId", "")),
        "userId": str(row.get("userId", "")),
        "motor_profile": {
            "impairment_score": round(float(impairment_final), 4),
            "confidence": round(float(confidence_final), 4),
            "latent_score": round(float(pc1), 4),
            "debug": {
                "pc1_flipped_training": bool(pc1_flip_applied),
                "impairment_score_A": round(float(impairment_A), 4),
                "impairment_score_B1": round(float(pred_B1), 4),
                "impairment_score_B2": round(float(pred_B2), 4),
                "used": "B2" if use_B2 else "A",
                "agreement_diff": round(float(diff), 4)
            }
        },
        "notes": [
            "Not a medical diagnosis.",
            "impairment_score is a functional interaction score in this task (0=better, 1=more assistance needed)."
        ]
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()