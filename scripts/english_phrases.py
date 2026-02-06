"""
Kapsamlı İngilizce çok kelimeli ifade sözlüğü
YDS/YÖKDİL sınavlarında sıkça karşılaşılan phrasal verbs, collocations,
prepositional phrases, conjunctions ve fixed expressions.

Frekans analizinde bu ifadeler tek birim olarak sayılır.
"""

# ============================================================
# PHRASAL VERBS (600+)
# ============================================================
PHRASAL_VERBS = [
    # A
    "account for", "act on", "act out", "add up", "add up to",
    "agree on", "agree with", "aim at", "allow for",
    "amount to", "appeal to", "apply for", "apply to",
    "approve of", "argue about", "argue with", "arise from",
    "ask for", "ask out",
    # B
    "back down", "back off", "back out", "back up",
    "base on", "bear in mind", "bear out", "bear with",
    "belong to", "benefit from", "blow out", "blow up",
    "boil down to", "break away", "break down", "break in",
    "break into", "break off", "break out", "break through",
    "break up", "bring about", "bring back", "bring down",
    "bring forward", "bring in", "bring on", "bring out",
    "bring up", "brush up on", "build on", "build up",
    "bump into", "burn down", "burn out", "burst into",
    "burst out",
    # C
    "call for", "call off", "call on", "call out", "call up",
    "calm down", "care about", "care for", "carry on",
    "carry out", "catch on", "catch up", "catch up with",
    "check in", "check out", "check up on", "cheer up",
    "clean up", "clear up", "close down", "come about",
    "come across", "come along", "come apart", "come around",
    "come back", "come by", "come down", "come down to",
    "come down with", "come forward", "come from", "come in",
    "come into", "come off", "come on", "come out",
    "come over", "come round", "come through", "come to",
    "come up", "come up against", "come up with",
    "comment on", "commit to", "compare to", "compare with",
    "compensate for", "compete with", "complain about",
    "comply with", "concentrate on", "confide in",
    "conform to", "consent to", "consist of", "contribute to",
    "convert into", "convince of", "cooperate with",
    "cope with", "correspond to", "correspond with",
    "count on", "count out", "crack down on", "cross out",
    "cut back", "cut back on", "cut down", "cut down on",
    "cut in", "cut off", "cut out", "cut up",
    # D
    "deal with", "decide on", "depend on", "derive from",
    "devote to", "die down", "die out", "differ from",
    "dig into", "dispose of", "distinguish between",
    "distinguish from", "do away with", "do without",
    "drag on", "draw on", "draw up", "dream of",
    "dress up", "drive away", "drop by", "drop in",
    "drop off", "drop out", "drop out of", "dwell on",
    # E
    "eat out", "eat up", "elaborate on", "embark on",
    "emerge from", "end up", "engage in", "enter into",
    "escape from", "even out",
    # F
    "face up to", "fall apart", "fall back on", "fall behind",
    "fall down", "fall for", "fall in", "fall off",
    "fall out", "fall through", "fed up with", "feed on",
    "feel like", "figure out", "fill in", "fill out",
    "fill up", "find out", "fit in", "focus on",
    "follow up", "fool around",
    # G
    "get across", "get ahead", "get along", "get along with",
    "get around", "get at", "get away", "get away with",
    "get back", "get back to", "get behind", "get by",
    "get down", "get down to", "get in", "get into",
    "get off", "get on", "get on with", "get out",
    "get out of", "get over", "get rid of", "get round to",
    "get through", "get to", "get together", "get up",
    "get used to", "give away", "give back", "give in",
    "give off", "give out", "give rise to", "give up",
    "give way to", "go about", "go after", "go against",
    "go ahead", "go along with", "go around", "go away",
    "go back", "go beyond", "go by", "go down",
    "go for", "go in for", "go into", "go off",
    "go on", "go out", "go over", "go through",
    "go together", "go under", "go up", "go with",
    "go without", "grow out of", "grow up",
    # H
    "hand down", "hand in", "hand out", "hand over",
    "hang around", "hang on", "hang out", "hang up",
    "happen to", "have to do with", "head for", "hear about",
    "hear from", "hear of", "help out", "hold back",
    "hold on", "hold on to", "hold out", "hold up",
    # I
    "impose on", "indulge in", "insist on", "interfere with",
    "invest in",
    # J
    "join in", "jump at",
    # K
    "keep away", "keep back", "keep down", "keep from",
    "keep off", "keep on", "keep out", "keep to",
    "keep up", "keep up with", "kick off", "knock down",
    "knock out", "know about",
    # L
    "lag behind", "lay down", "lay off", "lay out",
    "lead to", "lean on", "leave behind", "leave out",
    "lend itself to", "let down", "let in", "let off",
    "let out", "lie ahead", "lie behind", "line up",
    "live on", "live up to", "live with", "lock in",
    "lock out", "long for", "look after", "look ahead",
    "look around", "look at", "look back", "look down on",
    "look for", "look forward to", "look in", "look into",
    "look on", "look out", "look out for", "look over",
    "look through", "look up", "look up to",
    # M
    "make for", "make of", "make off", "make out",
    "make up", "make up for", "make use of", "mix up",
    "move in", "move on", "move out",
    # N
    "narrow down",
    # O
    "object to", "occur to", "opt for", "opt out",
    "originate from", "own up",
    # P
    "participate in", "pass away", "pass by", "pass down",
    "pass for", "pass on", "pass out", "pass up",
    "pay attention to", "pay back", "pay for", "pay off",
    "phase out", "pick on", "pick out", "pick up",
    "pile up", "play down", "plug in", "point out",
    "point to", "pop up", "pour in", "prevent from",
    "profit from", "provide for", "pull apart", "pull away",
    "pull back", "pull down", "pull in", "pull off",
    "pull out", "pull over", "pull through", "pull together",
    "pull up", "push ahead", "push for", "put across",
    "put aside", "put away", "put back", "put down",
    "put down to", "put forward", "put in", "put into",
    "put off", "put on", "put out", "put through",
    "put together", "put up", "put up with",
    # R
    "react to", "read up on", "recover from", "refer to",
    "reflect on", "refrain from", "relate to", "rely on",
    "remind of", "resort to", "respond to", "result from",
    "result in", "ring up", "rip off", "rule out",
    "run across", "run away", "run down", "run for",
    "run into", "run off", "run on", "run out",
    "run out of", "run over", "run through", "run up",
    # S
    "save up", "see off", "see through", "see to",
    "sell off", "sell out", "send back", "send for",
    "send off", "send out", "set about", "set aside",
    "set back", "set in", "set off", "set out",
    "set up", "settle down", "settle for", "settle in",
    "settle on", "show off", "show up", "shut down",
    "shut off", "shut out", "shut up", "sign in",
    "sign out", "sign up", "sit back", "sit down",
    "slow down", "sort out", "speak out", "speak up",
    "speed up", "spell out", "split up", "stand by",
    "stand for", "stand out", "stand up", "stand up for",
    "stand up to", "start off", "start out", "start up",
    "stay away", "stay up", "stem from", "step back",
    "step down", "step in", "step up", "stick out",
    "stick to", "stick up for", "stick with", "stir up",
    "stop by", "stumble upon", "subscribe to", "succeed in",
    "suffer from", "sum up", "switch off", "switch on",
    # T
    "take after", "take apart", "take away", "take back",
    "take down", "take in", "take into account",
    "take into consideration", "take off", "take on",
    "take out", "take over", "take part in", "take place",
    "take to", "take up", "talk about", "talk into",
    "talk out of", "talk over", "tear apart", "tear down",
    "tear up", "tell apart", "tell off", "tend to",
    "think about", "think of", "think over", "think through",
    "think up", "throw away", "throw out", "throw up",
    "tie in with", "touch on", "track down", "trade in",
    "try on", "try out", "tune in", "turn around",
    "turn away", "turn back", "turn down", "turn in",
    "turn into", "turn off", "turn on", "turn out",
    "turn over", "turn to", "turn up",
    # U
    "use up",
    # V
    "vote for", "vouch for",
    # W
    "wait for", "wait on", "wake up", "walk away",
    "walk out", "ward off", "warm up", "warn about",
    "wash away", "watch out", "watch out for", "watch over",
    "water down", "wear down", "wear off", "wear out",
    "weigh up", "wipe out", "work on", "work out",
    "work through", "work up", "worry about", "wrap up",
    "write down", "write off", "write up",
    # Z
    "zero in on",
]

