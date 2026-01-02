# Ishihara Plate Images - Setup Guide

## 📋 Quick Checklist

Place these 4 images in this directory:
- [ ] `ishihara_1.jpg` - Control plate
- [ ] `ishihara_3.jpg` - Test plate 2  
- [ ] `ishihara_11.jpg` - Test plate 3
- [ ] `ishihara_19.jpg` - Test plate 4

---

## 🖼️ Image Specifications

### Required Plates and Their Properties

| File Name | Plate Type | Normal Vision | Color Blind Vision |
|-----------|------------|---------------|-------------------|
| ishihara_1.jpg | Control | Sees "12" | Sees "12" |
| ishihara_3.jpg | Test | Sees "6" | Sees "5" |
| ishihara_11.jpg | Test | Sees "6" | Sees nothing |
| ishihara_19.jpg | Test | Sees nothing | Sees "2" |

### Technical Requirements

- **Format:** JPEG (.jpg)
- **Minimum Size:** 800 x 800 pixels
- **Recommended:** 1000 x 1000 pixels or higher
- **Aspect Ratio:** 1:1 (square)
- **Color Space:** RGB
- **Quality:** High (minimal compression)

---

## 📥 How to Obtain Images

### Option 1: Wikipedia Commons (Recommended)

1. Visit: https://en.wikipedia.org/wiki/Ishihara_test
2. Look for Ishihara test plate images
3. Download the specific plates listed above
4. Rename them to match the required filenames
5. Place in this directory

### Option 2: Educational Sources

Search for "Ishihara test plates educational use" or "Ishihara plates public domain"

Reputable sources:
- Educational websites with proper licensing
- Open-access medical databases
- Research repositories

### Option 3: Create Test Images (Development Only)

For development/testing purposes only, you can create simple colored dot patterns:
- Use image editing software
- Create 1000x1000px images
- Use colored dots in patterns
- **Not suitable for real color blindness testing**

---

## ⚠️ Important Legal Notice

### Copyright Considerations

The Ishihara color blindness test was created by Dr. Shinobu Ishihara and may be subject to copyright in some jurisdictions.

**Before using any Ishihara plates:**
- ✅ Verify the images are in the public domain or properly licensed
- ✅ For research/clinical use, obtain official test plates
- ✅ For educational/personal use, ensure compliance with local laws
- ❌ Do not use copyrighted images without permission

**This application is designed for:**
- Educational purposes
- Research data collection
- Demonstration of web technologies

**Not intended for:**
- Clinical diagnosis
- Medical decision-making
- Commercial use without proper licensing

---

## 🔧 Installation Steps

### 1. Obtain Images

Download the four required Ishihara test plates from a legitimate source.

### 2. Verify Filenames

Ensure your images are named **exactly** as follows:
```
ishihara_1.jpg
ishihara_3.jpg
ishihara_11.jpg
ishihara_19.jpg
```

**Case sensitive!** Use lowercase letters.

### 3. Place in Directory

Copy all four images to:
```
client/src/resources/
```

Your directory structure should look like:
```
client/src/resources/
├── .gitkeep
├── README.md (this file)
├── ishihara_1.jpg
├── ishihara_3.jpg
├── ishihara_11.jpg
└── ishihara_19.jpg
```

### 4. Verify

Run the application and navigate to:
**Perception Lab → Color Blindness Test**

You should see the actual Ishihara plates instead of placeholder circles.

---

## 🎨 Fallback Behavior

### What Happens Without Images?

If images are not found, the application will:
- ✅ Still function normally
- ✅ Display colored placeholder circles
- ✅ Allow test completion
- ✅ Record all interactions
- ⚠️ Show "Image not found" message

### Troubleshooting

**Images not appearing?**

1. **Check filenames:** Must be exact (lowercase, .jpg extension)
2. **Check location:** Must be in `client/src/resources/`
3. **Check format:** Must be JPEG (.jpg not .jpeg)
4. **Clear cache:** Try hard refresh (Ctrl+Shift+R)
5. **Restart dev server:** Stop and run `npm run dev` again

**Still not working?**

Check browser console (F12) for image loading errors.

---

## 📊 Using the Test

### For Accurate Results

1. **Display:** Use on a calibrated monitor if possible
2. **Lighting:** Test in good, consistent lighting
3. **Distance:** Maintain consistent viewing distance (~50cm)
4. **Time:** Don't rush - view each plate for 3-5 seconds
5. **Environment:** Quiet environment, no distractions

### Understanding Results

The test provides:
- **Color Vision Score:** Percentage of correct answers
- **Diagnosis:** Preliminary assessment
  - "Normal" - No color vision deficiency detected
  - "Suspected Red-Green Deficiency" - May indicate color blindness
  - "Inconclusive" - Results unclear

**⚠️ Disclaimer:** This is NOT a medical diagnosis. Consult an eye care professional for clinical assessment.

---

## 🛠️ For Developers

### Changing Images

To use different Ishihara plates:

1. **Update filenames** in `colorBlindnessAnalysis.js`:
```javascript
export const ISHIHARA_PLATES = [
  {
    plateId: 1,
    imageName: 'your_new_image_1.jpg',  // Change here
    normalAnswer: '12',
    colorBlindAnswer: '12',
  },
  // ... update others
];
```

2. **Update imports** in `ColorBlindnessTest.jsx`:
```javascript
import yourImage1 from '../../resources/your_new_image_1.jpg';
// ... update imageMap
```

### Adding More Plates

To add additional test plates:

1. Add plate definition in `colorBlindnessAnalysis.js`
2. Import image in `ColorBlindnessTest.jsx`
3. Update progress indicators
4. No backend changes needed!

---

## 📞 Need Help?

- Check the main project documentation
- Review `QUICKSTART.md` for setup instructions
- Check `docs/DEVELOPMENT.md` for development details
- Open an issue if you encounter problems

---

## ✅ Verification Checklist

Before running the color blindness test:

- [ ] All 4 images downloaded
- [ ] Filenames match exactly (lowercase, .jpg)
- [ ] Images placed in correct directory
- [ ] Images are high quality (at least 800x800px)
- [ ] Images are actual Ishihara plates (not placeholders)
- [ ] Legal rights to use images verified
- [ ] Dev server restarted after adding images
- [ ] Test page loads successfully
- [ ] Images display correctly (not placeholders)

---

**Happy Testing!** 🎨👁️

