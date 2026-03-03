/**
 * Computer Literacy Quiz Questions
 * Section A: Icon Knowledge (6), Section B: Terminology (6), Section C: Interaction Concepts (3)
 * Universally assumed icons and terms – misunderstanding predicts usability failure.
 */

export const LITERACY_QUESTIONS = [
  // Section A — Icon Knowledge (6 questions)
  {
    id: 'q1',
    category: 'icons',
    question: 'What does this symbol usually represent? 🔍',
    options: ['Search', 'Refresh', 'Share', 'Zoom out'],
    correctAnswer: 'Search',
    difficulty: 'easy',
  },
  {
    id: 'q2',
    category: 'icons',
    question: 'What does this symbol usually represent? ⚙️',
    options: ['Upload', 'Settings', 'Help', 'Save'],
    correctAnswer: 'Settings',
    difficulty: 'easy',
  },
  {
    id: 'q3',
    category: 'icons',
    question: 'What does this symbol usually represent? 🗑️',
    options: ['Archive', 'Delete', 'Download', 'Copy'],
    correctAnswer: 'Delete',
    difficulty: 'easy',
  },
  {
    id: 'q4',
    category: 'icons',
    question: 'What does this symbol usually represent? 💾',
    options: ['Open', 'Save', 'Upload', 'Share'],
    correctAnswer: 'Save',
    difficulty: 'easy',
  },
  {
    id: 'q5',
    category: 'icons',
    question: 'What does this symbol usually represent? ⬇️',
    options: ['Scroll', 'Download', 'Collapse', 'Minimize'],
    correctAnswer: 'Download',
    difficulty: 'easy',
  },
  {
    id: 'q6',
    category: 'icons',
    question: 'What does this symbol usually represent? ❓',
    options: ['Error', 'Help / Information', 'Warning', 'Logout'],
    correctAnswer: 'Help / Information',
    difficulty: 'easy',
  },
  // Section B — Terminology Knowledge (6 questions)
  {
    id: 'q7',
    category: 'terminology',
    question: 'What is a browser?',
    options: ['A website', 'A program used to view websites', 'A computer virus', 'A storage device'],
    correctAnswer: 'A program used to view websites',
    difficulty: 'easy',
  },
  {
    id: 'q8',
    category: 'terminology',
    question: 'What is a link on a website?',
    options: ['A file', 'Clickable text or image that opens another page', 'A password', 'A setting'],
    correctAnswer: 'Clickable text or image that opens another page',
    difficulty: 'easy',
  },
  {
    id: 'q9',
    category: 'terminology',
    question: 'What is a tab in a web browser?',
    options: ['A saved file', 'One open page within the browser window', 'A menu', 'A search result'],
    correctAnswer: 'One open page within the browser window',
    difficulty: 'easy',
  },
  {
    id: 'q10',
    category: 'terminology',
    question: 'What does download mean?',
    options: ['Sending a file to the internet', 'Copying data from the internet to your device', 'Opening a website', 'Printing a document'],
    correctAnswer: 'Copying data from the internet to your device',
    difficulty: 'easy',
  },
  {
    id: 'q11',
    category: 'terminology',
    question: 'What is an icon in a user interface?',
    options: ['A picture representing a function or app', 'A system error', 'A keyboard shortcut', 'A file type'],
    correctAnswer: 'A picture representing a function or app',
    difficulty: 'easy',
  },
  {
    id: 'q12',
    category: 'terminology',
    question: 'What is a menu in software?',
    options: ['A help document', 'A list of available actions or options', 'A website', 'A file'],
    correctAnswer: 'A list of available actions or options',
    difficulty: 'easy',
  },
  // Section C — Interaction Concepts (3 questions)
  {
    id: 'q13',
    category: 'interaction',
    question: 'What usually happens when you click a link?',
    options: ['The computer shuts down', 'Another page or content opens', 'A file is deleted', 'Nothing happens'],
    correctAnswer: 'Another page or content opens',
    difficulty: 'easy',
  },
  {
    id: 'q14',
    category: 'interaction',
    question: 'What does a checkbox allow you to do?',
    options: ['Enter text', 'Turn an option on or off', 'Download a file', 'Close a window'],
    correctAnswer: 'Turn an option on or off',
    difficulty: 'easy',
  },
  {
    id: 'q15',
    category: 'interaction',
    question: 'What does a dropdown menu do?',
    options: ['Deletes content', 'Shows hidden options when clicked', 'Refreshes the page', 'Opens a new window'],
    correctAnswer: 'Shows hidden options when clicked',
    difficulty: 'easy',
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
      score: 0, // Decimal 0-1 for impairment profile
    };
  }

  const totalQuestions = responses.length;
  const correctAnswers = responses.filter(r => r.isCorrect).length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  // Score as decimal (0.0 - 1.0) for impairment profile - higher = better literacy
  const score = Number((correctAnswers / totalQuestions).toFixed(2));

  // Calculate time factor (for display/gamification only)
  const totalTime = responses.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const averageTime = totalTime / totalQuestions;
  let timeFactor = 0;
  if (averageTime > 20000) {
    timeFactor = -10;
  } else {
    timeFactor = 5;
  }

  // Computer Literacy Score = correct answers + time factor (legacy)
  const computerLiteracyScore = Math.max(0, correctAnswers + timeFactor);

  return {
    correctAnswers,
    totalQuestions,
    percentage,
    timeFactor,
    computerLiteracyScore,
    score,
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
