
// YDS Sınav Dağılımı - Gerçek YDS formatına göre
const YDS_DISTRIBUTION = {
    'mini': {  // 20 soru
        'YDS Kelime Soruları': 3,
        'YDS Gramer': 3,
        'YDS Cümle Tamamlama': 3,
        'YDS Çeviri Soruları': 3,
        'YDS Diyalog': 1,
        'YDS Paragraf Doldurma': 1,
        'YDS İlgisiz Cümleyi Bulma': 1,
        'YDS Reading Passages': 4,
        'YDS Eş Anlam': 1
    },
    'medium': {  // 40 soru
        'YDS Kelime Soruları': 5,
        'YDS Gramer': 5,
        'YDS Cümle Tamamlama': 5,
        'YDS Çeviri Soruları': 6,
        'YDS Diyalog': 3,
        'YDS Paragraf Doldurma': 3,
        'YDS İlgisiz Cümleyi Bulma': 3,
        'YDS Reading Passages': 8,
        'YDS Eş Anlam': 2
    },
    'full': {  // 80 soru - Gerçek YDS
        'YDS Kelime Soruları': 10,
        'YDS Gramer': 10,
        'YDS Cümle Tamamlama': 10,
        'YDS Çeviri Soruları': 12,
        'YDS Diyalog': 5,
        'YDS Paragraf Doldurma': 5,
        'YDS İlgisiz Cümleyi Bulma': 5,
        'YDS Reading Passages': 18,
        'YDS Eş Anlam': 5
    }
};

// Kategori eşleştirmeleri (DB kategorileri -> YDS kategorileri)
const CATEGORY_MAPPING = {
    'YDS Kelime Soruları': ['YDS Kelime Soruları'],
    'YDS Gramer': ['YDS Gramer', 'Grammar Revision'],
    'YDS Cümle Tamamlama': ['YDS Cümle Tamamlama'],
    'YDS Çeviri Soruları': ['YDS Çeviri Soruları'],
    'YDS Diyalog': ['YDS Diyalog'],
    'YDS Paragraf Doldurma': ['YDS Paragraf Doldurma'],
    'YDS İlgisiz Cümleyi Bulma': ['YDS İlgisiz Cümleyi Bulma'],
    'YDS Reading Passages': ['YDS Reading Passages', 'YDS Okuma Soruları'],
    'YDS Eş Anlam': ['YDS Eş Anlam', 'YDS Durum']
};

// Gerçek YDS dağılımına göre soru seç
function selectQuestionsWithYDSDistribution(allQuestions, examSize = 'full') {
    const distribution = YDS_DISTRIBUTION[examSize];
    const selectedQuestions = [];
    
    // Her YDS kategorisi için soruları grupla
    const questionsByCategory = {};
    
    for (const [ydsCategory, dbCategories] of Object.entries(CATEGORY_MAPPING)) {
        questionsByCategory[ydsCategory] = allQuestions.filter(q => 
            dbCategories.some(dbCat => q.category === dbCat || q.category?.includes(dbCat))
        );
    }
    
    // Dağılıma göre seç
    for (const [category, count] of Object.entries(distribution)) {
        const available = questionsByCategory[category] || [];
        const shuffled = shuffleArray([...available]);
        const selected = shuffled.slice(0, count);
        selectedQuestions.push(...selected);
    }
    
    // Eksik varsa diğer sorulardan tamamla
    const targetCount = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (selectedQuestions.length < targetCount) {
        const selectedIds = new Set(selectedQuestions.map(q => q.id));
        const remaining = allQuestions.filter(q => !selectedIds.has(q.id));
        const shuffledRemaining = shuffleArray([...remaining]);
        const needed = targetCount - selectedQuestions.length;
        selectedQuestions.push(...shuffledRemaining.slice(0, needed));
    }
    
    // Son karıştırma
    return shuffleArray(selectedQuestions);
}
