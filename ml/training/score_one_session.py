import argparse
import json
import os
import joblib
import numpy as np
import pandas as pd

ID_COLS = ["sessionId", "userId"]

def percentile_from_sorted(sorted_vals: np.ndarray, x: float) -> float:
    """Compute percentile in [0,1] for value x given sorted training distribution."""
    idx = np.searchsorted(sorted_vals, x, side="left")
    if len(sorted_vals) <= 1:
        return 0.5
    return float(idx / (len(sorted_vals) - 1))

def clamp01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))

def pick_row_index_for_user(df: pd.DataFrame, user_id: str, how: str) -> int:
    matches = df.index[df["userId"].astype(str) == str(user_id)].tolist()
    if not matches:
        raise SystemExit(f"No rows found with userId={user_id}")

    how = how.lower().strip()
    if how == "first":
        return matches[0]
    if how == "latest":
        # Try to sort by sessionId string; fallback to last row occurrence
        try:
            sub = df.loc[matches, ["sessionId"]].copy()
            sub["sessionId"] = sub["sessionId"].astype(str)
            sub_sorted = sub.sort_values("sessionId")
            return int(sub_sorted.index[-1])
        except Exception:
            return matches[-1]

    if how in ("best", "worst"):
        return -1

    raise SystemExit(f"Invalid --userSession option: {how}. Use latest|first|best|worst.")