# ============================================================
# PREPOSITIONAL PHRASES & FIXED EXPRESSIONS (300+)
# ============================================================
PREPOSITIONAL_PHRASES = [
    # A
    "a great deal of", "a large number of", "a number of",
    "a variety of", "a wide range of", "above all",
    "according to", "ahead of", "along with", "apart from",
    "as a consequence", "as a consequence of", "as a matter of fact",
    "as a result", "as a result of", "as far as",
    "as for", "as if", "as long as", "as opposed to",
    "as regards", "as soon as", "as though", "as well",
    "as well as", "aside from", "at all costs", "at all times",
    "at any rate", "at first", "at first glance", "at hand",
    "at large", "at last", "at least", "at length",
    "at most", "at once", "at present", "at risk",
    "at stake", "at the expense of", "at the mercy of",
    "at the same time", "at times",
    # B
    "because of", "before long", "beyond doubt",
    "by accident", "by all means", "by and large",
    "by chance", "by contrast", "by far", "by means of",
    "by no means", "by the time", "by virtue of",
    "by way of",
    # D
    "due to",
    # E
    "each other", "even if", "even so", "even though",
    "ever since",
    # F
    "far from", "first of all", "for example",
    "for fear of", "for good", "for instance",
    "for lack of", "for the most part", "for the purpose of",
    "for the sake of", "for the time being", "from now on",
    "from time to time",
    # I
    "if only", "in a nutshell", "in a sense", "in a way",
    "in accordance with", "in addition", "in addition to",
    "in advance", "in any case", "in brief", "in case",
    "in case of", "in charge of", "in common",
    "in comparison to", "in comparison with", "in conclusion",
    "in conjunction with", "in contrast", "in contrast to",
    "in danger of", "in detail", "in effect", "in essence",
    "in exchange for", "in fact", "in favor of",
    "in favour of", "in front of", "in general",
    "in keeping with", "in light of", "in line with",
    "in need of", "in no way", "in order that",
    "in order to", "in other words", "in particular",
    "in place of", "in practice", "in proportion to",
    "in pursuit of", "in reality", "in regard to",
    "in relation to", "in response to", "in return",
    "in return for", "in search of", "in short",
    "in so far as", "in spite of", "in support of",
    "in terms of", "in that", "in the absence of",
    "in the course of", "in the end", "in the event of",
    "in the face of", "in the first place",
    "in the hope of", "in the light of",
    "in the long run", "in the meantime",
    "in the midst of", "in the process of",
    "in the same way", "in the wake of", "in theory",
    "in this regard", "in time", "in touch with",
    "in turn", "in vain", "in view of",
    "instead of", "irrespective of",
    # L
    "last but not least", "little by little",
    # M
    "more or less",
    # N
    "needless to say", "next to", "no doubt",
    "no longer", "no matter", "no sooner",
    "not only", "now and then", "now that",
    # O
    "of course", "on account of", "on average",
    "on behalf of", "on condition that", "on no account",
    "on occasion", "on one hand", "on purpose",
    "on the basis of", "on the brink of",
    "on the contrary", "on the grounds that",
    "on the one hand", "on the other hand",
    "on the verge of", "on the whole", "on time",
    "on top of", "once again", "once in a while",
    "one another", "only if", "other than",
    "out of", "out of date", "out of order",
    "out of place", "out of reach", "out of sight",
    "out of the question", "over and over", "over time",
    "owing to",
    # P
    "prior to", "provided that", "providing that",
    # R
    "rather than", "regardless of", "right away",
    # S
    "so as to", "so far", "so long as", "so much so that",
    "so that", "sooner or later", "such as",
    # T
    "thanks to", "the more the more", "the sooner the better",
    "to a certain extent", "to a great extent",
    "to a large extent", "to begin with",
    "to date", "to some extent", "to the extent that",
    "to this end",
    # U
    "under no circumstances", "unless otherwise",
    "up to", "up to date",
    # W
    "what is more", "whether or not", "with a view to",
    "with reference to", "with regard to",
    "with respect to", "with the exception of",
    "with the help of", "without a doubt",
    "without doubt",
]

