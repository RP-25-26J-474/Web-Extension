import argparse
import os
import json
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.decomposition import PCA
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from xgboost import XGBRegressor


ID_COLS = ["sessionId", "userId"]

EXCLUDE_FROM_MOTOR = {
    "r1_speedPxPerFrame", "r2_speedPxPerFrame", "r3_speedPxPerFrame",
    "r1_spawnIntervalMs", "r2_spawnIntervalMs", "r3_spawnIntervalMs",
}


def infer_column_groups(df):
    cols = [c for c in df.columns if c not in ID_COLS]

    motor_cols = [
        c for c in cols
        if c.startswith(("r1_", "r2_", "r3_", "delta_"))
        and c not in EXCLUDE_FROM_MOTOR
        and pd.api.types.is_numeric_dtype(df[c])
    ]

    context_cols = [c for c in cols if c not in motor_cols]
    context_numeric = [c for c in context_cols if pd.api.types.is_numeric_dtype(df[c])]
    context_categorical = [c for c in context_cols if not pd.api.types.is_numeric_dtype(df[c])]

    return motor_cols, context_numeric, context_categorical


def build_model(seed=42):
    return XGBRegressor(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="reg:squarederror",
        random_state=seed,
        n_jobs=-1
    )


def clamp01(x):
    return np.clip(x, 0.0, 1.0)


def confidence_from_error(y_true, y_pred):
    diff = np.abs(y_pred - y_true)
    return clamp01(1.0 - (diff / 0.5))