def compute_scores_for_row(row: pd.Series,
                           motor_cols, ctx_num_cols, ctx_cat_cols,
                           pca_scaler, pca, pc1_sorted,
                           modelB1, modelB2,
                           motor_medians: dict, ctx_num_medians: dict):
    """
    Returns:
      pc1, impairment_A, conf_A, pred_B1, pred_B2, diff, conf_B, impairment_final, confidence_final, used, imputed_count
    """
    row = row.copy()

    imputed_count = 0

    # --- FIX 1: Impute missing numeric features using training medians ---
    for c in motor_cols:
        if c in row.index and pd.isna(row[c]):
            row[c] = motor_medians.get(c, 0.0)
            imputed_count += 1

    for c in ctx_num_cols:
        if c in row.index and pd.isna(row[c]):
            row[c] = ctx_num_medians.get(c, 0.0)
            imputed_count += 1

    # A) Latent PC1 and impairment_score_A
    X_motor = row[motor_cols].astype(float).values.reshape(1, -1)
    X_motor_scaled = pca_scaler.transform(X_motor)
    pc1 = float(pca.transform(X_motor_scaled).reshape(-1)[0])

    pct = percentile_from_sorted(pc1_sorted, pc1)
    impairment_A = clamp01(1.0 - pct)  # 0 good, 1 assistance
    conf_A = clamp01(abs(impairment_A - 0.5) * 2.0)

    # B) Regression predictions
    pred_B1 = clamp01(float(modelB1.predict(X_motor)[0]))

    # Build B2 input
    b2_dict = {}
    for c in (motor_cols + ctx_num_cols + ctx_cat_cols):
        b2_dict[c] = row[c] if c in row.index else np.nan
    X_B2 = pd.DataFrame([b2_dict])

    # Convert categorical columns to string
    for c in ctx_cat_cols:
        X_B2[c] = X_B2[c].astype(str).fillna("unknown").replace({"nan": "unknown", "None": "unknown"})

    pred_B2 = clamp01(float(modelB2.predict(X_B2)[0]))

    diff = abs(pred_B2 - impairment_A)
    conf_B = clamp01(1.0 - (diff / 0.5))

    use_B2 = diff <= 0.25
    impairment_final = pred_B2 if use_B2 else impairment_A
    confidence_final = conf_B if use_B2 else conf_A
    used = "B2" if use_B2 else "A"

    return pc1, impairment_A, conf_A, pred_B1, pred_B2, diff, conf_B, impairment_final, confidence_final, used, imputed_count

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to motor_sessions.csv")
    ap.add_argument("--outdir", required=True, help="Model output folder (e.g., ..\\model_registry\\motor\\1.0.0)")
    ap.add_argument("--sessionId", default=None, help="Score a specific sessionId")
    ap.add_argument("--userId", default=None, help="Score by userId (chooses a session using --userSession)")
    ap.add_argument("--userSession", default="latest",
                    help="When using --userId: latest|first|best|worst (default: latest)")
    ap.add_argument("--row", type=int, default=None, help="Or score by row index (0-based)")
    args = ap.parse_args()

    # Load training report
    report_path = os.path.join(args.outdir, "reports", "training_report.json")
    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)

    motor_cols = report["pca"]["motor_feature_columns"]
    ctx_num_cols = report["modelB2_motor_plus_context"]["context_numeric_columns"]
    ctx_cat_cols = report["modelB2_motor_plus_context"]["context_categorical_columns"]

    # Load preprocessing + models
    pca_scaler = joblib.load(os.path.join(args.outdir, "preprocess", "pca_scaler_motor.joblib"))
    pca = joblib.load(os.path.join(args.outdir, "preprocess", "pca_pc1_motor.joblib"))
    pc1_sorted = joblib.load(os.path.join(args.outdir, "preprocess", "pc1_sorted.npy"))

    # FIX 1: load imputation medians from training
    impute_path = os.path.join(args.outdir, "preprocess", "impute_medians.json")
    with open(impute_path, "r", encoding="utf-8") as f:
        impute = json.load(f)
    motor_medians = impute.get("motor", {})
    ctx_num_medians = impute.get("context_numeric", {})

    modelB1 = joblib.load(os.path.join(args.outdir, "models", "modelB1_reg_motor_only.joblib"))
    modelB2 = joblib.load(os.path.join(args.outdir, "models", "modelB2_reg_motor_plus_context.joblib"))

    df = pd.read_csv(args.csv)

    idx = None

    if args.sessionId is not None:
        matches = df.index[df["sessionId"].astype(str) == str(args.sessionId)].tolist()
        if not matches:
            raise SystemExit(f"No row found with sessionId={args.sessionId}")
        idx = matches[0]

    elif args.userId is not None:
        idx_candidate = pick_row_index_for_user(df, args.userId, args.userSession)
        if idx_candidate != -1:
            idx = idx_candidate
        else:
            # best/worst requires computing A for each session of that user
            user_rows = df[df["userId"].astype(str) == str(args.userId)].copy()
            if user_rows.empty:
                raise SystemExit(f"No rows found with userId={args.userId}")

            scored = []
            for ridx, r in user_rows.iterrows():
                pc1, impairment_A, conf_A, pred_B1, pred_B2, diff, conf_B, imp_final, conf_final, used, imputed_count = compute_scores_for_row(
                    r, motor_cols, ctx_num_cols, ctx_cat_cols,
                    pca_scaler, pca, pc1_sorted,
                    modelB1, modelB2,
                    motor_medians, ctx_num_medians
                )
                scored.append((ridx, impairment_A))

            how = args.userSession.lower().strip()
            if how == "best":
                idx = min(scored, key=lambda t: t[1])[0]
            elif how == "worst":
                idx = max(scored, key=lambda t: t[1])[0]
            else:
                raise SystemExit("Internal error selecting best/worst session for userId.")

    elif args.row is not None:
        idx = args.row
        if idx < 0 or idx >= len(df):
            raise SystemExit(f"--row out of range. Must be 0..{len(df)-1}")

    else:
        idx = 0

    row = df.iloc[idx]

    pc1, impairment_A, conf_A, pred_B1, pred_B2, diff, conf_B, impairment_final, confidence_final, used, imputed_count = compute_scores_for_row(
        row, motor_cols, ctx_num_cols, ctx_cat_cols,
        pca_scaler, pca, pc1_sorted,
        modelB1, modelB2,
        motor_medians, ctx_num_medians
    )

    result = {
        "sessionId": str(row.get("sessionId", "")),
        "userId": str(row.get("userId", "")),
        "motor_profile": {
            "impairment_score": round(float(impairment_final), 4),
            "confidence": round(float(confidence_final), 4),
            "latent_score": round(float(pc1), 4),
            "data_quality": {
                "imputed_numeric_fields": int(imputed_count)
            },
            "debug": {
                "impairment_score_A": round(float(impairment_A), 4),
                "impairment_score_B1": round(float(pred_B1), 4),
                "impairment_score_B2": round(float(pred_B2), 4),
                "used": used,
                "agreement_abs_diff_B2_vs_A": round(float(diff), 4),
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