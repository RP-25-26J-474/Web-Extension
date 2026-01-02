/**
 * Computer Literacy Quiz Questions
 * Categories: Icons, Terminology, Navigation, Security
 */

export const LITERACY_QUESTIONS = [
  // Icon Recognition
  {
    id: 'q1',
    category: 'icons',
    question: 'What does this symbol typically represent? 💾',
    options: ['Save', 'Download', 'Upload', 'Delete'],
    correctAnswer: 'Save',
    difficulty: 'easy',
  },
  {
    id: 'q2',
    category: 'icons',
    question: 'What does the 🖨️ icon represent?',
    options: ['Print', 'Scan', 'Copy', 'Fax'],
    correctAnswer: 'Print',
    difficulty: 'easy',
  },
  {
    id: 'q3',
    category: 'icons',
    question: 'What does the ⚙️ icon typically represent in applications?',
    options: ['Help', 'Settings', 'Tools', 'About'],
    correctAnswer: 'Settings',
    difficulty: 'easy',
  },
  {
    id: 'q4',
    category: 'icons',
    question: 'What does the 🏠 icon usually do in a website?',
    options: ['Go to homepage', 'Exit', 'Settings', 'Search'],
    correctAnswer: 'Go to homepage',
    difficulty: 'easy',
  },
  
  // Terminology
  {
    id: 'q5',
    category: 'terminology',
    question: 'What does URL stand for?',
    options: ['Uniform Resource Locator', 'Universal Resource Link', 'Unique Reference Locator', 'United Resource Loader'],
    correctAnswer: 'Uniform Resource Locator',
    difficulty: 'medium',
  },
  {
    id: 'q6',
    category: 'terminology',
    question: 'What is Wi-Fi?',
    options: ['Wireless internet connection', 'A type of cable', 'A software program', 'A web browser'],
    correctAnswer: 'Wireless internet connection',
    difficulty: 'easy',
  },
  {
    id: 'q7',
    category: 'terminology',
    question: 'What does "download" mean?',
    options: ['Transfer files from the internet to your computer', 'Send files to the internet', 'Delete files', 'Compress files'],
    correctAnswer: 'Transfer files from the internet to your computer',
    difficulty: 'easy',
  },
  {
    id: 'q8',
    category: 'terminology',
    question: 'What is a "browser"?',
    options: ['Software to access websites', 'A search engine', 'An antivirus program', 'A file manager'],
    correctAnswer: 'Software to access websites',
    difficulty: 'medium',
  },
  
  // Navigation & UI
  {
    id: 'q9',
    category: 'navigation',
    question: 'What is a toolbar in a software application?',
    options: ['A row of buttons with common functions', 'A search bar', 'A status indicator', 'A file list'],
    correctAnswer: 'A row of buttons with common functions',
    difficulty: 'medium',
  },
  {
    id: 'q10',
    category: 'navigation',
    question: 'What does a "menu" typically contain in software?',
    options: ['List of commands and options', 'File list', 'Recent files', 'Error messages'],
    correctAnswer: 'List of commands and options',
    difficulty: 'easy',
  },
  {
    id: 'q11',
    category: 'navigation',
    question: 'What is the purpose of a "scroll bar"?',
    options: ['Navigate through content that extends beyond the visible area', 'Measure time', 'Show progress', 'Control volume'],
    correctAnswer: 'Navigate through content that extends beyond the visible area',
    difficulty: 'easy',
  },
  {
    id: 'q12',
    category: 'navigation',
    question: 'What does "right-click" typically do?',
    options: ['Opens a context menu', 'Selects text', 'Closes window', 'Opens a new tab'],
    correctAnswer: 'Opens a context menu',
    difficulty: 'medium',
  },
  
  // Security & Best Practices
  {
    id: 'q13',
    category: 'security',
    question: 'What is a strong password characteristic?',
    options: ['Mix of letters, numbers, and symbols', 'Your name and birthday', 'All lowercase letters', 'Simple word'],
    correctAnswer: 'Mix of letters, numbers, and symbols',
    difficulty: 'easy',
  },
  {
    id: 'q14',
    category: 'security',
    question: 'What should you do if you receive a suspicious email asking for your password?',
    options: ['Delete it and never share passwords via email', 'Reply with your password', 'Click the link', 'Forward it to friends'],
    correctAnswer: 'Delete it and never share passwords via email',
    difficulty: 'medium',
  },
  {
    id: 'q15',
    category: 'security',
    question: 'What is "phishing"?',
    options: ['Fraudulent attempt to obtain sensitive information', 'A type of fishing', 'A computer game', 'A software update'],
    correctAnswer: 'Fraudulent attempt to obtain sensitive information',
    difficulty: 'medium',
  },
];

/**
 * Calculate Computer Literacy Score (CLS)
 * @param {Array} responses - Array of response objects
 * @returns {object} Score breakdown
 */
export const calculateLiteracyScore = (responses) => {
  if (!responses || responses.length === 0) {
    return {
      correctAnswers: 0,
      totalQuestions: 0,
      percentage: 0,
      timeFactor: 0,
      computerLiteracyScore: 0,
    };
  }

  const totalQuestions = responses.length;
  const correctAnswers = responses.filter(r => r.isCorrect).length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  
  // Calculate time factor
  const totalTime = responses.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const averageTime = totalTime / totalQuestions;
  
  // Time bonus/penalty: faster responses get slight bonus, slower get penalty
  // Optimal time per question: 8-15 seconds
  let timeFactor = 0;
  // if (averageTime < 8000) {
  //   // Too fast - might be guessing, small penalty
  //   timeFactor = -5;
  // } 
  if (averageTime > 20000) {
    // Very slow - small penalty
    timeFactor = -10;
  } else {
    // Good pace - small bonus
    timeFactor = 5;
  }
  
  // Computer Literacy Score = correct answers + time factor
  const computerLiteracyScore = Math.max(0, correctAnswers + timeFactor);
  
  return {
    correctAnswers,
    totalQuestions,
    percentage,
    timeFactor,
    computerLiteracyScore,
    averageTime: Math.round(averageTime),
  };
};

/**
 * Calculate category-wise scores
 * @param {Array} responses - Array of response objects
 * @returns {Array} Category scores
 */
export const calculateCategoryScores = (responses) => {
  const categories = {};
  
  responses.forEach(response => {
    const question = LITERACY_QUESTIONS.find(q => q.id === response.questionId);
    if (!question) return;
    
    if (!categories[question.category]) {
      categories[question.category] = { correct: 0, total: 0 };
    }
    
    categories[question.category].total++;
    if (response.isCorrect) {
      categories[question.category].correct++;
    }
  });
  
  return Object.entries(categories).map(([category, data]) => ({
    category,
    correct: data.correct,
    total: data.total,
    percentage: Math.round((data.correct / data.total) * 100),
  }));
};

