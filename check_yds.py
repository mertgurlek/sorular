import json

with open('yds_questions/yds_all_categories.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

questions = d['questions']
valid = sum(1 for q in questions if q.get('correct_answer'))
print(f'Total: {len(questions)}, Valid (with answer): {valid}, No answer: {len(questions)-valid}')

# Show categories breakdown
from collections import Counter
cats = Counter(q.get('category', 'Unknown') for q in questions if q.get('correct_answer'))
print('\nCategories with valid answers:')
for cat, count in cats.most_common():
    print(f'  {cat}: {count}')
