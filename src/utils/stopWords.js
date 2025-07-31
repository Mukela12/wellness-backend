// Common English stop words to exclude from word frequency analysis
const stopWords = new Set([
  // Articles
  'a', 'an', 'the',
  
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  
  // Conjunctions
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'because', 'as', 'until', 
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 
  'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 
  'further', 'then', 'once',
  
  // Common verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 
  'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'should', 
  'could', 'ought', 'may', 'might', 'must', 'can', 'shall',
  
  // Common adverbs
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 
  'own', 'same', 'than', 'too', 'very', 'just', 'now', 'also', 'quite',
  
  // Common prepositions
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond',
  'by', 'down', 'during', 'except', 'for', 'from', 'in', 'inside', 'into',
  'like', 'near', 'of', 'off', 'on', 'outside', 'over', 'since', 'through',
  'throughout', 'till', 'to', 'toward', 'under', 'until', 'up', 'upon', 'with',
  'within', 'without',
  
  // Additional common words
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'any', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
  'should', 'now', 'use', 'used', 'using', 'uses', 'made', 'make', 'making',
  'way', 'ways', 'thing', 'things', 'see', 'seen', 'saw', 'look', 'looked',
  'looking', 'come', 'came', 'coming', 'go', 'went', 'going', 'get', 'got',
  'getting', 'much', 'many', 'one', 'two', 'first', 'second', 'new', 'old',
  'high', 'low', 'big', 'small', 'large', 'little', 'good', 'bad', 'best',
  'worst', 'right', 'wrong', 'back', 'well', 'even', 'still', 'try', 'tried',
  'trying', 'put', 'think', 'thought', 'thinking', 'know', 'knew', 'knowing'
]);

// Wellness-specific words to keep (not stop words)
const keepWords = new Set([
  // Emotions
  'happy', 'sad', 'angry', 'frustrated', 'excited', 'anxious', 'stressed',
  'calm', 'peaceful', 'worried', 'confident', 'scared', 'grateful', 'thankful',
  'overwhelmed', 'content', 'satisfied', 'disappointed', 'proud', 'ashamed',
  
  // Wellness terms
  'wellness', 'health', 'mental', 'physical', 'emotional', 'balance', 'mindful',
  'meditation', 'exercise', 'sleep', 'rest', 'energy', 'fatigue', 'burnout',
  'recovery', 'selfcare', 'therapy', 'support', 'help', 'improvement',
  
  // Work-related
  'work', 'job', 'career', 'project', 'team', 'manager', 'colleague', 'deadline',
  'meeting', 'presentation', 'performance', 'promotion', 'salary', 'workload',
  'productivity', 'achievement', 'goal', 'target', 'task', 'responsibility',
  
  // Positive indicators
  'progress', 'success', 'accomplish', 'achieve', 'improve', 'growth', 'learning',
  'development', 'opportunity', 'collaboration', 'teamwork', 'recognition',
  'appreciation', 'motivation', 'inspiration', 'creativity', 'innovation',
  
  // Concern indicators
  'stress', 'pressure', 'conflict', 'problem', 'issue', 'challenge', 'difficult',
  'hard', 'struggle', 'concern', 'worry', 'anxiety', 'depression', 'tired',
  'exhausted', 'overwhelm', 'confusion', 'uncertain', 'doubt', 'fear'
]);

module.exports = {
  isStopWord(word) {
    const lowerWord = word.toLowerCase().trim();
    // Keep wellness-specific words even if they might be common
    if (keepWords.has(lowerWord)) {
      return false;
    }
    return stopWords.has(lowerWord);
  },
  
  filterStopWords(words) {
    return words.filter(word => !this.isStopWord(word));
  },
  
  getStopWords() {
    return Array.from(stopWords);
  },
  
  getKeepWords() {
    return Array.from(keepWords);
  }
};