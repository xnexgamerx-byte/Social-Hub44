export interface TriviaQuestion {
  question: string;
  choices: string[];
  answer: number;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { question: "ما هي عاصمة المملكة العربية السعودية؟", choices: ["جدة", "الرياض", "مكة المكرمة", "الدمام"], answer: 1 },
  { question: "كم عدد كواكب المجموعة الشمسية؟", choices: ["7", "8", "9", "10"], answer: 1 },
  { question: "من هو مؤسس تطبيق فيسبوك؟", choices: ["ستيف جوبز", "بيل غيتس", "مارك زوكربرغ", "جيف بيزوس"], answer: 2 },
  { question: "ما هو أطول نهر في العالم؟", choices: ["الأمازون", "النيل", "الميسيسيبي", "الفرات"], answer: 1 },
  { question: "كم عدد لاعبي كرة القدم في كل فريق؟", choices: ["9", "10", "11", "12"], answer: 2 },
  { question: "ما هي أكبر قارة في العالم؟", choices: ["أفريقيا", "أمريكا الشمالية", "آسيا", "أوروبا"], answer: 2 },
  { question: "في أي سنة نزل الإنسان إلى القمر للمرة الأولى؟", choices: ["1965", "1969", "1972", "1975"], answer: 1 },
  { question: "ما هي اللغة الأكثر انتشاراً في العالم؟", choices: ["العربية", "الإسبانية", "الإنجليزية", "الصينية"], answer: 3 },
];
