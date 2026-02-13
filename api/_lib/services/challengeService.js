const { query, getPool } = require('../db');

// YDS Gerçek Sınav Soru Dağılımı (80 soru toplam)
const YDS_DISTRIBUTION = {
    'Tenses': 8,
    'Modals': 4,
    'If Clauses': 6,
    'Passive': 8,
    'Noun Clauses': 6,
    'Relative Clauses': 7,
    'Reductions': 3,
    'Nouns': 5,
    'Adjectives & Adverbs': 5,
    'Conjunctions': 6,
    'Gerunds & Infinitives': 6,
    'Grammar Revision': 16
};

const BASE_POINTS = 100;
const STREAK_BONUS = 10;
const MAX_SPEED_BONUS = 50;
const SPEED_BONUS_TIME = 10000;

const BADGES = {
    'first_win': { name: 'İlk Galibiyet', icon: '🏆', description: 'İlk challenge kazanımı' },
    'streak_5': { name: '5 Streak', icon: '🔥', description: '5 üst üste doğru cevap' },
    'streak_10': { name: '10 Streak', icon: '💥', description: '10 üst üste doğru cevap' },
    'streak_20': { name: 'Streak Ustası', icon: '⚡', description: '20 üst üste doğru cevap' },
    'games_10': { name: 'Deneyimli', icon: '🎮', description: '10 oyun tamamlandı' },
    'games_50': { name: 'Veteran', icon: '🎖️', description: '50 oyun tamamlandı' },
    'games_100': { name: 'Efsane', icon: '👑', description: '100 oyun tamamlandı' },
    'perfect_game': { name: 'Mükemmel Oyun', icon: '💎', description: 'Hiç hata yapmadan oyun bitirme' },
    'speed_demon': { name: 'Hız Şeytanı', icon: '⚡', description: '5 saniyede doğru cevap' },
    'social_butterfly': { name: 'Sosyal Kelebek', icon: '🦋', description: '10 arkadaş edinme' },
    'yds_master': { name: 'YDS Ustası', icon: '📚', description: 'Tam YDS simülasyonu kazanma' },
    'elo_1200': { name: 'Bronz', icon: '🥉', description: '1200 ELO puanına ulaşma' },
    'elo_1500': { name: 'Gümüş', icon: '🥈', description: '1500 ELO puanına ulaşma' },
    'elo_1800': { name: 'Altın', icon: '🥇', description: '1800 ELO puanına ulaşma' }
};

const ROOM_TEMPLATES = {
    'grammar-basics': {
        name: 'Gramer Temelleri',
        categories: ['Tenses', 'Modals', 'If Clauses'],
        questionCount: 15
    },
    'advanced-grammar': {
        name: 'İleri Gramer',
        categories: ['Noun Clauses', 'Relative Clauses', 'Reductions'],
        questionCount: 20
    },
    'vocabulary-focus': {
        name: 'Kelime Odaklı',
        categories: ['Nouns', 'Adjectives & Adverbs', 'Conjunctions'],
        questionCount: 20
    },
    'quick-practice': {
        name: 'Hızlı Pratik',
        categories: ['Tenses', 'Passive'],
        questionCount: 10,
        timeLimit: 30
    }
};

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function calculatePoints(isCorrect, answerTimeMs, currentStreak, scoringMode) {
    if (!isCorrect) return 0;
    
    if (scoringMode === 'normal') {
        return BASE_POINTS;
    }
    
    let points = BASE_POINTS;
    points += currentStreak * STREAK_BONUS;
    
    if (answerTimeMs && answerTimeMs < SPEED_BONUS_TIME) {
        const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - answerTimeMs / SPEED_BONUS_TIME));
        points += speedBonus;
    }
    
    return points;
}

async function awardBadge(userId, badgeId) {
    try {
        await query(
            'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, badgeId]
        );
        return true;
    } catch (error) {
        console.error('Award badge error:', error);
        return false;
    }
}

async function updateEloRatings(winnerId, loserId) {
    const K = 32;
    
    try {
        const winner = await query('SELECT elo_rating FROM challenge_stats WHERE user_id = $1', [winnerId]);
        const loser = await query('SELECT elo_rating FROM challenge_stats WHERE user_id = $1', [loserId]);
        
        const winnerElo = winner.rows[0]?.elo_rating || 1000;
        const loserElo = loser.rows[0]?.elo_rating || 1000;
        
        const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
        
        const newWinnerElo = Math.round(winnerElo + K * (1 - expectedWinner));
        const newLoserElo = Math.round(loserElo + K * (0 - expectedLoser));
        
        await query(
            'UPDATE challenge_stats SET elo_rating = $1, updated_at = NOW() WHERE user_id = $2',
            [newWinnerElo, winnerId]
        );
        await query(
            'UPDATE challenge_stats SET elo_rating = $1, updated_at = NOW() WHERE user_id = $2',
            [Math.max(100, newLoserElo), loserId]
        );

        if (newWinnerElo >= 1200) await awardBadge(winnerId, 'elo_1200');
        if (newWinnerElo >= 1500) await awardBadge(winnerId, 'elo_1500');
        if (newWinnerElo >= 1800) await awardBadge(winnerId, 'elo_1800');
        
    } catch (error) {
        console.error('Update ELO error:', error);
    }
}

async function finishGame(roomId) {
    try {
        await query(`
            UPDATE challenge_rooms SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [roomId]);

        const participants = await query(`
            SELECT user_id, total_correct, total_wrong, score, max_streak
            FROM room_participants WHERE room_id = $1 AND user_id IS NOT NULL
            ORDER BY score DESC
        `, [roomId]);

        for (const p of participants.rows) {
            const isWinner = p === participants.rows[0] && participants.rows.length > 1;
            const isPerfect = p.total_wrong === 0 && p.total_correct > 0;

            await query(`
                INSERT INTO challenge_stats (user_id, total_games, total_wins, total_points, highest_streak)
                VALUES ($1, 1, $2, $3, $4)
                ON CONFLICT (user_id) DO UPDATE SET
                    total_games = challenge_stats.total_games + 1,
                    total_wins = challenge_stats.total_wins + $2,
                    total_points = challenge_stats.total_points + $3,
                    highest_streak = GREATEST(challenge_stats.highest_streak, $4),
                    updated_at = CURRENT_TIMESTAMP
            `, [p.user_id, isWinner ? 1 : 0, p.score || 0, p.max_streak || 0]);

            if (isWinner) await awardBadge(p.user_id, 'first_win');
            if (isPerfect) await awardBadge(p.user_id, 'perfect_game');

            const stats = await query('SELECT total_games FROM challenge_stats WHERE user_id = $1', [p.user_id]);
            const totalGames = stats.rows[0]?.total_games || 0;
            if (totalGames >= 10) await awardBadge(p.user_id, 'games_10');
            if (totalGames >= 50) await awardBadge(p.user_id, 'games_50');
            if (totalGames >= 100) await awardBadge(p.user_id, 'games_100');
        }

        if (participants.rows.length >= 2 && participants.rows[0].user_id && participants.rows[1].user_id) {
            await updateEloRatings(participants.rows[0].user_id, participants.rows[1].user_id);
        }
    } catch (error) {
        console.error('Finish game error:', error);
    }
}

module.exports = {
    YDS_DISTRIBUTION,
    BADGES,
    ROOM_TEMPLATES,
    generateRoomCode,
    calculatePoints,
    awardBadge,
    updateEloRatings,
    finishGame
};