def safe_spearman(y_true, y_pred):
    """
    Spearman correlation = Pearson correlation on ranks.
    Returns None if not computable (e.g., constant values / too few points).
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    if len(y_true) < 3:
        return None

    r_true = pd.Series(y_true).rank(method="average").to_numpy()
    r_pred = pd.Series(y_pred).rank(method="average").to_numpy()

    # If either ranks have no variance, correlation undefined
    if np.std(r_true) == 0.0 or np.std(r_pred) == 0.0:
        return None

    corr = np.corrcoef(r_true, r_pred)[0, 1]
    if not np.isfinite(corr):
        return None
    return float(corr)


def bootstrap_ci_skip_invalid(y_true, y_pred, metric_fn, n=1500, seed=42, min_valid=50):
    """
    Bootstrap CI that SKIPS invalid samples (NaN/None).
    Returns None CI if too few valid bootstrap samples.
    """
    rng = np.random.default_rng(seed)
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    N = len(y_true)

    vals = []
    for _ in range(n):
        idx = rng.integers(0, N, size=N)
        v = metric_fn(y_true[idx], y_pred[idx])
        if v is None:
            continue
        if isinstance(v, float) and not np.isfinite(v):
            continue
        vals.append(float(v))

    valid = len(vals)
    if valid < min_valid:
        return {
            "mean": None,
            "ci_low": None,
            "ci_high": None,
            "valid_samples": int(valid),
            "requested_samples": int(n),
            "note": "Too few valid bootstrap samples to estimate CI reliably. Increase holdout size."
        }

    vals = np.asarray(vals, dtype=float)
    return {
        "mean": float(np.mean(vals)),
        "ci_low": float(np.percentile(vals, 2.5)),
        "ci_high": float(np.percentile(vals, 97.5)),
        "valid_samples": int(valid),
        "requested_samples": int(n),
        "note": None
    }


def grade_accuracy(mae, r2, spearman_value, mae_ci_width):
    # spearman_value may be None
    sp_ok = (spearman_value is not None) and (spearman_value >= 0.70)

    if (mae <= 0.10) and (r2 >= 0.65) and sp_ok and (mae_ci_width <= 0.05):
        return "strong"
    if (mae <= 0.15) and (r2 >= 0.40):
        return "moderate"
    return "weak"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--test_frac", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--bootstrap", type=int, default=1500)
    parser.add_argument("--min_test_users", type=int, default=10, help="Warn if holdout users are fewer than this.")
    args = parser.parse_args()

    df = pd.read_csv(args.csv)

    for c in ID_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing required ID column: {c}")

    motor_cols, ctx_num_cols, ctx_cat_cols = infer_column_groups(df)
    if len(motor_cols) < 10:
        raise ValueError("Not enough motor features found. Ensure r1_/r2_/r3_/delta_ motor metrics exist.")

    # Quality gate: drop rows with too many missing motor features
    keep = df[motor_cols].isna().mean(axis=1) <= 0.25
    df = df.loc[keep].reset_index(drop=True)

    # User-level split
    users = df["userId"].astype(str).unique()
    train_users, test_users = train_test_split(
        users, test_size=args.test_frac, random_state=args.seed, shuffle=True
    )

    df_train = df[df["userId"].astype(str).isin(train_users)].reset_index(drop=True)
    df_test = df[df["userId"].astype(str).isin(test_users)].reset_index(drop=True)

    if len(test_users) < args.min_test_users:
        print(f"\n⚠️ WARNING: Holdout has only {len(test_users)} users. "
              f"Spearman CI may be unstable. Consider collecting more users or using a larger test_frac.\n")

    # FIX 1: Train-only medians for imputation
    medians = {c: df_train[c].median() for c in (motor_cols + ctx_num_cols)}
    for c in (motor_cols + ctx_num_cols):
        df_train[c] = df_train[c].fillna(medians[c])
        df_test[c] = df_test[c].fillna(medians[c])

    for c in ctx_cat_cols:
        df_train[c] = df_train[c].astype(str).fillna("unknown").replace({"nan": "unknown", "None": "unknown"})
        df_test[c] = df_test[c].astype(str).fillna("unknown").replace({"nan": "unknown", "None": "unknown"})

    # Reference label from TRAIN only (no leakage)
    scaler = RobustScaler()
    X_motor_train = scaler.fit_transform(df_train[motor_cols])
    X_motor_test = scaler.transform(df_test[motor_cols])

    pca = PCA(n_components=1, random_state=args.seed)
    pc1_train = pca.fit_transform(X_motor_train).reshape(-1)
    pc1_test = pca.transform(X_motor_test).reshape(-1)

    pc1_sorted = np.sort(pc1_train)
    idx_test = np.searchsorted(pc1_sorted, pc1_test, side="left")
    pct_test = idx_test / (len(pc1_sorted) - 1 if len(pc1_sorted) > 1 else 1)

    y_train = 1.0 - pd.Series(pc1_train).rank(pct=True).values
    y_test = clamp01(1.0 - pct_test)

    # Model (Motor + Context)
    numeric = motor_cols + ctx_num_cols
    categorical = ctx_cat_cols

    preprocessor = ColumnTransformer([
        ("num", RobustScaler(), numeric),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical)
    ])

    model = Pipeline([
        ("prep", preprocessor),
        ("xgb", build_model(args.seed))
    ])

    X_train = df_train[numeric + categorical]
    X_test = df_test[numeric + categorical]

    model.fit(X_train, y_train)
    preds = clamp01(model.predict(X_test))

    # Metrics
    mae = float(mean_absolute_error(y_test, preds))
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    r2 = float(r2_score(y_test, preds))

    sp = safe_spearman(y_test, preds)

    conf = confidence_from_error(y_test, preds)
    mean_conf = float(np.mean(conf))
    median_conf = float(np.median(conf))

    # Bootstrap CIs (skip invalid)
    ci_mae = bootstrap_ci_skip_invalid(
        y_test, preds, lambda a, b: float(mean_absolute_error(a, b)),
        n=args.bootstrap, seed=args.seed, min_valid=200
    )
    ci_rmse = bootstrap_ci_skip_invalid(
        y_test, preds, lambda a, b: float(np.sqrt(mean_squared_error(a, b))),
        n=args.bootstrap, seed=args.seed, min_valid=200
    )
    ci_sp = bootstrap_ci_skip_invalid(
        y_test, preds, lambda a, b: safe_spearman(a, b),
        n=args.bootstrap, seed=args.seed, min_valid=200
    )

    mae_ci_width = None
    if (ci_mae["ci_low"] is not None) and (ci_mae["ci_high"] is not None):
        mae_ci_width = float(ci_mae["ci_high"] - ci_mae["ci_low"])
    else:
        mae_ci_width = 999.0  # forces grade not to become "strong" accidentally

    grade = grade_accuracy(mae, r2, sp, mae_ci_width)

    sp_str = f"{sp:.3f}" if sp is not None else "N/A"
    sp_ci_str = (
        f"{ci_sp['ci_low']:.3f}–{ci_sp['ci_high']:.3f}"
        if ci_sp["ci_low"] is not None else "N/A"
    )

    paper_summary = (
        f"Holdout (unseen users): MAE={mae:.3f} "
        f"(95% CI {ci_mae['ci_low'] if ci_mae['ci_low'] is not None else 'N/A'}–"
        f"{ci_mae['ci_high'] if ci_mae['ci_high'] is not None else 'N/A'}), "
        f"RMSE={rmse:.3f}, R²={r2:.3f}, "
        f"Spearman={sp_str} (95% CI {sp_ci_str}), "
        f"mean confidence={mean_conf:.3f} [grade: {grade}]."
    )

    # Save artifacts
    reports_dir = os.path.join(args.outdir, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    pred_df = pd.DataFrame({
        "sessionId": df_test["sessionId"].astype(str).values if "sessionId" in df_test.columns else [""] * len(df_test),
        "userId": df_test["userId"].astype(str).values,
        "impairment_score_ref": y_test,
        "impairment_score_pred": preds,
        "abs_error": np.abs(preds - y_test),
        "confidence": conf
    })
    pred_csv_path = os.path.join(reports_dir, "holdout_predictions.csv")
    pred_df.to_csv(pred_csv_path, index=False)

    results = {
        "holdout": {
            "test_frac_users": float(args.test_frac),
            "n_test_users": int(len(test_users)),
            "n_test_sessions": int(len(df_test))
        },
        "metrics": {
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "spearman": sp,  # may be None
            "mae_ci": ci_mae,
            "rmse_ci": ci_rmse,
            "spearman_ci": ci_sp,
            "mean_confidence": mean_conf,
            "median_confidence": median_conf
        },
        "paper_ready": {
            "accuracy_grade": grade,
            "summary_sentence": paper_summary,
            "interpretation_note": (
                "Metrics quantify agreement with the functional reference score in this task "
                "(not medical diagnosis). Spearman CI may be unavailable for very small holdout sets."
            )
        },
        "artifacts": {
            "holdout_predictions_csv": "reports/holdout_predictions.csv"
        },
        "notes": [
            "User-level holdout split (no userId leakage).",
            "Reference label is PCA-derived from training users only.",
            "Confidence is a heuristic based on prediction error to the reference score.",
            "If Spearman CI is N/A, increase holdout size (more users/sessions)."
        ]
    }

    out_json_path = os.path.join(reports_dir, "holdout_results.json")
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n✅ Holdout evaluation complete")
    print(paper_summary)
    print(f"Saved: {out_json_path}")
    print(f"Saved: {pred_csv_path}")


if __name__ == "__main__":
    main()