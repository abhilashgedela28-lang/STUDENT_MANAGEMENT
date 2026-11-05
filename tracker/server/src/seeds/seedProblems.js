const Problem = require('../models/Problem');

const starterProblems = [
  // 10 LeetCode problems
  {
    platform: 'LEETCODE',
    externalId: 'two-sum',
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Table'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'valid-parentheses',
    title: 'Valid Parentheses',
    url: 'https://leetcode.com/problems/valid-parentheses/',
    difficulty: 'Easy',
    topics: ['String', 'Stack'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    url: 'https://leetcode.com/problems/merge-two-sorted-lists/',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    difficulty: 'Easy',
    topics: ['Array', 'Dynamic Programming'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'valid-anagram',
    title: 'Valid Anagram',
    url: 'https://leetcode.com/problems/valid-anagram/',
    difficulty: 'Easy',
    topics: ['Hash Table', 'String', 'Sorting'],
  },
  {
    platform: 'LEETCODE',
    externalId: '3sum',
    title: '3Sum',
    url: 'https://leetcode.com/problems/3sum/',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Sorting'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'container-with-most-water',
    title: 'Container With Most Water',
    url: 'https://leetcode.com/problems/container-with-most-water/',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Greedy'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'group-anagrams',
    title: 'Group Anagrams',
    url: 'https://leetcode.com/problems/group-anagrams/',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'String', 'Sorting'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'longest-consecutive-sequence',
    title: 'Longest Consecutive Sequence',
    url: 'https://leetcode.com/problems/longest-consecutive-sequence/',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'Union Find'],
  },
  {
    platform: 'LEETCODE',
    externalId: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    url: 'https://leetcode.com/problems/trapping-rain-water/',
    difficulty: 'Hard',
    topics: ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack'],
  },

  // 10 Codeforces problems
  {
    platform: 'CODEFORCES',
    externalId: '4A',
    title: 'Watermelon',
    url: 'https://codeforces.com/problemset/problem/4/A',
    difficulty: 'Easy (800)',
    topics: ['brute force', 'math'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '71A',
    title: 'Way Too Long Words',
    url: 'https://codeforces.com/problemset/problem/71/A',
    difficulty: 'Easy (800)',
    topics: ['strings'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '231A',
    title: 'Team',
    url: 'https://codeforces.com/problemset/problem/231/A',
    difficulty: 'Easy (800)',
    topics: ['brute force', 'greedy'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '158A',
    title: 'Next Round',
    url: 'https://codeforces.com/problemset/problem/158/A',
    difficulty: 'Easy (800)',
    topics: ['special problem', 'implementation'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '282A',
    title: 'Bit++',
    url: 'https://codeforces.com/problemset/problem/282/A',
    difficulty: 'Easy (800)',
    topics: ['implementation'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '112A',
    title: 'Petya and Strings',
    url: 'https://codeforces.com/problemset/problem/112/A',
    difficulty: 'Easy (800)',
    topics: ['implementation', 'strings'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '339A',
    title: 'Helpful Maths',
    url: 'https://codeforces.com/problemset/problem/339/A',
    difficulty: 'Easy (800)',
    topics: ['greedy', 'implementation', 'sortings', 'strings'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '266A',
    title: 'Stones on the Table',
    url: 'https://codeforces.com/problemset/problem/266/A',
    difficulty: 'Easy (800)',
    topics: ['implementation'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '1A',
    title: 'Theatre Square',
    url: 'https://codeforces.com/problemset/problem/1/A',
    difficulty: 'Medium (1000)',
    topics: ['math'],
  },
  {
    platform: 'CODEFORCES',
    externalId: '4C',
    title: 'Registration system',
    url: 'https://codeforces.com/problemset/problem/4/C',
    difficulty: 'Medium (1300)',
    topics: ['data structures', 'hashing', 'implementation'],
  },
];

async function seedStarterProblems() {
  const count = await Problem.countDocuments();
  if (count === 0) {
    console.log('[Problem Seeding] Seeding 20 starter problems (10 LeetCode, 10 Codeforces)...');
    for (const prob of starterProblems) {
      await Problem.findOneAndUpdate(
        { platform: prob.platform, externalId: prob.externalId },
        { ...prob, active: true },
        { upsert: true }
      );
    }
    console.log('[Problem Seeding] 20 starter problems seeded successfully.');
  }
}

module.exports = { seedStarterProblems, starterProblems };
