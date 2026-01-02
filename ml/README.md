# 🚀 AURA ML Pipeline - Quick Start

## ⚡ Run Everything (3 Commands)

```powershell
# 1. Navigate to training directory
cd D:\Ext\ml\training

# 2. Setup environment (first time only)
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 3. Generate synthetic data
python generate_synthetic_motor_csv.py --out ..\datasets\final\motor_sessions.csv

# 4. Train models
python train_motor_model_v2.py --csv ..\datasets\final\motor_sessions.csv --outdir ..\model_registry\motor\1.0.0 --folds 5
```

---

## 📁 What's Inside

```
ml/
├── training/              # 🔧 Scripts & dependencies
│   ├── generate_synthetic_motor_csv.py
│   ├── train_motor_model_v2.py
│   ├── requirements.txt
│   └── README_TRAINING.md  # 📖 Full documentation
│
├── datasets/              # 📊 Data
│   └── final/
│       └── motor_sessions.csv
│
└── model_registry/        # 🤖 Trained models
    └── motor/
        └── 1.0.0/
            ├── models/                    # Trained XGBoost models
            ├── preprocess/                # PCA artifacts
            └── reports/                   # Results & analysis
                ├── training_report.json   # Main results
                └── sessions_with_latent_and_labels.csv
```

---

## 📊 Check Results

After training, open:

**1. Main Results:**
```powershell
notepad ..\model_registry\motor\1.0.0\reports\training_report.json
```

**2. Sessions with Scores:**
```powershell
# Open in Excel or VS Code
code ..\model_registry\motor\1.0.0\reports\sessions_with_latent_and_labels.csv
```

---

## 🎯 Expected Results

- **Dataset:** ~300 sessions, 150+ features
- **Model A Macro-F1:** 0.60 - 0.80 (motor-only)
- **Model B Macro-F1:** 0.65 - 0.85 (motor + context)
- **PC1 Explained Variance:** 0.30 - 0.50

---

## 📚 Documentation

**Full guide:** `training/README_TRAINING.md`

**Topics covered:**
- Feature engineering details
- Model architecture explanation
- Interpreting results
- Troubleshooting
- Deployment guide

---

## 🔄 Replace with Real Data

Once you have real user sessions:

```powershell
# 1. Export your MongoDB data to CSV (same schema as synthetic)
# 2. Replace the CSV path in training command

python train_motor_model_v2.py `
  --csv path\to\real_motor_sessions.csv `
  --outdir ..\model_registry\motor\1.0.1 `
  --folds 5
```

---

## ✅ Quick Health Check

Run this after training to verify everything worked:

```powershell
# Should show 4 files
ls ..\model_registry\motor\1.0.0\models\*.joblib

# Should show 3 files  
ls ..\model_registry\motor\1.0.0\preprocess\*.joblib

# Should show 2 files
ls ..\model_registry\motor\1.0.0\reports\*.*
```

---

**Status:** ✅ Ready to Run  
**Version:** 1.0.0  
**Last Updated:** January 2, 2026

