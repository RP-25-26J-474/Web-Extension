# AURA Motor Skills ML Training Pipeline

## 📁 Directory Structure

```
D:\Ext\ml\
├── training\
│   ├── generate_synthetic_motor_csv.py    # Synthetic data generator
│   ├── train_motor_model_v2.py            # Training script (PCA → XGBoost)
│   ├── requirements.txt                    # Python dependencies
│   └── README_TRAINING.md                  # This file
├── datasets\
│   └── final\
│       └── motor_sessions.csv             # Final session-level dataset
└── model_registry\
    └── motor\
        └── 1.0.0\
            ├── models\                     # Trained model artifacts
            │   ├── modelA_motor_only.joblib
            │   └── modelB_motor_plus_context.joblib
            ├── preprocess\                 # Preprocessing artifacts
            │   ├── pca_scaler_motor.joblib
            │   └── pca_pc1_motor.joblib
            └── reports\                    # Training reports & results
                ├── training_report.json
                └── sessions_with_latent_and_labels.csv
```

---

## 🚀 Quick Start

### **1. Setup Environment**

Open PowerShell and navigate to the training directory:

```powershell
cd D:\Ext\ml\training
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

---

### **2. Generate Synthetic Dataset**

```powershell
python generate_synthetic_motor_csv.py --out ..\datasets\final\motor_sessions.csv
```

**Arguments:**
- `--out`: Output path for the CSV (default: `..\datasets\final\motor_sessions.csv`)
- `--participants`: Number of participants (default: 80)
- `--min_sessions`: Minimum sessions per participant (default: 2)
- `--max_sessions`: Maximum sessions per participant (default: 5)
- `--seed`: Random seed for reproducibility (default: 42)

**Expected Output:**
```
Wrote synthetic dataset: D:\Ext\ml\datasets\final\motor_sessions.csv
Shape: (300, 150+)
```

---

### **3. Train the Models**

```powershell
python train_motor_model_v2.py `
  --csv ..\datasets\final\motor_sessions.csv `
  --outdir ..\model_registry\motor\1.0.0 `
  --folds 5
```

**Arguments:**
- `--csv`: Path to the input CSV dataset (required)
- `--outdir`: Output directory for model artifacts (default: `outputs`)
- `--folds`: Number of cross-validation folds (default: 5)
- `--seed`: Random seed (default: 42)

**Expected Output:**
```
Saved outputs to: ..\model_registry\motor\1.0.0

Model A overall:
              precision    recall  f1-score   support
           0      0.XXX     0.XXX     0.XXX       XX
           1      0.XXX     0.XXX     0.XXX       XX
           2      0.XXX     0.XXX     0.XXX       XX
           3      0.XXX     0.XXX     0.XXX       XX
    accuracy                          0.XXX      XXX
   macro avg      0.XXX     0.XXX     0.XXX      XXX
weighted avg      0.XXX     0.XXX     0.XXX      XXX
```

---

## 📊 Understanding the Output

### **A) Training Report JSON**

**Location:** `D:\Ext\ml\model_registry\motor\1.0.0\reports\training_report.json`

**Contains:**
- **PCA Details:**
  - Explained variance ratio for PC1
  - Motor feature columns used
  - Excluded condition columns (speed, spawn interval)
  - PC1 loadings (feature importance in latent dimension)

- **Labeling:**
  - Method: Percentile bands on PCA PC1
  - Cuts: 10th, 30th, 60th percentiles
  - Thresholds: Actual PC1 values for each cut
  - Label names:
    - `0`: Typical interaction performance (top 40%)
    - `1`: Mild difficulty (30-60%)
    - `2`: Moderate difficulty (10-30%)
    - `3`: High difficulty (bottom 10%)

- **Model A (Motor-Only):**
  - Cross-validation results per fold
  - Overall macro-F1, balanced accuracy
  - Confusion matrix
  - Classification report

- **Model B (Motor + Context):**
  - Same metrics as Model A
  - Uses device/performance/demographic context

### **B) Sessions with Latent Scores & Labels**