# ============================================================
# CONJUNCTIONS & LINKING EXPRESSIONS (100+)
# ============================================================
CONJUNCTIONS_LINKERS = [
    "after all", "all in all", "all the same",
    "and yet", "as a whole", "as it were",
    "at any rate", "by comparison", "by the same token",
    "conversely", "equally important",
    "even now", "first and foremost",
    "for all that", "for this reason",
    "furthermore", "given that", "hence",
    "however", "in any event", "in brief",
    "in contrast", "in either case",
    "in much the same way", "in summary",
    "in the first place", "in the second place",
    "inasmuch as", "indeed",
    "just as", "likewise",
    "more importantly", "moreover",
    "much less", "nevertheless",
    "nonetheless", "not to mention",
    "notwithstanding", "on balance",
    "on that account", "on the whole",
    "otherwise", "overall",
    "similarly", "still",
    "that being said", "that is to say",
    "thereby", "therefore", "thus",
    "to put it another way", "to sum up",
    "to summarize", "under the circumstances",
    "what is more", "whereas", "whereby",
    "while", "yet",
]

# ============================================================
# ACADEMIC / YDS COLLOCATIONS (200+)
# ============================================================
ACADEMIC_COLLOCATIONS = [
    # Verb + Noun
    "achieve success", "address the issue", "adopt a policy",
    "bear in mind", "break the law", "bridge the gap",
    "cause damage", "cause harm", "come to a conclusion",
    "come to terms with", "conduct research",
    "draw a conclusion", "draw attention to",
    "exert influence", "face challenges",
    "gain access", "gain experience", "gain insight",
    "have an effect", "have an impact",
    "impose restrictions", "keep pace with",
    "lay the foundation", "lose sight of",
    "make a contribution", "make a decision",
    "make a distinction", "make an effort",
    "make progress", "make sense", "make sure",
    "meet the needs", "pay attention",
    "place emphasis", "play a key role",
    "play a role", "play a vital role",
    "pose a threat", "put pressure on",
    "raise awareness", "raise concerns",
    "reach a conclusion", "reach an agreement",
    "run the risk", "serve a purpose",
    "set a precedent", "set an example",
    "shed light on", "shift the focus",
    "solve a problem", "take a step",
    "take account of", "take action",
    "take advantage of", "take care of",
    "take effect", "take measures",
    "take note of", "take responsibility",
    "take steps", "take the initiative",
    "undergo changes",
    # Adjective + Noun
    "adverse effect", "broad range", "common ground",
    "considerable amount", "crucial role",
    "dire consequences", "drastic measures",
    "far reaching", "far-reaching consequences",
    "growing concern", "harsh criticism",
    "heated debate", "heavy reliance",
    "high priority", "key factor", "key role",
    "lasting impact", "major concern",
    "mutual benefit", "narrow margin",
    "ongoing debate", "overwhelming majority",
    "profound effect", "profound impact",
    "rapid growth", "sharp decline",
    "significant impact", "significant role",
    "stark contrast", "steady decline",
    "steep rise", "striking resemblance",
    "strong correlation", "substantial evidence",
    "unprecedented growth", "vast majority",
    "vicious circle", "vital role",
    "wide range", "widespread concern",
    # Adverb + Adjective / Verb
    "deeply rooted", "closely related",
    "directly proportional", "entirely dependent",
    "firmly established", "fundamentally different",
    "greatly influenced", "heavily dependent",
    "highly likely", "highly unlikely",
    "increasingly important", "inherently flawed",
    "inextricably linked", "mutually exclusive",
    "particularly noteworthy", "predominantly used",
    "primarily concerned", "profoundly affected",
    "readily available", "significantly higher",
    "solely responsible", "strongly associated",
    "widely accepted", "widely believed",
    "widely known", "widely recognized",
    "widely regarded", "widely used",
]

