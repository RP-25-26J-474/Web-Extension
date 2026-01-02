import argparse
import os
import json
import copy
import numpy as np
import pandas as pd

from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.decomposition import PCA
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    balanced_accuracy_score,
)

from xgboost import XGBClassifier
import joblib

ID_COLS = ["sessionId", "participantId"]

# Exclude "condition" columns from being treated as motor ability features
EXCLUDE_FROM_MOTOR = {
    "r1_speedPxPerFrame","r2_speedPxPerFrame","r3_speedPxPerFrame",
    "r1_spawnIntervalMs","r2_spawnIntervalMs","r3_spawnIntervalMs",
}

def infer_column_groups(df: pd.DataFrame):
    cols = [c for c in df.columns if c not in ID_COLS]

    motor_prefixes = ("r1_", "r2_", "r3_", "delta_")
    motor_cols_all = [c for c in cols if c.startswith(motor_prefixes)]

    # Motor numeric for PCA/modelA = motor cols minus excluded condition fields
    motor_numeric = [
        c for c in motor_cols_all
        if pd.api.types.is_numeric_dtype(df[c]) and c not in EXCLUDE_FROM_MOTOR
    ]

    # Context = everything else (including condition fields + device/perf/game)
    context_cols = [c for c in cols if c not in motor_numeric]

    context_numeric = [c for c in context_cols if pd.api.types.is_numeric_dtype(df[c])]
    context_categorical = [c for c in context_cols if not pd.api.types.is_numeric_dtype(df[c])]

    return motor_numeric, context_numeric, context_categorical

def make_percentile_labels(scores: np.ndarray, cuts=(10, 30, 60)):
    p10, p30, p60 = np.percentile(scores, cuts)
    y = np.zeros_like(scores, dtype=int)
    y[scores <= p10] = 3
    y[(scores > p10) & (scores <= p30)] = 2
    y[(scores > p30) & (scores <= p60)] = 1
    y[scores > p60] = 0
    thresholds = {"p10": float(p10), "p30": float(p30), "p60": float(p60)}
    return y, thresholds

def ensure_pc1_direction(pc1: np.ndarray, df_motor: pd.DataFrame):
    bad_candidates = [c for c in df_motor.columns if "reactionTime_mean" in c]
    if not bad_candidates:
        return pc1, False
    col = bad_candidates[0]
    r = np.corrcoef(pc1, df_motor[col].values)[0, 1]
    if np.isfinite(r) and r > 0:
        return -pc1, True
    return pc1, False

def build_xgb():
    return XGBClassifier(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="multi:softprob",
        num_class=4,
        random_state=42,
        n_jobs=-1,
        eval_metric="mlogloss",
    )

