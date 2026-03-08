from fastapi import FastAPI, HTTPException
import os
import json
import joblib
import numpy as np
import pandas as pd

app = FastAPI()

MODEL_DIR = os.getenv("AURA_MOTOR_MODEL_DIR", r"..\model_registry\motor\1.0.0")

# Load report for feature lists
report_path = os.path.join(MODEL_DIR, "reports", "training_report.json")
with open(report_path, "r", encoding="utf-8") as f:
    report = json.load(f)

motor_cols = report["pca"]["motor_feature_columns"]
ctx_num_cols = report["modelB2_motor_plus_context"]["context_numeric_columns"]
ctx_cat_cols = report["modelB2_motor_plus_context"]["context_categorical_columns"]
pc1_flipped = bool(report["pca"].get("pc1_flipped", False))

# Load preprocess + models
pca_scaler = joblib.load(os.path.join(MODEL_DIR, "preprocess", "pca_scaler_motor.joblib"))
pca = joblib.load(os.path.join(MODEL_DIR, "preprocess", "pca_pc1_motor.joblib"))
pc1_sorted = joblib.load(os.path.join(MODEL_DIR, "preprocess", "pc1_sorted.npy"))

with open(os.path.join(MODEL_DIR, "preprocess", "impute_medians.json"), "r", encoding="utf-8") as f:
    impute = json.load(f)

motor_medians = impute.get("motor", {})
ctx_num_medians = impute.get("context_numeric", {})

modelB2 = joblib.load(os.path.join(MODEL_DIR, "models", "modelB2_reg_motor_plus_context.joblib"))


def percentile_from_sorted(sorted_vals: np.ndarray, x: float) -> float:
    idx = np.searchsorted(sorted_vals, x, side="left")
    if len(sorted_vals) <= 1:
        return 0.5
    return float(idx / (len(sorted_vals) - 1))


def clamp01(v: float) -> float:
    return float(max(0.0, min(1.0, v)))


def compute_reaction_delay(row: pd.Series):
    """
    Returns:
      delayed_reaction_ms: average of available round reactionTime_mean values
      reaction_delay_score: normalized 0..1 where higher = more delayed
    """
    rts = []
    for c in ["r1_reactionTime_mean", "r2_reactionTime_mean", "r3_reactionTime_mean"]:
        if c in row.index and row[c] is not None and not pd.isna(row[c]):
            rts.append(float(row[c]))

    if len(rts) == 0:
        return None, None

    delay_ms = float(np.mean(rts))

    # Simple normalization:
    # ~300ms => 0.0, ~2300ms => 1.0
    delay_score = clamp01((delay_ms - 300.0) / 2000.0)

    return round(delay_ms, 2), round(delay_score, 4)


def compute_data_quality(row: pd.Series, motor_cols):
    """
    Basic quality assessment based on:
    - sampling rate
    - dropped frames
    - missing motor feature ratio
    """
    sampling = row.get("perf_samplingHzEstimated", None)
    dropped = row.get("perf_droppedFrames", None)

    missing_motor = 0
    total_motor = len(motor_cols)

    for c in motor_cols:
        if c not in row.index or pd.isna(row[c]):
            missing_motor += 1

    missing_ratio = (missing_motor / total_motor) if total_motor > 0 else 1.0

    status = "good"

    if sampling is not None and not pd.isna(sampling) and float(sampling) < 25:
        status = "low"

    if dropped is not None and not pd.isna(dropped) and float(dropped) > 1500:
        status = "low"

    if missing_ratio > 0.40:
        status = "low"

    if missing_ratio > 0.70:
        status = "insufficient"

    return {
        "status": status,
        "sampling_hz": None if pd.isna(sampling) else float(sampling),
        "dropped_frames": None if pd.isna(dropped) else int(dropped),
        "missing_motor_feature_ratio": round(float(missing_ratio), 4)
    }


def decide_profile_status(confidence: float, quality_status: str):
    """
    Decide how strongly the result should be used.
    """
    if quality_status == "insufficient":
        return {
            "profile_status": "insufficient_data",
            "adaptation_strength": "none"
        }

    if confidence < 0.5 or quality_status == "low":
        return {
            "profile_status": "provisional",
            "adaptation_strength": "minimal"
        }

    return {
        "profile_status": "ready",
        "adaptation_strength": "full"
    }


@app.get("/health")
def health():
    return {"ok": True, "model_dir": MODEL_DIR}


@app.post("/score/motor")
def score_motor(payload: dict):
    """
    payload should include:
      sessionId, userId, plus all features used in training
      (missing numeric fields will be imputed).
    """
    try:
        row = pd.Series(payload)

        # Keep an untouched copy for quality assessment before imputation
        raw_row = row.copy()

        # Impute numeric motor fields
        for c in motor_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = motor_medians.get(c, 0.0)

        # Impute numeric context fields
        for c in ctx_num_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = ctx_num_medians.get(c, 0.0)

        # Normalize categorical fields
        for c in ctx_cat_cols:
            if c not in row.index or row[c] is None or str(row[c]).lower() in ("nan", "none"):
                row[c] = "unknown"
            else:
                row[c] = str(row[c])

        # --------------------
        # A) PCA-based reference score
        # --------------------
        X_motor = row[motor_cols].astype(float).values.reshape(1, -1)
        X_motor_scaled = pca_scaler.transform(X_motor)
        pc1 = float(pca.transform(X_motor_scaled).reshape(-1)[0])

        # Apply same sign convention as training
        if pc1_flipped:
            pc1 = -pc1

        pct = percentile_from_sorted(pc1_sorted, pc1)
        impairment_A = clamp01(1.0 - pct)

        # --------------------
        # B) Model prediction
        # --------------------
        b2_cols = motor_cols + ctx_num_cols + ctx_cat_cols
        X_B2 = pd.DataFrame([{c: row[c] for c in b2_cols}])

        pred_B2 = clamp01(float(modelB2.predict(X_B2)[0]))

        # Confidence = agreement between model and PCA reference
        diff = abs(pred_B2 - impairment_A)
        confidence = clamp01(1.0 - (diff / 0.5))

        # Extra analysis
        delayed_reaction_ms, reaction_delay_score = compute_reaction_delay(raw_row)
        data_quality = compute_data_quality(raw_row, motor_cols)
        status_info = decide_profile_status(confidence, data_quality["status"])

        # Final output score
        # Base combined score
        impairment_score = confidence * pred_B2 + (1.0 - confidence) * impairment_A
        # Optional delayed reaction adjustment
        if reaction_delay_score is not None:
            impairment_score = 0.85 * impairment_score + 0.15 * reaction_delay_score

        impairment_score = clamp01(impairment_score)

        return {
            "sessionId": str(row.get("sessionId", "")),
            "userId": str(row.get("userId", "")),
            "motor_profile": {
                "impairment_score": round(impairment_score, 4),
                "confidence": round(confidence, 4),
                "latent_score": round(pc1, 4)
            },
            "reaction_analysis": {
                "delayed_reaction_ms": delayed_reaction_ms,
                "reaction_delay_score": reaction_delay_score
            },
            "data_quality": data_quality,
            "decision": status_info,
            "notes": [
                "Not a medical diagnosis.",
                "impairment_score is a functional interaction score in this task (0=better, 1=more assistance needed)."
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))