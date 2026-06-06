export interface TriviaQuestion {
  question: string;
  choices: string[];
  answer: number;
  category?: string;
}

/**
 * Large, varied Arabic question bank. Each game session draws a random subset
 * (see QUESTIONS_PER_GAME) and shuffles it, so two games are almost never the
 * same — this gives the "AI-generated, always different" feel without any
 * runtime AI dependency or cost.
 */
export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // ── جغرافيا وعواصم ──
  { question: "ما هي عاصمة المملكة العربية السعودية؟", choices: ["جدة", "الرياض", "مكة المكرمة", "الدمام"], answer: 1, category: "جغرافيا" },
  { question: "ما هي عاصمة مصر؟", choices: ["الإسكندرية", "القاهرة", "الجيزة", "أسوان"], answer: 1, category: "جغرافيا" },
  { question: "ما هي عاصمة العراق؟", choices: ["البصرة", "الموصل", "بغداد", "أربيل"], answer: 2, category: "جغرافيا" },
  { question: "ما هي عاصمة المغرب؟", choices: ["الدار البيضاء", "مراكش", "فاس", "الرباط"], answer: 3, category: "جغرافيا" },
  { question: "ما هي عاصمة الإمارات العربية المتحدة؟", choices: ["دبي", "أبوظبي", "الشارقة", "العين"], answer: 1, category: "جغرافيا" },
  { question: "ما هي عاصمة الأردن؟", choices: ["إربد", "الزرقاء", "عمّان", "العقبة"], answer: 2, category: "جغرافيا" },
  { question: "ما هي عاصمة قطر؟", choices: ["الدوحة", "الوكرة", "الريان", "الخور"], answer: 0, category: "جغرافيا" },
  { question: "ما هي عاصمة لبنان؟", choices: ["طرابلس", "بيروت", "صيدا", "صور"], answer: 1, category: "جغرافيا" },
  { question: "ما هي عاصمة تركيا؟", choices: ["إسطنبول", "أنقرة", "إزمير", "بورصة"], answer: 1, category: "جغرافيا" },
  { question: "ما هي عاصمة فرنسا؟", choices: ["ليون", "مرسيليا", "باريس", "نيس"], answer: 2, category: "جغرافيا" },
  { question: "ما هي عاصمة اليابان؟", choices: ["أوساكا", "كيوتو", "طوكيو", "ناغويا"], answer: 2, category: "جغرافيا" },
  { question: "ما هو أطول نهر في العالم؟", choices: ["الأمازون", "النيل", "الميسيسيبي", "الفرات"], answer: 1, category: "جغرافيا" },
  { question: "ما هي أكبر قارة في العالم؟", choices: ["أفريقيا", "أمريكا الشمالية", "آسيا", "أوروبا"], answer: 2, category: "جغرافيا" },
  { question: "ما هي أكبر صحراء حارة في العالم؟", choices: ["صحراء كالاهاري", "الصحراء الكبرى", "صحراء النفود", "صحراء غوبي"], answer: 1, category: "جغرافيا" },
  { question: "ما هو أكبر محيط في العالم؟", choices: ["الأطلسي", "الهندي", "الهادئ", "المتجمد الشمالي"], answer: 2, category: "جغرافيا" },
  { question: "في أي قارة تقع مصر؟", choices: ["آسيا", "أفريقيا", "أوروبا", "أستراليا"], answer: 1, category: "جغرافيا" },
  { question: "ما هي أعلى قمة جبلية في العالم؟", choices: ["كي2", "إيفرست", "كليمنجارو", "مون بلان"], answer: 1, category: "جغرافيا" },
  { question: "ما هي أكبر دولة في العالم من حيث المساحة؟", choices: ["الصين", "كندا", "روسيا", "أمريكا"], answer: 2, category: "جغرافيا" },
  { question: "ما هو البحر الذي يفصل بين آسيا وأفريقيا؟", choices: ["البحر الأسود", "البحر الأحمر", "بحر قزوين", "البحر الأبيض المتوسط"], answer: 1, category: "جغرافيا" },
  { question: "كم عدد القارات في العالم؟", choices: ["5", "6", "7", "8"], answer: 2, category: "جغرافيا" },

  // ── علوم ──
  { question: "كم عدد كواكب المجموعة الشمسية؟", choices: ["7", "8", "9", "10"], answer: 1, category: "علوم" },
  { question: "ما هو أقرب كوكب إلى الشمس؟", choices: ["الزهرة", "عطارد", "الأرض", "المريخ"], answer: 1, category: "علوم" },
  { question: "ما هو أكبر كوكب في المجموعة الشمسية؟", choices: ["زحل", "المشتري", "نبتون", "أورانوس"], answer: 1, category: "علوم" },
  { question: "ما هو الغاز الذي تتنفسه النباتات وتطلق الأكسجين؟", choices: ["النيتروجين", "ثاني أكسيد الكربون", "الهيدروجين", "الهيليوم"], answer: 1, category: "علوم" },
  { question: "ما هو العضو المسؤول عن ضخ الدم في الجسم؟", choices: ["الكبد", "الرئة", "القلب", "الكلى"], answer: 2, category: "علوم" },
  { question: "كم عدد عظام جسم الإنسان البالغ؟", choices: ["186", "206", "226", "246"], answer: 1, category: "علوم" },
  { question: "ما هو أكبر عضو في جسم الإنسان؟", choices: ["الكبد", "الجلد", "الدماغ", "الرئتان"], answer: 1, category: "علوم" },
  { question: "ما هي وحدة قياس شدة التيار الكهربائي؟", choices: ["الفولت", "الأوم", "الأمبير", "الواط"], answer: 2, category: "علوم" },
  { question: "ما هو الرمز الكيميائي للماء؟", choices: ["CO2", "O2", "H2O", "NaCl"], answer: 2, category: "علوم" },
  { question: "ما هو المعدن السائل في درجة حرارة الغرفة؟", choices: ["الحديد", "الزئبق", "النحاس", "الرصاص"], answer: 1, category: "علوم" },
  { question: "ما هي سرعة الضوء التقريبية؟", choices: ["300 ألف كم/ث", "150 ألف كم/ث", "500 ألف كم/ث", "1 مليون كم/ث"], answer: 0, category: "علوم" },
  { question: "ما هو الكوكب المعروف بالكوكب الأحمر؟", choices: ["الزهرة", "المريخ", "المشتري", "عطارد"], answer: 1, category: "علوم" },
  { question: "ما الذي يقيسه جهاز الترمومتر؟", choices: ["الضغط", "السرعة", "درجة الحرارة", "الرطوبة"], answer: 2, category: "علوم" },
  { question: "ما هو أصلب مادة طبيعية معروفة؟", choices: ["الذهب", "الحديد", "الألماس", "الجرانيت"], answer: 2, category: "علوم" },
  { question: "ما هو الغاز الأكثر وفرة في الغلاف الجوي للأرض؟", choices: ["الأكسجين", "النيتروجين", "ثاني أكسيد الكربون", "الأرجون"], answer: 1, category: "علوم" },
  { question: "كم عدد حواس الإنسان الأساسية؟", choices: ["3", "4", "5", "6"], answer: 2, category: "علوم" },

  // ── تاريخ ──
  { question: "في أي سنة نزل الإنسان إلى القمر للمرة الأولى؟", choices: ["1965", "1969", "1972", "1975"], answer: 1, category: "تاريخ" },
  { question: "في أي عام بدأت الحرب العالمية الأولى؟", choices: ["1912", "1914", "1918", "1920"], answer: 1, category: "تاريخ" },
  { question: "في أي عام انتهت الحرب العالمية الثانية؟", choices: ["1943", "1945", "1947", "1950"], answer: 1, category: "تاريخ" },
  { question: "من هو أول رئيس للولايات المتحدة الأمريكية؟", choices: ["أبراهام لينكولن", "جورج واشنطن", "توماس جيفرسون", "جون آدمز"], answer: 1, category: "تاريخ" },
  { question: "ما هي أقدم الحضارات في بلاد الرافدين؟", choices: ["الفرعونية", "السومرية", "الرومانية", "الإغريقية"], answer: 1, category: "تاريخ" },
  { question: "من بنى أهرامات الجيزة؟", choices: ["الرومان", "الإغريق", "المصريون القدماء", "البابليون"], answer: 2, category: "تاريخ" },
  { question: "في أي مدينة بدأت الثورة الصناعية؟", choices: ["باريس", "لندن", "مدن إنجلترا", "نيويورك"], answer: 2, category: "تاريخ" },
  { question: "من هو القائد المسلم الذي فتح الأندلس؟", choices: ["خالد بن الوليد", "طارق بن زياد", "صلاح الدين", "عمرو بن العاص"], answer: 1, category: "تاريخ" },
  { question: "في أي عام كانت غزوة بدر؟", choices: ["السنة الأولى للهجرة", "السنة الثانية للهجرة", "السنة الثالثة للهجرة", "السنة الخامسة للهجرة"], answer: 1, category: "تاريخ" },

  // ── دين ──
  { question: "كم عدد أركان الإسلام؟", choices: ["4", "5", "6", "7"], answer: 1, category: "دين" },
  { question: "كم عدد سور القرآن الكريم؟", choices: ["110", "114", "120", "124"], answer: 1, category: "دين" },
  { question: "ما هي أطول سورة في القرآن الكريم؟", choices: ["آل عمران", "البقرة", "النساء", "المائدة"], answer: 1, category: "دين" },
  { question: "كم عدد أركان الإيمان؟", choices: ["5", "6", "7", "8"], answer: 1, category: "دين" },
  { question: "في أي شهر هجري يصوم المسلمون؟", choices: ["شعبان", "رمضان", "شوال", "رجب"], answer: 1, category: "دين" },
  { question: "كم عدد ركعات صلاة الفجر؟", choices: ["2", "3", "4", "5"], answer: 0, category: "دين" },
  { question: "ما هي أول سورة في القرآن الكريم؟", choices: ["البقرة", "الفاتحة", "الإخلاص", "الناس"], answer: 1, category: "دين" },
  { question: "إلى أي مدينة هاجر النبي محمد ﷺ؟", choices: ["مكة", "الطائف", "المدينة المنورة", "الكوفة"], answer: 2, category: "دين" },

  // ── رياضة ──
  { question: "كم عدد لاعبي كرة القدم في كل فريق؟", choices: ["9", "10", "11", "12"], answer: 2, category: "رياضة" },
  { question: "كل كم سنة تقام بطولة كأس العالم لكرة القدم؟", choices: ["سنتان", "3 سنوات", "4 سنوات", "5 سنوات"], answer: 2, category: "رياضة" },
  { question: "في أي رياضة يُستخدم مصطلح \"سلام دانك\"؟", choices: ["كرة القدم", "كرة السلة", "التنس", "الكرة الطائرة"], answer: 1, category: "رياضة" },
  { question: "كم عدد لاعبي فريق كرة السلة في الملعب؟", choices: ["5", "6", "7", "11"], answer: 0, category: "رياضة" },
  { question: "ما هي الدولة التي فازت بأكبر عدد من ألقاب كأس العالم؟", choices: ["ألمانيا", "إيطاليا", "البرازيل", "الأرجنتين"], answer: 2, category: "رياضة" },
  { question: "كم عدد الأشواط في مباراة كرة القدم؟", choices: ["1", "2", "3", "4"], answer: 1, category: "رياضة" },
  { question: "في أي مدينة أقيمت أولى دورات الألعاب الأولمبية الحديثة؟", choices: ["باريس", "لندن", "أثينا", "روما"], answer: 2, category: "رياضة" },

  // ── ثقافة عامة وتكنولوجيا ──
  { question: "من هو مؤسس تطبيق فيسبوك؟", choices: ["ستيف جوبز", "بيل غيتس", "مارك زوكربرغ", "جيف بيزوس"], answer: 2, category: "تكنولوجيا" },
  { question: "ما هي الشركة المطورة لنظام أندرويد؟", choices: ["آبل", "مايكروسوفت", "جوجل", "سامسونج"], answer: 2, category: "تكنولوجيا" },
  { question: "من مؤسس شركة مايكروسوفت؟", choices: ["مارك زوكربرغ", "بيل غيتس", "إيلون ماسك", "لاري بيج"], answer: 1, category: "تكنولوجيا" },
  { question: "ماذا تعني الأحرف \"www\"؟", choices: ["الشبكة العالمية", "World Wide Web", "موقع الويب العالمي", "نظام الويب"], answer: 1, category: "تكنولوجيا" },
  { question: "ما هي الشركة المالكة لتطبيق إنستغرام؟", choices: ["جوجل", "تويتر", "ميتا (فيسبوك)", "تيك توك"], answer: 2, category: "تكنولوجيا" },
  { question: "ما هي اللغة الأكثر انتشاراً في العالم؟", choices: ["العربية", "الإسبانية", "الإنجليزية", "الصينية"], answer: 3, category: "ثقافة" },
  { question: "ما هي العملة الرسمية لليابان؟", choices: ["اليوان", "الين", "الوون", "الدولار"], answer: 1, category: "ثقافة" },
  { question: "ما هي العملة الرسمية للمملكة المتحدة؟", choices: ["اليورو", "الدولار", "الجنيه الإسترليني", "الفرنك"], answer: 2, category: "ثقافة" },
  { question: "كم لوناً في قوس قزح؟", choices: ["5", "6", "7", "8"], answer: 2, category: "ثقافة" },
  { question: "ما هو الحيوان الذي يُلقّب بملك الغابة؟", choices: ["النمر", "الأسد", "الفيل", "الدب"], answer: 1, category: "طبيعة" },
  { question: "ما هو أكبر حيوان على وجه الأرض؟", choices: ["الفيل الأفريقي", "الحوت الأزرق", "الزرافة", "وحيد القرن"], answer: 1, category: "طبيعة" },
  { question: "ما هو أسرع حيوان بري في العالم؟", choices: ["الأسد", "الفهد", "الحصان", "الغزال"], answer: 1, category: "طبيعة" },
  { question: "ما هو الطائر الذي لا يستطيع الطيران؟", choices: ["النسر", "البطريق", "الصقر", "الحمام"], answer: 1, category: "طبيعة" },
  { question: "كم عدد أرجل العنكبوت؟", choices: ["6", "8", "10", "12"], answer: 1, category: "طبيعة" },
  { question: "ما هو الحيوان الذي ينام واقفاً؟", choices: ["القطة", "الحصان", "الكلب", "الأرنب"], answer: 1, category: "طبيعة" },

  // ── رياضيات ──
  { question: "كم ناتج 7 × 8؟", choices: ["54", "56", "58", "64"], answer: 1, category: "رياضيات" },
  { question: "كم ناتج 12 + 15؟", choices: ["25", "27", "28", "30"], answer: 1, category: "رياضيات" },
  { question: "كم عدد أضلاع المثلث؟", choices: ["2", "3", "4", "5"], answer: 1, category: "رياضيات" },
  { question: "كم عدد دقائق الساعة الواحدة؟", choices: ["30", "60", "90", "120"], answer: 1, category: "رياضيات" },
  { question: "ما هو الرقم الذي يلي 99؟", choices: ["98", "100", "101", "110"], answer: 1, category: "رياضيات" },
  { question: "كم ناتج 100 ÷ 4؟", choices: ["20", "25", "30", "40"], answer: 1, category: "رياضيات" },
  { question: "كم عدد أضلاع المربع؟", choices: ["3", "4", "5", "6"], answer: 1, category: "رياضيات" },
  { question: "كم ناتج 9 × 9؟", choices: ["72", "81", "90", "99"], answer: 1, category: "رياضيات" },

  // ── فنون وأدب ──
  { question: "من هو مؤلف رواية \"البؤساء\"؟", choices: ["شكسبير", "فيكتور هوغو", "تولستوي", "ديكنز"], answer: 1, category: "أدب" },
  { question: "من رسم لوحة \"الموناليزا\"؟", choices: ["بيكاسو", "ليوناردو دافنشي", "فان جوخ", "مايكل أنجلو"], answer: 1, category: "أدب" },
  { question: "من هو شاعر النيل؟", choices: ["أحمد شوقي", "حافظ إبراهيم", "المتنبي", "نزار قباني"], answer: 1, category: "أدب" },
  { question: "من يُلقّب بأمير الشعراء؟", choices: ["المتنبي", "أحمد شوقي", "نزار قباني", "محمود درويش"], answer: 1, category: "أدب" },
  { question: "ما هي جنسية الأديب نجيب محفوظ الحائز على نوبل؟", choices: ["لبناني", "مصري", "سوري", "عراقي"], answer: 1, category: "أدب" },
];

/** Number of questions drawn for a single game round. */
export const QUESTIONS_PER_GAME = 10;

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick a random, shuffled subset of `count` questions for a new game session.
 * Choices order is preserved (answer index stays valid).
 */
export function pickQuestions(count = QUESTIONS_PER_GAME): TriviaQuestion[] {
  return shuffle(TRIVIA_QUESTIONS).slice(0, Math.min(count, TRIVIA_QUESTIONS.length));
}