def evaluate_cv(model_pipeline, X, y, groups, folds=5):
    gkf = GroupKFold(n_splits=folds)
    all_true, all_pred = [], []
    fold_stats = []

    for fold, (tr, te) in enumerate(gkf.split(X, y, groups=groups), start=1):
        Xtr, Xte = X.iloc[tr], X.iloc[te]
        ytr, yte = y[tr], y[te]

        model_fold = copy.deepcopy(model_pipeline)
        model_fold.fit(Xtr, ytr)
        yhat = model_fold.predict(Xte)

        fold_stats.append({
            "fold": fold,
            "macro_f1": float(f1_score(yte, yhat, average="macro")),
            "balanced_acc": float(balanced_accuracy_score(yte, yhat)),
        })

        all_true.extend(yte.tolist())
        all_pred.extend(yhat.tolist())

    all_true = np.array(all_true)
    all_pred = np.array(all_pred)

    overall = {
        "macro_f1": float(f1_score(all_true, all_pred, average="macro")),
        "balanced_acc": float(balanced_accuracy_score(all_true, all_pred)),
        "confusion_matrix": confusion_matrix(all_true, all_pred).tolist(),
        "classification_report": classification_report(all_true, all_pred, digits=3),
    }
    return fold_stats, overall

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--outdir", default="outputs")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    np.random.seed(args.seed)

    os.makedirs(args.outdir, exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "models"), exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "preprocess"), exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "reports"), exist_ok=True)

    df = pd.read_csv(args.csv)
    for col in ID_COLS:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    motor_cols, ctx_num_cols, ctx_cat_cols = infer_column_groups(df)
    if len(motor_cols) < 10:
        raise ValueError("Not enough motor features found. Ensure r1_/r2_/r3_/delta_ columns exist.")

    # Basic missing handling
    motor_df = df[motor_cols].copy()
    keep = (motor_df.isna().mean(axis=1) <= 0.25)
    df = df.loc[keep].reset_index(drop=True)

    for c in motor_cols:
        if df[c].isna().any():
            df[c] = df[c].fillna(df[c].median())

    for c in ctx_num_cols:
        if df[c].isna().any():
            df[c] = df[c].fillna(df[c].median())

    for c in ctx_cat_cols:
        df[c] = df[c].astype(str).fillna("unknown").replace({"nan":"unknown","None":"unknown"})

    groups = df["participantId"].astype(str).values

    # PCA on motor-only
    pca_scaler = RobustScaler()
    X_motor_scaled = pca_scaler.fit_transform(df[motor_cols].values)

    pca = PCA(n_components=1, random_state=args.seed)
    pc1 = pca.fit_transform(X_motor_scaled).reshape(-1)
    pc1_aligned, flipped = ensure_pc1_direction(pc1, df[motor_cols])

    # Labeling via percentiles on PC1
    y, thresholds = make_percentile_labels(pc1_aligned, cuts=(10, 30, 60))

    # Model A (motor-only)
    modelA = Pipeline(steps=[
        ("scaler", RobustScaler()),
        ("xgb", build_xgb()),
    ])

    # Model B (motor + context) optional comparison
    numeric_B = motor_cols + ctx_num_cols
    categorical_B = ctx_cat_cols

    preprocessor_B = ColumnTransformer(
        transformers=[
            ("num", RobustScaler(), numeric_B),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_B),
        ],
        remainder="drop",
    )

    modelB = Pipeline(steps=[
        ("prep", preprocessor_B),
        ("xgb", build_xgb()),
    ])

    foldA, overallA = evaluate_cv(modelA, df[motor_cols], y, groups, folds=args.folds)

    X_B = df[motor_cols + ctx_num_cols + ctx_cat_cols]
    foldB, overallB = evaluate_cv(modelB, X_B, y, groups, folds=args.folds)

    # Fit final models on full data
    modelA.fit(df[motor_cols], y)
    modelB.fit(X_B, y)

    # Save artifacts
    joblib.dump(pca_scaler, os.path.join(args.outdir, "preprocess", "pca_scaler_motor.joblib"))
    joblib.dump(pca, os.path.join(args.outdir, "preprocess", "pca_pc1_motor.joblib"))
    joblib.dump(modelA, os.path.join(args.outdir, "models", "modelA_motor_only.joblib"))
    joblib.dump(modelB, os.path.join(args.outdir, "models", "modelB_motor_plus_context.joblib"))

    report = {
        "seed": args.seed,
        "pca": {
            "explained_variance_ratio_pc1": float(pca.explained_variance_ratio_[0]),
            "pc1_flipped": bool(flipped),
            "motor_feature_columns": motor_cols,
            "excluded_condition_columns": sorted(list(EXCLUDE_FROM_MOTOR)),
            "pc1_loadings": {c: float(w) for c, w in zip(motor_cols, pca.components_[0])},
        },
        "labeling": {
            "method": "percentile_bands_on_pca_pc1",
            "cuts_percentiles": [10, 30, 60],
            "thresholds": thresholds,
            "label_names": {
                "0": "Typical interaction performance",
                "1": "Mild difficulty",
                "2": "Moderate difficulty",
                "3": "High difficulty",
            },
        },
        "modelA_motor_only": {"cv_folds": foldA, "overall": overallA},
        "modelB_motor_plus_context": {
            "context_numeric_columns": ctx_num_cols,
            "context_categorical_columns": ctx_cat_cols,
            "cv_folds": foldB,
            "overall": overallB
        }
    }

    with open(os.path.join(args.outdir, "reports", "training_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    df_out = df.copy()
    df_out["latent_pc1_motor"] = pc1_aligned
    df_out["label_level"] = y
    df_out.to_csv(os.path.join(args.outdir, "reports", "sessions_with_latent_and_labels.csv"), index=False)

    print("Saved outputs to:", args.outdir)
    print("\nModel A overall:\n", overallA["classification_report"])
    print("\nModel B overall:\n", overallB["classification_report"])

if __name__ == "__main__":
    main()

