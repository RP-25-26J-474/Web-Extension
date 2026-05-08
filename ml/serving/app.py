from fastapi import FastAPI, HTTPException
import os
import json
import joblib
import numpy as np
import pandas as pd

app = FastAPI()

MODEL_DIR = os.getenv("AURA_MOTOR_MODEL_DIR", os.path.join("..", "model_registry", "motor", "1.0.0"))

# Load report for feature lists
report_path = os.path.join(MODEL_DIR, "reports", "training_report.json")
with open(report_path, "r", encoding="utf-8") as f:
    report = json.load(f)

def resolve_feature_sets(report: dict) -> dict:
    if isinstance(report.get("feature_sets"), dict):
        return report["feature_sets"]

    pca_report = report.get("pca", {})
    b2_report = report.get("modelB2_motor_plus_context", {})

    pca_cols = list(pca_report.get("pca_motor_columns") or pca_report.get("motor_feature_columns") or [])
    ctx_num = list(b2_report.get("context_numeric_columns") or [])
    ctx_cat = list(b2_report.get("context_categorical_columns") or [])
    b2_motor = list(b2_report.get("b2_motor_columns") or pca_cols)
    runtime_motor = list(b2_report.get("runtime_motor_columns") or b2_motor or pca_cols)

    if not pca_cols or not b2_motor:
        raise KeyError("training_report.json is missing feature_sets and legacy motor feature columns")

    return {
        "pca_motor_columns": pca_cols,
        "b2_motor_columns": b2_motor,
        "runtime_motor_columns": runtime_motor,
        "context_numeric_columns": ctx_num,
        "context_categorical_columns": ctx_cat,
    }

feature_sets = resolve_feature_sets(report)
pca_motor_cols = feature_sets["pca_motor_columns"]
b2_motor_cols = feature_sets["b2_motor_columns"]
runtime_motor_cols = feature_sets["runtime_motor_columns"]
ctx_num_cols = feature_sets["context_numeric_columns"]
ctx_cat_cols = feature_sets["context_categorical_columns"]
pc1_flipped = bool(report["pca"].get("pc1_flipped", False))

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
    rts = []
    for c in ["r1_reactionTime_mean", "r2_reactionTime_mean", "r3_reactionTime_mean"]:
        if c in row.index and row[c] is not None and not pd.isna(row[c]):
            rts.append(float(row[c]))

    if len(rts) == 0:
        return None, None

    delay_ms = float(np.mean(rts))
    delay_score = clamp01((delay_ms - 300.0) / 2000.0)
    return round(delay_ms, 2), round(delay_score, 4)


def compute_data_quality(row: pd.Series, runtime_motor_cols):
    sampling = row.get("perf_samplingHzEstimated", None)
    dropped = row.get("perf_droppedFrames", None)

    missing_motor = 0
    total_motor = len(runtime_motor_cols)

    for c in runtime_motor_cols:
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
        "sampling_hz": None if sampling is None or pd.isna(sampling) else float(sampling),
        "dropped_frames": None if dropped is None or pd.isna(dropped) else int(dropped),
        "missing_motor_feature_ratio": round(float(missing_ratio), 4)
    }


def decide_profile_status(confidence: float, quality_status: str):
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


def compute_hit_summary(row: pd.Series):
    hits = []
    for c in ["r1_hitRate", "r2_hitRate", "r3_hitRate"]:
        if c in row.index and row[c] is not None and not pd.isna(row[c]):
            hits.append(float(row[c]))
    if not hits:
        return None, None
    avg_hit = float(np.mean(hits))
    r3_hit = row.get("r3_hitRate", None)
    r3_hit = None if r3_hit is None or pd.isna(r3_hit) else float(r3_hit)
    return avg_hit, r3_hit


def detect_a_contradiction(impairment_A: float, reaction_delay_score, avg_hit_rate, r3_hit_rate):
    """
    Contradiction rule:
    If session is obviously poor by delay + hit rate, but PCA says "very good", distrust A.
    """
    if reaction_delay_score is None:
        return False

    poor_delay = reaction_delay_score >= 0.80
    poor_avg_hit = (avg_hit_rate is not None and avg_hit_rate < 0.50)
    poor_r3_hit = (r3_hit_rate is not None and r3_hit_rate < 0.40)
    suspiciously_good_A = impairment_A < 0.20

    return bool(poor_delay and (poor_avg_hit or poor_r3_hit) and suspiciously_good_A)