**Location:** `D:\Ext\ml\model_registry\motor\1.0.0\reports\sessions_with_latent_and_labels.csv`

This CSV contains the original dataset plus:
- `latent_pc1_motor`: PC1 score (higher = better motor skills)
- `label_level`: Assigned label (0-3)

**Use cases:**
- Visual analysis (scatter plots, histograms)
- Validate label distribution
- Identify edge cases
- Sort by latent score to inspect extreme cases

### **C) Model Artifacts**

**Location:** `D:\Ext\ml\model_registry\motor\1.0.0\models\`

- `modelA_motor_only.joblib`: Trained XGBoost model (motor features only)
- `modelB_motor_plus_context.joblib`: Trained XGBoost model (motor + context)

**Location:** `D:\Ext\ml\model_registry\motor\1.0.0\preprocess\`

- `pca_scaler_motor.joblib`: RobustScaler for PCA preprocessing
- `pca_pc1_motor.joblib`: Fitted PCA model (1 component)

---

## 🧠 Model Architecture

### **Pipeline Overview**

```
Raw Motor Features (r1_*, r2_*, r3_*, delta_*)
    ↓
[Exclude condition columns: speed, spawn interval]
    ↓
RobustScaler (handles outliers better than StandardScaler)
    ↓
PCA (n_components=1) → PC1 score
    ↓
Ensure PC1 direction (flip if correlates positively with reactionTime)
    ↓
Percentile-based labeling (10%, 30%, 60% cuts)
    ↓
4-class labels: 0 (typical), 1 (mild), 2 (moderate), 3 (high difficulty)
    ↓
XGBoost Classifier (Gradient Boosting)
    ↓
5-Fold GroupKFold CV (grouped by participantId)
    ↓
