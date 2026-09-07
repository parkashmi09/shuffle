/* Live challenges captured from the reference; images are served from /public/games. */
const raw = [
  ["endorphina-end-injazz", "In Jazz", "53014eaf-8782-455d-ad66-929c99ca9373", "#E300FF", "1,200x|₹70.83", "₹42,493.50"],
  ["delulu-candy-chaos", "Candy Chaos", "2c8dd7d1-4b26-4529-b660-8df06860c031", "#ff3c77", "1,000x|₹188.86", "₹75,544.00"],
  ["exco-piranha-bite-club", "Piranha Bite Club", "e5873114-cd80-4d51-8d8b-e885a0110e72", "#ff4a4a", "5,000x|₹94.43", "₹165,252.50"],
  ["exco-piranha-bite-club", "Piranha Bite Club", "e5873114-cd80-4d51-8d8b-e885a0110e72", "#ff4a4a", "2,000x|₹47.22", "₹70,822.50"],
  ["7-rings-mouse-ananza", "Mouse Ananza", "0f3efb39-21d4-43ff-a6c6-e2a040846e48", "#ff39e8", "3,500x|₹18.89", "₹61,379.50"],
  ["7-rings-mouse-ananza", "Mouse Ananza", "0f3efb39-21d4-43ff-a6c6-e2a040846e48", "#ff39e8", "2,500x|₹94.43", "₹94,430.00"],
  ["hacksaw-houndsof-hell-96-4686", "Hounds of Hell", "df47042b-cbfe-42a3-a2d9-d147d8e59846", "#E30015", "8,000x|₹75.55", "₹283,290.00"],
  ["hacksaw-houndsof-hell-96-4686", "Hounds of Hell", "df47042b-cbfe-42a3-a2d9-d147d8e59846", "#E30015", "16,000x|₹18.89", "₹151,088.00"],
  ["n-2-games-fire", "FIRE!", "04799647-29b1-4068-8c7d-21366050730e", "#E95628", "10,000x|₹37.78", "₹188,860.00"],
  ["n-2-games-fire", "FIRE!", "04799647-29b1-4068-8c7d-21366050730e", "#E95628", "20,000x|₹9.45", "₹94,430.00"],
  ["softswiss-clucking-hell", "Clucking Hell", "02630e89-20a0-4b81-b588-1e53a80b2f80", "#EA3323", "3,500x|₹94.43", "₹141,645.00"],
  ["softswiss-clucking-hell", "Clucking Hell", "02630e89-20a0-4b81-b588-1e53a80b2f80", "#EA3323", "4,500x|₹47.22", "₹94,430.00"],
  ["hacksaw-sun-princess", "Sun Princess", "88970783-0a72-4f6e-a38e-3b84748d24f4", "#FE7301", "4,000x|₹94.43", "₹188,860.00"],
  ["hacksaw-sun-princess", "Sun Princess", "88970783-0a72-4f6e-a38e-3b84748d24f4", "#FE7301", "10,000x|₹18.89", "₹94,430.00"],
  ["n-2-games-bust-the-piggy", "Bust The Piggy", "895aaa20-3ff3-4d66-91a1-e1511ad7f2cc", "#fb4cf4", "8,000x|₹18.89", "₹75,544.00"],
  ["n-2-games-bust-the-piggy", "Bust The Piggy", "895aaa20-3ff3-4d66-91a1-e1511ad7f2cc", "#fb4cf4", "12,000x|₹9.45", "₹56,658.00"],
  ["shady-lady-shdla-swoll", "SWOLL", "2ef1a39f-0334-4330-99f8-429a864f8b3c", "#FF950C", "5,000x|₹94.43", "₹188,860.00"],
  ["shady-lady-shdla-swoll", "SWOLL", "2ef1a39f-0334-4330-99f8-429a864f8b3c", "#FF950C", "10,000x|₹9.45", "₹47,215.00"],
  ["shady-lady-shdla-preachtv", "Preach TV", "25395352-da22-4c6f-94a9-17d5487f1273", "#DD0536", "4,000x|₹94.43", "₹188,860.00"],
  ["shady-lady-shdla-preachtv", "Preach TV", "25395352-da22-4c6f-94a9-17d5487f1273", "#DD0536", "6,000x|₹18.89", "₹47,215.00"],
  ["shady-lady-shdla-preachtv", "Preach TV", "25395352-da22-4c6f-94a9-17d5487f1273", "#DD0536", "8,000x|₹9.45", "₹37,772.00"],
  ["shady-lady-shdla-sheeple", "Sheeple", "7320faa7-1402-4747-bc5e-f774da24cbf8", "#83d10a", "4,000x|₹47.22", "₹94,430.00"],
  ["shady-lady-shdla-sheeple", "Sheeple", "7320faa7-1402-4747-bc5e-f774da24cbf8", "#83d10a", "6,000x|₹18.89", "₹47,215.00"],
  ["shady-lady-shdla-sheeple", "Sheeple", "7320faa7-1402-4747-bc5e-f774da24cbf8", "#83d10a", "8,000x|₹9.45", "₹37,772.00"],
];

export const challenges = raw.map(([slug, game, img, color, rule, reward]) => {
  const [multiplier, minBet] = rule.split("|");
  return { slug, game, img: `/games/${img}.webp`, color, multiplier, minBet, reward, creator: "Shuffle" };
});