# ============================================================
# STOP WORDS (filtrelenecek tekil kelimeler)
# ============================================================
STOP_WORDS = {
    # Articles & Determiners
    "a", "an", "the", "this", "that", "these", "those",
    "my", "your", "his", "her", "its", "our", "their",
    "some", "any", "no", "every", "each", "all", "both",
    "few", "several", "many", "much", "more", "most",
    "other", "another", "such",
    # Pronouns
    "i", "me", "we", "us", "you", "he", "him", "she",
    "it", "they", "them", "myself", "yourself", "himself",
    "herself", "itself", "ourselves", "themselves",
    "who", "whom", "whose", "which", "what", "whoever",
    "whatever", "whichever",
    # Be verbs
    "am", "is", "are", "was", "were", "be", "been", "being",
    # Auxiliary / Modal
    "have", "has", "had", "having",
    "do", "does", "did", "doing", "done",
    "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    "need", "dare", "ought",
    # Prepositions (tek başına anlamsız olanlar)
    "in", "on", "at", "to", "for", "with", "from",
    "by", "of", "about", "into", "through", "during",
    "before", "after", "above", "below", "between",
    "under", "over", "up", "down", "out", "off",
    "against", "along", "around", "among", "within",
    "without", "upon", "toward", "towards", "across",
    "behind", "beside", "besides", "beyond", "near",
    "since", "until", "till", "throughout", "past",
    # Conjunctions (tek başına)
    "and", "but", "or", "nor", "so", "yet", "for",
    "if", "when", "while", "as", "than", "that",
    "because", "although", "though", "unless", "since",
    "where", "whether", "how",
    # Common adverbs
    "not", "very", "also", "just", "only", "then",
    "now", "here", "there", "too", "quite", "rather",
    "already", "still", "always", "never", "often",
    "sometimes", "usually", "ever", "soon", "ago",
    "well", "back", "even", "again",
    # Others
    "one", "two", "first", "second", "new",
    "like", "way", "thing", "things",
    "get", "got", "make", "made",
    "go", "went", "gone", "come", "came",
    "say", "said", "tell", "told",
    "know", "knew", "known", "think", "thought",
    "see", "saw", "seen", "look", "looked",
    "want", "wanted", "give", "gave", "given",
    "use", "used", "find", "found",
    "take", "took", "taken", "put",
    "let", "keep", "kept", "begin", "began",
    "seem", "seemed", "help", "show", "showed",
    "hear", "heard", "turn", "turned",
    "start", "started", "might", "try", "tried",
    "leave", "left", "call", "called",
    # Question words & misc
    "mr", "mrs", "ms", "dr", "etc", "eg", "ie",
    "vs", "p", "s", "t", "d", "ll", "ve", "re",
    "don", "doesn", "didn", "won", "wouldn", "couldn",
    "shouldn", "isn", "aren", "wasn", "weren", "hasn",
    "haven", "hadn",
    # Blank/fill markers
    "____", "___", "__", "_", "...", "..", "blank",
    # Roman numerals & numbering
    "ii", "iii", "iv", "vi", "vii", "viii", "ix", "xi",
    "xii", "xiii", "xiv", "xv",
    # Turkish leak words (question_tr / explanation_tr sızıntısı)
    "bir", "ve", "bu", "da", "de", "ile", "için", "olan",
    "den", "dan", "dir", "dır", "ise", "gibi", "daha",
    "en", "ya", "ki", "ne", "mi", "mu", "mı",
    "olarak", "kadar", "sonra", "önce", "ancak", "ama",
    "hem", "çok", "var", "yok", "olan", "olduğu",
    "etmek", "etme", "eden", "eder", "etti",
    "olan", "olduğunu", "olması", "olduğu",
    "değil", "aynı", "diğer", "her", "bazı",
    # Common passage/question markers
    "passage", "question", "following", "sentence",
    "answer", "correct", "choose", "best", "complete",
    "fill", "appropriate", "suitable", "given",
    "according", "paragraph", "text", "statement",
    "option", "options", "below", "above",
    "underlined", "meaning", "closest",
}


def get_all_phrases():
    """Tüm çok kelimeli ifadeleri birleşik set olarak döndür (lowercase)"""
    all_phrases = set()
    for phrase_list in [PHRASAL_VERBS, PREPOSITIONAL_PHRASES, 
                        CONJUNCTIONS_LINKERS, ACADEMIC_COLLOCATIONS]:
        for phrase in phrase_list:
            all_phrases.add(phrase.lower().strip())
    return all_phrases


def get_phrases_by_length():
    """İfadeleri kelime sayısına göre grupla (uzundan kısaya sıralı)"""
    all_phrases = get_all_phrases()
    by_length = {}
    for phrase in all_phrases:
        word_count = len(phrase.split())
        if word_count not in by_length:
            by_length[word_count] = set()
        by_length[word_count].add(phrase)
    return by_length


def get_stop_words():
    """Stop words setini döndür"""
    return STOP_WORDS