Final models trained on full dataset
```

### **Model A vs Model B**

| Aspect | Model A | Model B |
|--------|---------|---------|
| **Features** | Motor metrics only | Motor + Device/Perf/Demographics |
| **Use Case** | Pure motor skill assessment | Context-aware assessment |
| **Interpretability** | High (only motor features) | Medium (many features) |
| **Expected Performance** | Strong (motor is primary signal) | Slightly better (context helps edge cases) |

---

## 📋 Feature Categories

### **Motor Features (used in PCA)**

```python
# Round-level metrics (r1_*, r2_*, r3_*)
- nTargets, nHits, nMisses, hitRate
- reactionTime_mean, reactionTime_std, reactionTime_median
- movementTime_mean, movementTime_std, movementTime_median
- interTap_mean, interTap_std, interTap_cv
- errorDist_mean, errorDist_std
- pathLength_mean, pathLength_std
- straightness_mean, straightness_std
- meanSpeed_mean, peakSpeed_mean, speedVar_mean
- meanAccel_mean, peakAccel_mean
- jerkRMS_mean, jerkRMS_std
- submovementCount_mean, submovementCount_std
- overshootCount_mean, overshootCount_std
- ID_mean (Fitts' Index of Difficulty)
- throughput_mean, throughput_std (Fitts' Throughput)

# Delta features (improvement across rounds)
- delta_r2_minus_r1_hitRate, delta_r3_minus_r1_hitRate, ...
- delta_r2_minus_r1_reactionTime_mean, ...
- delta_r2_minus_r1_movementTime_mean, ...
- delta_r2_minus_r1_jerkRMS_mean, ...
- delta_r2_minus_r1_throughput_mean, ...
```

### **Excluded Condition Columns**

These are **NOT** used in PCA/labeling (they are experimental conditions, not abilities):

```python
- r1_speedPxPerFrame, r2_speedPxPerFrame, r3_speedPxPerFrame
- r1_spawnIntervalMs, r2_spawnIntervalMs, r3_spawnIntervalMs
```

### **Context Features (used in Model B only)**

```python
# Device context
- device_pointerPrimary (mouse/touch/pen)
- device_os (Windows/macOS/Linux/Android/iOS)
- device_browser (Chrome/Edge/Firefox/Safari)
- screen_width, screen_height, screen_dpr
- viewportWidth, viewportHeight

# Performance context
- perf_samplingHzTarget, perf_samplingHzEstimated
- perf_avgFrameMs, perf_p95FrameMs
- perf_droppedFrames, perf_inputLagMsEstimate

# Accessibility
- highContrastMode, reducedMotionPreference

# Demographics
- userInfo_ageBucket (18-24, 25-34, ...)
- userInfo_gender (Male, Female, Other, Prefer not to say)
```

---

## 🔬 Interpreting Results

### **Good Model Performance Indicators:**

1. **Macro-F1 Score:**
   - `> 0.70`: Excellent
   - `0.60 - 0.70`: Good
   - `0.50 - 0.60`: Fair
   - `< 0.50`: Poor (may need more data or feature engineering)

2. **Balanced Accuracy:**
   - Similar thresholds as F1 score
   - Important because classes may be imbalanced

3. **Confusion Matrix:**
   - Look for strong diagonal (correct predictions)
   - Off-diagonal elements show misclassifications
   - Adjacent misclassifications (e.g., 1→2) are less severe than distant ones (e.g., 0→3)

4. **PC1 Explained Variance:**
   - `> 0.40`: Strong single-factor structure
   - `0.30 - 0.40`: Moderate structure
   - `< 0.30`: Weak structure (motor skills may be multidimensional)

### **Common Issues:**

**Issue:** Low explained variance for PC1
**Solution:** Check if motor features have high correlation, consider using 2-3 PCs instead

**Issue:** Poor classification on label 3 (high difficulty)
**Solution:** Extreme cases are rare; consider adjusting percentile cuts (e.g., 5%, 25%, 60%)

**Issue:** Model B not much better than Model A
**Solution:** Motor skills dominate; context features provide minimal additional signal (expected!)

**Issue:** High variance across CV folds
**Solution:** May need more participants; current dataset has limited diversity

---

## 🛠️ Troubleshooting

### **Error: "Not enough motor features found"**

**Cause:** CSV doesn't have expected column names  
**Fix:** Ensure CSV has columns like `r1_hitRate`, `r2_reactionTime_mean`, `delta_r2_minus_r1_hitRate`, etc.

### **Error: "Missing required column: participantId"**

**Cause:** CSV missing ID columns  
**Fix:** Ensure CSV has `sessionId` and `participantId` columns

### **Warning: "High missing rate in motor features"**

**Cause:** >25% missing data in some sessions  
**Fix:** Check data collection; missing sessions are automatically dropped

### **Poor model performance (<0.50 F1)**

**Cause:** Synthetic data or insufficient diversity  
**Fix:** Replace with real user data; synthetic data is for testing only

---

## 📚 Next Steps

1. **Replace Synthetic Data:**
   - Once you have real user sessions, replace `motor_sessions.csv`
   - Rerun training with `--csv path/to/real_data.csv`

2. **Hyperparameter Tuning:**
   - Adjust XGBoost params in `train_motor_model_v2.py`
   - Try different PCA components (2-3)
   - Experiment with percentile cuts (e.g., 5%, 25%, 60%)

3. **Deploy Model:**
   - Load `modelA_motor_only.joblib` in your backend
   - Use for real-time classification during onboarding
   - See `DEPLOYMENT.md` for integration guide

4. **Monitor Model:**
   - Track prediction distribution (are all users labeled 0?)
   - Compare predictions to user self-reports
   - Retrain periodically as data grows

---

## 📖 References

- **PCA:** Dimensionality reduction to find latent motor skill factor
- **XGBoost:** Gradient boosting for robust classification
- **GroupKFold:** Ensures no participant data leaks between train/test
- **RobustScaler:** Handles outliers better than StandardScaler
- **Fitts' Law:** Basis for throughput and Index of Difficulty metrics

---

**Training Pipeline Version:** 2.0  
**Last Updated:** January 2, 2026  
**Status:** ✅ Ready for Production  
**Contact:** AURA Development Team

