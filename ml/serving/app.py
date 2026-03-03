from fastapi import FastAPI, HTTPException
import os, json
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

@app.get("/health")
def health():
    return {"ok": True, "model_dir": MODEL_DIR}

@app.post("/score/motor")
def score_motor(payload: dict):
    """
    payload should include:
      sessionId, userId, plus all features used in training (or missing will be imputed).
    """
    try:
        row = pd.Series(payload)

        # Impute numeric
        for c in motor_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = motor_medians.get(c, 0.0)
        for c in ctx_num_cols:
            if c not in row.index or pd.isna(row[c]):
                row[c] = ctx_num_medians.get(c, 0.0)

        # Categorical
        for c in ctx_cat_cols:
            if c not in row.index or row[c] is None or str(row[c]).lower() in ("nan", "none"):
                row[c] = "unknown"
            else:
                row[c] = str(row[c])

        # Latent score A (debug/monitoring)
        X_motor = row[motor_cols].astype(float).values.reshape(1, -1)
        pc1 = float(pca.transform(pca_scaler.transform(X_motor)).reshape(-1)[0])
        pct = percentile_from_sorted(pc1_sorted, pc1)
        impairment_A = clamp01(1.0 - pct)

        # Prediction (B2)
        b2_cols = motor_cols + ctx_num_cols + ctx_cat_cols
        X_B2 = pd.DataFrame([{c: row[c] for c in b2_cols}])
        pred_B2 = clamp01(float(modelB2.predict(X_B2)[0]))

        # Confidence heuristic (agreement with A)
        diff = abs(pred_B2 - impairment_A)
        confidence = clamp01(1.0 - (diff / 0.5))

        return {
            "sessionId": str(row.get("sessionId", "")),
            "userId": str(row.get("userId", "")),
            "motor_profile": {
                "impairment_score": round(pred_B2, 4),
                "confidence": round(confidence, 4),
                "latent_score": round(pc1, 4)
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))