@app.get("/")
def root():
    return {
        "service": "AURA Motor ML API",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "score": "/score/motor"
        }
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "model_dir": MODEL_DIR,
        "model_loaded": True,
        "pca_motor_feature_count": len(pca_motor_cols),
        "b2_motor_feature_count": len(b2_motor_cols),
        "context_numeric_count": len(ctx_num_cols),
        "context_categorical_count": len(ctx_cat_cols),
    }


@app.post("/score/motor")
def score_motor(payload: dict):
    try:
        row = pd.Series(payload)
        raw_row = row.copy()

        # Safe numeric coercion
        for c in runtime_motor_cols + ctx_num_cols:
            if c in row.index:
                row[c] = pd.to_numeric(row[c], errors="coerce")

        # Impute selected motor fields
        for c in runtime_motor_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = motor_medians.get(c, 0.0)

        # Impute numeric context
        for c in ctx_num_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = ctx_num_medians.get(c, 0.0)

        # Normalize categorical
        for c in ctx_cat_cols:
            if c not in row.index or row[c] is None or str(row[c]).lower() in ("nan", "none", ""):
                row[c] = "unknown"
            else:
                row[c] = str(row[c])

        # A) PCA reference from reduced stable subset
        X_pca = row[pca_motor_cols].astype(float).values.reshape(1, -1)
        X_pca_scaled = pca_scaler.transform(X_pca)
        pc1 = float(pca.transform(X_pca_scaled).reshape(-1)[0])
        if pc1_flipped:
            pc1 = -pc1

        pct = percentile_from_sorted(pc1_sorted, pc1)
        impairment_A = clamp01(1.0 - pct)

        # B) B2 prediction from reduced stable set
        b2_cols = b2_motor_cols + ctx_num_cols + ctx_cat_cols
        X_B2 = pd.DataFrame([{c: row[c] for c in b2_cols}])
        pred_B2 = clamp01(float(modelB2.predict(X_B2)[0]))

        # Analysis
        delayed_reaction_ms, reaction_delay_score = compute_reaction_delay(raw_row)
        data_quality = compute_data_quality(raw_row, runtime_motor_cols)
        avg_hit_rate, r3_hit_rate = compute_hit_summary(raw_row)
        contradiction_A = detect_a_contradiction(
            impairment_A=impairment_A,
            reaction_delay_score=reaction_delay_score,
            avg_hit_rate=avg_hit_rate,
            r3_hit_rate=r3_hit_rate
        )

        # Agreement/confidence
        diff = abs(pred_B2 - impairment_A)
        sigma = 0.30
        agreement_conf = np.exp(-(diff ** 2) / (2 * sigma ** 2))

        quality_factor = 1.0
        if data_quality["status"] == "low":
            quality_factor = 0.9
        elif data_quality["status"] == "insufficient":
            quality_factor = 0.7

        confidence = clamp01(float(agreement_conf * quality_factor))

        # Final score policy
        if contradiction_A:
            # Ignore misleading A; trust B2 + delay
            impairment_score = 0.90 * pred_B2
            if reaction_delay_score is not None:
                impairment_score += 0.10 * reaction_delay_score
        else:
            impairment_score = confidence * pred_B2 + (1.0 - confidence) * impairment_A
            if reaction_delay_score is not None:
                impairment_score = 0.85 * impairment_score + 0.15 * reaction_delay_score

        impairment_score = clamp01(impairment_score)

        # If contradiction happened, confidence should not be treated as full trust
        effective_confidence = confidence
        if contradiction_A:
            effective_confidence = min(confidence, 0.65)

        return {
            "sessionId": str(row.get("sessionId", "")),
            "userId": str(row.get("userId", "")),
            "motor_profile": {
                "impairment_score": round(impairment_score, 4),
                "confidence": round(effective_confidence, 4)
            },
            "reaction_analysis": {
                "delayed_reaction_ms": delayed_reaction_ms,
                "reaction_delay_score": reaction_delay_score
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
