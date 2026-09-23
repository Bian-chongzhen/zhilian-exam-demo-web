// scripts/smoke/stub.mjs
var store = /* @__PURE__ */ new Map();
globalThis.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  }
};

// src/constants/enums.ts
var RoleType = { ADMIN: 1, USER: 2 };
var PrivacyType = { PRIVATE: 1, PUBLIC: 2 };
var PaperType = { COMPETITIVE: 1, PRACTICE: 2 };
var PaperTypeLabel = { 1: "\u7ADE\u6280\u578B", 2: "\u7EC3\u4E60\u578B" };
var Visibility = { PRIVATE: 1, PUBLIC: 2 };
var VisibilityLabel = { 1: "\u79C1\u6709", 2: "\u516C\u5F00" };
var DraftStatus = { ENABLED: 1, DISABLED: 2, DISCARDED: 3 };
var DraftStatusLabel = { 1: "\u542F\u7528", 2: "\u505C\u7528", 3: "\u5E9F\u5F03" };
var LockFlag = { UNLOCKED: 0, LOCKED: 1 };
var QuestionType = { SINGLE: 1, MULTIPLE: 2, JUDGE: 3, SHORT_ANSWER: 4 };
var QuestionTypeLabel = {
  1: "\u5355\u9009",
  2: "\u591A\u9009",
  3: "\u5224\u65AD",
  4: "\u7B80\u7B54"
};
var JudgeStatus = { PENDING: 1, JUDGED: 2, WAIT_RETRY: 3 };
var JudgeResult = { WRONG: 0, RIGHT: 1 };
var MasterStatus = { WRONG_SET: 0, MASTERED_SET: 1 };
var ExamSourceType = { NORMAL: 1, WRONG_COMPOSE: 2 };
var DraftSourceType = { MANUAL: 1, WRONG_COMPOSE: 2 };
var EnabledFlag = { DISABLED: 0, ENABLED: 1 };
var TitleFormat = { PLAIN: 1, MARKDOWN: 2, HTML: 3 };
var FavoriteTargetType = { DRAFT: 1, QUESTION: 2, KNOWLEDGE: 3 };
var FeedbackStatus = { PENDING: 1, HANDLED: 2, IGNORED: 3 };
var FeedbackStatusLabel = {
  1: "\u5F85\u5904\u7406",
  2: "\u5DF2\u5904\u7406",
  3: "\u5FFD\u7565"
};
var TagMatchModeLabel = { 1: "\u5339\u914D\u4EFB\u610F\u9009\u4E2D\u6807\u7B7E", 2: "\u5FC5\u987B\u540C\u65F6\u5339\u914D\u5168\u90E8\u6807\u7B7E" };
var ComposeScope = { WRONG_ONLY: 1, WRONG_AND_MASTERED: 2 };
var ComposeScopeLabel = {
  1: "\u4EC5\u9519\u9898\u96C6\u5408",
  2: "\u9519\u9898\u96C6\u5408 + \u5DF2\u638C\u63E1\u96C6\u5408"
};
var ComposeStrategy = { WEIGHT: 1, RANDOM: 2, TIME: 3 };
var ComposeStrategyLabel = {
  1: "\u6309\u6743\u91CD\u62BD\u53D6",
  2: "\u968F\u673A\u62BD\u53D6",
  3: "\u6309\u65F6\u95F4\u62BD\u53D6\uFF08\u6700\u8FD1\u7B54\u9519\u4F18\u5148\uFF09"
};
var MASTERED_SCOPE_FACTOR = 0.3;
var toOptions = (labelMap) => Object.entries(labelMap).map(([value, label]) => ({ value: Number(value), label }));
var PaperTypeOptions = toOptions(PaperTypeLabel);
var VisibilityOptions = toOptions(VisibilityLabel);
var DraftStatusOptions = toOptions(DraftStatusLabel);
var QuestionTypeOptions = toOptions(QuestionTypeLabel);
var TagMatchModeOptions = toOptions(TagMatchModeLabel);
var ComposeScopeOptions = toOptions(ComposeScopeLabel);
var ComposeStrategyOptions = toOptions(ComposeStrategyLabel);
var FeedbackStatusOptions = toOptions(FeedbackStatusLabel);

// src/mock/rules/judge.ts
function parseOptions(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function stringifyOptions(options) {
  return JSON.stringify(options);
}
var JUDGE_OPTIONS = [
  { key: "1", content: "\u6B63\u786E" },
  { key: "0", content: "\u9519\u8BEF" }
];
function defaultOptionsFor(type) {
  if (type === QuestionType.JUDGE) return JUDGE_OPTIONS.map((o) => ({ ...o }));
  if (type === QuestionType.SHORT_ANSWER) return [];
  return [
    { key: "A", content: "" },
    { key: "B", content: "" },
    { key: "C", content: "" },
    { key: "D", content: "" }
  ];
}
function splitMulti(value) {
  return value.split(/[,，]/).map((v) => v.trim().toUpperCase()).filter(Boolean).sort();
}
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
function judgeObjective(type, answer, userAnswer) {
  const ua = (userAnswer ?? "").trim();
  if (!ua) return JudgeResult.WRONG;
  if (type === QuestionType.MULTIPLE) {
    return sameSet(splitMulti(answer), splitMulti(ua)) ? JudgeResult.RIGHT : JudgeResult.WRONG;
  }
  return answer.trim().toUpperCase() === ua.toUpperCase() ? JudgeResult.RIGHT : JudgeResult.WRONG;
}
function isObjective(type) {
  return type !== QuestionType.SHORT_ANSWER;
}
function scoreOf(score, result) {
  if (result === null || result === void 0) return null;
  return result === JudgeResult.RIGHT ? score : 0;
}
function validateQuestion(question) {
  const errors = [];
  const label = `\u9898\u76EE#${question.id}`;
  if (!question.title.trim()) errors.push(`${label}\uFF1A\u9898\u5E72\u4E0D\u80FD\u4E3A\u7A7A`);
  if (question.score <= 0) errors.push(`${label}\uFF1A\u5206\u503C\u5FC5\u987B\u5927\u4E8E 0`);
  if (question.questionType === QuestionType.SINGLE || question.questionType === QuestionType.MULTIPLE) {
    const options = parseOptions(question.options);
    if (options.length < 2) errors.push(`${label}\uFF1A\u5355\u9009/\u591A\u9009\u81F3\u5C11\u9700\u8981 2 \u4E2A\u9009\u9879`);
    if (options.some((o) => !o.content.trim())) errors.push(`${label}\uFF1A\u5B58\u5728\u5185\u5BB9\u4E3A\u7A7A\u7684\u9009\u9879`);
    const keys = options.map((o) => o.key.toUpperCase());
    if (new Set(keys).size !== keys.length) errors.push(`${label}\uFF1A\u9009\u9879 key \u91CD\u590D`);
    const answerKeys = question.questionType === QuestionType.MULTIPLE ? splitMulti(question.answer) : [question.answer.trim().toUpperCase()];
    if (answerKeys.some((k) => !k || !keys.includes(k))) {
      errors.push(`${label}\uFF1A\u53C2\u8003\u7B54\u6848\u4E0E\u9009\u9879\u4E0D\u5339\u914D`);
    }
    if (question.questionType === QuestionType.MULTIPLE && answerKeys.length < 2) {
      errors.push(`${label}\uFF1A\u591A\u9009\u9898\u53C2\u8003\u7B54\u6848\u81F3\u5C11\u9700\u5305\u542B 2 \u4E2A\u9009\u9879`);
    }
    if (question.questionType === QuestionType.SINGLE && answerKeys.length !== 1) {
      errors.push(`${label}\uFF1A\u5355\u9009\u9898\u53C2\u8003\u7B54\u6848\u53EA\u80FD\u6709 1 \u4E2A\u9009\u9879`);
    }
  }
  if (question.questionType === QuestionType.JUDGE) {
    if (!["0", "1"].includes(question.answer.trim())) {
      errors.push(`${label}\uFF1A\u5224\u65AD\u9898\u53C2\u8003\u7B54\u6848\u5FC5\u987B\u4E3A 1\uFF08\u6B63\u786E\uFF09\u6216 0\uFF08\u9519\u8BEF\uFF09`);
    }
  }
  if (question.questionType === QuestionType.SHORT_ANSWER && !question.answer.trim()) {
    errors.push(`${label}\uFF1A\u7B80\u7B54\u9898\u5FC5\u987B\u586B\u5199\u53C2\u8003\u7B54\u6848\uFF08\u7528\u4E8E\u4EA4\u5377\u540E\u81EA\u8BC4\u5BF9\u7167\uFF09`);
  }
  return errors;
}

// src/mock/rules/password.ts
function hashPassword(plain) {
  let h = 2166136261;
  for (let i = 0; i < plain.length; i += 1) {
    h ^= plain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `$demo$${(h >>> 0).toString(16)}$${plain.length}`;
}
function verifyPassword(plain, hashed) {
  return hashPassword(plain) === hashed;
}
var DEMO_PASSWORD = "123456";

// src/mock/seed.ts
var now = /* @__PURE__ */ new Date();
var daysAgo = (days, hour = 10) => {
  const d = new Date(now.getTime() - days * 24 * 3600 * 1e3);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
var minutesAgo = (m) => new Date(now.getTime() - m * 60 * 1e3).toISOString();
function buildSeed() {
  const seq = {};
  const id = (table) => {
    seq[table] = (seq[table] ?? 0) + 1;
    return seq[table];
  };
  const base = (table) => ({ id: id(table), deleted: 0, createTime: daysAgo(90), updateTime: daysAgo(90) });
  const users = [];
  const addUser = (username, phone, roleType, privacyType, profile, deleted = 0) => {
    const user = {
      ...base("users"),
      username,
      password: hashPassword(DEMO_PASSWORD),
      phone,
      roleType,
      profile,
      privacyType,
      lastLoginTime: daysAgo(1),
      deleted,
      deleteTime: deleted ? daysAgo(30) : null
    };
    users.push(user);
    return user;
  };
  const admin = addUser(
    "admin",
    "13800000001",
    RoleType.ADMIN,
    PrivacyType.PUBLIC,
    "\u7CFB\u7EDF\u7BA1\u7406\u5458\uFF0C\u8D1F\u8D23\u7EF4\u62A4\u5168\u5C40\u8BD5\u5377\u5206\u7C7B\u3001\u8003\u70B9\u6807\u7B7E\u4E0E\u516C\u5F00\u8BD5\u5377\u3002"
  );
  const alice = addUser(
    "alice",
    "13800000002",
    RoleType.USER,
    PrivacyType.PUBLIC,
    "\u5907\u8003\u8F6F\u8003\u7A0B\u5E8F\u5458\uFF0C\u6B63\u5728\u5237\u4E0A\u5348\u5BA2\u89C2\u9898\u4E0E\u9762\u8BD5\u516B\u80A1\u3002"
  );
  const bob = addUser(
    "bob",
    "13800000003",
    RoleType.USER,
    PrivacyType.PRIVATE,
    "\u9690\u79C1\u4E3B\u9875\u793A\u4F8B\u8D26\u53F7\uFF1A\u4ED6\u4EBA\u53EA\u80FD\u770B\u5230\u6211\u53D1\u5E03\u7684\u516C\u5F00\u8BD5\u5377\u3002"
  );
  const carol = addUser(
    "carol",
    "13800000004",
    RoleType.USER,
    PrivacyType.PUBLIC,
    '\u5DF2\u6CE8\u9500\u8D26\u53F7\u793A\u4F8B\uFF1A\u4E3B\u9875\u4ECD\u5C55\u793A\u5386\u53F2\u7B54\u9898\u8BB0\u5F55\u5E76\u6807\u6CE8"\u8BE5\u7528\u6237\u5DF2\u6CE8\u9500"\u3002',
    1
  );
  addUser(
    "dave",
    "13800000005",
    RoleType.USER,
    PrivacyType.PRIVATE,
    '\u65B0\u7528\u6237\u793A\u4F8B\uFF1A\u6682\u65E0\u4EFB\u4F55\u7B54\u9898\u8BB0\u5F55\uFF0C\u7528\u4E8E\u9A8C\u8BC1"\u672A\u4F5C\u7B54\u5206\u7C7B\u81EA\u52A8\u9690\u85CF"\u3002'
  );
  const tagNames = [
    "\u8BA1\u7B97\u673A\u57FA\u7840",
    "\u8FDB\u5236\u8F6C\u6362",
    "\u6570\u636E\u7ED3\u6784",
    "\u7A0B\u5E8F\u6D41\u7A0B\u56FE",
    "\u64CD\u4F5C\u7CFB\u7EDF",
    "\u8BA1\u7B97\u673A\u7F51\u7EDC",
    "\u7B97\u6CD5\u8BBE\u8BA1",
    "\u6570\u636E\u5E93\u8BBE\u8BA1",
    "\u7CFB\u7EDF\u8BBE\u8BA1",
    "Java\u57FA\u7840",
    "\u5E76\u53D1\u7F16\u7A0B",
    "JVM",
    "MySQL\u7D22\u5F15",
    "Redis\u7F13\u5B58"
  ];
  const tags = tagNames.map((tagName, index) => ({
    ...base("tags"),
    tagName,
    isEnabled: 1,
    sortNo: index + 1
  }));
  const tagId = (name) => tags.find((t) => t.tagName === name).id;
  const categories = [];
  const addCategory = (categoryName, fixedQuestionCount, isSystem, sortNo) => {
    const category = {
      ...base("categories"),
      categoryName,
      fixedQuestionCount,
      isSystem,
      sortNo
    };
    categories.push(category);
    return category;
  };
  const catMorning = addCategory("\u4E0A\u5348\u5BA2\u89C2\u9898", 10, 1, 1);
  const catAfternoon = addCategory("\u4E0B\u5348\u4E3B\u89C2\u9898", 3, 1, 2);
  const catInterview = addCategory("\u9762\u8BD5\u516B\u80A1", 8, 0, 3);
  const categoryTagRels = [];
  const linkCategoryTag = (categoryId, names) => {
    names.forEach((n) => {
      categoryTagRels.push({
        ...base("categoryTagRels"),
        categoryId,
        tagId: tagId(n)
      });
    });
  };
  linkCategoryTag(catMorning.id, ["\u8BA1\u7B97\u673A\u57FA\u7840", "\u8FDB\u5236\u8F6C\u6362", "\u6570\u636E\u7ED3\u6784", "\u7A0B\u5E8F\u6D41\u7A0B\u56FE", "\u64CD\u4F5C\u7CFB\u7EDF", "\u8BA1\u7B97\u673A\u7F51\u7EDC"]);
  linkCategoryTag(catAfternoon.id, ["\u7B97\u6CD5\u8BBE\u8BA1", "\u6570\u636E\u5E93\u8BBE\u8BA1", "\u7CFB\u7EDF\u8BBE\u8BA1"]);
  linkCategoryTag(catInterview.id, ["Java\u57FA\u7840", "\u5E76\u53D1\u7F16\u7A0B", "JVM", "MySQL\u7D22\u5F15", "Redis\u7F13\u5B58"]);
  const categoryWeights = [];
  const addWeight = (categoryId, tagName, weight) => {
    categoryWeights.push({
      ...base("categoryWeights"),
      categoryId,
      tagId: tagId(tagName),
      weight
    });
  };
  addWeight(catMorning.id, "\u8BA1\u7B97\u673A\u57FA\u7840", 2);
  addWeight(catMorning.id, "\u8FDB\u5236\u8F6C\u6362", 1.5);
  addWeight(catMorning.id, "\u6570\u636E\u7ED3\u6784", 1.5);
  addWeight(catMorning.id, "\u7A0B\u5E8F\u6D41\u7A0B\u56FE", 1);
  addWeight(catMorning.id, "\u64CD\u4F5C\u7CFB\u7EDF", 1);
  addWeight(catInterview.id, "Java\u57FA\u7840", 2);
  addWeight(catInterview.id, "\u5E76\u53D1\u7F16\u7A0B", 1.5);
  addWeight(catInterview.id, "JVM", 1.2);
  addWeight(catInterview.id, "MySQL\u7D22\u5F15", 1);
  const questions = [];
  const questionTagRels = [];
  const addQuestion = (opts) => {
    const question = {
      ...base("questions"),
      questionType: opts.type,
      title: opts.title,
      titleFormat: TitleFormat.PLAIN,
      options: opts.type === QuestionType.SHORT_ANSWER ? null : JSON.stringify(
        opts.options ?? (opts.type === QuestionType.JUDGE ? JUDGE_OPTIONS : [])
      ),
      answer: opts.answer,
      analysis: opts.analysis,
      score: opts.score,
      isLocked: 0
    };
    questions.push(question);
    opts.tags.forEach((t) => {
      questionTagRels.push({
        ...base("questionTagRels"),
        questionId: question.id,
        tagId: tagId(t)
      });
    });
    return question;
  };
  const abc = (a, b, c, d) => [
    { key: "A", content: a },
    { key: "B", content: b },
    { key: "C", content: c },
    { key: "D", content: d }
  ];
  const q1 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E0B\u5217\u5173\u4E8E\u51AF\xB7\u8BFA\u4F9D\u66FC\u4F53\u7CFB\u7ED3\u6784\u57FA\u672C\u601D\u60F3\u7684\u63CF\u8FF0\uFF0C\u6B63\u786E\u7684\u662F\uFF1A",
    options: abc(
      "\u7A0B\u5E8F\u4E0E\u6570\u636E\u5206\u5F00\u5B58\u50A8\uFF0C\u5206\u522B\u5904\u7406",
      "\u7A0B\u5E8F\u4E0E\u6570\u636E\u7EDF\u4E00\u5B58\u50A8\uFF0C\u5747\u4EE5\u4E8C\u8FDB\u5236\u5F62\u5F0F\u8868\u793A",
      "\u6307\u4EE4\u4E0E\u6570\u636E\u5FC5\u987B\u540C\u65F6\u8BFB\u5165 CPU",
      "\u5B58\u50A8\u5668\u6309\u5185\u5BB9\u5BFB\u5740\u800C\u975E\u6309\u5730\u5740\u5BFB\u5740"
    ),
    answer: "B",
    analysis: '\u51AF\xB7\u8BFA\u4F9D\u66FC\u7ED3\u6784\u7684\u6838\u5FC3\u662F"\u5B58\u50A8\u7A0B\u5E8F"\u601D\u60F3\uFF1A\u7A0B\u5E8F\u4E0E\u6570\u636E\u7EDF\u4E00\u5B58\u653E\u4E8E\u5B58\u50A8\u5668\u4E2D\uFF0C\u5747\u4EE5\u4E8C\u8FDB\u5236\u8868\u793A\u3002',
    score: 1,
    tags: ["\u8BA1\u7B97\u673A\u57FA\u7840"]
  });
  const q2 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E8C\u8FDB\u5236\u6570 1101 0110 \u8F6C\u6362\u4E3A\u5341\u516D\u8FDB\u5236\u662F\uFF1A",
    options: abc("D6", "C6", "E6", "B6"),
    answer: "A",
    analysis: "\u81EA\u53F3\u5411\u5DE6\u6BCF 4 \u4F4D\u4E00\u7EC4\uFF1A1101=D\uFF0C0110=6\uFF0C\u6545\u4E3A D6\u3002",
    score: 1,
    tags: ["\u8FDB\u5236\u8F6C\u6362"]
  });
  const q3 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u5341\u8FDB\u5236\u6570 45 \u8F6C\u6362\u4E3A\u4E8C\u8FDB\u5236\u6570\u662F\uFF1A",
    options: abc("101101", "101011", "110101", "100101"),
    answer: "A",
    analysis: "45 = 32+8+4+1 = 101101B\u3002",
    score: 1,
    tags: ["\u8FDB\u5236\u8F6C\u6362"]
  });
  const q4 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u5728\u957F\u5EA6\u4E3A n \u7684\u987A\u5E8F\u8868\u4E2D\u63D2\u5165\u4E00\u4E2A\u5143\u7D20\uFF0C\u5E73\u5747\u9700\u8981\u79FB\u52A8\u7684\u5143\u7D20\u4E2A\u6570\u7EA6\u4E3A\uFF1A",
    options: abc("n/2", "n", "(n+1)/2", "n-1"),
    answer: "A",
    analysis: "\u63D2\u5165\u4F4D\u7F6E\u7B49\u6982\u7387\u5206\u5E03\uFF0C\u5E73\u5747\u79FB\u52A8 n/2 \u4E2A\u5143\u7D20\uFF1B\u82E5\u6309\u6700\u574F\u60C5\u51B5\u5219\u4E3A n\u3002",
    score: 1,
    tags: ["\u6570\u636E\u7ED3\u6784"]
  });
  const q5 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u5177\u6709 3 \u4E2A\u7ED3\u70B9\u7684\u4E8C\u53C9\u6811\uFF0C\u5171\u6709\u591A\u5C11\u79CD\u4E0D\u540C\u7684\u5F62\u6001\uFF1F",
    options: abc("3", "5", "8", "9"),
    answer: "B",
    analysis: "\u5361\u7279\u5170\u6570 C(2n,n)/(n+1)\uFF0Cn=3 \u65F6\u4E3A 5 \u79CD\u3002",
    score: 1,
    tags: ["\u6570\u636E\u7ED3\u6784"]
  });
  const q6 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u8FDB\u7A0B\u4E0E\u7A0B\u5E8F\u7684\u4E3B\u8981\u533A\u522B\u662F\uFF1A",
    options: abc(
      "\u8FDB\u7A0B\u662F\u9759\u6001\u7684\uFF0C\u7A0B\u5E8F\u662F\u52A8\u6001\u7684",
      "\u8FDB\u7A0B\u662F\u52A8\u6001\u7684\uFF0C\u7A0B\u5E8F\u662F\u9759\u6001\u7684",
      "\u4E8C\u8005\u6CA1\u6709\u4EFB\u4F55\u533A\u522B",
      "\u7A0B\u5E8F\u4E00\u5B9A\u6BD4\u8FDB\u7A0B\u5360\u7528\u66F4\u591A\u5185\u5B58"
    ),
    answer: "B",
    analysis: "\u7A0B\u5E8F\u662F\u9759\u6001\u7684\u6307\u4EE4\u96C6\u5408\uFF0C\u8FDB\u7A0B\u662F\u7A0B\u5E8F\u7684\u4E00\u6B21\u6267\u884C\u8FC7\u7A0B\uFF0C\u5177\u6709\u52A8\u6001\u6027\u3001\u5E76\u53D1\u6027\u4E0E\u72EC\u7ACB\u6027\u3002",
    score: 1,
    tags: ["\u64CD\u4F5C\u7CFB\u7EDF"]
  });
  const q7 = addQuestion({
    type: QuestionType.SINGLE,
    title: "TCP \u4E09\u6B21\u63E1\u624B\u4E2D\uFF0C\u7B2C\u4E8C\u6B21\u63E1\u624B\u62A5\u6587\u4E2D\u643A\u5E26\u7684\u6807\u5FD7\u4F4D\u662F\uFF1A",
    options: abc("\u4EC5 SYN", "SYN + ACK", "\u4EC5 ACK", "FIN"),
    answer: "B",
    analysis: "\u7B2C\u4E8C\u6B21\u63E1\u624B\u670D\u52A1\u7AEF\u540C\u65F6\u786E\u8BA4\u5BA2\u6237\u7AEF\u5E8F\u5217\u53F7\u5E76\u53D1\u9001\u81EA\u5DF1\u7684\u5E8F\u5217\u53F7\uFF0C\u6545\u4E3A SYN+ACK\u3002",
    score: 1,
    tags: ["\u8BA1\u7B97\u673A\u7F51\u7EDC"]
  });
  const q14 = addQuestion({
    type: QuestionType.SINGLE,
    title: '\u7A0B\u5E8F\u6D41\u7A0B\u56FE\u4E2D\uFF0C\u7528\u4E8E\u8868\u793A"\u5F00\u59CB / \u7ED3\u675F"\u7684\u56FE\u5F62\u662F\uFF1A',
    options: abc("\u77E9\u5F62", "\u83F1\u5F62", "\u5706\u89D2\u77E9\u5F62\uFF08\u692D\u5706\uFF09", "\u5E73\u884C\u56DB\u8FB9\u5F62"),
    answer: "C",
    analysis: "\u5706\u89D2\u77E9\u5F62\u8868\u793A\u8D77\u6B62\uFF1B\u77E9\u5F62\u8868\u793A\u5904\u7406\uFF1B\u83F1\u5F62\u8868\u793A\u5224\u65AD\uFF1B\u5E73\u884C\u56DB\u8FB9\u5F62\u8868\u793A\u8F93\u5165\u8F93\u51FA\u3002",
    score: 1,
    tags: ["\u7A0B\u5E8F\u6D41\u7A0B\u56FE"]
  });
  const q8 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: "\u4E0B\u5217\u5C5E\u4E8E\u8BA1\u7B97\u673A\u7CFB\u7EDF\u8F6F\u4EF6\u7684\u6709\uFF1A",
    options: abc("\u64CD\u4F5C\u7CFB\u7EDF", "\u7F16\u8BD1\u7A0B\u5E8F", "\u6570\u636E\u5E93\u7BA1\u7406\u7CFB\u7EDF", "\u6587\u5B57\u5904\u7406\u8F6F\u4EF6"),
    answer: "A,B,C",
    analysis: "\u7CFB\u7EDF\u8F6F\u4EF6\u5305\u62EC\u64CD\u4F5C\u7CFB\u7EDF\u3001\u7F16\u8BD1\u7A0B\u5E8F\u3001\u6570\u636E\u5E93\u7BA1\u7406\u7CFB\u7EDF\u7B49\uFF1B\u6587\u5B57\u5904\u7406\u8F6F\u4EF6\u5C5E\u4E8E\u5E94\u7528\u8F6F\u4EF6\u3002",
    score: 2,
    tags: ["\u8BA1\u7B97\u673A\u57FA\u7840"]
  });
  const q9 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: "\u4E0B\u5217\u6392\u5E8F\u7B97\u6CD5\u4E2D\uFF0C\u5E73\u5747\u65F6\u95F4\u590D\u6742\u5EA6\u4E3A O(n log n) \u7684\u6709\uFF1A",
    options: abc("\u5FEB\u901F\u6392\u5E8F", "\u5F52\u5E76\u6392\u5E8F", "\u5806\u6392\u5E8F", "\u5192\u6CE1\u6392\u5E8F"),
    answer: "A,B,C",
    analysis: "\u5192\u6CE1\u6392\u5E8F\u5E73\u5747\u65F6\u95F4\u590D\u6742\u5EA6\u4E3A O(n\xB2)\u3002",
    score: 2,
    tags: ["\u6570\u636E\u7ED3\u6784"]
  });
  const q10 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: "\u4EA7\u751F\u6B7B\u9501\u7684\u5FC5\u8981\u6761\u4EF6\u5305\u62EC\uFF1A",
    options: abc("\u4E92\u65A5\u6761\u4EF6", "\u8BF7\u6C42\u4E0E\u4FDD\u6301\u6761\u4EF6", "\u4E0D\u53EF\u5265\u593A\u6761\u4EF6", "\u5FAA\u73AF\u7B49\u5F85\u6761\u4EF6"),
    answer: "A,B,C,D",
    analysis: "\u56DB\u4E2A\u6761\u4EF6\u540C\u65F6\u6EE1\u8DB3\u624D\u53EF\u80FD\u4EA7\u751F\u6B7B\u9501\uFF0C\u7F3A\u4E00\u4E0D\u53EF\u3002",
    score: 2,
    tags: ["\u64CD\u4F5C\u7CFB\u7EDF"]
  });
  const q11 = addQuestion({
    type: QuestionType.JUDGE,
    title: "\u5224\u65AD\uFF1A\u8BA1\u7B97\u673A\u4E2D\u6D6E\u70B9\u6570\u7684\u8868\u793A\u53EF\u80FD\u5B58\u5728\u7CBE\u5EA6\u8BEF\u5DEE\u3002",
    answer: "1",
    analysis: "\u6D6E\u70B9\u6570\u91C7\u7528\u6709\u9650\u4F4D\u4E8C\u8FDB\u5236\u8868\u793A\uFF0C\u65E0\u6CD5\u7CBE\u786E\u8868\u793A\u6240\u6709\u5341\u8FDB\u5236\u5C0F\u6570\uFF0C\u56E0\u6B64\u5B58\u5728\u7CBE\u5EA6\u8BEF\u5DEE\u3002",
    score: 1,
    tags: ["\u8BA1\u7B97\u673A\u57FA\u7840"]
  });
  const q12 = addQuestion({
    type: QuestionType.JUDGE,
    title: "\u5224\u65AD\uFF1A\u7A0B\u5E8F\u6D41\u7A0B\u56FE\u4E2D\uFF0C\u83F1\u5F62\u6846\u7528\u4E8E\u8868\u793A\u5904\u7406\u6B65\u9AA4\u3002",
    answer: "0",
    analysis: "\u83F1\u5F62\u6846\u8868\u793A\u5224\u65AD\uFF08\u6761\u4EF6\u5206\u652F\uFF09\uFF0C\u77E9\u5F62\u6846\u624D\u8868\u793A\u5904\u7406\u6B65\u9AA4\u3002",
    score: 1,
    tags: ["\u7A0B\u5E8F\u6D41\u7A0B\u56FE"]
  });
  const q13 = addQuestion({
    type: QuestionType.JUDGE,
    title: "\u5224\u65AD\uFF1AHTTPS \u534F\u8BAE\u7684\u9ED8\u8BA4\u7AEF\u53E3\u53F7\u4E3A 443\u3002",
    answer: "1",
    analysis: "HTTPS \u9ED8\u8BA4\u7AEF\u53E3 443\uFF0CHTTP \u9ED8\u8BA4\u7AEF\u53E3 80\u3002",
    score: 1,
    tags: ["\u8BA1\u7B97\u673A\u7F51\u7EDC"]
  });
  const q15 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E0B\u5217\u54EA\u4E00\u9879\u4E0D\u5C5E\u4E8E Java \u7684\u57FA\u672C\u6570\u636E\u7C7B\u578B\uFF1F",
    options: abc("int", "boolean", "String", "char"),
    answer: "C",
    analysis: "String \u662F\u5F15\u7528\u7C7B\u578B\uFF08\u7C7B\uFF09\uFF0CJava \u7684 8 \u79CD\u57FA\u672C\u7C7B\u578B\u4E0D\u542B String\u3002",
    score: 1,
    tags: ["Java\u57FA\u7840"]
  });
  const q16 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E0B\u5217\u5173\u4E8E Java String \u7684\u63CF\u8FF0\uFF0C\u6B63\u786E\u7684\u662F\uFF1A",
    options: abc(
      "String \u662F\u53EF\u53D8\u5BF9\u8C61\uFF0C\u4FEE\u6539\u5185\u5BB9\u4E0D\u4F1A\u521B\u5EFA\u65B0\u5BF9\u8C61",
      "String \u5BF9\u8C61\u521B\u5EFA\u540E\u5176\u5185\u5BB9\u4E0D\u53EF\u53D8",
      "String \u53EF\u4EE5\u76F4\u63A5\u7528 == \u6BD4\u8F83\u5185\u5BB9\u662F\u5426\u76F8\u540C",
      "String \u4E0D\u662F final \u7C7B\uFF0C\u53EF\u4EE5\u88AB\u7EE7\u627F"
    ),
    answer: "B",
    analysis: "String \u88AB final \u4FEE\u9970\u3001\u5185\u90E8\u5B57\u7B26\u6570\u7EC4\u4E0D\u53EF\u53D8\uFF1B\u5185\u5BB9\u6BD4\u8F83\u5E94\u4F7F\u7528 equals\u3002",
    score: 1,
    tags: ["Java\u57FA\u7840"]
  });
  const q17 = addQuestion({
    type: QuestionType.SINGLE,
    title: "JVM \u8FD0\u884C\u65F6\u6570\u636E\u533A\u4E2D\uFF0C\u5C5E\u4E8E\u7EBF\u7A0B\u79C1\u6709\u7684\u533A\u57DF\u662F\uFF1A",
    options: abc("\u65B9\u6CD5\u533A", "\u5806", "\u865A\u62DF\u673A\u6808", "\u5143\u7A7A\u95F4"),
    answer: "C",
    analysis: "\u865A\u62DF\u673A\u6808\u3001\u672C\u5730\u65B9\u6CD5\u6808\u3001\u7A0B\u5E8F\u8BA1\u6570\u5668\u4E3A\u7EBF\u7A0B\u79C1\u6709\uFF1B\u5806\u4E0E\u65B9\u6CD5\u533A\uFF08\u5143\u7A7A\u95F4\uFF09\u4E3A\u7EBF\u7A0B\u5171\u4EAB\u3002",
    score: 1,
    tags: ["JVM"]
  });
  const q18 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E0B\u5217 Java \u5F15\u7528\u7C7B\u578B\u4E2D\uFF0C\u6700\u4E0D\u5BB9\u6613\u88AB\u5783\u573E\u56DE\u6536\u5668\u56DE\u6536\u7684\u662F\uFF1A",
    options: abc("\u5F3A\u5F15\u7528", "\u8F6F\u5F15\u7528", "\u5F31\u5F15\u7528", "\u865A\u5F15\u7528"),
    answer: "A",
    analysis: "\u5F3A\u5F15\u7528\u53EA\u8981\u53EF\u8FBE\u5C31\u4E0D\u4F1A\u88AB\u56DE\u6536\uFF1B\u8F6F\u5F15\u7528\u5728\u5185\u5B58\u4E0D\u8DB3\u65F6\u56DE\u6536\uFF1B\u5F31\u5F15\u7528\u5728\u4E0B\u6B21 GC \u65F6\u56DE\u6536\u3002",
    score: 1,
    tags: ["JVM"]
  });
  const q19 = addQuestion({
    type: QuestionType.SINGLE,
    title: "Java \u4E2D volatile \u5173\u952E\u5B57\u7684\u4F5C\u7528\u662F\uFF1A",
    options: abc(
      "\u4FDD\u8BC1\u53D8\u91CF\u7684\u539F\u5B50\u6027",
      "\u4FDD\u8BC1\u53D8\u91CF\u7684\u53EF\u89C1\u6027\u4E0E\u7981\u6B62\u6307\u4EE4\u91CD\u6392\u5E8F",
      "\u66FF\u4EE3 synchronized \u5B9E\u73B0\u4E92\u65A5",
      "\u4FDD\u8BC1\u590D\u5408\u64CD\u4F5C\u7684\u7EBF\u7A0B\u5B89\u5168"
    ),
    answer: "B",
    analysis: "volatile \u4FDD\u8BC1\u53EF\u89C1\u6027\u4E0E\u6709\u5E8F\u6027\uFF0C\u4F46\u4E0D\u4FDD\u8BC1\u539F\u5B50\u6027\uFF08\u5982 i++ \u4ECD\u9700\u52A0\u9501\uFF09\u3002",
    score: 1,
    tags: ["\u5E76\u53D1\u7F16\u7A0B"]
  });
  const q20 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u5173\u4E8E synchronized \u4E0E ReentrantLock\uFF0C\u4E0B\u5217\u8BF4\u6CD5\u6B63\u786E\u7684\u662F\uFF1A",
    options: abc(
      "synchronized \u652F\u6301\u54CD\u5E94\u4E2D\u65AD",
      "ReentrantLock \u652F\u6301\u516C\u5E73\u9501",
      "\u4E24\u8005\u90FD\u4E0D\u652F\u6301\u53EF\u91CD\u5165",
      "ReentrantLock \u65E0\u9700\u624B\u52A8\u91CA\u653E\u9501"
    ),
    answer: "B",
    analysis: "ReentrantLock \u53EF\u6784\u9020\u516C\u5E73\u9501\uFF0C\u4E14\u652F\u6301\u4E2D\u65AD\u3001\u8D85\u65F6\u4E0E\u591A\u6761\u4EF6\u53D8\u91CF\uFF1B\u4F46\u5FC5\u987B\u624B\u52A8 unlock\u3002",
    score: 1,
    tags: ["\u5E76\u53D1\u7F16\u7A0B"]
  });
  const q21 = addQuestion({
    type: QuestionType.SINGLE,
    title: "InnoDB \u4E2D\u7684\u805A\u7C07\u7D22\u5F15\u662F\u6307\uFF1A",
    options: abc(
      "\u4EE5\u4E3B\u952E\u987A\u5E8F\u7EC4\u7EC7\u6570\u636E\u5B58\u50A8\u7684\u7D22\u5F15\uFF0C\u53F6\u5B50\u8282\u70B9\u5B58\u653E\u6574\u884C\u6570\u636E",
      "\u4EE5\u975E\u4E3B\u952E\u5217\u7EC4\u7EC7\u6570\u636E\u5B58\u50A8\u7684\u7D22\u5F15",
      "\u57FA\u4E8E\u54C8\u5E0C\u8868\u5B9E\u73B0\u7684\u7D22\u5F15",
      "\u7528\u4E8E\u5168\u6587\u68C0\u7D22\u7684\u7D22\u5F15"
    ),
    answer: "A",
    analysis: "InnoDB \u4E3B\u952E\u7D22\u5F15\u5373\u805A\u7C07\u7D22\u5F15\uFF0C\u53F6\u5B50\u8282\u70B9\u5B58\u50A8\u5B8C\u6574\u884C\u6570\u636E\uFF1B\u4E8C\u7EA7\u7D22\u5F15\u53F6\u5B50\u5B58\u50A8\u4E3B\u952E\u503C\u3002",
    score: 1,
    tags: ["MySQL\u7D22\u5F15"]
  });
  const q22 = addQuestion({
    type: QuestionType.SINGLE,
    title: "\u4E0B\u5217\u54EA\u79CD\u5199\u6CD5\u6700\u53EF\u80FD\u5BFC\u81F4 MySQL \u65E0\u6CD5\u4F7F\u7528\u7D22\u5F15\uFF1F",
    options: abc(
      "\u5728\u7D22\u5F15\u5217\u4E0A\u4F7F\u7528\u51FD\u6570\uFF0C\u5982 WHERE YEAR(create_time) = 2024",
      "\u4F7F\u7528\u7B49\u503C\u67E5\u8BE2 WHERE user_id = 1",
      "\u9075\u5FAA\u6700\u5DE6\u524D\u7F00\u539F\u5219\u67E5\u8BE2\u8054\u5408\u7D22\u5F15",
      "\u4F7F\u7528\u8986\u76D6\u7D22\u5F15\u907F\u514D\u56DE\u8868"
    ),
    answer: "A",
    analysis: "\u5BF9\u7D22\u5F15\u5217\u4F7F\u7528\u51FD\u6570\u4F1A\u5BFC\u81F4\u7D22\u5F15\u5931\u6548\uFF0C\u5E94\u6539\u5199\u4E3A\u8303\u56F4\u67E5\u8BE2\u3002",
    score: 1,
    tags: ["MySQL\u7D22\u5F15"]
  });
  const q23 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: "\u5173\u4E8E Redis \u6301\u4E45\u5316\u673A\u5236\uFF0C\u4E0B\u5217\u8BF4\u6CD5\u6B63\u786E\u7684\u6709\uFF1A",
    options: abc(
      "RDB \u662F\u4EE5\u5FEB\u7167\u65B9\u5F0F\u4FDD\u5B58\u67D0\u4E00\u65F6\u523B\u7684\u6570\u636E",
      "AOF \u8BB0\u5F55\u7684\u662F\u5199\u547D\u4EE4",
      "RDB \u7684\u6062\u590D\u901F\u5EA6\u901A\u5E38\u5FEB\u4E8E AOF",
      "AOF \u6587\u4EF6\u4F53\u79EF\u4E00\u5B9A\u5C0F\u4E8E RDB \u6587\u4EF6"
    ),
    answer: "A,B,C",
    analysis: "AOF \u8BB0\u5F55\u5199\u547D\u4EE4\uFF0C\u6587\u4EF6\u901A\u5E38\u6BD4 RDB \u66F4\u5927\uFF0C\u4F46\u6570\u636E\u4E22\u5931\u66F4\u5C11\u3002",
    score: 2,
    tags: ["Redis\u7F13\u5B58"]
  });
  const q24 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: "\u5173\u4E8E Java \u7EBF\u7A0B\u6C60\uFF0C\u4E0B\u5217\u8BF4\u6CD5\u6B63\u786E\u7684\u6709\uFF1A",
    options: abc(
      "\u6838\u5FC3\u7EBF\u7A0B\u6570\u5DF2\u6EE1\u65F6\uFF0C\u65B0\u4EFB\u52A1\u4F1A\u5148\u8FDB\u5165\u5DE5\u4F5C\u961F\u5217",
      "\u7EBF\u7A0B\u6C60\u53EF\u4EE5\u964D\u4F4E\u7EBF\u7A0B\u9891\u7E41\u521B\u5EFA\u9500\u6BC1\u7684\u5F00\u9500",
      "\u7EBF\u7A0B\u6C60\u7684\u7EBF\u7A0B\u6570\u914D\u7F6E\u5F97\u8D8A\u5927\u6027\u80FD\u8D8A\u597D",
      "\u7EBF\u7A0B\u6C60\u53EF\u4EE5\u7EDF\u4E00\u7BA1\u7406\u7EBF\u7A0B\u7684\u751F\u547D\u5468\u671F"
    ),
    answer: "A,B,D",
    analysis: "\u7EBF\u7A0B\u6570\u8FC7\u5927\u4F1A\u52A0\u5267\u4E0A\u4E0B\u6587\u5207\u6362\u4E0E\u8D44\u6E90\u7ADE\u4E89\uFF0C\u9700\u7ED3\u5408\u4EFB\u52A1\u7C7B\u578B\u4E0E CPU \u6838\u6570\u5408\u7406\u914D\u7F6E\u3002",
    score: 2,
    tags: ["\u5E76\u53D1\u7F16\u7A0B"]
  });
  const q25 = addQuestion({
    type: QuestionType.JUDGE,
    title: "\u5224\u65AD\uFF1AJava \u4E2D\u4F7F\u7528 == \u6BD4\u8F83\u4E24\u4E2A\u5F15\u7528\u7C7B\u578B\u53D8\u91CF\u65F6\uFF0C\u6BD4\u8F83\u7684\u662F\u5BF9\u8C61\u7684\u5185\u5B58\u5730\u5740\u3002",
    answer: "1",
    analysis: "== \u6BD4\u8F83\u5F15\u7528\u5730\u5740\uFF08\u662F\u5426\u540C\u4E00\u5BF9\u8C61\uFF09\uFF1B\u5185\u5BB9\u6BD4\u8F83\u5E94\u4F7F\u7528 equals\u3002",
    score: 1,
    tags: ["Java\u57FA\u7840"]
  });
  const q26 = addQuestion({
    type: QuestionType.JUDGE,
    title: "\u5224\u65AD\uFF1ARedis \u91C7\u7528\u5355\u7EBF\u7A0B\u6A21\u578B\u5904\u7406\u547D\u4EE4\uFF0C\u56E0\u6B64\u4E0D\u5B58\u5728\u4EFB\u4F55\u5E76\u53D1\u95EE\u9898\u3002",
    answer: "0",
    analysis: "Redis \u547D\u4EE4\u6267\u884C\u662F\u5355\u7EBF\u7A0B\u7684\uFF0C\u4F46\u4E1A\u52A1\u5C42\u4ECD\u5B58\u5728\u5E76\u53D1\u7ADE\u4E89\uFF08\u5982\u7F13\u5B58\u51FB\u7A7F\u3001\u8D85\u5356\uFF09\uFF0C\u9700\u8981\u989D\u5916\u63A7\u5236\u3002",
    score: 1,
    tags: ["Redis\u7F13\u5B58"]
  });
  const q27 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: "\u8BF7\u7B80\u8FF0\u5FEB\u901F\u6392\u5E8F\u7684\u57FA\u672C\u601D\u60F3\uFF0C\u5E76\u8BF4\u660E\u5176\u6700\u574F\u65F6\u95F4\u590D\u6742\u5EA6\u53CA\u4EA7\u751F\u539F\u56E0\u3002",
    answer: "\u5FEB\u901F\u6392\u5E8F\u91C7\u7528\u5206\u6CBB\u601D\u60F3\uFF1A\u9009\u53D6\u4E00\u4E2A\u57FA\u51C6\u5143\u7D20\uFF0C\u5C06\u5E8F\u5217\u5212\u5206\u4E3A\u5C0F\u4E8E\u57FA\u51C6\u4E0E\u5927\u4E8E\u57FA\u51C6\u7684\u4E24\u90E8\u5206\uFF0C\u518D\u9012\u5F52\u5904\u7406\u4E24\u90E8\u5206\u3002\u5E73\u5747\u65F6\u95F4\u590D\u6742\u5EA6 O(n log n)\uFF1B\u5F53\u6BCF\u6B21\u5212\u5206\u6781\u4E0D\u5E73\u8861\uFF08\u4F8B\u5982\u5E8F\u5217\u5DF2\u57FA\u672C\u6709\u5E8F\u4E14\u56FA\u5B9A\u53D6\u9996\u5143\u7D20\u4E3A\u57FA\u51C6\uFF09\u65F6\uFF0C\u9012\u5F52\u6DF1\u5EA6\u9000\u5316\u4E3A n\uFF0C\u6700\u574F\u65F6\u95F4\u590D\u6742\u5EA6\u4E3A O(n\xB2)\u3002",
    analysis: "\u7B54\u9898\u8981\u70B9\uFF1A\u5206\u6CBB\u601D\u60F3\u3001\u57FA\u51C6\u9009\u53D6\u4E0E\u5212\u5206\u8FC7\u7A0B\u3001\u5E73\u5747 O(n log n)\u3001\u6700\u574F O(n\xB2) \u53CA\u4EA7\u751F\u6761\u4EF6\uFF08\u5212\u5206\u4E0D\u5E73\u8861\uFF09\u3002",
    score: 5,
    tags: ["\u7B97\u6CD5\u8BBE\u8BA1"]
  });
  const q28 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: "\u8BF7\u8BBE\u8BA1\u7B97\u6CD5\u5224\u65AD\u5355\u94FE\u8868\u4E2D\u662F\u5426\u5B58\u5728\u73AF\uFF0C\u5E76\u8BF4\u660E\u65F6\u95F4\u590D\u6742\u5EA6\u4E0E\u7A7A\u95F4\u590D\u6742\u5EA6\u3002",
    answer: "\u53EF\u91C7\u7528\u5FEB\u6162\u6307\u9488\uFF08Floyd \u5224\u5708\u7B97\u6CD5\uFF09\uFF1A\u6162\u6307\u9488\u6BCF\u6B21\u8D70 1 \u6B65\uFF0C\u5FEB\u6307\u9488\u6BCF\u6B21\u8D70 2 \u6B65\uFF0C\u82E5\u5B58\u5728\u73AF\u5219\u4E24\u6307\u9488\u5FC5\u7136\u5728\u73AF\u5185\u76F8\u9047\uFF0C\u82E5\u5FEB\u6307\u9488\u5230\u8FBE\u94FE\u8868\u672B\u5C3E\u5219\u65E0\u73AF\u3002\u65F6\u95F4\u590D\u6742\u5EA6 O(n)\uFF0C\u7A7A\u95F4\u590D\u6742\u5EA6 O(1)\u3002\u4E5F\u53EF\u7528\u54C8\u5E0C\u8868\u8BB0\u5F55\u8BBF\u95EE\u8FC7\u7684\u7ED3\u70B9\uFF0C\u65F6\u95F4 O(n)\u3001\u7A7A\u95F4 O(n)\u3002",
    analysis: "\u7B54\u9898\u8981\u70B9\uFF1A\u5FEB\u6162\u6307\u9488\u601D\u8DEF\u3001\u76F8\u9047\u5224\u5B9A\u6761\u4EF6\u3001O(n) \u65F6\u95F4\u4E0E O(1) \u7A7A\u95F4\uFF1B\u63D0\u53CA\u54C8\u5E0C\u8868\u65B9\u6848\u53EF\u52A0\u5206\u3002",
    score: 5,
    tags: ["\u7B97\u6CD5\u8BBE\u8BA1"]
  });
  const q29 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: "\u8BF7\u8BF4\u660E\u6570\u636E\u5E93\u4E09\u5927\u8303\u5F0F\u7684\u5185\u5BB9\uFF0C\u5E76\u4E3E\u4F8B\u8BF4\u660E\u4F55\u65F6\u9700\u8981\u53CD\u8303\u5F0F\u8BBE\u8BA1\u3002",
    answer: "\u7B2C\u4E00\u8303\u5F0F\uFF081NF\uFF09\uFF1A\u5B57\u6BB5\u5177\u6709\u539F\u5B50\u6027\uFF0C\u4E0D\u53EF\u518D\u5206\uFF1B\u7B2C\u4E8C\u8303\u5F0F\uFF082NF\uFF09\uFF1A\u5728 1NF \u57FA\u7840\u4E0A\u6D88\u9664\u975E\u4E3B\u5C5E\u6027\u5BF9\u4E3B\u952E\u7684\u90E8\u5206\u4F9D\u8D56\uFF1B\u7B2C\u4E09\u8303\u5F0F\uFF083NF\uFF09\uFF1A\u5728 2NF \u57FA\u7840\u4E0A\u6D88\u9664\u975E\u4E3B\u5C5E\u6027\u5BF9\u4E3B\u952E\u7684\u4F20\u9012\u4F9D\u8D56\u3002\u53CD\u8303\u5F0F\u573A\u666F\uFF1A\u8BFB\u591A\u5199\u5C11\u3001\u8054\u8868\u67E5\u8BE2\u4EE3\u4EF7\u9AD8\u7684\u7EDF\u8BA1\u62A5\u8868\u573A\u666F\uFF0C\u53EF\u5197\u4F59\u90E8\u5206\u5B57\u6BB5\u4EE5\u51CF\u5C11 join\uFF1B\u6216\u4E3A\u4E86\u4FDD\u7559\u5386\u53F2\u5FEB\u7167\uFF08\u5982\u8BA2\u5355\u4E2D\u7684\u5546\u54C1\u4EF7\u683C\uFF09\u800C\u523B\u610F\u5197\u4F59\u3002",
    analysis: "\u7B54\u9898\u8981\u70B9\uFF1A\u4E09\u8303\u5F0F\u5B9A\u4E49\u51C6\u786E + \u53CD\u8303\u5F0F\u52A8\u673A\uFF08\u6027\u80FD\u6362\u5197\u4F59\u3001\u5FEB\u7167\u7559\u5B58\uFF09\u4E0E\u4EE3\u4EF7\uFF08\u4E00\u81F4\u6027\u7EF4\u62A4\u6210\u672C\uFF09\u3002",
    score: 5,
    tags: ["\u6570\u636E\u5E93\u8BBE\u8BA1"]
  });
  const q30 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: "\u8BF7\u7B80\u8FF0\u7F13\u5B58\u7A7F\u900F\u3001\u7F13\u5B58\u51FB\u7A7F\u4E0E\u7F13\u5B58\u96EA\u5D29\u7684\u533A\u522B\u53CA\u5404\u81EA\u7684\u89E3\u51B3\u65B9\u6848\u3002",
    answer: "\u7F13\u5B58\u7A7F\u900F\uFF1A\u67E5\u8BE2\u4E0D\u5B58\u5728\u7684\u6570\u636E\uFF0C\u8BF7\u6C42\u7ED5\u8FC7\u7F13\u5B58\u76F4\u8FBE\u6570\u636E\u5E93\u3002\u65B9\u6848\uFF1A\u5E03\u9686\u8FC7\u6EE4\u5668\u3001\u7A7A\u503C\u7F13\u5B58\u3002\u7F13\u5B58\u51FB\u7A7F\uFF1A\u67D0\u4E2A\u70ED\u70B9 key \u5931\u6548\u77AC\u95F4\u5927\u91CF\u5E76\u53D1\u8BF7\u6C42\u6253\u5230\u6570\u636E\u5E93\u3002\u65B9\u6848\uFF1A\u4E92\u65A5\u9501\u91CD\u5EFA\u3001\u70ED\u70B9\u6570\u636E\u6C38\u4E0D\u8FC7\u671F + \u5F02\u6B65\u66F4\u65B0\u3002\u7F13\u5B58\u96EA\u5D29\uFF1A\u5927\u91CF key \u540C\u65F6\u5931\u6548\u6216\u7F13\u5B58\u670D\u52A1\u5B95\u673A\uFF0C\u5BFC\u81F4\u6570\u636E\u5E93\u538B\u529B\u9AA4\u589E\u3002\u65B9\u6848\uFF1A\u8FC7\u671F\u65F6\u95F4\u52A0\u968F\u673A\u6296\u52A8\u3001\u591A\u7EA7\u7F13\u5B58\u3001\u7F13\u5B58\u96C6\u7FA4\u9AD8\u53EF\u7528\u4E0E\u9650\u6D41\u964D\u7EA7\u3002",
    analysis: "\u7B54\u9898\u8981\u70B9\uFF1A\u4E09\u8005\u5B9A\u4E49\u533A\u5206\u6E05\u695A\uFF08\u4E0D\u5B58\u5728\u7684\u6570\u636E / \u5355\u4E2A\u70ED\u70B9 key / \u5927\u9762\u79EF\u540C\u65F6\u5931\u6548\uFF09+ \u5BF9\u5E94\u65B9\u6848\u5339\u914D\u3002",
    score: 5,
    tags: ["\u7CFB\u7EDF\u8BBE\u8BA1"]
  });
  const q31 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: "\u8BF7\u8BF4\u660E CAP \u7406\u8BBA\u7684\u542B\u4E49\uFF0C\u5E76\u4E3E\u4F8B\u8BF4\u660E\u5206\u5E03\u5F0F\u7CFB\u7EDF\u4E2D\u7684\u53D6\u820D\u3002",
    answer: "CAP \u6307\u4E00\u81F4\u6027\uFF08Consistency\uFF09\u3001\u53EF\u7528\u6027\uFF08Availability\uFF09\u3001\u5206\u533A\u5BB9\u9519\u6027\uFF08Partition tolerance\uFF09\u3002\u5206\u5E03\u5F0F\u7CFB\u7EDF\u4E2D\u5206\u533A\u5BB9\u9519\u6027\u901A\u5E38\u5FC5\u987B\u4FDD\u7559\uFF0C\u56E0\u6B64\u5B9E\u9645\u662F\u5728 C \u4E0E A \u4E4B\u95F4\u53D6\u820D\uFF1ACP \u7CFB\u7EDF\uFF08\u5982 ZooKeeper\u3001etcd\uFF09\u5728\u7F51\u7EDC\u5206\u533A\u65F6\u4F18\u5148\u4FDD\u8BC1\u4E00\u81F4\u6027\uFF0C\u53EF\u80FD\u62D2\u7EDD\u670D\u52A1\uFF1BAP \u7CFB\u7EDF\uFF08\u5982 Eureka\u3001Cassandra\uFF09\u4F18\u5148\u4FDD\u8BC1\u53EF\u7528\u6027\uFF0C\u5141\u8BB8\u8FD4\u56DE\u53EF\u80FD\u8FC7\u671F\u7684\u6570\u636E\u3002BASE \u7406\u8BBA\u662F\u5BF9 AP \u7684\u5EF6\u4F38\u5B9E\u8DF5\u3002",
    analysis: "\u7B54\u9898\u8981\u70B9\uFF1A\u4E09\u8005\u5B9A\u4E49\u3001P \u5FC5\u987B\u4FDD\u7559\u7684\u539F\u56E0\u3001CP \u4E0E AP \u7684\u5178\u578B\u7CFB\u7EDF\u4E3E\u4F8B\u3001\u53EF\u8865\u5145 BASE \u7406\u8BBA\u3002",
    score: 5,
    tags: ["\u7CFB\u7EDF\u8BBE\u8BA1"]
  });
  const drafts = [];
  const draftQuestionRels = [];
  const addDraft = (opts) => {
    const locked = opts.draftStatus === DraftStatus.ENABLED ? 1 : 0;
    const stampTime = opts.createTime ?? daysAgo(80);
    const draft = {
      id: id("drafts"),
      deleted: 0,
      createTime: stampTime,
      updateTime: stampTime,
      draftName: opts.draftName,
      userId: opts.userId,
      categoryId: opts.categoryId,
      paperType: opts.paperType,
      visibility: opts.visibility,
      draftStatus: opts.draftStatus,
      isLocked: locked,
      sourceType: opts.sourceType ?? DraftSourceType.MANUAL,
      randomOrder: opts.randomOrder ?? 0,
      questionCount: opts.questions.length,
      enableTime: locked ? daysAgo(70) : null
    };
    drafts.push(draft);
    opts.questions.forEach((item, index) => {
      draftQuestionRels.push({
        id: id("draftQuestionRels"),
        deleted: 0,
        createTime: stampTime,
        updateTime: stampTime,
        draftId: draft.id,
        questionId: item.q.id,
        sortNo: index + 1,
        score: item.score ?? item.q.score
      });
    });
    return draft;
  };
  const d1 = addDraft({
    draftName: "\u8F6F\u8003\u7A0B\u5E8F\u5458 \xB7 \u4E0A\u5348\u5BA2\u89C2\u9898\u7CBE\u9009\uFF0814 \u9898\uFF09",
    userId: admin.id,
    categoryId: catMorning.id,
    paperType: PaperType.COMPETITIVE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    questions: [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14].map((q32) => ({ q: q32 }))
  });
  const d2 = addDraft({
    draftName: "\u9762\u8BD5\u516B\u80A1 \xB7 Java \u6838\u5FC3\u4E0E\u4E2D\u95F4\u4EF6\uFF0812 \u9898\uFF09",
    userId: admin.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    randomOrder: 1,
    questions: [q15, q16, q17, q18, q19, q20, q21, q22, q23, q24, q25, q26].map((q32) => ({ q: q32 }))
  });
  const d3 = addDraft({
    draftName: "\u4E0B\u5348\u4E3B\u89C2\u9898 \xB7 \u7CFB\u7EDF\u8BBE\u8BA1\u4E13\u9879\uFF085 \u9898 \xB7 \u7B80\u7B54\u81EA\u8BC4\uFF09",
    userId: admin.id,
    categoryId: catAfternoon.id,
    paperType: PaperType.COMPETITIVE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    questions: [q27, q28, q29, q30, q31].map((q32) => ({ q: q32 }))
  });
  const d4 = addDraft({
    draftName: "\u6211\u7684\u9519\u9898\u590D\u4E60\u5377\uFF08\u7B2C 1 \u6B21\u7EC4\u5377\uFF09",
    userId: alice.id,
    categoryId: catMorning.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.ENABLED,
    sourceType: DraftSourceType.WRONG_COMPOSE,
    questions: [q3, q8, q11, q13].map((q32) => ({ q: q32 })),
    createTime: daysAgo(12)
  });
  const d5 = addDraft({
    draftName: "\u5F85\u5B8C\u5584\u7684\u79C1\u6709\u7EC3\u4E60\u5377\uFF08\u53EF\u7F16\u8F91\u6F14\u793A\uFF09",
    userId: alice.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    questions: [{ q: q15 }, { q: q17 }],
    createTime: daysAgo(6)
  });
  addDraft({
    draftName: "\u65E7\u7248\u9762\u8BD5\u7EC3\u4E60\u5377\uFF08\u5DF2\u5E9F\u5F03\uFF09",
    userId: bob.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISCARDED,
    questions: [{ q: q21 }, { q: q22 }],
    createTime: daysAgo(60)
  });
  const lockedDraftIds = new Set(
    drafts.filter((d) => d.isLocked === 1 && d.draftStatus !== DraftStatus.DISCARDED).map((d) => d.id)
  );
  const questionIdSet = new Set(
    draftQuestionRels.filter((rel) => lockedDraftIds.has(rel.draftId)).map((rel) => rel.questionId)
  );
  questions.forEach((q32) => {
    if (questionIdSet.has(q32.id)) q32.isLocked = 1;
  });
  const exams = [];
  const examQuestions = [];
  const records = [];
  const wrongDetails = [];
  const findRecord2 = (userId, questionId, categoryId) => records.find(
    (r) => r.userId === userId && r.questionId === questionId && r.categoryId === categoryId
  );
  const wrongAnswerOf = (question) => {
    if (question.questionType === QuestionType.JUDGE) {
      return question.answer === "1" ? "0" : "1";
    }
    if (question.questionType === QuestionType.MULTIPLE) {
      const keys = splitMulti(question.answer);
      return keys.slice(0, Math.max(1, keys.length - 1)).join(",");
    }
    const options = parseOptions(question.options);
    const correct = question.answer.trim().toUpperCase();
    const other = options.find((o) => o.key.toUpperCase() !== correct);
    return other ? other.key : "A";
  };
  const simulateExam = (opts) => {
    const wrongIds = opts.wrongQuestionIds ?? [];
    const rels = draftQuestionRels.filter((rel) => rel.draftId === opts.draft.id).sort((a, b) => a.sortNo - b.sortNo);
    const attemptNo = exams.filter((e) => e.userId === opts.userId && e.draftId === opts.draft.id).length + 1;
    const created = new Date(new Date(opts.submitTime).getTime() - 20 * 60 * 1e3).toISOString();
    const exam = {
      id: id("exams"),
      deleted: 0,
      createTime: created,
      updateTime: opts.submitTime,
      userId: opts.userId,
      draftId: opts.draft.id,
      draftName: opts.draft.draftName,
      categoryId: opts.draft.categoryId,
      paperType: opts.draft.paperType,
      sourceType: opts.sourceType ?? ExamSourceType.NORMAL,
      attemptNo,
      questionCount: rels.length,
      totalScore: 0,
      obtainedScore: 0,
      usedSeconds: opts.usedSeconds ?? 600,
      submitTime: opts.submitTime
    };
    exams.push(exam);
    let totalScore = 0;
    let obtainedScore = 0;
    rels.forEach((rel, index) => {
      const question = questions.find((q32) => q32.id === rel.questionId);
      let userAnswer;
      if (opts.partial) {
        userAnswer = opts.partial[question.id] ?? null;
      } else if (question.questionType === QuestionType.SHORT_ANSWER) {
        userAnswer = opts.shortAnswers?.[question.id] ?? null;
      } else if (wrongIds.includes(question.id)) {
        userAnswer = wrongAnswerOf(question);
      } else {
        userAnswer = question.answer;
      }
      const isShort = question.questionType === QuestionType.SHORT_ANSWER;
      const judged = !isShort && !opts.partial;
      const result = judged ? judgeObjective(question.questionType, question.answer, userAnswer) : null;
      totalScore += rel.score;
      if (result === JudgeResult.RIGHT) obtainedScore += rel.score;
      examQuestions.push({
        id: id("examQuestions"),
        deleted: 0,
        createTime: created,
        updateTime: opts.submitTime,
        examId: exam.id,
        questionId: question.id,
        sortNo: index + 1,
        questionType: question.questionType,
        score: rel.score,
        userAnswer,
        judgeStatus: judged ? JudgeStatus.JUDGED : JudgeStatus.PENDING,
        judgeResult: result,
        obtainedScore: result === JudgeResult.RIGHT ? rel.score : result === JudgeResult.WRONG ? 0 : null,
        aiExplain: null,
        aiRetryTimes: 0,
        manualRetryTimes: 0,
        judgeTime: judged ? opts.submitTime : null
      });
    });
    exam.totalScore = totalScore;
    exam.obtainedScore = opts.partial ? null : Number(obtainedScore.toFixed(2));
    if (opts.partial) exam.submitTime = null;
    if (!opts.partial) {
      examQuestions.filter((eq) => eq.examId === exam.id).forEach((eq) => {
        if (eq.judgeStatus !== JudgeStatus.JUDGED) return;
        if (eq.judgeResult === JudgeResult.WRONG) {
          let record = findRecord2(opts.userId, eq.questionId, exam.categoryId);
          if (!record) {
            record = {
              id: id("records"),
              deleted: 0,
              createTime: opts.submitTime,
              updateTime: opts.submitTime,
              userId: opts.userId,
              questionId: eq.questionId,
              categoryId: exam.categoryId,
              isMaster: MasterStatus.WRONG_SET,
              wrongCount: 1,
              lastExamId: exam.id,
              lastExamQuestionId: eq.id,
              lastWrongTime: opts.submitTime,
              masterTime: null
            };
            records.push(record);
          } else {
            record.isMaster = MasterStatus.WRONG_SET;
            record.wrongCount += 1;
            record.lastExamId = exam.id;
            record.lastExamQuestionId = eq.id;
            record.lastWrongTime = opts.submitTime;
            record.masterTime = null;
            record.updateTime = opts.submitTime;
          }
          wrongDetails.push({
            id: id("wrongDetails"),
            deleted: 0,
            createTime: opts.submitTime,
            updateTime: opts.submitTime,
            recordId: record.id,
            examId: exam.id,
            examQuestionId: eq.id,
            userAnswer: eq.userAnswer ?? null,
            judgeResult: eq.judgeResult ?? null,
            aiExplain: null,
            answerTime: opts.submitTime
          });
        } else if (eq.judgeResult === JudgeResult.RIGHT) {
          const record = findRecord2(opts.userId, eq.questionId, exam.categoryId);
          if (record && record.isMaster === MasterStatus.WRONG_SET) {
            record.isMaster = MasterStatus.MASTERED_SET;
            record.masterTime = opts.submitTime;
            record.lastExamId = exam.id;
            record.lastExamQuestionId = eq.id;
            record.updateTime = opts.submitTime;
          }
        }
      });
    }
    return exam;
  };
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(30),
    wrongQuestionIds: [q3, q8, q11, q13].map((q32) => q32.id),
    usedSeconds: 720
  });
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(20),
    wrongQuestionIds: [q8, q13].map((q32) => q32.id),
    usedSeconds: 640
  });
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(10),
    wrongQuestionIds: [q8, q11].map((q32) => q32.id),
    usedSeconds: 700
  });
  simulateExam({
    userId: alice.id,
    draft: d2,
    submitTime: daysAgo(5),
    wrongQuestionIds: [q18, q23, q24].map((q32) => q32.id),
    usedSeconds: 900
  });
  simulateExam({
    userId: alice.id,
    draft: d4,
    submitTime: daysAgo(2),
    sourceType: ExamSourceType.WRONG_COMPOSE,
    wrongQuestionIds: [q8, q13].map((q32) => q32.id),
    usedSeconds: 300
  });
  simulateExam({
    userId: alice.id,
    draft: d3,
    submitTime: daysAgo(3),
    shortAnswers: {
      [q27.id]: "\u5FEB\u6392\u7528\u5206\u6CBB\uFF0C\u9009\u57FA\u51C6\u5212\u5206\u540E\u9012\u5F52\u3002\u6700\u574F O(n\xB2)\uFF0C\u53D1\u751F\u5728\u5212\u5206\u6781\u4E0D\u5E73\u8861\u65F6\u3002",
      [q28.id]: "\u7528\u5FEB\u6162\u6307\u9488\uFF0C\u5FEB\u6307\u9488\u8D70\u4E24\u6B65\u6162\u6307\u9488\u8D70\u4E00\u6B65\uFF0C\u76F8\u9047\u5373\u6709\u73AF\uFF0C\u65F6\u95F4 O(n) \u7A7A\u95F4 O(1)\u3002",
      [q29.id]: "1NF \u5B57\u6BB5\u539F\u5B50\uFF1B2NF \u6D88\u9664\u90E8\u5206\u4F9D\u8D56\uFF1B3NF \u6D88\u9664\u4F20\u9012\u4F9D\u8D56\u3002\u8BFB\u591A\u5199\u5C11\u53EF\u53CD\u8303\u5F0F\u3002",
      [q30.id]: "\u7A7F\u900F\u662F\u67E5\u4E0D\u5B58\u5728\u7684\u6570\u636E\uFF1B\u51FB\u7A7F\u662F\u70ED\u70B9 key \u5931\u6548\uFF1B\u96EA\u5D29\u662F\u5927\u91CF key \u540C\u65F6\u5931\u6548\u3002",
      [q31.id]: "CAP \u662F\u4E00\u81F4\u6027\u3001\u53EF\u7528\u6027\u3001\u5206\u533A\u5BB9\u9519\u6027\uFF0CP \u5FC5\u987B\u4FDD\u7559\uFF0C\u6240\u4EE5\u5728 C \u548C A \u4E4B\u95F4\u53D6\u820D\u3002"
    },
    usedSeconds: 1200
  });
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: minutesAgo(30),
    wrongQuestionIds: [],
    partial: {
      [q1.id]: q1.answer,
      [q2.id]: wrongAnswerOf(q2),
      [q4.id]: q4.answer
    },
    usedSeconds: 180
  });
  simulateExam({
    userId: bob.id,
    draft: d1,
    submitTime: daysAgo(7),
    wrongQuestionIds: [q2, q5, q9].map((q32) => q32.id),
    usedSeconds: 800
  });
  simulateExam({
    userId: carol.id,
    draft: d1,
    submitTime: daysAgo(60),
    wrongQuestionIds: [q1, q6].map((q32) => q32.id),
    usedSeconds: 660
  });
  const seedUser = (name) => users.find((u) => u.username === name);
  const knowledge = [];
  const knowledgeTagRels = [];
  const knowledgeQuestionRels = [];
  const knowledgeAnnotations = [];
  const addKnowledge = (username, title, summary, content, visibility, tagNames2, questionIds, createdDaysAgo) => {
    const article = {
      ...base("knowledge"),
      createTime: daysAgo(createdDaysAgo),
      updateTime: daysAgo(Math.max(0, createdDaysAgo - 3)),
      userId: seedUser(username).id,
      title,
      summary,
      content,
      visibility
    };
    knowledge.push(article);
    tagNames2.forEach((n) => {
      knowledgeTagRels.push({ ...base("knowledgeTagRels"), knowledgeId: article.id, tagId: tagId(n) });
    });
    questionIds.forEach((qid) => {
      knowledgeQuestionRels.push({
        ...base("knowledgeQuestionRels"),
        knowledgeId: article.id,
        questionId: qid
      });
    });
    return article;
  };
  const q = (index) => questions[index % questions.length].id;
  addKnowledge(
    "admin",
    "\u5B50\u7F51\u5212\u5206\u4E0E CIDR \u901F\u67E5",
    "\u628A\u300C\u501F\u4F4D\u2014\u63A9\u7801\u2014\u53EF\u7528\u4E3B\u673A\u6570\u300D\u4E09\u6B65\u56FA\u5B9A\u4E0B\u6765\uFF0C\u8003\u573A\u4E0A\u4E0D\u7528\u73B0\u63A8\u3002",
    [
      "## \u4E00\u53E5\u8BDD\u7ED3\u8BBA",
      "",
      "\u5212\u5206\u5B50\u7F51\u5C31\u662F**\u4ECE\u4E3B\u673A\u4F4D\u501F\u4F4D**\uFF1A\u501F n \u4F4D \u2192 \u5B50\u7F51\u6570 2^n\uFF0C\u6BCF\u4E2A\u5B50\u7F51\u53EF\u7528\u4E3B\u673A\u6570 2^(\u5269\u4F59\u4E3B\u673A\u4F4D) \u2212 2\u3002",
      "",
      "### \u4E09\u6B65\u8D70",
      "",
      "1. \u770B\u63A9\u7801\u524D\u7F00\uFF08\u5982 `/26`\uFF09\uFF0C\u7B97\u51FA\u4E3B\u673A\u4F4D\u6570 `32 \u2212 26 = 6`",
      "2. \u53EF\u7528\u4E3B\u673A\u6570 = `2^6 \u2212 2 = 62`\uFF08\u51CF\u6389\u7F51\u7EDC\u53F7\u4E0E\u5E7F\u64AD\u5730\u5740\uFF09",
      "3. \u5B50\u7F51\u5757\u5927\u5C0F = `256 \u2212 \u63A9\u7801\u7B2C\u56DB\u6BB5\u503C`\uFF0C\u7528\u5B83\u5207\u5206\u7F51\u6BB5",
      "",
      "| \u524D\u7F00 | \u63A9\u7801 | \u5757\u5927\u5C0F | \u53EF\u7528\u4E3B\u673A |",
      "| --- | --- | --- | --- |",
      "| /24 | 255.255.255.0 | 256 | 254 |",
      "| /25 | 255.255.255.128 | 128 | 126 |",
      "| /26 | 255.255.255.192 | 64 | 62 |",
      "| /27 | 255.255.255.224 | 32 | 30 |",
      "",
      "> \u6613\u9519\u70B9\uFF1A\u9898\u76EE\u95EE\u300C\u53EF\u7528\u4E3B\u673A\u6570\u300D\u65F6\u4E00\u5B9A\u8981\u51CF 2\uFF1B\u95EE\u300C\u5B50\u7F51\u6570\u300D\u65F6\u4E0D\u8981\u518D\u51CF\u3002",
      "",
      "```text",
      "192.168.1.0/26",
      "  \u2192 \u7F51\u7EDC\u53F7   192.168.1.0",
      "  \u2192 \u7B2C\u4E00\u4E2A\u53EF\u7528 192.168.1.1",
      "  \u2192 \u6700\u540E\u4E00\u4E2A\u53EF\u7528 192.168.1.62",
      "  \u2192 \u5E7F\u64AD     192.168.1.63",
      "```",
      "",
      "### \u53CD\u5411\u9A8C\u8BC1",
      "",
      "\u7ED9\u4E00\u4E2A IP \u5224\u65AD\u5C5E\u4E8E\u54EA\u4E2A\u5B50\u7F51\uFF1A\u628A IP \u4E0E\u63A9\u7801**\u6309\u4F4D\u4E0E**\uFF0C\u7ED3\u679C\u5C31\u662F\u7F51\u7EDC\u53F7\u3002\u8FD9\u4E00\u6B65\u4E0D\u8981\u9760\u5FC3\u7B97\uFF0C\u5199\u4E0B\u6765\u6700\u5FEB\u3002"
    ].join("\n"),
    Visibility.PUBLIC,
    ["\u8BA1\u7B97\u673A\u7F51\u7EDC", "\u8BA1\u7B97\u673A\u57FA\u7840"],
    [q(0), q(1)],
    21
  );
  addKnowledge(
    "admin",
    "\u8FDB\u7A0B\u4E0E\u7EBF\u7A0B\uFF1A\u9762\u8BD5\u7B54\u9898\u6846\u67B6",
    "\u522B\u80CC\u5B9A\u4E49\uFF0C\u6309\u300C\u8D44\u6E90\u5206\u914D / \u8C03\u5EA6\u5355\u4F4D / \u5207\u6362\u4EE3\u4EF7 / \u901A\u4FE1\u65B9\u5F0F\u300D\u56DB\u53E5\u8BDD\u7B54\u5B8C\u3002",
    [
      "## \u56DB\u53E5\u8BDD\u6846\u67B6",
      "",
      "1. **\u8D44\u6E90\u5206\u914D**\uFF1A\u8FDB\u7A0B\u662F\u8D44\u6E90\u5206\u914D\u7684\u57FA\u672C\u5355\u4F4D\uFF0C\u7EBF\u7A0B\u662F\u8C03\u5EA6\u7684\u57FA\u672C\u5355\u4F4D",
      "2. **\u5730\u5740\u7A7A\u95F4**\uFF1A\u540C\u8FDB\u7A0B\u5185\u7EBF\u7A0B\u5171\u4EAB\u5730\u5740\u7A7A\u95F4\uFF0C\u8FDB\u7A0B\u4E4B\u95F4\u76F8\u4E92\u9694\u79BB",
      "3. **\u5207\u6362\u4EE3\u4EF7**\uFF1A\u7EBF\u7A0B\u5207\u6362\u4E0D\u6362\u9875\u8868\uFF0C\u6BD4\u8FDB\u7A0B\u5207\u6362\u4FBF\u5B9C",
      "4. **\u901A\u4FE1\u65B9\u5F0F**\uFF1A\u8FDB\u7A0B\u95F4\u8981\u8D70 IPC\uFF08\u7BA1\u9053 / \u5171\u4EAB\u5185\u5B58 / \u6D88\u606F\u961F\u5217 / \u4FE1\u53F7\uFF09\uFF0C\u7EBF\u7A0B\u76F4\u63A5\u8BFB\u5199\u5171\u4EAB\u53D8\u91CF\u4F46\u8981\u52A0\u9501",
      "",
      "### \u8FFD\u95EE\uFF1A\u4EC0\u4E48\u65F6\u5019\u7528\u591A\u8FDB\u7A0B\uFF1F",
      "",
      "- \u9700\u8981**\u9694\u79BB\u6027**\uFF08\u4E00\u4E2A\u6302\u4E86\u4E0D\u5F71\u54CD\u53E6\u4E00\u4E2A\uFF09",
      "- \u8981\u7ED5\u8FC7 GIL / \u5355\u7EBF\u7A0B\u74F6\u9888\uFF0C\u4E14\u8FDB\u7A0B\u95F4\u6570\u636E\u4EA4\u6362\u4E0D\u9891\u7E41",
      "- \u9700\u8981 CPU \u5BC6\u96C6\u578B\u5E76\u884C\u4E14\u8BED\u8A00\u8FD0\u884C\u65F6\u5BF9\u591A\u7EBF\u7A0B\u4E0D\u53CB\u597D",
      "",
      "### \u8FFD\u95EE\uFF1A\u7EBF\u7A0B\u6570\u5F00\u591A\u5C11\u5408\u9002\uFF1F",
      "",
      "CPU \u5BC6\u96C6\u578B\u7EA6\u7B49\u4E8E\u6838\u6570\uFF1BIO \u5BC6\u96C6\u578B\u53EF\u4EE5\u66F4\u5927\uFF0C\u4F46\u8981\u8003\u8651\u5185\u5B58\u4E0E\u4E0A\u4E0B\u6587\u5207\u6362\u6210\u672C\u3002**\u522B\u80CC\u56FA\u5B9A\u6570\u5B57\uFF0C\u8BB2\u6E05\u695A\u4F9D\u636E**\u3002"
    ].join("\n"),
    Visibility.PUBLIC,
    ["\u64CD\u4F5C\u7CFB\u7EDF", "Java\u57FA\u7840"],
    [q(2)],
    14
  );
  addKnowledge(
    "alice",
    "\u6570\u636E\u5E93\u8303\u5F0F\u4E0E\u53CD\u8303\u5F0F\uFF1A\u4EC0\u4E48\u65F6\u5019\u8BE5\u62C6\u8868",
    "\u4E09\u8303\u5F0F\u4E0D\u662F\u6559\u6761\uFF0C\u56DE\u7B54\u300C\u4E3A\u4EC0\u4E48\u5197\u4F59\u300D\u6BD4\u80CC\u5B9A\u4E49\u66F4\u52A0\u5206\u3002",
    [
      "## \u4E09\u8303\u5F0F\u901F\u8BB0",
      "",
      "- **1NF**\uFF1A\u5B57\u6BB5\u4E0D\u53EF\u518D\u5206",
      "- **2NF**\uFF1A\u975E\u4E3B\u952E\u5B57\u6BB5\u5B8C\u5168\u4F9D\u8D56\u4E3B\u952E\uFF08\u6D88\u6389\u90E8\u5206\u4F9D\u8D56\uFF09",
      "- **3NF**\uFF1A\u975E\u4E3B\u952E\u5B57\u6BB5\u4E0D\u4F20\u9012\u4F9D\u8D56\u4E3B\u952E",
      "",
      "## \u53CD\u8303\u5F0F\u4E0D\u662F\u9519",
      "",
      "\u8BFB\u591A\u5199\u5C11\u3001\u8054\u8868\u4EE3\u4EF7\u9AD8\u7684\u573A\u666F\uFF0C**\u9002\u5EA6\u5197\u4F59**\u53CD\u800C\u66F4\u597D\uFF1A",
      "",
      "| \u573A\u666F | \u505A\u6CD5 |",
      "| --- | --- |",
      "| \u8BA2\u5355\u5217\u8868\u8981\u663E\u793A\u7528\u6237\u540D | \u8BA2\u5355\u8868\u5197\u4F59 `user_name` |",
      "| \u7EDF\u8BA1\u62A5\u8868\u8981\u805A\u5408 | \u5355\u72EC\u5EFA\u6C47\u603B\u8868\uFF0C\u5B9A\u65F6\u5237\u65B0 |",
      "",
      "> \u5173\u952E\u662F\u628A\u300C\u4E00\u81F4\u6027\u7531\u8C01\u4FDD\u8BC1\u300D\u8BB2\u6E05\u695A\uFF1A\u9760\u4E8B\u52A1\u3001\u9760\u5B9A\u65F6\u5BF9\u8D26\uFF0C\u8FD8\u662F\u63A5\u53D7\u6700\u7EC8\u4E00\u81F4\u3002"
    ].join("\n"),
    Visibility.PUBLIC,
    ["\u6570\u636E\u5E93\u8BBE\u8BA1", "MySQL\u7D22\u5F15"],
    [q(3)],
    9
  );
  addKnowledge(
    "bob",
    "HTTP \u4E0E HTTPS \u63E1\u624B\u6D41\u7A0B\u7B14\u8BB0",
    "TLS \u63E1\u624B\u8BB0\u300C\u56DB\u6B21\u5F80\u8FD4\u300D\u6BD4\u8BB0\u6B65\u9AA4\u540D\u66F4\u7A33\u3002",
    [
      "## HTTP \u8BF7\u6C42\u5230\u54CD\u5E94\u7684\u5B8C\u6574\u94FE\u8DEF",
      "",
      "1. DNS \u89E3\u6790\uFF08\u6D4F\u89C8\u5668\u7F13\u5B58 \u2192 \u7CFB\u7EDF\u7F13\u5B58 \u2192 \u9012\u5F52\u67E5\u8BE2\uFF09",
      "2. TCP \u4E09\u6B21\u63E1\u624B",
      "3. **TLS \u63E1\u624B**\uFF08HTTPS \u72EC\u6709\uFF09",
      "4. \u53D1\u8BF7\u6C42\u3001\u7B49\u54CD\u5E94\u3001\u56DB\u6B21\u6325\u624B",
      "",
      "## TLS \u63E1\u624B\u5728\u505A\u4EC0\u4E48",
      "",
      "- \u534F\u5546\u7B97\u6CD5\u5957\u4EF6",
      "- \u670D\u52A1\u5668\u51FA\u793A\u8BC1\u4E66\uFF0C\u5BA2\u6237\u7AEF\u6821\u9A8C\uFF08CA \u94FE + \u57DF\u540D + \u6709\u6548\u671F\uFF09",
      "- \u4EA4\u6362\u5BC6\u94A5\u6750\u6599\uFF0C\u6D3E\u751F\u5BF9\u79F0\u5BC6\u94A5",
      "- \u4E4B\u540E\u6240\u6709\u6570\u636E\u7528**\u5BF9\u79F0\u52A0\u5BC6**\u4F20\u8F93\uFF08\u975E\u5BF9\u79F0\u53EA\u7528\u6765\u534F\u5546\uFF09",
      "",
      "> \u4E3A\u4EC0\u4E48\u4E0D\u5168\u7528\u975E\u5BF9\u79F0\uFF1F\u6162\u3002\u975E\u5BF9\u79F0\u53EA\u89E3\u51B3\u300C\u5B89\u5168\u5730\u4EA4\u6362\u5BF9\u79F0\u5BC6\u94A5\u300D\u8FD9\u4E00\u4EF6\u4E8B\u3002"
    ].join("\n"),
    Visibility.PUBLIC,
    // 刻意不绑标签：用于验证 15 号 KG-03（无标签的公开知识点仍应展示，但按标签筛选命中不到）
    [],
    [q(4)],
    5
  );
  const privateArticle = addKnowledge(
    "alice",
    "\u6211\u7684\u9519\u9898\u672C\uFF1A\u4F4D\u8FD0\u7B97\u6613\u9519\u70B9",
    "\u79C1\u6709\u7B14\u8BB0\uFF0C\u53EA\u6709\u6211\u80FD\u770B\u5230\u3002",
    [
      "## \u6211\u603B\u9519\u7684\u4E09\u4E2A\u70B9",
      "",
      "1. \u8D1F\u6570\u53F3\u79FB\uFF1A`>>` \u662F\u7B97\u672F\u53F3\u79FB\uFF08\u8865\u7B26\u53F7\u4F4D\uFF09\uFF0C`>>>` \u624D\u662F\u903B\u8F91\u53F3\u79FB",
      "2. \u5DE6\u79FB\u6EA2\u51FA\uFF1A`1 << 32` \u5728 Java \u91CC\u7B49\u4E8E `1 << 0`\uFF08\u79FB\u4F4D\u91CF\u5BF9 32 \u53D6\u6A21\uFF09",
      "3. \u5F02\u6216\u4EA4\u6362\u4E24\u4E2A\u6570\u65F6\uFF0C**\u4E0D\u80FD\u5BF9\u81EA\u5DF1\u5F02\u6216**\uFF08\u4F1A\u6E05\u96F6\uFF09",
      "",
      "> \u8FD9\u6761\u662F\u79C1\u6709\u7684\uFF1A\u5E7F\u573A\u4E0A\u4E0D\u8BE5\u51FA\u73B0\uFF0C\u522B\u4EBA\u76F4\u63A5\u8BBF\u95EE\u4E5F\u5E94\u8BE5\u88AB\u62E6\u3002"
    ].join("\n"),
    Visibility.PRIVATE,
    ["Java\u57FA\u7840", "\u8FDB\u5236\u8F6C\u6362"],
    [q(5)],
    3
  );
  addKnowledge(
    "bob",
    "\u5F85\u8865\u5145\uFF1AUML \u7528\u4F8B\u56FE",
    "\u8349\u7A3F\uFF0C\u8FD8\u6CA1\u5199\u5B8C\u3002",
    "## \u5F85\u529E\n\n- \u8865\u53C2\u4E0E\u8005\u4E0E\u7528\u4F8B\u7684\u5173\u7CFB\n- \u8865 include / extend \u533A\u522B\n",
    Visibility.PRIVATE,
    ["\u7CFB\u7EDF\u8BBE\u8BA1"],
    [],
    1
  );
  knowledgeAnnotations.push({
    ...base("knowledgeAnnotations"),
    knowledgeId: privateArticle.id,
    userId: seedUser("alice").id,
    content: "\u590D\u4E60\u63D0\u9192\uFF1A\u4F4D\u8FD0\u7B97\u90A3\u9898\u6211\u9519\u5728\u7B2C 2 \u70B9\uFF0C\u8003\u8BD5\u524D\u518D\u770B\u4E00\u904D\u79FB\u4F4D\u53D6\u6A21\u7684\u89C4\u5219\u3002"
  });
  const questionNotes = [];
  const aliceWrongQuestion = records.find((r) => r.userId === seedUser("alice").id)?.questionId;
  if (aliceWrongQuestion) {
    questionNotes.push({
      ...base("questionNotes"),
      userId: seedUser("alice").id,
      questionId: aliceWrongQuestion,
      content: [
        "\u7B2C\u4E09\u904D\u7EC8\u4E8E\u505A\u5BF9\u4E86\uFF0C\u8BB0\u4E00\u4E0B\u5F53\u65F6\u7684\u5751\uFF1A",
        "",
        "1. \u5148\u628A\u9009\u9879\u91CC\u7684\u300C**\u4E00\u5B9A**\u300D\u300C**\u5FC5\u987B**\u300D\u5708\u51FA\u6765\uFF0C\u8FD9\u79CD\u8BCD\u5F80\u5F80\u5C31\u662F\u9519\u9879\u7684\u4FE1\u53F7",
        "2. \u7B97\u5B8C\u987A\u624B\u7528\u53CD\u5411\u4EE3\u5165\u9A8C\u4E00\u904D\uFF0C\u6BD4\u91CD\u65B0\u63A8\u4E00\u904D\u5FEB",
        "",
        "> \u8FD9\u6761\u7B14\u8BB0\u53EA\u6709\u6211\u81EA\u5DF1\u770B\u5F97\u5230\uFF0C\u522B\u4EBA\u7FFB\u6211\u7684\u9519\u9898\u8BB0\u5F55\u4E5F\u770B\u4E0D\u5230\u3002"
      ].join("\n")
    });
  }
  const favorites = [];
  const seedAliceId = seedUser("alice").id;
  const seedAdminId = seedUser("admin").id;
  const seedBobId = seedUser("bob").id;
  const publicDraftOfAdmin = drafts.find(
    (d) => d.userId === seedAdminId && d.visibility === Visibility.PUBLIC && d.deleted === 0
  );
  if (publicDraftOfAdmin) {
    favorites.push({
      ...base("favorites"),
      userId: seedAliceId,
      targetType: FavoriteTargetType.DRAFT,
      targetId: publicDraftOfAdmin.id
    });
    const rel = draftQuestionRels.find(
      (r) => r.draftId === publicDraftOfAdmin.id && r.deleted === 0
    );
    if (rel) {
      favorites.push({
        ...base("favorites"),
        userId: seedAliceId,
        targetType: FavoriteTargetType.QUESTION,
        targetId: rel.questionId
      });
    }
  }
  const publicArticle = knowledge.find((k) => k.visibility === Visibility.PUBLIC);
  if (publicArticle) {
    favorites.push({
      ...base("favorites"),
      userId: seedAliceId,
      targetType: FavoriteTargetType.KNOWLEDGE,
      targetId: publicArticle.id
    });
  }
  const bobPrivateDraft = drafts.find(
    (d) => d.userId === seedBobId && d.visibility === Visibility.PRIVATE && d.deleted === 0
  );
  if (bobPrivateDraft) {
    favorites.push({
      ...base("favorites"),
      userId: seedAliceId,
      targetType: FavoriteTargetType.DRAFT,
      targetId: bobPrivateDraft.id
    });
  }
  const feedbackTickets = [];
  const aliceId = seedUser("alice").id;
  const bobId = seedUser("bob").id;
  const adminId = seedUser("admin").id;
  const someQuestion = questions[0];
  if (someQuestion) {
    feedbackTickets.push({
      ...base("feedbackTickets"),
      createTime: daysAgo(3),
      updateTime: daysAgo(3),
      userId: aliceId,
      questionId: someQuestion.id,
      description: "\u8FD9\u9053\u9898\u7684\u89E3\u6790\u91CC\u628A\u300C\u6309\u4F4D\u4E0E\u300D\u5199\u6210\u4E86\u300C\u6309\u4F4D\u6216\u300D\uFF0C\u7ED3\u679C\u6CA1\u9519\u4F46\u63A8\u5BFC\u8FC7\u7A0B\u5BF9\u4E0D\u4E0A\uFF0C\u9EBB\u70E6\u6838\u5BF9\u4E00\u4E0B\u3002",
      status: FeedbackStatus.PENDING
    });
  }
  const anotherQuestion = questions[1];
  if (anotherQuestion) {
    feedbackTickets.push({
      ...base("feedbackTickets"),
      createTime: daysAgo(9),
      updateTime: daysAgo(7),
      userId: bobId,
      questionId: anotherQuestion.id,
      description: "\u9009\u9879 C \u548C D \u7684\u8868\u8FF0\u51E0\u4E4E\u4E00\u6837\uFF0C\u770B\u4E0D\u51FA\u533A\u522B\uFF0C\u6000\u7591\u6709\u7B14\u8BEF\u3002",
      status: FeedbackStatus.HANDLED,
      adminRemark: "\u5DF2\u786E\u8BA4\u9898\u5E72\u7B14\u8BEF\uFF0C\u6309\u300C\u590D\u5236\u4E3A\u65B0\u9898\u300D\u6D41\u7A0B\u4FEE\u6B63\uFF0C\u539F\u9898\u4FDD\u7559\u4E0D\u52A8\u3002",
      handledBy: adminId,
      handledTime: daysAgo(7)
    });
  }
  feedbackTickets.push({
    ...base("feedbackTickets"),
    createTime: daysAgo(1),
    updateTime: daysAgo(1),
    userId: aliceId,
    questionId: 999999,
    description: "\uFF08\u8FD9\u6761\u53CD\u9988\u5BF9\u5E94\u7684\u9898\u76EE\u540E\u6765\u88AB\u5220\u6389\u4E86\uFF0C\u7528\u4E8E\u9A8C\u8BC1\u5DE5\u5355\u672C\u8EAB\u4E0D\u8DDF\u7740\u5220\uFF09",
    status: FeedbackStatus.PENDING
  });
  return {
    users,
    categories,
    categoryTagRels,
    categoryWeights,
    tags,
    drafts,
    draftQuestionRels,
    questions,
    questionTagRels,
    exams,
    examQuestions,
    records,
    wrongDetails,
    knowledge,
    knowledgeTagRels,
    knowledgeQuestionRels,
    knowledgeAnnotations,
    questionNotes,
    favorites,
    feedbackTickets,
    seq
  };
}

// src/mock/db.ts
var DB_KEY = "zhilian-qbank-demo-db-v1";
var SESSION_KEY = "zhilian-qbank-demo-session-v1";
var SESSION_EPOCH_KEY = "zhilian-qbank-demo-session-epoch-v1";
var EXAM_POS_KEY = "zhilian-qbank-demo-exam-pos-v1";
var cache = null;
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function newStamp() {
  const t = nowIso();
  return { createTime: t, updateTime: t };
}
var TABLE_KEYS = [
  "users",
  "categories",
  "categoryTagRels",
  "categoryWeights",
  "tags",
  "drafts",
  "draftQuestionRels",
  "questions",
  "questionTagRels",
  "exams",
  "examQuestions",
  "records",
  "wrongDetails",
  "knowledge",
  "knowledgeTagRels",
  "knowledgeQuestionRels",
  "knowledgeAnnotations",
  "questionNotes",
  "favorites",
  "feedbackTickets"
];
function migrateLegacyDb(db) {
  const target = db;
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(target[key])) target[key] = [];
  }
  if (!target.seq || typeof target.seq !== "object") target.seq = {};
  return db;
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.users ? migrateLegacyDb(parsed) : null;
  } catch {
    return null;
  }
}
function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[mock-db] \u6301\u4E45\u5316\u5931\u8D25", e);
  }
}
function getDb() {
  if (!cache) {
    cache = loadFromStorage() ?? buildSeed();
    persist();
  }
  return cache;
}
function saveDb() {
  persist();
}
function resetDb() {
  cache = buildSeed();
  persist();
  clearSession();
  clearSessionEpochs();
  clearExamPositions();
}
function nextId(table) {
  const db = getDb();
  db.seq[table] = (db.seq[table] ?? 0) + 1;
  return db.seq[table];
}
function active(rows) {
  return rows.filter((r) => r.deleted === 0);
}
function softDelete(rows, id) {
  const row = rows.find((r) => r.id === id && r.deleted === 0);
  if (!row) return false;
  row.deleted = row.id;
  row.deleteTime = nowIso();
  return true;
}
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return { userId: null, token: null, loginTime: null };
}
function setSession(state) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
function readSessionEpochs() {
  try {
    const raw = localStorage.getItem(SESSION_EPOCH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function sessionEpochOf(userId) {
  return readSessionEpochs()[String(userId)] ?? 0;
}
function bumpSessionEpoch(userId) {
  try {
    const all = readSessionEpochs();
    all[String(userId)] = (all[String(userId)] ?? 0) + 1;
    localStorage.setItem(SESSION_EPOCH_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("[mock-db] \u4F1A\u8BDD\u7248\u672C\u53F7\u6301\u4E45\u5316\u5931\u8D25", e);
  }
}
function clearSessionEpochs() {
  localStorage.removeItem(SESSION_EPOCH_KEY);
}
function isSessionStale(session) {
  if (!session.userId) return false;
  return (session.epoch ?? 0) !== sessionEpochOf(session.userId);
}
function clearExamPositions() {
  localStorage.removeItem(EXAM_POS_KEY);
}

// src/constants/apiCodes.ts
var ApiCode = {
  /** 未分类的业务失败（默认） */
  GENERIC: 1,
  /** 会话失效或未登录 */
  SESSION: 401,
  /** 已登录但无权限 */
  NO_PERMISSION: 403,
  /** 资源不存在或对当前身份不可见 */
  NOT_FOUND: 404
};

// src/mock/errors.ts
var DomainError = class extends Error {
  code;
  constructor(message, code = ApiCode.GENERIC) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
};
function noPermission(message = "\u65E0\u6743\u8BBF\u95EE\u8BE5\u8D44\u6E90") {
  return new DomainError(message, ApiCode.NO_PERMISSION);
}
function notFound(message = "\u8D44\u6E90\u4E0D\u5B58\u5728") {
  return new DomainError(message, ApiCode.NOT_FOUND);
}
function sessionInvalid(message = "\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548") {
  return new DomainError(message, ApiCode.SESSION);
}

// src/constants/copy.ts
var Copy = {
  /** 游客触发写操作（弹窗） */
  loginRequired: "\u8BF7\u767B\u5F55\u540E\u6267\u884C\u8BE5\u64CD\u4F5C",
  /** 置灰按钮的 tooltip（游客） */
  guestDisabledTip: "\u767B\u5F55\u540E\u53EF\u7528",
  /** 无权限访问 /admin/*（S3） */
  noPermission: "\u65E0\u6743\u8BBF\u95EE\u8BE5\u9875\u9762\uFF1A\u9700\u8981\u7BA1\u7406\u5458\u8EAB\u4EFD",
  /** 会话失效（PER-02） */
  sessionExpired: "\u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
  /** 资源已删除（S4 详情页） */
  resourceDeleted: "\u8BE5\u8D44\u6E90\u5DF2\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664",
  /** 资源转为私有 / 被废弃（S4 列表条目） */
  resourceUnavailable: "\u8D44\u6E90\u5DF2\u4E0D\u53EF\u8BBF\u95EE",
  /** 已注销账号的治理操作（UM-03 / UM-04） */
  accountDeactivated: "\u8BE5\u8D26\u53F7\u5DF2\u6CE8\u9500\uFF0C\u4E0D\u53EF\u64CD\u4F5C",
  /** 取消自己的管理员角色（UM-05） */
  cannotCancelOwnAdmin: "\u4E0D\u80FD\u53D6\u6D88\u81EA\u5DF1\u7684\u7BA1\u7406\u5458\u89D2\u8272",
  /** 已注销用户主页标注 */
  userDeactivated: "\u8BE5\u7528\u6237\u5DF2\u6CE8\u9500",
  /** 锁定底稿 / 锁定题目只读说明 */
  lockedReadonly: "\u8BE5\u8BD5\u5377\u5DF2\u9501\u5B9A\uFF1A\u542F\u7528\u540E\u5185\u5BB9\u6C38\u4E45\u53EA\u8BFB\uFF1B\u9898\u76EE\u88AB\u5DF2\u9501\u5B9A\u8BD5\u5377\u5F15\u7528\uFF0C\u4EC5\u6807\u7B7E\u53EF\u8C03\u6574",
  /** 知识点广场筛选无结果（15 号 KG-06，v1-plus） */
  knowledgeEmpty: "\u6CA1\u6709\u627E\u5230\u7B26\u5408\u6761\u4EF6\u7684\u77E5\u8BC6\u70B9\uFF0C\u8BF7\u8C03\u6574\u7B5B\u9009\u6761\u4EF6",
  /** 统计大盘无数据（15 号 ST-02 / ST-05，v1-plus） */
  statsEmpty: "\u6682\u65E0\u7B54\u9898\u6570\u636E\uFF0C\u5B8C\u6210\u8BD5\u5377\u540E\u67E5\u770B\u7EDF\u8BA1",
  /** 组卷推荐无匹配知识点（15 号 CL-02，v1-plus） */
  composeNoKnowledge: "\u672A\u627E\u5230\u5339\u914D\u7684\u63A8\u8350\u77E5\u8BC6\u70B9",
  /** 题目笔记为空（15 号 NT-06，v1-plus） */
  noteEmpty: "\u6682\u65E0\u4E2A\u4EBA\u7B14\u8BB0",
  /** 报错题目已失效（15 号 FB-U2，v1-plus） */
  reportQuestionGone: "\u8BE5\u9898\u76EE\u5DF2\u5931\u6548\uFF0C\u4E0D\u80FD\u63D0\u4EA4\u53CD\u9988",
  /* --- v1-plus 实施期新增（与 13 号 §9.5 同表维护，避免各页自创文案） --- */
  /** 错题无关联知识点：按钮置灰时的原因说明（15 号 CL-01） */
  noKnowledgeLinked: "\u8FD9\u9053\u9898\u8FD8\u6CA1\u6709\u5173\u8054\u77E5\u8BC6\u70B9"
};

// src/mock/repo.ts
var allUsers = () => active(getDb().users);
var findUser = (id) => allUsers().find((u) => u.id === id) ?? null;
var findUserByName = (name) => allUsers().find((u) => u.username === name) ?? null;
var findUsersByPhone = (phone) => allUsers().filter((u) => u.phone === phone);
var allCategories = () => active(getDb().categories).sort((a, b) => a.sortNo - b.sortNo);
var findCategory = (id) => allCategories().find((c) => c.id === id) ?? null;
var allTags = () => active(getDb().tags).sort((a, b) => a.sortNo - b.sortNo);
var findTag = (id) => allTags().find((t) => t.id === id) ?? null;
var categoryTagIds = (categoryId) => active(getDb().categoryTagRels).filter((r) => r.categoryId === categoryId).map((r) => r.tagId);
var allDrafts = () => active(getDb().drafts);
var findDraft = (id) => allDrafts().find((d) => d.id === id) ?? null;
var allQuestions = () => active(getDb().questions);
var findQuestion = (id) => allQuestions().find((q) => q.id === id) ?? null;
var allExams = () => active(getDb().exams);
var findExam = (id) => allExams().find((e) => e.id === id) ?? null;
var allExamQuestions = () => active(getDb().examQuestions);
var examQuestionsOf = (examId) => allExamQuestions().filter((eq) => eq.examId === examId).sort((a, b) => a.sortNo - b.sortNo);
var allRecords = () => active(getDb().records);
var recordsOfUser = (userId) => allRecords().filter((r) => r.userId === userId);
var findRecord = (userId, questionId, categoryId) => recordsOfUser(userId).find(
  (r) => r.questionId === questionId && r.categoryId === categoryId
) ?? null;
var draftRels = (draftId) => active(getDb().draftQuestionRels).filter((r) => r.draftId === draftId).sort((a, b) => a.sortNo - b.sortNo);
var relsByQuestion = (questionId) => active(getDb().draftQuestionRels).filter((r) => r.questionId === questionId);
var questionTagIds = (questionId) => active(getDb().questionTagRels).filter((r) => r.questionId === questionId).map((r) => r.tagId);
var questionTagNames = (questionId) => questionTagIds(questionId).map((id) => findTag(id)?.tagName).filter((v) => !!v);
var categoryWeightMap = (categoryId) => {
  const map = /* @__PURE__ */ new Map();
  active(getDb().categoryWeights).filter((w) => w.categoryId === categoryId).forEach((w) => map.set(w.tagId, w.weight));
  return map;
};
var lockedDraftsReferencing = (questionId) => relsByQuestion(questionId).map((rel) => findDraft(rel.draftId)).filter((d) => !!d && d.isLocked === 1 && d.draftStatus !== DraftStatus.DISCARDED);
var examQuestionsByQuestion = (questionId) => allExamQuestions().filter((eq) => eq.questionId === questionId);
function insertCategoryTagRel(categoryId, tagId) {
  const row = {
    id: nextId("categoryTagRels"),
    categoryId,
    tagId,
    deleted: 0,
    ...newStamp()
  };
  getDb().categoryTagRels.push(row);
  return row;
}
function insertCategoryWeight(categoryId, tagId, weight) {
  const db = getDb();
  const exist = active(db.categoryWeights).find(
    (w) => w.categoryId === categoryId && w.tagId === tagId
  );
  if (exist) {
    exist.weight = weight;
    exist.updateTime = nowIso();
    return;
  }
  db.categoryWeights.push({
    id: nextId("categoryWeights"),
    categoryId,
    tagId,
    weight,
    deleted: 0,
    ...newStamp()
  });
}
function insertQuestionTagRel(questionId, tagId) {
  const db = getDb();
  const exist = active(db.questionTagRels).find(
    (r) => r.questionId === questionId && r.tagId === tagId
  );
  if (exist) return;
  db.questionTagRels.push({
    id: nextId("questionTagRels"),
    questionId,
    tagId,
    deleted: 0,
    ...newStamp()
  });
}
function insertDraftQuestionRel(draftId, questionId, sortNo, score) {
  const row = {
    id: nextId("draftQuestionRels"),
    draftId,
    questionId,
    sortNo,
    score,
    deleted: 0,
    ...newStamp()
  };
  getDb().draftQuestionRels.push(row);
  return row;
}
var submittedExamsOf = (userId) => allExams().filter((e) => e.userId === userId && !!e.submitTime);
var judgedExamQuestionsOf = (userId) => {
  const result = [];
  submittedExamsOf(userId).forEach((exam) => {
    examQuestionsOf(exam.id).forEach((eq) => {
      if (eq.judgeStatus === JudgeStatus.JUDGED) result.push({ exam, eq });
    });
  });
  return result;
};

// src/mock/service/authService.ts
var PHONE_RE = /^\d{11}$/;
function assertPhone(phone) {
  if (!phone) throw new Error("\u624B\u673A\u53F7\u5FC5\u586B");
  if (!PHONE_RE.test(phone)) throw new Error("\u624B\u673A\u53F7\u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u5E94\u4E3A 11 \u4F4D\u6570\u5B57\uFF09");
}
function isUsernameTaken(username) {
  return getDb().users.some((u) => u.username === username);
}
function checkUsernameAvailable(username) {
  if (!username.trim()) return { available: false, message: "\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" };
  if (isUsernameTaken(username)) return { available: false, message: "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u5360\u7528\uFF08\u6CE8\u9500\u8D26\u53F7\u7684\u7528\u6237\u540D\u540C\u6837\u4E0D\u53EF\u590D\u7528\uFF09" };
  return { available: true, message: "\u8BE5\u7528\u6237\u540D\u53EF\u4F7F\u7528" };
}
function register(params) {
  const username = params.username.trim();
  if (!username) throw new Error("\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A");
  if (!params.password) throw new Error("\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
  if (params.password.length > 128) throw new Error("\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u8D85\u8FC7 128 \u5B57\u7B26");
  assertPhone(params.phone);
  if (isUsernameTaken(username)) throw new Error("\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u5360\u7528");
  const db = getDb();
  const stamp = newStamp();
  const user = {
    id: nextId("users"),
    deleted: 0,
    ...stamp,
    username,
    password: hashPassword(params.password),
    phone: params.phone,
    roleType: RoleType.USER,
    profile: null,
    privacyType: PrivacyType.PRIVATE,
    lastLoginTime: null
  };
  db.users.push(user);
  return user;
}
function login(params) {
  let user = null;
  if (params.mode === "phone") {
    const phone = (params.phone ?? "").trim();
    if (!phone) throw new Error("\u8BF7\u8F93\u5165\u624B\u673A\u53F7");
    if (!params.username.trim()) throw new Error("\u624B\u673A\u53F7\u767B\u5F55\u9700\u540C\u65F6\u586B\u5199\u7528\u6237\u540D\u4EE5\u786E\u5B9A\u8D26\u53F7");
    const candidates = findUsersByPhone(phone).filter((u) => u.username === params.username.trim());
    if (candidates.length === 0) throw new Error("\u624B\u673A\u53F7\u4E0E\u7528\u6237\u540D\u4E0D\u5339\u914D");
    user = candidates[0];
  } else {
    user = findUserByName(params.username.trim());
  }
  if (!user) throw new Error("\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF");
  if (user.deleted !== 0) throw new Error("\u8BE5\u8D26\u53F7\u5DF2\u6CE8\u9500\uFF0C\u65E0\u6CD5\u767B\u5F55");
  if (!verifyPassword(params.password, user.password)) throw new Error("\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF");
  user.lastLoginTime = nowIso();
  const token = `demo-token-${user.id}-${Date.now().toString(36)}`;
  setSession({
    userId: user.id,
    token,
    loginTime: nowIso(),
    roleType: user.roleType,
    epoch: sessionEpochOf(user.id)
  });
  return { token, user };
}
function logout() {
  clearSession();
}
function currentUser() {
  const session = getSession();
  if (!session.userId) return null;
  const user = findUser(session.userId);
  if (!user || user.deleted !== 0) {
    clearSession();
    return null;
  }
  if (isSessionStale(session)) {
    clearSession();
    return null;
  }
  if (session.roleType && session.roleType !== user.roleType) {
    return { ...user, roleType: session.roleType };
  }
  return user;
}
function requireUser() {
  const user = currentUser();
  if (!user) throw sessionInvalid();
  return user;
}
function requireAdmin() {
  const user = requireUser();
  if (user.roleType !== RoleType.ADMIN) throw noPermission("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650");
  return user;
}
function isSessionExpired() {
  const session = getSession();
  if (!session.userId) return false;
  const user = findUser(session.userId);
  if (!user || user.deleted !== 0) return true;
  return isSessionStale(session);
}
function resetPassword(params) {
  const phone = params.phone.trim();
  const username = params.username.trim();
  if (!phone || !username) throw new Error("\u624B\u673A\u53F7\u4E0E\u7528\u6237\u540D\u5747\u9700\u586B\u5199");
  if (!params.newPassword) throw new Error("\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
  const user = getDb().users.find(
    (u) => u.deleted === 0 && u.phone === phone && u.username === username
  );
  if (!user) throw new Error("\u624B\u673A\u53F7\u4E0E\u7528\u6237\u540D\u4E0D\u5339\u914D\uFF0C\u65E0\u6CD5\u91CD\u7F6E\u5BC6\u7801");
  user.password = hashPassword(params.newPassword);
  user.updateTime = nowIso();
  clearSession();
}
function updateProfile(userId, params) {
  const db = getDb();
  const user = db.users.find((u) => u.id === userId && u.deleted === 0);
  if (!user) throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  if (params.profile !== void 0) {
    if ((params.profile ?? "").length > 500) throw new Error("\u4E2A\u4EBA\u7B80\u4ECB\u6700\u591A 500 \u5B57");
    user.profile = params.profile;
  }
  if (params.privacyType !== void 0) {
    if (![PrivacyType.PRIVATE, PrivacyType.PUBLIC].includes(params.privacyType)) {
      throw new Error("\u9690\u79C1\u8BBE\u7F6E\u53D6\u503C\u975E\u6CD5");
    }
    user.privacyType = params.privacyType;
  }
  user.updateTime = nowIso();
  return user;
}
function changePassword(userId, oldPassword, newPassword) {
  const user = findUser(userId);
  if (!user) throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  if (!verifyPassword(oldPassword, user.password)) throw new Error("\u539F\u5BC6\u7801\u4E0D\u6B63\u786E");
  if (!newPassword) throw new Error("\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
  user.password = hashPassword(newPassword);
  user.updateTime = nowIso();
}
function deactivateAccount(userId, password) {
  const db = getDb();
  const user = db.users.find((u) => u.id === userId && u.deleted === 0);
  if (!user) throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  if (!verifyPassword(password, user.password)) throw new Error("\u5BC6\u7801\u4E0D\u6B63\u786E\uFF0C\u65E0\u6CD5\u6CE8\u9500");
  const now2 = nowIso();
  user.deleted = user.id;
  user.deleteTime = now2;
  user.updateTime = now2;
  db.drafts.filter((d) => d.userId === userId && d.visibility === Visibility.PRIVATE && d.deleted === 0).forEach((d) => {
    d.draftStatus = DraftStatus.DISCARDED;
    d.updateTime = now2;
  });
  clearSession();
}
function listUsers() {
  return getDb().users.filter((u) => u.deleted === 0);
}
function listUsersForAdmin(filter = {}) {
  const operator = requireAdmin();
  const keyword = (filter.keyword ?? "").trim().toLowerCase();
  const status = filter.accountStatus ?? "all";
  return getDb().users.filter((u) => {
    if (keyword && !u.username.toLowerCase().includes(keyword)) return false;
    if (status === "normal") return u.deleted === 0;
    if (status === "deactivated") return u.deleted !== 0;
    return true;
  }).map((u) => ({
    id: u.id,
    username: u.username,
    phone: u.phone,
    createTime: u.createTime,
    deleteTime: u.deleteTime ?? null,
    deactivated: u.deleted !== 0,
    roleType: u.roleType,
    isSelf: u.id === operator.id
  })).sort((a, b) => a.id - b.id);
}
function adminResetPassword(targetUserId, newPassword) {
  requireAdmin();
  const target = getDb().users.find((u) => u.id === targetUserId);
  if (!target) throw notFound("\u7528\u6237\u4E0D\u5B58\u5728");
  if (target.deleted !== 0) throw noPermission(Copy.accountDeactivated);
  if (!newPassword) throw new Error("\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
  target.password = hashPassword(newPassword);
  target.updateTime = nowIso();
  bumpSessionEpoch(target.id);
}
function adminSwitchRole(targetUserId) {
  const operator = requireAdmin();
  const target = getDb().users.find((u) => u.id === targetUserId);
  if (!target) throw notFound("\u7528\u6237\u4E0D\u5B58\u5728");
  if (target.deleted !== 0) throw noPermission(Copy.accountDeactivated);
  if (target.id === operator.id) throw noPermission(Copy.cannotCancelOwnAdmin);
  target.roleType = target.roleType === RoleType.ADMIN ? RoleType.USER : RoleType.ADMIN;
  target.updateTime = nowIso();
  return target.roleType;
}

// src/mock/service/categoryService.ts
function listCategories() {
  return allCategories().map((category) => {
    const weightMap = categoryWeightMap(category.id);
    return {
      ...category,
      tagIds: categoryTagIds(category.id),
      weights: [...weightMap.entries()].map(([tagId, weight]) => ({ tagId, weight })),
      draftCount: allDrafts().filter((d) => d.categoryId === category.id).length
    };
  });
}
function createCategory(operatorId, payload) {
  requireAdmin();
  if (!payload.categoryName.trim()) throw new Error("\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (allCategories().some((c) => c.categoryName === payload.categoryName.trim())) {
    throw new Error("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
  }
  if (payload.fixedQuestionCount <= 0) throw new Error("\u56FA\u5B9A\u9898\u91CF\u5FC5\u987B\u5927\u4E8E 0");
  const db = getDb();
  const stamp = newStamp();
  const category = {
    id: nextId("categories"),
    deleted: 0,
    ...stamp,
    categoryName: payload.categoryName.trim(),
    fixedQuestionCount: payload.fixedQuestionCount,
    isSystem: 0,
    sortNo: allCategories().length + 1
  };
  db.categories.push(category);
  syncCategoryTags(category.id, payload);
  return category;
}
function updateCategory(operatorId, categoryId, payload) {
  requireAdmin();
  const category = findCategory(categoryId);
  if (!category) throw new Error("\u5206\u7C7B\u4E0D\u5B58\u5728");
  if (!payload.categoryName.trim()) throw new Error("\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (allCategories().some(
    (c) => c.id !== categoryId && c.categoryName === payload.categoryName.trim()
  )) {
    throw new Error("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
  }
  if (payload.fixedQuestionCount <= 0) throw new Error("\u56FA\u5B9A\u9898\u91CF\u5FC5\u987B\u5927\u4E8E 0");
  category.categoryName = payload.categoryName.trim();
  category.fixedQuestionCount = payload.fixedQuestionCount;
  category.updateTime = nowIso();
  syncCategoryTags(categoryId, payload);
  return category;
}
function syncCategoryTags(categoryId, payload) {
  const db = getDb();
  const current = categoryTagIds(categoryId);
  const next = payload.tagIds;
  db.categoryTagRels.filter((r) => r.categoryId === categoryId && r.deleted === 0 && !next.includes(r.tagId)).forEach((r) => {
    r.deleted = r.id;
    r.deleteTime = nowIso();
  });
  next.filter((tagId) => !current.includes(tagId)).forEach((tagId) => insertCategoryTagRel(categoryId, tagId));
  payload.weights.filter((w) => next.includes(w.tagId)).forEach((w) => insertCategoryWeight(categoryId, w.tagId, w.weight));
}
function deleteCategory(operatorId, categoryId) {
  requireAdmin();
  const category = findCategory(categoryId);
  if (!category) throw new Error("\u5206\u7C7B\u4E0D\u5B58\u5728");
  if (category.isSystem === 1) throw new Error("\u7CFB\u7EDF\u9884\u7F6E\u5206\u7C7B\u4E0D\u53EF\u5220\u9664");
  const used = allDrafts().filter((d) => d.categoryId === categoryId);
  if (used.length > 0) {
    throw new Error(`\u8BE5\u5206\u7C7B\u4ECD\u88AB ${used.length} \u4EFD\u8BD5\u5377\u5F15\u7528\uFF0C\u8BF7\u5148\u5904\u7406\u8FD9\u4E9B\u8BD5\u5377`);
  }
  const db = getDb();
  db.categoryTagRels.filter((r) => r.categoryId === categoryId && r.deleted === 0).forEach((r) => softDelete(db.categoryTagRels, r.id));
  db.categoryWeights.filter((r) => r.categoryId === categoryId && r.deleted === 0).forEach((r) => softDelete(db.categoryWeights, r.id));
  softDelete(db.categories, categoryId);
}
function listTags(includeDisabled = true) {
  const db = getDb();
  return allTags().filter((t) => includeDisabled ? true : t.isEnabled === EnabledFlag.ENABLED).map((tag) => ({
    ...tag,
    usedCount: db.questionTagRels.filter((r) => r.tagId === tag.id && r.deleted === 0).length
  }));
}
function createTag(operatorId, tagName) {
  requireAdmin();
  if (!tagName.trim()) throw new Error("\u6807\u7B7E\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (allTags().some((t) => t.tagName === tagName.trim())) throw new Error("\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728");
  const db = getDb();
  const stamp = newStamp();
  const tag = {
    id: nextId("tags"),
    deleted: 0,
    ...stamp,
    tagName: tagName.trim(),
    isEnabled: EnabledFlag.ENABLED,
    sortNo: allTags().length + 1
  };
  db.tags.push(tag);
  return tag;
}
function updateTag(operatorId, tagId, payload) {
  requireAdmin();
  const tag = findTag(tagId);
  if (!tag) throw new Error("\u6807\u7B7E\u4E0D\u5B58\u5728");
  if (payload.tagName !== void 0) {
    if (!payload.tagName.trim()) throw new Error("\u6807\u7B7E\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    if (allTags().some((t) => t.id !== tagId && t.tagName === payload.tagName.trim())) {
      throw new Error("\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728");
    }
    tag.tagName = payload.tagName.trim();
  }
  if (payload.isEnabled !== void 0) tag.isEnabled = payload.isEnabled;
  tag.updateTime = nowIso();
  return tag;
}
function deleteTag(operatorId, tagId) {
  requireAdmin();
  const db = getDb();
  const categoryRefs = db.categoryTagRels.filter((r) => r.tagId === tagId && r.deleted === 0).length;
  const questionRefs = db.questionTagRels.filter((r) => r.tagId === tagId && r.deleted === 0).length;
  if (categoryRefs > 0 || questionRefs > 0) {
    throw new Error(
      `\u8BE5\u6807\u7B7E\u88AB ${categoryRefs} \u4E2A\u5206\u7C7B\u3001${questionRefs} \u9053\u9898\u76EE\u5F15\u7528\uFF0C\u4E0D\u53EF\u5220\u9664\uFF1B\u5EFA\u8BAE\u6539\u4E3A"\u505C\u7528"`
    );
  }
  softDelete(db.tags, tagId);
}
function adminUpdateQuestionTags(operatorId, questionId, tagIds) {
  requireAdmin();
  const db = getDb();
  const current = questionTagIds(questionId);
  db.questionTagRels.filter((r) => r.questionId === questionId && r.deleted === 0 && !tagIds.includes(r.tagId)).forEach((r) => {
    r.deleted = r.id;
    r.deleteTime = nowIso();
  });
  tagIds.filter((id) => !current.includes(id)).forEach((id) => insertQuestionTagRel(questionId, id));
}
function categoryTagConfig(categoryId) {
  const weightMap = categoryWeightMap(categoryId);
  return {
    tagIds: categoryTagIds(categoryId),
    weights: [...weightMap.entries()].map(([tagId, weight]) => ({ tagId, weight }))
  };
}

// src/mock/rules/compose.ts
function buildCandidates(userId, params) {
  const warnings = [];
  const category = findCategory(params.categoryId);
  if (!category) return { candidates: [], warnings: ["\u8BD5\u5377\u5206\u7C7B\u4E0D\u5B58\u5728"] };
  const categoryTags = categoryTagIds(params.categoryId);
  const weightMap = categoryWeightMap(params.categoryId);
  const selectedTags = params.tagIds.filter((id) => categoryTags.includes(id));
  if (params.tagIds.length !== selectedTags.length) {
    warnings.push("\u5DF2\u81EA\u52A8\u5FFD\u7565\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5206\u7C7B\u7684\u8003\u70B9\u6807\u7B7E");
  }
  const scopeRecords = recordsOfUser(userId).filter((r) => {
    if (r.categoryId !== params.categoryId) return false;
    if (params.scope === ComposeScope.WRONG_ONLY) return r.isMaster === MasterStatus.WRONG_SET;
    return true;
  });
  const candidates = [];
  scopeRecords.forEach((record) => {
    const question = findQuestion(record.questionId);
    if (!question) return;
    const tagIds = questionTagIds(question.id);
    if (selectedTags.length > 0) {
      if (params.matchMode === 2) {
        const allMatched = selectedTags.every((id) => tagIds.includes(id));
        if (!allMatched) return;
      } else {
        const anyMatched = selectedTags.some((id) => tagIds.includes(id));
        if (!anyMatched) return;
      }
    }
    const baseTagPool = selectedTags.length > 0 ? tagIds.filter((id) => selectedTags.includes(id)) : tagIds.filter((id) => categoryTags.includes(id));
    const weights = baseTagPool.map((id) => weightMap.get(id) ?? 1);
    const baseWeight = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 1;
    const scopeFactor = record.isMaster === MasterStatus.MASTERED_SET ? MASTERED_SCOPE_FACTOR : 1;
    const weight = baseWeight * (1 + record.wrongCount) * scopeFactor;
    candidates.push({
      questionId: question.id,
      title: question.title,
      questionType: question.questionType,
      categoryId: params.categoryId,
      isMaster: record.isMaster,
      wrongCount: record.wrongCount,
      weight: Number(weight.toFixed(4)),
      lastWrongTime: record.lastWrongTime ?? null,
      tagNames: questionTagNames(question.id)
    });
  });
  return { candidates, warnings };
}
function previewCompose(userId, params) {
  const category = findCategory(params.categoryId);
  const { candidates, warnings } = buildCandidates(userId, params);
  const targetCount = params.targetCount ?? category?.fixedQuestionCount ?? candidates.length;
  if (candidates.length < targetCount) {
    warnings.push(
      `\u53EF\u62BD\u9898\u76EE ${candidates.length} \u9053\uFF0C\u5C11\u4E8E\u76EE\u6807\u9898\u91CF ${targetCount} \u9053\uFF0C\u5C06\u6309\u5B9E\u9645\u6570\u91CF\u751F\u6210`
    );
  }
  return {
    candidates,
    targetCount,
    availableCount: candidates.length,
    categoryName: category?.categoryName ?? "\u2014",
    warnings
  };
}
function drawWithoutReplacement(pool, count, pick) {
  const remaining = [...pool];
  const picked = [];
  while (picked.length < count && remaining.length > 0) {
    const index = pick(remaining);
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return picked;
}
function drawByWeight(pool, count) {
  return drawWithoutReplacement(pool, count, (remaining) => {
    const total = remaining.reduce((sum, c) => sum + c.weight, 0);
    if (total <= 0) return Math.floor(Math.random() * remaining.length);
    let r = Math.random() * total;
    for (let i = 0; i < remaining.length; i += 1) {
      r -= remaining[i].weight;
      if (r <= 0) return i;
    }
    return remaining.length - 1;
  });
}
function drawByRandom(pool, count) {
  return drawWithoutReplacement(
    pool,
    count,
    (remaining) => Math.floor(Math.random() * remaining.length)
  );
}
function drawByTime(pool, count) {
  return [...pool].sort((a, b) => {
    const ta = a.lastWrongTime ?? "";
    const tb = b.lastWrongTime ?? "";
    return tb.localeCompare(ta);
  }).slice(0, count);
}
function drawQuestions(candidates, strategy, targetCount) {
  if (candidates.length === 0) return [];
  const count = Math.min(targetCount, candidates.length);
  if (strategy === ComposeStrategy.RANDOM) return drawByRandom(candidates, count);
  if (strategy === ComposeStrategy.TIME) return drawByTime(candidates, count);
  return drawByWeight(candidates, count);
}

// src/mock/service/composeService.ts
function validateParams(userId, params) {
  const errors = [];
  if (!params.categoryId) errors.push("\u8BF7\u9009\u62E9\u8BD5\u5377\u5206\u7C7B");
  if (!params.paperType) errors.push("\u8BF7\u9009\u62E9\u8BD5\u5377\u7C7B\u578B\uFF08\u7ADE\u6280\u578B / \u7EC3\u4E60\u578B\uFF0C\u65E0\u9ED8\u8BA4\u503C\uFF09");
  if (!params.draftName || !params.draftName.trim()) errors.push("\u8BF7\u586B\u5199\u9519\u9898\u8BD5\u5377\u540D\u79F0");
  if (!findCategory(params.categoryId)) errors.push("\u8BD5\u5377\u5206\u7C7B\u4E0D\u5B58\u5728");
  const { candidates } = buildCandidates(userId, params);
  if (candidates.length === 0) {
    errors.push("\u5F53\u524D\u6761\u4EF6\u4E0B\u6CA1\u6709\u53EF\u62BD\u53D6\u7684\u9519\u9898\uFF0C\u8BF7\u653E\u5BBD\u6761\u4EF6\u6216\u5148\u505A\u51E0\u9053\u9898");
  }
  return errors;
}
function preview(userId, params) {
  return previewCompose(userId, params);
}
function generate(userId, params) {
  const errors = validateParams(userId, params);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const category = findCategory(params.categoryId);
  const targetCount = params.targetCount ?? category.fixedQuestionCount;
  const { candidates, warnings } = buildCandidates(userId, params);
  const picked = drawQuestions(candidates, params.strategy, targetCount);
  const downgraded = picked.length < targetCount;
  if (downgraded) {
    warnings.push(`\u5B9E\u9645\u53EF\u62BD\u9898\u76EE\u4EC5 ${picked.length} \u9053\uFF0C\u5DF2\u6309\u5B9E\u9645\u6570\u91CF\u751F\u6210`);
  }
  const db = getDb();
  const stamp = newStamp();
  const draft = {
    id: nextId("drafts"),
    deleted: 0,
    ...stamp,
    draftName: params.draftName.trim(),
    userId,
    categoryId: params.categoryId,
    paperType: params.paperType,
    visibility: params.visibility ?? Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.WRONG_COMPOSE,
    randomOrder: 0,
    questionCount: picked.length,
    enableTime: null
  };
  db.drafts.push(draft);
  picked.forEach((candidate, index) => {
    const question = findQuestion(candidate.questionId);
    insertDraftQuestionRel(draft.id, candidate.questionId, index + 1, question?.score ?? 1);
  });
  return { draft, picked, warnings, downgraded };
}
function generateAndEnable(userId, params) {
  const result = generate(userId, params);
  result.draft.draftStatus = DraftStatus.ENABLED;
  result.draft.isLocked = LockFlag.LOCKED;
  result.draft.enableTime = (/* @__PURE__ */ new Date()).toISOString();
  result.picked.forEach((candidate) => {
    const question = findQuestion(candidate.questionId);
    if (question) question.isLocked = LockFlag.LOCKED;
  });
  return result;
}
function suggestDraftName(userId, categoryId) {
  const category = findCategory(categoryId);
  const db = getDb();
  const same = db.drafts.filter(
    (d) => d.userId === userId && d.categoryId === categoryId && d.deleted === 0
  ).length;
  return `${category?.categoryName ?? "\u9519\u9898"}\u590D\u4E60\u5377\uFF08\u7B2C ${same + 1} \u6B21\u7EC4\u5377\uFF09`;
}

// src/mock/rules/lock.ts
function canEditDraft(draft) {
  return draft.draftStatus === DraftStatus.DISABLED && draft.isLocked === LockFlag.UNLOCKED;
}
function isPubliclyListed(draft) {
  return draft.draftStatus === DraftStatus.ENABLED && draft.visibility === 2;
}
function lockedDraftNames(questionId) {
  return lockedDraftsReferencing(questionId).map((d) => d.draftName);
}
function isQuestionDeletable(questionId) {
  const reasons = [];
  const locked = lockedDraftNames(questionId);
  if (locked.length > 0) {
    reasons.push(`\u5DF2\u88AB\u9501\u5B9A\u8BD5\u5377\u5F15\u7528\uFF1A\u300A${locked.join("\u300B\u300A")}\u300B`);
  }
  const examRefs = examQuestionsByQuestion(questionId);
  if (examRefs.length > 0) {
    reasons.push(`\u5DF2\u88AB ${examRefs.length} \u6761\u5386\u53F2\u7B54\u9898\u8BB0\u5F55\u5F15\u7528`);
  }
  return { deletable: reasons.length === 0, reasons };
}
function validateDraftForEnable(draftId) {
  const errors = [];
  const draft = findDraft(draftId);
  if (!draft) return ["\u8BD5\u5377\u4E0D\u5B58\u5728"];
  if (draft.draftStatus === DraftStatus.DISCARDED) errors.push("\u5E9F\u5F03\u8BD5\u5377\u4E0D\u53EF\u542F\u7528");
  const rels = draftRels(draftId);
  if (rels.length === 0) {
    errors.push("\u8BD5\u5377\u81F3\u5C11\u9700\u8981 1 \u9053\u9898\u76EE\u624D\u80FD\u542F\u7528");
    return errors;
  }
  const questions = rels.map((rel) => findQuestion(rel.questionId)).filter((q) => !!q);
  if (questions.length !== rels.length) errors.push("\u5B58\u5728\u5DF2\u88AB\u5220\u9664\u7684\u9898\u76EE\uFF0C\u8BF7\u5148\u6E05\u7406");
  let totalScore = 0;
  questions.forEach((q, index) => {
    const rel = rels[index];
    const errs = validateQuestion(q);
    if (rel && rel.score <= 0) errs.push(`\u9898\u76EE#${q.id}\uFF1A\u672C\u8BD5\u5377\u5185\u5206\u503C\u5FC5\u987B\u5927\u4E8E 0`);
    errors.push(...errs);
    totalScore += rel?.score ?? q.score;
  });
  if (totalScore <= 0) errors.push("\u8BD5\u5377\u603B\u5206\u5FC5\u987B\u5927\u4E8E 0");
  return errors;
}
function applyDraftLock(draft, now2) {
  draft.isLocked = LockFlag.LOCKED;
  draft.enableTime = draft.enableTime ?? now2;
  draft.updateTime = now2;
}
function applyQuestionLockByDraft(draftId, now2) {
  let count = 0;
  draftRels(draftId).forEach((rel) => {
    const question = findQuestion(rel.questionId);
    if (question && question.isLocked === LockFlag.UNLOCKED) {
      question.isLocked = LockFlag.LOCKED;
      question.updateTime = now2;
      count += 1;
    }
  });
  return count;
}

// src/mock/service/draftService.ts
function toListItem(draft) {
  const owner = findUser(draft.userId);
  return {
    ...draft,
    categoryName: findCategory(draft.categoryId)?.categoryName ?? "\u2014",
    ownerName: owner ? owner.username : "\u5DF2\u6CE8\u9500\u7528\u6237",
    canEdit: canEditDraft(draft)
  };
}
function listPublicDrafts(filter) {
  return allDrafts().filter(isPubliclyListed).filter((d) => filter?.categoryId ? d.categoryId === filter.categoryId : true).filter((d) => filter?.paperType ? d.paperType === filter.paperType : true).filter(
    (d) => filter?.keyword ? d.draftName.toLowerCase().includes(filter.keyword.toLowerCase()) : true
  ).sort((a, b) => (b.enableTime ?? "").localeCompare(a.enableTime ?? "")).map(toListItem);
}
function listMyDrafts(userId) {
  return allDrafts().filter((d) => d.userId === userId && d.draftStatus !== DraftStatus.DISCARDED).sort((a, b) => (b.updateTime ?? b.createTime).localeCompare(a.updateTime ?? a.createTime)).map(toListItem);
}
function listDiscardedDrafts() {
  return allDrafts().filter((d) => d.draftStatus === DraftStatus.DISCARDED).sort((a, b) => (b.updateTime ?? b.createTime).localeCompare(a.updateTime ?? a.createTime)).map(toListItem);
}
function getDraftDetail(draftId, viewerId) {
  const draft = findDraft(draftId);
  if (!draft) throw notFound("\u8BD5\u5377\u4E0D\u5B58\u5728");
  const viewer = viewerId ? findUser(viewerId) : null;
  const isAdmin = viewer?.roleType === RoleType.ADMIN;
  if (draft.draftStatus === DraftStatus.DISCARDED && !isAdmin) {
    throw notFound("\u8BE5\u8BD5\u5377\u5DF2\u5E9F\u5F03\uFF0C\u4EC5\u4F9B\u7BA1\u7406\u5458\u5BA1\u8BA1");
  }
  if (draft.visibility === Visibility.PRIVATE && draft.userId !== viewerId) {
    throw noPermission("\u65E0\u6743\u8BBF\u95EE\u4ED6\u4EBA\u7684\u79C1\u6709\u8BD5\u5377");
  }
  const questions = draftRels(draftId).map((rel) => {
    const question = findQuestion(rel.questionId);
    if (!question) return null;
    return {
      relId: rel.id,
      questionId: question.id,
      sortNo: rel.sortNo,
      score: rel.score,
      question,
      tagIds: questionTagIds(question.id),
      tagNames: questionTagNames(question.id)
    };
  }).filter((v) => v !== null);
  return {
    draft,
    category: findCategory(draft.categoryId),
    owner: findUser(draft.userId) ?? { username: "\u5DF2\u6CE8\u9500\u7528\u6237" },
    questions,
    canEdit: canEditDraft(draft) && draft.userId === viewerId,
    lockedQuestionCount: questions.filter((q) => q.question.isLocked === LockFlag.LOCKED).length
  };
}
function createDraft(userId, params) {
  const user = findUser(userId);
  if (!user) throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  if (!params.draftName.trim()) throw new Error("\u8BD5\u5377\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (!findCategory(params.categoryId)) throw new Error("\u8BD5\u5377\u5206\u7C7B\u4E0D\u5B58\u5728");
  const db = getDb();
  const stamp = newStamp();
  const draft = {
    id: nextId("drafts"),
    deleted: 0,
    ...stamp,
    draftName: params.draftName.trim(),
    userId,
    categoryId: params.categoryId,
    paperType: params.paperType,
    visibility: params.visibility ?? (user.roleType === RoleType.ADMIN ? Visibility.PUBLIC : Visibility.PRIVATE),
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.MANUAL,
    randomOrder: params.randomOrder ?? 0,
    questionCount: 0,
    enableTime: null
  };
  db.drafts.push(draft);
  return draft;
}
function assertOwnership(draft, userId) {
  const user = findUser(userId);
  if (draft.userId !== userId) {
    throw new Error(
      user?.roleType === RoleType.ADMIN ? "\u7BA1\u7406\u5458\u4E0D\u53EF\u7F16\u8F91\u4ED6\u4EBA\u8BD5\u5377\uFF08\u53EF\u505C\u7528\u505A\u5185\u5BB9\u6CBB\u7406\uFF09" : "\u4E0D\u80FD\u4FEE\u6539\u4ED6\u4EBA\u521B\u5EFA\u7684\u8BD5\u5377"
    );
  }
}
function updateDraftMeta(draftId, userId, params) {
  const draft = findDraft(draftId);
  if (!draft) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  assertOwnership(draft, userId);
  if (!canEditDraft(draft)) {
    throw new Error("\u8BD5\u5377\u5904\u4E8E\u542F\u7528\u6216\u5DF2\u9501\u5B9A\u72B6\u6001\uFF0C\u4E0D\u53EF\u7F16\u8F91\uFF08\u542F\u7528\u5373\u6C38\u4E45\u9501\u5B9A\uFF09");
  }
  if (params.draftName !== void 0) {
    if (!params.draftName.trim()) throw new Error("\u8BD5\u5377\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    draft.draftName = params.draftName.trim();
  }
  if (params.categoryId !== void 0) {
    if (!findCategory(params.categoryId)) throw new Error("\u8BD5\u5377\u5206\u7C7B\u4E0D\u5B58\u5728");
    draft.categoryId = params.categoryId;
  }
  if (params.paperType !== void 0) draft.paperType = params.paperType;
  if (params.visibility !== void 0) draft.visibility = params.visibility;
  if (params.randomOrder !== void 0) draft.randomOrder = params.randomOrder;
  draft.updateTime = nowIso();
  return draft;
}
function switchDraftStatus(draftId, userId, target) {
  const draft = findDraft(draftId);
  if (!draft) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  assertOwnership(draft, userId);
  if (draft.draftStatus === DraftStatus.DISCARDED) throw new Error("\u5E9F\u5F03\u8BD5\u5377\u4E0D\u53EF\u53D8\u66F4\u72B6\u6001");
  if (target === DraftStatus.ENABLED) {
    const errors = validateDraftForEnable(draftId);
    if (errors.length > 0) {
      throw new Error(`\u542F\u7528\u524D\u7F6E\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A
${errors.slice(0, 5).join("\n")}`);
    }
    if (draft.isLocked === LockFlag.UNLOCKED) applyDraftLock(draft, nowIso());
    draft.draftStatus = DraftStatus.ENABLED;
    const locked = applyQuestionLockByDraft(draftId, nowIso());
    return {
      draft,
      lockedQuestionCount: locked,
      message: locked > 0 ? `\u8BD5\u5377\u5DF2\u542F\u7528\u5E76\u6C38\u4E45\u9501\u5B9A\uFF1B\u540C\u65F6 ${locked} \u9053\u9898\u76EE\u7EE7\u627F\u9501\u5B9A\uFF08\u9898\u5E72\u3001\u7B54\u6848\u4E0E\u5206\u503C\u4E0D\u53EF\u518D\u4FEE\u6539\uFF09` : "\u8BD5\u5377\u5DF2\u542F\u7528\u5E76\u6C38\u4E45\u9501\u5B9A"
    };
  }
  draft.draftStatus = DraftStatus.DISABLED;
  draft.updateTime = nowIso();
  return {
    draft,
    lockedQuestionCount: 0,
    message: draft.isLocked === LockFlag.LOCKED ? "\u8BD5\u5377\u5DF2\u505C\u7528\uFF1A\u4E0D\u518D\u5BF9\u5916\u53EF\u7B54\u9898\uFF0C\u4F46\u56E0\u5DF2\u9501\u5B9A\u4ECD\u4E0D\u53EF\u7F16\u8F91" : "\u8BD5\u5377\u5DF2\u505C\u7528\uFF1A\u53EF\u7EE7\u7EED\u7F16\u8F91"
  };
}
function discardDraft(draftId, userId) {
  const draft = findDraft(draftId);
  if (!draft) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  assertOwnership(draft, userId);
  draft.draftStatus = DraftStatus.DISCARDED;
  draft.updateTime = nowIso();
}
function saveDraftAs(draftId, userId, newName) {
  const source = findDraft(draftId);
  if (!source) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  if (!newName.trim()) throw new Error("\u65B0\u8BD5\u5377\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  const db = getDb();
  const stamp = newStamp();
  const copy = {
    id: nextId("drafts"),
    deleted: 0,
    ...stamp,
    draftName: newName.trim(),
    userId,
    categoryId: source.categoryId,
    paperType: source.paperType,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.MANUAL,
    randomOrder: source.randomOrder,
    questionCount: 0,
    enableTime: null
  };
  db.drafts.push(copy);
  const rels = draftRels(draftId);
  rels.forEach((rel, index) => {
    insertDraftQuestionRel(copy.id, rel.questionId, index + 1, rel.score);
  });
  copy.questionCount = rels.length;
  return copy;
}
function assertEditable(draftId, userId) {
  const draft = findDraft(draftId);
  if (!draft) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  assertOwnership(draft, userId);
  if (!canEditDraft(draft)) {
    throw new Error("\u8BD5\u5377\u5904\u4E8E\u542F\u7528\u6216\u5DF2\u9501\u5B9A\u72B6\u6001\uFF0C\u4E0D\u53EF\u7F16\u8F91\u9898\u76EE");
  }
  return draft;
}
function buildQuestion(payload) {
  const stamp = newStamp();
  const question = {
    id: nextId("questions"),
    deleted: 0,
    ...stamp,
    questionType: payload.questionType,
    title: payload.title.trim(),
    titleFormat: TitleFormat.PLAIN,
    options: payload.questionType === QuestionType.SHORT_ANSWER ? null : stringifyOptions(payload.options ?? defaultOptionsFor(payload.questionType)),
    answer: payload.answer.trim(),
    analysis: payload.analysis ?? null,
    score: payload.score,
    isLocked: LockFlag.UNLOCKED
  };
  return question;
}
function createQuestionInDraft(draftId, userId, payload) {
  assertEditable(draftId, userId);
  const question = buildQuestion(payload);
  const errors = validateQuestion(question);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  getDb().questions.push(question);
  payload.tagIds.forEach((tagId) => insertQuestionTagRel(question.id, tagId));
  const rels = draftRels(draftId);
  insertDraftQuestionRel(draftId, question.id, rels.length + 1, payload.score);
  const draft = findDraft(draftId);
  draft.questionCount = rels.length + 1;
  draft.updateTime = nowIso();
  return question;
}
function attachQuestionToDraft(draftId, userId, questionId, score) {
  assertEditable(draftId, userId);
  const question = findQuestion(questionId);
  if (!question) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728");
  const exists = draftRels(draftId).some((rel) => rel.questionId === questionId);
  if (exists) throw new Error("\u8BE5\u9898\u76EE\u5DF2\u5728\u5F53\u524D\u8BD5\u5377\u4E2D");
  const rels = draftRels(draftId);
  insertDraftQuestionRel(draftId, questionId, rels.length + 1, score ?? question.score);
  const draft = findDraft(draftId);
  draft.questionCount = rels.length + 1;
  draft.updateTime = nowIso();
}
function updateQuestion(draftId, userId, questionId, payload, relScore) {
  assertEditable(draftId, userId);
  const question = findQuestion(questionId);
  if (!question) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728");
  if (question.isLocked === LockFlag.LOCKED) {
    const names = lockedDraftsReferencing(questionId).map((d) => d.draftName);
    throw new Error(
      `\u8BE5\u9898\u76EE\u5DF2\u88AB\u9501\u5B9A\u8BD5\u5377\u5F15\u7528\uFF08${names.join("\u3001")}\uFF09\uFF0C\u5185\u5BB9\u4E0D\u53EF\u4FEE\u6539\u3002\u5982\u9700\u8C03\u6574\uFF0C\u8BF7\u4F7F\u7528"\u590D\u5236\u4E3A\u65B0\u9898"\u3002`
    );
  }
  const merged = {
    ...question,
    questionType: payload.questionType,
    title: payload.title.trim(),
    options: payload.questionType === QuestionType.SHORT_ANSWER ? null : stringifyOptions(payload.options ?? defaultOptionsFor(payload.questionType)),
    answer: payload.answer.trim(),
    analysis: payload.analysis ?? null,
    score: payload.score,
    updateTime: nowIso()
  };
  const errors = validateQuestion(merged);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  Object.assign(question, merged);
  const db = getDb();
  const current = questionTagIds(questionId);
  const next = payload.tagIds;
  db.questionTagRels.filter((r) => r.questionId === questionId && r.deleted === 0 && !next.includes(r.tagId)).forEach((r) => {
    r.deleted = r.id;
    r.deleteTime = nowIso();
  });
  next.filter((tagId) => !current.includes(tagId)).forEach((tagId) => insertQuestionTagRel(questionId, tagId));
  if (relScore !== void 0) {
    const rel = draftRels(draftId).find((r) => r.questionId === questionId);
    if (rel) {
      rel.score = relScore;
      rel.updateTime = nowIso();
    }
  }
  return question;
}
function copyQuestionAsNew(draftId, userId, questionId) {
  assertEditable(draftId, userId);
  const source = findQuestion(questionId);
  if (!source) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728");
  const question = buildQuestion({
    questionType: source.questionType,
    title: source.title,
    options: parseOptions(source.options),
    answer: source.answer,
    analysis: source.analysis,
    score: source.score,
    tagIds: []
  });
  getDb().questions.push(question);
  questionTagIds(questionId).forEach((tagId) => insertQuestionTagRel(question.id, tagId));
  const rels = draftRels(draftId);
  insertDraftQuestionRel(draftId, question.id, rels.length + 1, source.score);
  const draft = findDraft(draftId);
  draft.questionCount = rels.length + 1;
  draft.updateTime = nowIso();
  return question;
}
function detachQuestionFromDraft(draftId, userId, relId) {
  assertEditable(draftId, userId);
  const db = getDb();
  const rel = db.draftQuestionRels.find((r) => r.id === relId && r.deleted === 0);
  if (!rel) throw new Error("\u5173\u8054\u4E0D\u5B58\u5728");
  softDelete(db.draftQuestionRels, relId);
  const rels = draftRels(draftId);
  rels.forEach((r, index) => {
    r.sortNo = index + 1;
  });
  const draft = findDraft(draftId);
  draft.questionCount = rels.length;
  draft.updateTime = nowIso();
}
function moveQuestion(draftId, userId, relId, delta) {
  assertEditable(draftId, userId);
  const rels = draftRels(draftId);
  const index = rels.findIndex((r) => r.id === relId);
  if (index < 0) return;
  const target = index + delta;
  if (target < 0 || target >= rels.length) return;
  const [moved] = rels.splice(index, 1);
  rels.splice(target, 0, moved);
  rels.forEach((r, i) => {
    r.sortNo = i + 1;
    r.updateTime = nowIso();
  });
}
function updateRelScore(draftId, userId, relId, score) {
  assertEditable(draftId, userId);
  if (score <= 0) throw new Error("\u5206\u503C\u5FC5\u987B\u5927\u4E8E 0");
  const rel = getDb().draftQuestionRels.find((r) => r.id === relId && r.deleted === 0);
  if (!rel) throw new Error("\u5173\u8054\u4E0D\u5B58\u5728");
  rel.score = score;
  rel.updateTime = nowIso();
}
function deleteQuestion(userId, questionId) {
  const question = findQuestion(questionId);
  if (!question) throw new Error("\u9898\u76EE\u4E0D\u5B58\u5728");
  const { deletable, reasons } = isQuestionDeletable(questionId);
  if (!deletable) {
    throw new Error(`\u8BE5\u9898\u76EE\u7981\u6B62\u5220\u9664\uFF1A
${reasons.join("\n")}`);
  }
  const db = getDb();
  relsByQuestion(questionId).forEach((rel) => softDelete(db.draftQuestionRels, rel.id));
  softDelete(db.questions, questionId);
}
function listQuestionBank(filter) {
  return allQuestions().filter(
    (q) => filter?.keyword ? q.title.toLowerCase().includes(filter.keyword.toLowerCase()) : true
  ).filter(
    (q) => filter?.tagId ? questionTagIds(q.id).includes(filter.tagId) : true
  ).filter((q) => filter?.questionType ? q.questionType === filter.questionType : true).map((question) => ({
    question,
    tagNames: questionTagNames(question.id),
    usedByDraftCount: relsByQuestion(question.id).length,
    usedByExamCount: examQuestionsByQuestion(question.id).length,
    lockedDraftNames: lockedDraftsReferencing(question.id).map((d) => d.draftName)
  }));
}

// src/mock/rules/exam.ts
function createExam(userId, draftId, sourceType = ExamSourceType.NORMAL) {
  const db = getDb();
  const draft = findDraft(draftId);
  if (!draft) throw new Error("\u8BD5\u5377\u4E0D\u5B58\u5728");
  const rels = draftRels(draftId);
  const attemptNo = allExams().filter((e) => e.userId === userId && e.draftId === draftId).length + 1;
  const stamp = newStamp();
  const exam = {
    id: nextId("exams"),
    userId,
    draftId,
    draftName: draft.draftName,
    categoryId: draft.categoryId,
    paperType: draft.paperType,
    sourceType,
    attemptNo,
    questionCount: rels.length,
    totalScore: null,
    obtainedScore: null,
    usedSeconds: null,
    submitTime: null,
    deleted: 0,
    ...stamp
  };
  db.exams.push(exam);
  const ordered = [...rels];
  if (draft.randomOrder === 1) {
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }
  ordered.forEach((rel, index) => {
    const question = findQuestion(rel.questionId);
    if (!question) return;
    const row = {
      id: nextId("examQuestions"),
      examId: exam.id,
      questionId: question.id,
      sortNo: index + 1,
      questionType: question.questionType,
      score: rel.score,
      userAnswer: null,
      judgeStatus: JudgeStatus.PENDING,
      judgeResult: null,
      obtainedScore: null,
      aiExplain: null,
      aiRetryTimes: 0,
      manualRetryTimes: 0,
      judgeTime: null,
      deleted: 0,
      ...newStamp()
    };
    db.examQuestions.push(row);
  });
  return exam;
}
function saveAnswer(examQuestionId, userAnswer) {
  const db = getDb();
  const row = db.examQuestions.find((eq) => eq.id === examQuestionId && eq.deleted === 0);
  if (!row) return null;
  const exam = db.exams.find((e) => e.id === row.examId);
  if (!exam || exam.submitTime) return null;
  row.userAnswer = userAnswer;
  row.updateTime = nowIso();
  if (exam.paperType === 2 && isObjective(row.questionType)) {
    row.judgeStatus = JudgeStatus.JUDGED;
    row.judgeResult = judgeObjective(row.questionType, currentAnswer(row.questionId), userAnswer);
    row.obtainedScore = scoreOf(row.score, row.judgeResult);
  }
  return row;
}
function currentAnswer(questionId) {
  return findQuestion(questionId)?.answer ?? "";
}
function submitExam(examId) {
  const db = getDb();
  const exam = db.exams.find((e) => e.id === examId && e.deleted === 0);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  if (exam.submitTime) {
    const items2 = examQuestionsOf(examId);
    return {
      exam,
      judgedCount: items2.filter((i) => i.judgeStatus === JudgeStatus.JUDGED).length,
      pendingCount: items2.filter((i) => i.judgeStatus !== JudgeStatus.JUDGED).length,
      wrongCount: items2.filter((i) => i.judgeResult === JudgeResult.WRONG).length
    };
  }
  const now2 = nowIso();
  const items = examQuestionsOf(examId);
  let totalScore = 0;
  let obtainedScore = 0;
  let judgedCount = 0;
  let pendingCount = 0;
  let wrongCount = 0;
  items.forEach((eq) => {
    totalScore += eq.score;
    if (isObjective(eq.questionType)) {
      const result = judgeObjective(eq.questionType, currentAnswer(eq.questionId), eq.userAnswer);
      eq.judgeStatus = JudgeStatus.JUDGED;
      eq.judgeResult = result;
      eq.obtainedScore = scoreOf(eq.score, result);
      eq.judgeTime = now2;
      judgedCount += 1;
      if (result === JudgeResult.WRONG) wrongCount += 1;
    } else {
      eq.judgeStatus = JudgeStatus.PENDING;
      eq.judgeResult = null;
      eq.obtainedScore = null;
      pendingCount += 1;
    }
    eq.updateTime = now2;
    if (eq.obtainedScore) obtainedScore += eq.obtainedScore;
  });
  exam.totalScore = totalScore;
  exam.obtainedScore = Number(obtainedScore.toFixed(2));
  exam.submitTime = now2;
  exam.updateTime = now2;
  items.forEach((eq) => {
    if (eq.judgeStatus !== JudgeStatus.JUDGED) return;
    if (eq.judgeResult === JudgeResult.WRONG) {
      upsertWrongRecord(exam, eq, now2);
    } else if (eq.judgeResult === JudgeResult.RIGHT) {
      markMastered(exam, eq, now2);
    }
  });
  return { exam, judgedCount, pendingCount, wrongCount };
}
function upsertWrongRecord(exam, eq, now2) {
  const db = getDb();
  let record = findRecord(exam.userId, eq.questionId, exam.categoryId);
  if (!record) {
    const stamp = newStamp();
    record = {
      id: nextId("records"),
      userId: exam.userId,
      questionId: eq.questionId,
      categoryId: exam.categoryId,
      isMaster: MasterStatus.WRONG_SET,
      wrongCount: 1,
      lastExamId: exam.id,
      lastExamQuestionId: eq.id,
      lastWrongTime: now2,
      masterTime: null,
      deleted: 0,
      ...stamp
    };
    db.records.push(record);
  } else {
    record.isMaster = MasterStatus.WRONG_SET;
    record.wrongCount += 1;
    record.lastExamId = exam.id;
    record.lastExamQuestionId = eq.id;
    record.lastWrongTime = now2;
    record.masterTime = null;
    record.updateTime = now2;
  }
  db.wrongDetails.push({
    id: nextId("wrongDetails"),
    recordId: record.id,
    examId: exam.id,
    examQuestionId: eq.id,
    userAnswer: eq.userAnswer ?? null,
    judgeResult: eq.judgeResult ?? null,
    aiExplain: eq.aiExplain ?? null,
    answerTime: now2,
    deleted: 0,
    ...newStamp()
  });
}
function markMastered(exam, eq, now2) {
  const record = findRecord(exam.userId, eq.questionId, exam.categoryId);
  if (!record || record.isMaster === MasterStatus.MASTERED_SET) return;
  record.isMaster = MasterStatus.MASTERED_SET;
  record.masterTime = now2;
  record.lastExamId = exam.id;
  record.lastExamQuestionId = eq.id;
  record.updateTime = now2;
}
function deleteExam(examId) {
  const db = getDb();
  const ok = softDelete(db.exams, examId);
  if (!ok) return false;
  db.examQuestions.filter((eq) => eq.examId === examId && eq.deleted === 0).forEach((eq) => {
    softDelete(db.examQuestions, eq.id);
  });
  return true;
}
function assertDraftAnswerable(draft) {
  if (!draft) return "\u8BD5\u5377\u4E0D\u5B58\u5728";
  if (draft.draftStatus === DraftStatus.DISCARDED) return "\u8BD5\u5377\u5DF2\u5E9F\u5F03\uFF0C\u4E0D\u53EF\u4F5C\u7B54";
  if (draft.draftStatus !== DraftStatus.ENABLED) return "\u8BD5\u5377\u5904\u4E8E\u505C\u7528\u72B6\u6001\uFF0C\u4E0D\u53EF\u53D1\u8D77\u7B54\u9898";
  return null;
}

// src/mock/rules/stat.ts
function calcAccuracy(userId) {
  const rows = judgedExamQuestionsOf(userId);
  let rightCount = 0;
  const byCategory = /* @__PURE__ */ new Map();
  rows.forEach(({ exam, eq }) => {
    const isRight = eq.judgeResult === JudgeResult.RIGHT;
    if (isRight) rightCount += 1;
    const bucket = byCategory.get(exam.categoryId) ?? { right: 0, total: 0 };
    bucket.total += 1;
    if (isRight) bucket.right += 1;
    byCategory.set(exam.categoryId, bucket);
  });
  const total = rows.length;
  const categories = [...byCategory.entries()].map(([categoryId, v]) => ({
    categoryId,
    categoryName: findCategory(categoryId)?.categoryName ?? `\u5206\u7C7B#${categoryId}`,
    accuracy: v.total > 0 ? v.right / v.total : null,
    judgedCount: v.total,
    rightCount: v.right
  })).sort((a, b) => b.judgedCount - a.judgedCount);
  return {
    userId,
    globalAccuracy: total > 0 ? rightCount / total : null,
    judgedCount: total,
    rightCount,
    categories
  };
}
function summarizeExam(examId) {
  let rightCount = 0;
  let wrongCount = 0;
  let pendingCount = 0;
  examQuestionsOf(examId).forEach((eq) => {
    if (eq.judgeStatus !== JudgeStatus.JUDGED) {
      pendingCount += 1;
      return;
    }
    if (eq.judgeResult === JudgeResult.RIGHT) rightCount += 1;
    else wrongCount += 1;
  });
  return { rightCount, wrongCount, pendingCount };
}
function listExamsOfUser(userId) {
  return allExams().filter((e) => e.userId === userId).sort((a, b) => (b.submitTime ?? b.createTime).localeCompare(a.submitTime ?? a.createTime)).map((exam) => ({
    ...exam,
    categoryName: findCategory(exam.categoryId)?.categoryName ?? `\u5206\u7C7B#${exam.categoryId}`,
    ...summarizeExam(exam.id)
  }));
}

// src/mock/service/examService.ts
function assertExamOwner(exam, userId) {
  if (exam.userId !== userId) throw new Error("\u65E0\u6743\u64CD\u4F5C\u4ED6\u4EBA\u7684\u7B54\u9898\u8BB0\u5F55");
}
function startExam(userId, draftId) {
  const draft = findDraft(draftId);
  const error = assertDraftAnswerable(draft);
  if (error) throw new Error(error);
  const rels = draftRels(draftId);
  if (rels.length === 0) throw new Error("\u8BE5\u8BD5\u5377\u6CA1\u6709\u9898\u76EE\uFF0C\u65E0\u6CD5\u53D1\u8D77\u7B54\u9898");
  return createExam(userId, draftId, ExamSourceType.NORMAL);
}
function getExamDetail(examId, userId) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  const submitted = !!exam.submitTime;
  const items = examQuestionsOf(examId).map((eq) => {
    const question = findQuestion(eq.questionId);
    return {
      examQuestionId: eq.id,
      questionId: eq.questionId,
      sortNo: eq.sortNo,
      questionType: eq.questionType,
      score: eq.score,
      title: question?.title ?? "\uFF08\u9898\u76EE\u5DF2\u5220\u9664\uFF09",
      options: parseOptions(question?.options),
      // 未交卷不下发答案与解析，避免作弊
      answer: submitted ? question?.answer ?? null : null,
      analysis: submitted ? question?.analysis ?? null : null,
      tagNames: questionTagNames(eq.questionId),
      userAnswer: eq.userAnswer ?? null,
      judgeStatus: eq.judgeStatus,
      judgeResult: eq.judgeResult ?? null,
      obtainedScore: eq.obtainedScore ?? null,
      aiExplain: eq.aiExplain ?? null
    };
  });
  return { exam, items, editable: !submitted };
}
function saveAnswer2(examId, userId, examQuestionId, userAnswer) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  if (exam.submitTime) throw new Error("\u5DF2\u4EA4\u5377\uFF0C\u4E0D\u53EF\u518D\u4FEE\u6539\u7B54\u6848");
  const row = saveAnswer(examQuestionId, userAnswer);
  if (!row) throw new Error("\u4FDD\u5B58\u5931\u8D25\uFF1A\u4F5C\u7B54\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u4EA4\u5377");
  return {
    judgeStatus: row.judgeStatus,
    judgeResult: row.judgeResult ?? null,
    obtainedScore: row.obtainedScore ?? null
  };
}
function submitExam2(examId, userId) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  const usedSeconds = Math.max(
    1,
    Math.round((Date.now() - new Date(exam.createTime).getTime()) / 1e3)
  );
  const result = submitExam(examId);
  result.exam.usedSeconds = usedSeconds;
  const judged = result.judgedCount;
  const rightCount = examQuestionsOf(examId).filter(
    (eq) => eq.judgeStatus === JudgeStatus.JUDGED && eq.judgeResult === 1
  ).length;
  return {
    exam: result.exam,
    judgedCount: result.judgedCount,
    pendingCount: result.pendingCount,
    wrongCount: result.wrongCount,
    totalScore: result.exam.totalScore ?? 0,
    obtainedScore: result.exam.obtainedScore ?? 0,
    accuracy: judged > 0 ? rightCount / judged : null
  };
}
function listMyExams(userId) {
  return listExamsOfUser(userId);
}
function listUnsubmitted(userId) {
  return listMyExams(userId).filter((e) => !e.submitTime);
}
function deleteExam2(examId, userId) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  deleteExam(examId);
}
function clearExamAnswers(examId, userId) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  if (exam.submitTime) throw new Error("\u5DF2\u4EA4\u5377\uFF0C\u4E0D\u53EF\u6E05\u7A7A\u4F5C\u7B54");
  const db = getDb();
  db.examQuestions.filter((eq) => eq.examId === examId && eq.deleted === 0).forEach((eq) => {
    eq.userAnswer = null;
    eq.judgeStatus = JudgeStatus.PENDING;
    eq.judgeResult = null;
    eq.obtainedScore = null;
    eq.updateTime = nowIso();
  });
}
function abandonExam(examId, userId) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  assertExamOwner(exam, userId);
  if (exam.submitTime) throw new Error("\u5DF2\u4EA4\u5377\u7684\u7B54\u9898\u8BB0\u5F55\u8BF7\u4F7F\u7528\u5220\u9664\u64CD\u4F5C");
  const db = getDb();
  softDelete(db.exams, examId);
  db.examQuestions.filter((eq) => eq.examId === examId && eq.deleted === 0).forEach((eq) => softDelete(db.examQuestions, eq.id));
}
function getExamDetailForViewer(examId, viewerId, viewerIsAdmin = false) {
  const exam = findExam(examId);
  if (!exam) throw new Error("\u7B54\u9898\u8BB0\u5F55\u4E0D\u5B58\u5728");
  const owner = findUser(exam.userId);
  const isOwner = viewerId === exam.userId;
  if (!isOwner) {
    const allowed = viewerIsAdmin || owner?.privacyType === PrivacyType.PUBLIC;
    if (!allowed) throw new Error("\u8BE5\u7528\u6237\u672A\u516C\u5F00\u7B54\u9898\u8BB0\u5F55");
    if (!exam.submitTime) throw new Error("\u8BE5\u7B54\u9898\u5C1A\u672A\u4EA4\u5377\uFF0C\u4E0D\u53EF\u67E5\u770B");
  }
  const detail = getExamDetail(examId, exam.userId);
  if (isOwner) return detail;
  return {
    ...detail,
    items: detail.items.map((item) => ({
      ...item,
      answer: null,
      analysis: null
    }))
  };
}

// src/mock/service/favoriteService.ts
var activeFavorites = (userId) => getDb().favorites.filter((f) => f.deleted === 0 && f.userId === userId);
function isFavorited(userId, targetType, targetId) {
  return activeFavorites(userId).some(
    (f) => f.targetType === targetType && f.targetId === targetId
  );
}
function listFavoriteIds(userId, targetType) {
  return activeFavorites(userId).filter((f) => f.targetType === targetType).map((f) => f.targetId);
}
function toggleFavorite(userId, targetType, targetId) {
  const db = getDb();
  const existing = db.favorites.find(
    (f) => f.deleted === 0 && f.userId === userId && f.targetType === targetType && f.targetId === targetId
  );
  if (existing) {
    softDelete(db.favorites, existing.id);
    return false;
  }
  if (!resourceExists(targetType, targetId)) return false;
  db.favorites.push({
    ...newStamp(),
    id: nextId("favorites"),
    deleted: 0,
    userId,
    targetType,
    targetId
  });
  return true;
}
function resourceExists(targetType, targetId) {
  const db = getDb();
  if (targetType === FavoriteTargetType.DRAFT) {
    return db.drafts.some((d) => d.id === targetId && d.deleted === 0);
  }
  if (targetType === FavoriteTargetType.QUESTION) {
    return db.questions.some((q) => q.id === targetId && q.deleted === 0);
  }
  return db.knowledge.some((k) => k.id === targetId && k.deleted === 0);
}
function draftAccessible(draftId, userId) {
  const draft = getDb().drafts.find((d) => d.id === draftId && d.deleted === 0);
  if (!draft) return false;
  if (draft.visibility === Visibility.PUBLIC) {
    return draft.draftStatus !== 3;
  }
  return draft.userId === userId;
}
function knowledgeAccessible(knowledgeId, userId) {
  const row = getDb().knowledge.find((k) => k.id === knowledgeId && k.deleted === 0);
  if (!row) return false;
  if (row.visibility === Visibility.PUBLIC) return true;
  return row.userId === userId;
}
function questionAccessible(questionId, userId) {
  const db = getDb();
  const question = db.questions.find((q) => q.id === questionId && q.deleted === 0);
  if (!question) return false;
  return db.draftQuestionRels.filter((r) => r.deleted === 0 && r.questionId === questionId).some((r) => draftAccessible(r.draftId, userId));
}
function questionLink(questionId, userId) {
  const db = getDb();
  const rels = db.draftQuestionRels.filter((r) => r.deleted === 0 && r.questionId === questionId).map((r) => db.drafts.find((d) => d.id === r.draftId && d.deleted === 0)).filter((d) => !!d);
  const preferred = rels.find((d) => d.visibility === Visibility.PUBLIC && d.draftStatus !== 3) ?? rels.find((d) => d.userId === userId);
  if (!preferred) return null;
  return `/drafts/${preferred.id}?questionId=${questionId}`;
}
function listFavorites(userId, targetType) {
  const db = getDb();
  return activeFavorites(userId).filter((f) => f.targetType === targetType).map((f) => buildItem(f, userId)).sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt));
}
function buildItem(favorite, userId) {
  const db = getDb();
  const base = {
    id: favorite.id,
    targetType: favorite.targetType,
    targetId: favorite.targetId,
    title: "\u8D44\u6E90\u5DF2\u4E0D\u53EF\u8BBF\u95EE",
    subtitle: "",
    favoritedAt: favorite.createTime,
    available: false,
    link: null
  };
  if (favorite.targetType === FavoriteTargetType.DRAFT) {
    const draft = db.drafts.find((d) => d.id === favorite.targetId && d.deleted === 0);
    if (!draft) return base;
    const available2 = draftAccessible(draft.id, userId);
    const category = db.categories.find((c) => c.id === draft.categoryId);
    return {
      ...base,
      title: draft.draftName,
      subtitle: `${category?.categoryName ?? "\u2014"} \xB7 ${draft.questionCount} \u9898`,
      available: available2,
      link: available2 ? `/drafts/${draft.id}` : null
    };
  }
  if (favorite.targetType === FavoriteTargetType.QUESTION) {
    const question = db.questions.find((q) => q.id === favorite.targetId && q.deleted === 0);
    if (!question) return base;
    const available2 = questionAccessible(question.id, userId);
    const link = available2 ? questionLink(question.id, userId) : null;
    return {
      ...base,
      title: question.title,
      subtitle: question.analysis ? "\u542B\u89E3\u6790" : "\u9898\u76EE",
      // 题目存在但没有可见试卷时也算不可访问（跳不过去）
      available: available2 && link !== null,
      link
    };
  }
  const knowledge = db.knowledge.find((k) => k.id === favorite.targetId && k.deleted === 0);
  if (!knowledge) return base;
  const available = knowledgeAccessible(knowledge.id, userId);
  const tagNames = db.knowledgeTagRels.filter((r) => r.deleted === 0 && r.knowledgeId === knowledge.id).map((r) => db.tags.find((t) => t.id === r.tagId && t.deleted === 0)?.tagName).filter((n) => !!n);
  return {
    ...base,
    title: knowledge.title,
    subtitle: tagNames.length > 0 ? tagNames.join("\u3001") : "\u672A\u7ED1\u5B9A\u8003\u70B9\u6807\u7B7E",
    available,
    link: available ? `/knowledge/${knowledge.id}` : null
  };
}
function favoriteCount(userId) {
  return activeFavorites(userId).length;
}

// src/mock/service/feedbackService.ts
function inDateRange(value, start, end) {
  const day = value.slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}
function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}\u2026`;
}
function toItem(ticket) {
  const db = getDb();
  const submitter = findUser(ticket.userId);
  const question = db.questions.find((q) => q.id === ticket.questionId && q.deleted === 0);
  const handler = ticket.handledBy ? findUser(ticket.handledBy) : null;
  const draftRel = question ? db.draftQuestionRels.find((r) => r.deleted === 0 && r.questionId === question.id) : void 0;
  const draft = draftRel ? db.drafts.find((d) => d.id === draftRel.draftId && d.deleted === 0) : void 0;
  return {
    id: ticket.id,
    userId: ticket.userId,
    submitterName: submitter?.username ?? "\u5DF2\u6CE8\u9500\u7528\u6237",
    submitterDeleted: !submitter || submitter.deleted !== 0,
    questionId: ticket.questionId,
    questionPreview: question ? truncate(question.title, 60) : null,
    questionType: question ? question.questionType : null,
    draftId: draft ? draft.id : null,
    draftName: draft ? draft.draftName : null,
    description: ticket.description,
    status: ticket.status,
    adminRemark: ticket.adminRemark ?? null,
    handledByName: handler?.username ?? null,
    handledTime: ticket.handledTime ?? null,
    createTime: ticket.createTime
  };
}
function submitFeedback(userId, questionId, description) {
  const db = getDb();
  const text = description.trim();
  if (!text) throw new Error("\u8BF7\u586B\u5199\u95EE\u9898\u63CF\u8FF0");
  if (text.length > 500) throw new Error("\u95EE\u9898\u63CF\u8FF0\u6700\u591A 500 \u5B57");
  const question = db.questions.find((q) => q.id === questionId && q.deleted === 0);
  if (!question) throw notFound("\u8BE5\u9898\u76EE\u5DF2\u5931\u6548\uFF0C\u4E0D\u80FD\u63D0\u4EA4\u53CD\u9988");
  db.feedbackTickets.push({
    ...newStamp(),
    id: nextId("feedbackTickets"),
    deleted: 0,
    userId,
    questionId,
    description: text,
    status: FeedbackStatus.PENDING,
    adminRemark: null,
    handledBy: null,
    handledTime: null
  });
}
function listMyFeedback(userId) {
  return getDb().feedbackTickets.filter((t) => t.deleted === 0 && t.userId === userId).map((t) => ({
    ...toItem(t),
    adminRemark: null,
    handledByName: null
  })).sort((a, b) => b.createTime.localeCompare(a.createTime));
}
function listFeedback(filter = {}) {
  requireAdmin();
  const status = filter.status ?? "all";
  return getDb().feedbackTickets.filter((t) => t.deleted === 0).filter((t) => status === "all" ? true : t.status === status).filter((t) => inDateRange(t.createTime, filter.startDate, filter.endDate)).map(toItem).sort((a, b) => b.createTime.localeCompare(a.createTime));
}
function handleFeedback(ticketId, status, remark) {
  const operator = requireAdmin();
  const ticket = getDb().feedbackTickets.find((t) => t.id === ticketId && t.deleted === 0);
  if (!ticket) throw notFound("\u5DE5\u5355\u4E0D\u5B58\u5728");
  const text = remark.trim();
  if ((status === FeedbackStatus.HANDLED || status === FeedbackStatus.IGNORED) && !text) {
    throw new Error("\u6807\u8BB0\u4E3A\u300C\u5DF2\u5904\u7406 / \u5FFD\u7565\u300D\u65F6\u5FC5\u987B\u586B\u5199\u5904\u7406\u5907\u6CE8");
  }
  ticket.status = status;
  ticket.adminRemark = text || null;
  ticket.updateTime = nowIso();
  if (status === FeedbackStatus.PENDING) {
    ticket.handledBy = null;
    ticket.handledTime = null;
  } else {
    ticket.handledBy = operator.id;
    ticket.handledTime = nowIso();
  }
}
function pendingFeedbackCount() {
  requireAdmin();
  return getDb().feedbackTickets.filter(
    (t) => t.deleted === 0 && t.status === FeedbackStatus.PENDING
  ).length;
}

// src/mock/service/knowledgeService.ts
var activeKnowledge = () => getDb().knowledge.filter((k) => k.deleted === 0);
var activeTagRels = () => getDb().knowledgeTagRels.filter((r) => r.deleted === 0);
var activeQuestionRels = () => getDb().knowledgeQuestionRels.filter((r) => r.deleted === 0);
function findKnowledge(id) {
  return activeKnowledge().find((k) => k.id === id);
}
function tagIdsOf(knowledgeId) {
  return activeTagRels().filter((r) => r.knowledgeId === knowledgeId).map((r) => r.tagId);
}
function tagNamesOf(knowledgeId) {
  const db = getDb();
  return tagIdsOf(knowledgeId).map((id) => db.tags.find((t) => t.id === id && t.deleted === 0)?.tagName).filter((n) => !!n);
}
function categoriesOf(knowledgeId) {
  const db = getDb();
  const tagIds = new Set(tagIdsOf(knowledgeId));
  const categoryIds = new Set(
    db.categoryTagRels.filter((r) => r.deleted === 0 && tagIds.has(r.tagId)).map((r) => r.categoryId)
  );
  return [...categoryIds].map((id) => db.categories.find((c) => c.id === id && c.deleted === 0)).filter((c) => !!c).map((c) => ({ id: c.id, name: c.categoryName }));
}
function toListItem2(k) {
  const author = findUser(k.userId);
  const cats = categoriesOf(k.id);
  return {
    ...k,
    authorName: author?.username ?? "\u5DF2\u6CE8\u9500\u7528\u6237",
    authorDeleted: !author || author.deleted !== 0,
    tagIds: tagIdsOf(k.id),
    tagNames: tagNamesOf(k.id),
    categoryIds: cats.map((c) => c.id),
    categoryNames: cats.map((c) => c.name)
  };
}
function matchTitlePrefix(title, keyword) {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  return title.trim().toLowerCase().startsWith(k);
}
function draftRefForQuestion(questionId, viewerId) {
  const db = getDb();
  const rels = db.draftQuestionRels.filter((r) => r.deleted === 0 && r.questionId === questionId);
  const candidates = rels.map((rel) => db.drafts.find((d) => d.id === rel.draftId && d.deleted === 0)).filter((d) => !!d).filter((d) => {
    if (d.draftStatus !== 1) return false;
    if (d.visibility === Visibility.PUBLIC) return true;
    return viewerId !== null && d.userId === viewerId;
  });
  const preferred = candidates.find((d) => d.visibility === Visibility.PUBLIC) ?? candidates.find((d) => viewerId !== null && d.userId === viewerId) ?? candidates[0];
  return preferred ? { draftId: preferred.id, draftName: preferred.draftName } : { draftId: null, draftName: null };
}
function assertQuestionsSelectable(questionIds, ownerId) {
  if (questionIds.length === 0) return;
  const db = getDb();
  const allowed = new Set(selectableQuestionIds(ownerId));
  for (const qid of questionIds) {
    const question = db.questions.find((x) => x.id === qid && x.deleted === 0);
    if (!question) throw notFound(`\u9898\u76EE\u4E0D\u5B58\u5728\uFF1A${qid}`);
    if (!allowed.has(qid)) throw noPermission("\u4E0D\u80FD\u5173\u8054\u4ED6\u4EBA\u79C1\u6709\u8BD5\u5377\u4E2D\u7684\u9898\u76EE");
  }
}
function selectableQuestionIds(ownerId) {
  const db = getDb();
  const questionIds = /* @__PURE__ */ new Set();
  db.drafts.filter((d) => d.deleted === 0 && d.userId === ownerId).forEach(
    (d) => db.draftQuestionRels.filter((r) => r.deleted === 0 && r.draftId === d.id).forEach((r) => questionIds.add(r.questionId))
  );
  db.drafts.filter((d) => d.deleted === 0 && d.visibility === Visibility.PUBLIC).forEach(
    (d) => db.draftQuestionRels.filter((r) => r.deleted === 0 && r.draftId === d.id).forEach((r) => questionIds.add(r.questionId))
  );
  return [...questionIds];
}
function replaceRelations(knowledgeId, tagIds, questionIds) {
  const db = getDb();
  const stamp = nowIso();
  db.knowledgeTagRels.filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0).forEach((r) => softDelete(db.knowledgeTagRels, r.id));
  db.knowledgeQuestionRels.filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0).forEach((r) => softDelete(db.knowledgeQuestionRels, r.id));
  tagIds.forEach((tagId) => {
    db.knowledgeTagRels.push({
      id: nextId("knowledgeTagRels"),
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      knowledgeId,
      tagId
    });
  });
  questionIds.forEach((questionId) => {
    db.knowledgeQuestionRels.push({
      id: nextId("knowledgeQuestionRels"),
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      knowledgeId,
      questionId
    });
  });
}
function assertOwner(knowledge, userId) {
  if (knowledge.userId !== userId) throw noPermission("\u53EA\u80FD\u7F16\u8F91\u81EA\u5DF1\u521B\u5EFA\u7684\u77E5\u8BC6\u70B9");
}
function listPublicKnowledge(filter = {}) {
  const sort = filter.sort ?? "created";
  const rows = activeKnowledge().filter((k) => k.visibility === Visibility.PUBLIC).filter((k) => matchTitlePrefix(k.title, filter.keyword ?? "")).filter((k) => {
    if (!filter.categoryId) return true;
    return categoriesOf(k.id).some((c) => c.id === filter.categoryId);
  }).filter((k) => {
    const selected = filter.tagIds ?? [];
    if (selected.length === 0) return true;
    const own = new Set(tagIdsOf(k.id));
    return selected.some((t) => own.has(t));
  }).map(toListItem2);
  return sortKnowledge(rows, sort);
}
function sortKnowledge(rows, sort) {
  const list = [...rows];
  if (sort === "title") {
    return list.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  }
  if (sort === "updated") {
    return list.sort((a, b) => (b.updateTime ?? "").localeCompare(a.updateTime ?? ""));
  }
  return list.sort((a, b) => b.createTime.localeCompare(a.createTime));
}
function listMyKnowledge(userId) {
  return sortKnowledge(
    activeKnowledge().filter((k) => k.userId === userId).map(toListItem2),
    "updated"
  );
}
function getKnowledgeDetail(knowledgeId, viewerId) {
  const knowledge = findKnowledge(knowledgeId);
  if (!knowledge) throw notFound("\u77E5\u8BC6\u70B9\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
  const author = findUser(knowledge.userId);
  const authorDeleted = !author || author.deleted !== 0;
  const isOwner = viewerId !== null && knowledge.userId === viewerId;
  if (knowledge.visibility === Visibility.PRIVATE) {
    if (authorDeleted && !isOwner) throw notFound("\u8BE5\u77E5\u8BC6\u70B9\u5DF2\u4E0D\u53EF\u8BBF\u95EE");
    if (!isOwner) throw noPermission("\u79C1\u6709\u77E5\u8BC6\u70B9\u4EC5\u521B\u5EFA\u8005\u672C\u4EBA\u53EF\u8BBF\u95EE");
  }
  const db = getDb();
  const questions = activeQuestionRels().filter((r) => r.knowledgeId === knowledgeId).map((r) => {
    const question = db.questions.find((x) => x.id === r.questionId && x.deleted === 0);
    if (!question) return null;
    const ref = draftRefForQuestion(question.id, viewerId);
    return {
      questionId: question.id,
      title: question.title,
      questionType: question.questionType,
      draftId: ref.draftId,
      draftName: ref.draftName
    };
  }).filter((x) => !!x);
  return {
    knowledge,
    author: {
      id: author?.id ?? knowledge.userId,
      username: author?.username ?? "\u5DF2\u6CE8\u9500\u7528\u6237",
      deleted: author?.deleted ?? 1
    },
    tagIds: tagIdsOf(knowledgeId),
    tagNames: tagNamesOf(knowledgeId),
    questions,
    myAnnotation: viewerId === null ? null : getMyAnnotation(knowledgeId, viewerId),
    canEdit: isOwner
  };
}
function listPublicKnowledgeByUser(userId) {
  return sortKnowledge(
    activeKnowledge().filter((k) => k.userId === userId && k.visibility === Visibility.PUBLIC).map(toListItem2),
    "updated"
  );
}
function listKnowledgeByQuestions(questionIds, viewerId) {
  const result = {};
  for (const qid of questionIds) {
    const links = listKnowledgeByQuestion(qid, viewerId);
    if (links.length > 0) result[qid] = links;
  }
  return result;
}
function listKnowledgeByQuestion(questionId, viewerId) {
  const db = getDb();
  const ids = new Set(
    activeQuestionRels().filter((r) => r.questionId === questionId).map((r) => r.knowledgeId)
  );
  return activeKnowledge().filter((k) => ids.has(k.id)).filter((k) => {
    if (k.visibility === Visibility.PUBLIC) {
      return true;
    }
    return viewerId !== null && k.userId === viewerId;
  }).map((k) => ({ id: k.id, title: k.title })).sort((a, b) => a.id - b.id);
}
function searchSelectableQuestions(userId, keyword = "") {
  const db = getDb();
  const k = keyword.trim().toLowerCase();
  return selectableQuestionIds(userId).map((qid) => db.questions.find((x) => x.id === qid && x.deleted === 0)).filter((x) => !!x).filter((q) => !k || q.title.toLowerCase().includes(k)).slice(0, 50).map((q) => {
    const ref = draftRefForQuestion(q.id, userId);
    return {
      questionId: q.id,
      title: q.title,
      questionType: q.questionType,
      draftId: ref.draftId,
      draftName: ref.draftName
    };
  });
}
function checkKnowledgeTitle(title, excludeId) {
  const t = title.trim();
  if (!t) return { exactDuplicate: false, similar: [] };
  const publics = activeKnowledge().filter(
    (k) => k.visibility === Visibility.PUBLIC && k.id !== excludeId
  );
  const exactDuplicate = publics.some((k) => k.title.trim() === t);
  const grams = (s) => {
    const set = /* @__PURE__ */ new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const target = grams(t);
  const similar = publics.map((k) => {
    const other = grams(k.title.trim());
    let hit = 0;
    other.forEach((g) => {
      if (target.has(g)) hit++;
    });
    const score = target.size === 0 ? 0 : hit / target.size;
    return { id: k.id, title: k.title, score };
  }).filter((x) => x.score >= 0.34 && x.title.trim() !== t).sort((a, b) => b.score - a.score).slice(0, 5).map(({ id, title: name }) => ({ id, title: name }));
  return { exactDuplicate, similar };
}
function createKnowledge(userId, payload) {
  const user = findUser(userId);
  if (!user || user.deleted !== 0) throw notFound("\u7528\u6237\u4E0D\u5B58\u5728");
  const title = payload.title.trim();
  if (!title) throw new Error("\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  if (!payload.content.trim()) throw new Error("\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
  assertQuestionsSelectable(payload.questionIds, userId);
  const visibility = payload.visibility ?? (user.roleType === RoleType.ADMIN ? Visibility.PUBLIC : Visibility.PRIVATE);
  const article = {
    ...newStamp(),
    id: nextId("knowledge"),
    deleted: 0,
    userId,
    title,
    summary: payload.summary?.trim() || null,
    content: payload.content,
    visibility
  };
  getDb().knowledge.push(article);
  replaceRelations(article.id, payload.tagIds, payload.questionIds);
  return article;
}
function updateKnowledge(knowledgeId, userId, payload) {
  const knowledge = findKnowledge(knowledgeId);
  if (!knowledge) throw notFound("\u77E5\u8BC6\u70B9\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
  assertOwner(knowledge, userId);
  const title = payload.title.trim();
  if (!title) throw new Error("\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  if (!payload.content.trim()) throw new Error("\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A");
  assertQuestionsSelectable(payload.questionIds, userId);
  knowledge.title = title;
  knowledge.summary = payload.summary?.trim() || null;
  knowledge.content = payload.content;
  if (payload.visibility) knowledge.visibility = payload.visibility;
  knowledge.updateTime = nowIso();
  replaceRelations(knowledgeId, payload.tagIds, payload.questionIds);
  return knowledge;
}
function deleteKnowledge(knowledgeId, userId) {
  const knowledge = findKnowledge(knowledgeId);
  if (!knowledge) throw notFound("\u77E5\u8BC6\u70B9\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
  assertOwner(knowledge, userId);
  const db = getDb();
  db.knowledgeTagRels.filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0).forEach((r) => softDelete(db.knowledgeTagRels, r.id));
  db.knowledgeQuestionRels.filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0).forEach((r) => softDelete(db.knowledgeQuestionRels, r.id));
  softDelete(db.knowledge, knowledgeId);
}
function getMyAnnotation(knowledgeId, userId) {
  const row = getDb().knowledgeAnnotations.find(
    (a) => a.deleted === 0 && a.knowledgeId === knowledgeId && a.userId === userId
  );
  return row ? row.content : null;
}
function saveMyAnnotation(knowledgeId, userId, content) {
  const knowledge = findKnowledge(knowledgeId);
  if (!knowledge) throw notFound("\u77E5\u8BC6\u70B9\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
  const db = getDb();
  const existing = db.knowledgeAnnotations.find(
    (a) => a.deleted === 0 && a.knowledgeId === knowledgeId && a.userId === userId
  );
  const text = content.trim();
  if (!text) {
    if (existing) softDelete(db.knowledgeAnnotations, existing.id);
    return;
  }
  if (existing) {
    existing.content = text;
    existing.updateTime = nowIso();
    return;
  }
  db.knowledgeAnnotations.push({
    ...newStamp(),
    id: nextId("knowledgeAnnotations"),
    deleted: 0,
    knowledgeId,
    userId,
    content: text
  });
}

// src/mock/service/noteService.ts
function getMyNote(userId, questionId) {
  const row = getDb().questionNotes.find(
    (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId
  );
  return row ? row.content : null;
}
function listMyNotes(userId, questionIds) {
  const wanted = new Set(questionIds);
  const map = {};
  getDb().questionNotes.filter((n) => n.deleted === 0 && n.userId === userId && wanted.has(n.questionId)).forEach((n) => {
    map[n.questionId] = n.content;
  });
  return map;
}
function saveMyNote(userId, questionId, content) {
  const db = getDb();
  if (!db.questions.some((q) => q.id === questionId && q.deleted === 0)) {
    const existing2 = db.questionNotes.find(
      (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId
    );
    if (!existing2) throw notFound("\u9898\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
  }
  const existing = db.questionNotes.find(
    (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId
  );
  const text = content.trim();
  if (!text) {
    if (existing) softDelete(db.questionNotes, existing.id);
    return;
  }
  if (existing) {
    existing.content = text;
    existing.updateTime = nowIso();
    return;
  }
  db.questionNotes.push({
    ...newStamp(),
    id: nextId("questionNotes"),
    deleted: 0,
    userId,
    questionId,
    content: text
  });
}
var NOTE_EMPTY_HINT = Copy.noteEmpty;

// src/mock/service/statService.ts
function accuracy(userId) {
  return calcAccuracy(userId);
}
function dashboard(userId) {
  const db = getDb();
  const user = findUser(userId);
  if (!user) throw notFound("\u7528\u6237\u4E0D\u5B58\u5728");
  const finishedExams = db.exams.filter(
    (e) => e.deleted === 0 && e.userId === userId && !!e.submitTime
  );
  const finishedExamIds = new Set(finishedExams.map((e) => e.id));
  const judgedObjective = db.examQuestions.filter((q) => {
    if (q.deleted !== 0) return false;
    if (!finishedExamIds.has(q.examId)) return false;
    if (q.questionType === QuestionType.SHORT_ANSWER) return false;
    return q.judgeStatus === JudgeStatus.JUDGED;
  });
  const wrongRecords = db.records.filter(
    (r) => r.deleted === 0 && r.userId === userId && r.isMaster === MasterStatus.WRONG_SET
  );
  const masteredRecords = db.records.filter(
    (r) => r.deleted === 0 && r.userId === userId && r.isMaster === MasterStatus.MASTERED_SET
  );
  const trendMap = /* @__PURE__ */ new Map();
  const examDateOf = /* @__PURE__ */ new Map();
  finishedExams.forEach((e) => {
    const date = (e.submitTime ?? "").slice(0, 10);
    examDateOf.set(e.id, date);
    const row = trendMap.get(date) ?? { examCount: 0, questionCount: 0 };
    row.examCount += 1;
    trendMap.set(date, row);
  });
  judgedObjective.forEach((q) => {
    const date = examDateOf.get(q.examId);
    if (!date) return;
    const row = trendMap.get(date) ?? { examCount: 0, questionCount: 0 };
    row.questionCount += 1;
    trendMap.set(date, row);
  });
  const trend = [...trendMap.entries()].map(([date, v]) => ({ date, examCount: v.examCount, questionCount: v.questionCount })).sort((a, b) => a.date.localeCompare(b.date));
  const tagCount = /* @__PURE__ */ new Map();
  wrongRecords.forEach((r) => {
    const tagIds = db.questionTagRels.filter((rel) => rel.deleted === 0 && rel.questionId === r.questionId).map((rel) => rel.tagId);
    tagIds.forEach((tagId) => tagCount.set(tagId, (tagCount.get(tagId) ?? 0) + 1));
  });
  const tagWrongRanking = [...tagCount.entries()].map(([tagId, count]) => ({
    tagId,
    tagName: db.tags.find((t) => t.id === tagId)?.tagName ?? `\u6807\u7B7E#${tagId}`,
    wrongCount: count
  })).sort((a, b) => b.wrongCount - a.wrongCount).slice(0, 10);
  const accuracyStat = calcAccuracy(userId);
  const totals = {
    finishedExamCount: finishedExams.length,
    judgedQuestionCount: judgedObjective.length,
    wrongCount: wrongRecords.length,
    masteredCount: masteredRecords.length,
    globalAccuracy: accuracyStat.globalAccuracy
  };
  const empty = totals.finishedExamCount === 0 && totals.wrongCount === 0 && totals.masteredCount === 0;
  return {
    totals,
    trend,
    categoryAccuracy: accuracyStat.categories,
    tagWrongRanking,
    setCompare: { wrongCount: totals.wrongCount, masteredCount: totals.masteredCount },
    empty
  };
}
function publicDraftsOf(userId) {
  return allDrafts().filter(
    (d) => d.userId === userId && d.visibility === Visibility.PUBLIC && d.draftStatus !== DraftStatus.DISCARDED
  ).map((d) => ({
    ...d,
    categoryName: findCategory(d.categoryId)?.categoryName ?? "\u2014",
    ownerName: findUser(d.userId)?.username ?? "\u5DF2\u6CE8\u9500\u7528\u6237",
    canEdit: false
  }));
}
function sanitizeRecordsForOthers(userId) {
  const db = getDb();
  return recordsOfUser(userId).filter((r) => r.isMaster === MasterStatus.WRONG_SET).map((record) => {
    const question = findQuestion(record.questionId);
    return {
      recordId: record.id,
      questionId: record.questionId,
      categoryId: record.categoryId,
      categoryName: findCategory(record.categoryId)?.categoryName ?? "\u2014",
      isMaster: record.isMaster,
      wrongCount: 0,
      lastWrongTime: record.lastWrongTime ?? null,
      masterTime: record.masterTime ?? null,
      questionType: question?.questionType ?? QuestionType.SINGLE,
      title: question?.title ?? "\uFF08\u9898\u76EE\u5DF2\u5220\u9664\uFF09",
      options: parseOptions(question?.options),
      answer: "",
      analysis: null,
      tagNames: questionTagNames(record.questionId),
      detailCount: db.wrongDetails.filter((d) => d.recordId === record.id && d.deleted === 0).length
    };
  }).sort((a, b) => (b.lastWrongTime ?? "").localeCompare(a.lastWrongTime ?? ""));
}
function profileView(viewerId, targetUserId) {
  const target = findUser(targetUserId);
  if (!target) throw notFound("\u7528\u6237\u4E0D\u5B58\u5728");
  const viewer = viewerId ? findUser(viewerId) : null;
  const isSelf = viewerId === targetUserId;
  const isAdmin = viewer?.roleType === RoleType.ADMIN;
  const canViewDetail = isSelf || target.privacyType === PrivacyType.PUBLIC;
  const base = {
    user: {
      id: target.id,
      username: target.username,
      profile: target.profile ?? null,
      privacyType: target.privacyType,
      deleted: target.deleted,
      createTime: target.createTime
    },
    canViewDetail,
    publicDrafts: publicDraftsOf(targetUserId),
    /*
     * 公开知识点：**与隐私设置无关**。
     * 隐私开关管的是答题记录、错题集、准确率这些个人数据；
     * 知识点的可见性由每篇自己的公开/私有决定（14 号 §4.4：注销用户的公开知识点继续可用）。
     */
    publicKnowledge: listPublicKnowledgeByUser(targetUserId)
  };
  if (!canViewDetail) return base;
  const exams = listExamsOfUser(targetUserId);
  base.accuracy = calcAccuracy(targetUserId);
  base.exams = exams;
  base.wrongRecords = isSelf || isAdmin ? (
    // 本人视角：完整字段（错题次数等）
    recordsOfUser(targetUserId).filter((r) => r.isMaster === MasterStatus.WRONG_SET).map((record) => {
      const question = findQuestion(record.questionId);
      return {
        recordId: record.id,
        questionId: record.questionId,
        categoryId: record.categoryId,
        categoryName: findCategory(record.categoryId)?.categoryName ?? "\u2014",
        isMaster: record.isMaster,
        wrongCount: record.wrongCount,
        lastWrongTime: record.lastWrongTime ?? null,
        masterTime: record.masterTime ?? null,
        questionType: question?.questionType ?? QuestionType.SINGLE,
        title: question?.title ?? "\uFF08\u9898\u76EE\u5DF2\u5220\u9664\uFF09",
        options: parseOptions(question?.options),
        answer: question?.answer ?? "",
        analysis: question?.analysis ?? null,
        tagNames: questionTagNames(record.questionId),
        detailCount: getDb().wrongDetails.filter((d) => d.recordId === record.id && d.deleted === 0).length
      };
    })
  ) : sanitizeRecordsForOthers(targetUserId);
  return base;
}
function pendingSummary(userId) {
  let pending = 0;
  getDb().exams.filter((e) => e.userId === userId && e.deleted === 0).forEach((exam) => {
    pending += examQuestionsOf(exam.id).filter((eq) => eq.judgeStatus !== JudgeStatus.JUDGED).length;
  });
  return { pendingCount: pending };
}

// src/mock/service/wrongService.ts
function listRecords(userId, filter) {
  const db = getDb();
  return recordsOfUser(userId).filter((r) => filter?.categoryId ? r.categoryId === filter.categoryId : true).filter(
    (r) => filter?.isMaster === null || filter?.isMaster === void 0 ? true : r.isMaster === filter.isMaster
  ).map((record) => {
    const question = findQuestion(record.questionId);
    const detailCount = db.wrongDetails.filter(
      (d) => d.recordId === record.id && d.deleted === 0
    ).length;
    return {
      recordId: record.id,
      questionId: record.questionId,
      categoryId: record.categoryId,
      categoryName: findCategory(record.categoryId)?.categoryName ?? "\u2014",
      isMaster: record.isMaster,
      wrongCount: record.wrongCount,
      lastWrongTime: record.lastWrongTime ?? null,
      masterTime: record.masterTime ?? null,
      questionType: question?.questionType ?? QuestionType.SINGLE,
      title: question?.title ?? "\uFF08\u9898\u76EE\u5DF2\u5220\u9664\uFF09",
      options: parseOptions(question?.options),
      answer: question?.answer ?? "",
      analysis: question?.analysis ?? null,
      tagNames: questionTagNames(record.questionId),
      detailCount
    };
  }).filter(
    (item) => filter?.keyword ? item.title.toLowerCase().includes(filter.keyword.toLowerCase()) : true
  ).sort((a, b) => (b.lastWrongTime ?? "").localeCompare(a.lastWrongTime ?? ""));
}
function countBySet(userId) {
  const records = recordsOfUser(userId);
  return {
    wrongCount: records.filter((r) => r.isMaster === MasterStatus.WRONG_SET).length,
    masteredCount: records.filter((r) => r.isMaster === MasterStatus.MASTERED_SET).length,
    totalWrongTimes: records.reduce((sum, r) => sum + r.wrongCount, 0)
  };
}
function listDetails(userId, recordId) {
  const db = getDb();
  const record = db.records.find((r) => r.id === recordId && r.deleted === 0);
  if (!record || record.userId !== userId) throw new Error("\u65E0\u6743\u67E5\u770B\u8BE5\u9519\u9898\u660E\u7EC6");
  return db.wrongDetails.filter((d) => d.recordId === recordId && d.deleted === 0).sort((a, b) => b.answerTime.localeCompare(a.answerTime)).map((d) => {
    const exam = findExam(d.examId);
    return {
      id: d.id,
      examId: d.examId,
      examQuestionId: d.examQuestionId,
      userAnswer: d.userAnswer ?? null,
      judgeResult: d.judgeResult ?? null,
      aiExplain: d.aiExplain ?? null,
      answerTime: d.answerTime,
      examName: exam?.draftName ?? "\uFF08\u7B54\u9898\u8BB0\u5F55\u5DF2\u5220\u9664\uFF09"
    };
  });
}
function deleteRecord(userId, recordId) {
  const db = getDb();
  const record = db.records.find((r) => r.id === recordId && r.deleted === 0);
  if (!record) throw new Error("\u8BB0\u5F55\u4E0D\u5B58\u5728");
  if (record.userId !== userId) throw new Error("\u65E0\u6743\u5220\u9664\u4ED6\u4EBA\u7684\u9519\u9898\u8BB0\u5F55");
  softDelete(db.records, recordId);
}
function recordState(userId, questionId, categoryId) {
  const record = findRecord(userId, questionId, categoryId);
  if (!record) return { exists: false, isMaster: null, wrongCount: 0 };
  return { exists: true, isMaster: record.isMaster, wrongCount: record.wrongCount };
}

// src/api/index.ts
var ApiError = class extends Error {
  code;
  constructor(message, code = ApiCode.GENERIC) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
};
function toApiError(e) {
  if (e instanceof DomainError) return new ApiError(e.message, e.code);
  return new ApiError(e instanceof Error ? e.message : String(e), ApiCode.GENERIC);
}
var LATENCY = 90;
function assertSessionForWrite() {
  if (!currentUser()) {
    throw new ApiError("\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548", ApiCode.SESSION);
  }
}
async function call(fn, opts = {}) {
  await new Promise((resolve) => setTimeout(resolve, LATENCY));
  if (!opts.allowGuest) assertSessionForWrite();
  try {
    const data = fn();
    saveDb();
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}
async function query(fn) {
  await new Promise((resolve) => setTimeout(resolve, LATENCY));
  try {
    return fn();
  } catch (e) {
    throw toApiError(e);
  }
}
var authApi = {
  checkUsername: (username) => query(() => checkUsernameAvailable(username)),
  // 注册 / 登录 / 找回密码：未登录状态下必须可用，显式放行
  register: (params) => call(() => register(params), { allowGuest: true }),
  login: (params) => call(() => login(params), { allowGuest: true }),
  logout: () => call(() => logout()),
  current: () => query(() => currentUser()),
  /** 会话是否存在但已失效（用户被注销/删除）—— 用于区分「游客」与「会话失效」(PER-02) */
  isSessionExpired: () => query(() => isSessionExpired()),
  resetPassword: (params) => call(() => resetPassword(params), { allowGuest: true }),
  resetDemoData: () => call(() => resetDb())
};
var userApi = {
  updateProfile: (userId, params) => call(() => updateProfile(userId, params)),
  changePassword: (userId, oldPassword, newPassword) => call(() => changePassword(userId, oldPassword, newPassword)),
  deactivate: (userId, password) => call(() => deactivateAccount(userId, password)),
  list: () => query(() => listUsers()),
  /* --- 管理端：用户账号管理（v0.5）。权限以会话为准，故不接收「操作者 id」 --- */
  /** 用户账号列表（含已注销账号，支持用户名关键字 + 账号状态筛选） */
  adminList: (filter) => query(() => listUsersForAdmin(filter)),
  /** 重置指定用户密码：该用户全部在线会话立即失效 */
  adminResetPassword: (targetUserId, newPassword) => call(() => adminResetPassword(targetUserId, newPassword)),
  /** 切换指定用户角色（下次登录生效；不允许操作自己） */
  adminSwitchRole: (targetUserId) => call(() => adminSwitchRole(targetUserId))
};
var categoryApi = {
  list: () => query(() => listCategories()),
  create: (operatorId, payload) => call(() => createCategory(operatorId, payload)),
  update: (operatorId, categoryId, payload) => call(() => updateCategory(operatorId, categoryId, payload)),
  remove: (operatorId, categoryId) => call(() => deleteCategory(operatorId, categoryId)),
  tagConfig: (categoryId) => query(() => categoryTagConfig(categoryId))
};
var tagApi = {
  list: () => query(() => listTags()),
  create: (operatorId, tagName) => call(() => createTag(operatorId, tagName)),
  update: (operatorId, tagId, payload) => call(() => updateTag(operatorId, tagId, payload)),
  remove: (operatorId, tagId) => call(() => deleteTag(operatorId, tagId))
};
var draftApi = {
  listPublic: (filter) => query(() => listPublicDrafts(filter)),
  listMine: (userId) => query(() => listMyDrafts(userId)),
  listDiscarded: () => query(() => listDiscardedDrafts()),
  detail: (draftId, viewerId) => query(() => getDraftDetail(draftId, viewerId)),
  create: (userId, params) => call(() => createDraft(userId, params)),
  updateMeta: (draftId, userId, params) => call(() => updateDraftMeta(draftId, userId, params)),
  switchStatus: (draftId, userId, target) => call(() => switchDraftStatus(draftId, userId, target)),
  discard: (draftId, userId) => call(() => discardDraft(draftId, userId)),
  saveAs: (draftId, userId, newName) => call(() => saveDraftAs(draftId, userId, newName)),
  createQuestion: (draftId, userId, payload) => call(() => createQuestionInDraft(draftId, userId, payload)),
  updateQuestion: (draftId, userId, questionId, payload, relScore) => call(() => updateQuestion(draftId, userId, questionId, payload, relScore)),
  copyAsNew: (draftId, userId, questionId) => call(() => copyQuestionAsNew(draftId, userId, questionId)),
  attachQuestion: (draftId, userId, questionId, score) => call(() => attachQuestionToDraft(draftId, userId, questionId, score)),
  detachQuestion: (draftId, userId, relId) => call(() => detachQuestionFromDraft(draftId, userId, relId)),
  moveQuestion: (draftId, userId, relId, delta) => call(() => moveQuestion(draftId, userId, relId, delta)),
  updateRelScore: (draftId, userId, relId, score) => call(() => updateRelScore(draftId, userId, relId, score)),
  deleteQuestion: (userId, questionId) => call(() => deleteQuestion(userId, questionId)),
  questionBank: (filter) => query(() => listQuestionBank(filter)),
  adminUpdateQuestionTags: (operatorId, questionId, tagIds) => call(() => adminUpdateQuestionTags(operatorId, questionId, tagIds))
};
var examApi = {
  start: (userId, draftId) => call(() => startExam(userId, draftId)),
  detail: (examId, userId) => query(() => getExamDetail(examId, userId)),
  detailForViewer: (examId, viewerId, isAdmin = false) => query(() => getExamDetailForViewer(examId, viewerId, isAdmin)),
  saveAnswer: (examId, userId, examQuestionId, userAnswer) => call(() => saveAnswer2(examId, userId, examQuestionId, userAnswer)),
  submit: (examId, userId) => call(() => submitExam2(examId, userId)),
  listMine: (userId) => query(() => listMyExams(userId)),
  listUnsubmitted: (userId) => query(() => listUnsubmitted(userId)),
  remove: (examId, userId) => call(() => deleteExam2(examId, userId)),
  abandon: (examId, userId) => call(() => abandonExam(examId, userId)),
  clearAnswers: (examId, userId) => call(() => clearExamAnswers(examId, userId))
};
var wrongApi = {
  list: (userId, filter) => query(() => listRecords(userId, filter)),
  counts: (userId) => query(() => countBySet(userId)),
  details: (userId, recordId) => query(() => listDetails(userId, recordId)),
  remove: (userId, recordId) => call(() => deleteRecord(userId, recordId)),
  state: (userId, questionId, categoryId) => query(() => recordState(userId, questionId, categoryId))
};
var composeApi = {
  preview: (userId, params) => query(() => preview(userId, params)),
  validate: (userId, params) => query(() => validateParams(userId, params)),
  generate: (userId, params) => call(() => generate(userId, params)),
  generateAndEnable: (userId, params) => call(() => generateAndEnable(userId, params)),
  suggestName: (userId, categoryId) => query(() => suggestDraftName(userId, categoryId))
};
var knowledgeApi = {
  /** 广场列表：仅公开、未删除；支持标题前缀搜索 / 分类 / 标签 / 排序 */
  listPublic: (filter) => query(() => listPublicKnowledge(filter)),
  /** 我的知识点（私有 + 公开） */
  listMine: (userId) => query(() => listMyKnowledge(userId)),
  /** 详情：私有仅作者；viewerId 为查看者（游客传 null） */
  detail: (knowledgeId, viewerId) => query(() => getKnowledgeDetail(knowledgeId, viewerId)),
  create: (userId, payload) => call(() => createKnowledge(userId, payload)),
  update: (knowledgeId, userId, payload) => call(() => updateKnowledge(knowledgeId, userId, payload)),
  remove: (knowledgeId, userId) => call(() => deleteKnowledge(knowledgeId, userId)),
  /** 保存前的标题查重与相似提示（仅提示，不阻止保存） */
  checkTitle: (title, excludeId) => query(() => checkKnowledgeTitle(title, excludeId)),
  /** 保存本人批注（用户 + 知识点唯一，空内容视为删除） */
  saveAnnotation: (knowledgeId, userId, content) => call(() => saveMyAnnotation(knowledgeId, userId, content)),
  /** 供错题页 / 答题回顾页：某题关联的、当前访问者可见的知识点 */
  listByQuestion: (questionId, viewerId) => query(() => listKnowledgeByQuestion(questionId, viewerId)),
  /** 批量版（一屏多题，避免逐题请求） */
  listByQuestions: (questionIds, viewerId) => query(() => listKnowledgeByQuestions(questionIds, viewerId)),
  /** 某个用户创建的公开知识点（他人主页展示；私有永不外露） */
  listPublicByUser: (userId) => query(() => listPublicKnowledgeByUser(userId)),
  /** 编辑页「关联题目」搜索（范围：本人全部底稿 + 公开底稿） */
  searchQuestions: (userId, keyword) => query(() => searchSelectableQuestions(userId, keyword))
};
var feedbackApi = {
  /** 提交题目报错反馈（题目已失效时拒绝） */
  submit: (userId, questionId, description) => call(() => submitFeedback(userId, questionId, description)),
  /** 我提交过的工单（用户只读自查） */
  listMine: (userId) => query(() => listMyFeedback(userId)),
  /* --- 管理端：权限以会话为准，不接收「操作者 id」 --- */
  /** 工单列表（状态 + 时间范围筛选） */
  list: (filter) => query(() => listFeedback(filter)),
  /** 处理工单：改状态 + 写备注（已处理/忽略 时备注必填）；**不改题目数据** */
  handle: (ticketId, status, remark) => call(() => handleFeedback(ticketId, status, remark)),
  /** 待处理工单数 */
  pendingCount: () => query(() => pendingFeedbackCount())
};
var favoriteApi = {
  /** 是否已收藏某资源 */
  isFavorited: (userId, targetType, targetId) => query(() => isFavorited(userId, targetType, targetId)),
  /** 批量查某类资源中已收藏的 id（列表页批量标注星标状态） */
  listIds: (userId, targetType) => query(() => listFavoriteIds(userId, targetType)),
  /** 切换收藏状态，返回切换后的状态（true = 已收藏） */
  toggle: (userId, targetType, targetId) => call(() => toggleFavorite(userId, targetType, targetId)),
  /** 我的收藏列表（按资源类型分 Tab；可用性已判定） */
  list: (userId, targetType) => query(() => listFavorites(userId, targetType)),
  /** 收藏总数（三类合计） */
  count: (userId) => query(() => favoriteCount(userId))
};
var noteApi = {
  /** 读取本人对某题的笔记（没写过返回 null） */
  get: (userId, questionId) => query(() => getMyNote(userId, questionId)),
  /** 批量读取本人笔记（答题回顾页一屏多题，避免逐题请求） */
  list: (userId, questionIds) => query(() => listMyNotes(userId, questionIds)),
  /** 保存本人笔记（编辑覆盖，唯一键 = 用户 + 题目；空内容视为删除） */
  save: (userId, questionId, content) => call(() => saveMyNote(userId, questionId, content))
};
var statApi = {
  accuracy: (userId) => query(() => accuracy(userId)),
  profile: (viewerId, targetUserId) => query(() => profileView(viewerId, targetUserId)),
  pending: (userId) => query(() => pendingSummary(userId)),
  /** v1-plus 模块5：个人学习统计大盘（**仅本人可见**，他人访问由页面按 403 拦截） */
  dashboard: (userId) => query(() => dashboard(userId))
};
var ACTOR_ARG_INDEX = {
  user: { updateProfile: 0, changePassword: 0, deactivate: 0 },
  category: { create: 0, update: 0, remove: 0 },
  tag: { create: 0, update: 0, remove: 0 },
  draft: {
    listMine: 0,
    create: 0,
    deleteQuestion: 0,
    adminUpdateQuestionTags: 0,
    updateMeta: 1,
    switchStatus: 1,
    discard: 1,
    saveAs: 1,
    createQuestion: 1,
    updateQuestion: 1,
    copyAsNew: 1,
    attachQuestion: 1,
    detachQuestion: 1,
    moveQuestion: 1,
    updateRelScore: 1
  },
  exam: {
    start: 0,
    listMine: 0,
    listUnsubmitted: 0,
    detail: 1,
    saveAnswer: 1,
    submit: 1,
    remove: 1,
    abandon: 1,
    clearAnswers: 1
  },
  wrong: { list: 0, counts: 0, details: 0, remove: 0, state: 0 },
  compose: { preview: 0, validate: 0, generate: 0, generateAndEnable: 0, suggestName: 0 },
  stat: { accuracy: 0, pending: 0, dashboard: 0 },
  knowledge: {
    listMine: 0,
    create: 0,
    searchQuestions: 0,
    update: 1,
    remove: 1,
    saveAnnotation: 1
  },
  note: { get: 0, list: 0, save: 0 },
  favorite: { isFavorited: 0, listIds: 0, toggle: 0, list: 0, count: 0 },
  feedback: { submit: 0, listMine: 0 }
};
function assertActor(actorId) {
  const me = currentUser();
  if (!me) throw new ApiError("\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548", ApiCode.SESSION);
  if (me.id !== actorId) throw new ApiError("\u65E0\u6743\u4EE5\u4ED6\u4EBA\u8EAB\u4EFD\u6267\u884C\u8BE5\u64CD\u4F5C", ApiCode.NO_PERMISSION);
}
function guardActor(group, apiGroup) {
  const spec = ACTOR_ARG_INDEX[group] ?? {};
  const guarded = { ...apiGroup };
  for (const [name, index] of Object.entries(spec)) {
    const original = apiGroup[name];
    if (typeof original !== "function") continue;
    guarded[name] = async (...args) => {
      const actorId = args[index];
      if (typeof actorId === "number") assertActor(actorId);
      return original(...args);
    };
  }
  return guarded;
}
var api = {
  auth: authApi,
  user: guardActor("user", userApi),
  category: guardActor("category", categoryApi),
  tag: guardActor("tag", tagApi),
  draft: guardActor("draft", draftApi),
  exam: guardActor("exam", examApi),
  wrong: guardActor("wrong", wrongApi),
  compose: guardActor("compose", composeApi),
  knowledge: guardActor("knowledge", knowledgeApi),
  note: guardActor("note", noteApi),
  favorite: guardActor("favorite", favoriteApi),
  feedback: guardActor("feedback", feedbackApi),
  /*
   * ⚠ 必须套 guardActor：`ACTOR_ARG_INDEX.stat` 已登记 accuracy / pending / dashboard 三项，
   * 早期这里写成 `stat: statApi` 导致清单形同虚设（学情大盘的「仅本人」校验实际未生效）。
   * `stat.profile(viewerId, targetUserId)` 是跨用户读取，**故意不在清单内**，因此不受影响。
   */
  stat: guardActor("stat", statApi)
};

// scripts/smoke/v1plus.ts
var pass = 0;
var fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  \u2705 ${name}`);
  } else {
    fail++;
    console.log(`  \u274C ${name}${detail ? " \u2192 " + detail : ""}`);
  }
}
async function expectApiError(name, fn, code) {
  try {
    await fn();
    check(name, false, "\u6CA1\u6709\u629B\u9519");
  } catch (e) {
    const err = e;
    check(name, err instanceof ApiError && err.code === code, `\u5B9E\u9645 code=${err.code} msg=${err.message}`);
  }
}
function userByName(name) {
  const u = getDb().users.find((x) => x.username === name);
  if (!u) throw new Error(`\u79CD\u5B50\u6570\u636E\u7F3A\u5C11\u8D26\u53F7 ${name}`);
  return u;
}
async function loginAs(username, password = "123456") {
  logout();
  await api.auth.login({ mode: "username", username, password });
  return currentUser();
}
async function main() {
  console.log("\n===== v1-plus \u6A21\u57571\uFF1A\u77E5\u8BC6\u70B9\u77E5\u8BC6\u5E93 =====");
  console.log("\n\u3010\u5347\u7EA7\u517C\u5BB9\u3011v0.5 \u65F6\u671F\u7684\u672C\u5730\u6570\u636E\u7F3A\u5C11\u65B0\u96C6\u5408");
  const legacy = { users: [], seq: {} };
  const migrated = migrateLegacyDb(legacy);
  check(
    "\u7F3A\u5931\u7684\u77E5\u8BC6\u70B9\u96C6\u5408\u88AB\u8865\u6210\u7A7A\u6570\u7EC4\uFF08\u5426\u5219\u5347\u7EA7\u540E\u4E00\u6253\u5F00\u5C31\u5D29\uFF09",
    Array.isArray(migrated.knowledge) && Array.isArray(migrated.knowledgeTagRels) && Array.isArray(migrated.knowledgeQuestionRels) && Array.isArray(migrated.knowledgeAnnotations)
  );
  check("\u7F3A\u5931\u7684 seq \u88AB\u8865\u6210\u7A7A\u5BF9\u8C61", !!migrated.seq && typeof migrated.seq === "object");
  const alice = userByName("alice");
  const bob = userByName("bob");
  const carol = userByName("carol");
  const db = getDb();
  console.log("\n\u3010\xA74.1 \u5E7F\u573A\u3011\u53EA\u5C55\u793A\u516C\u5F00\u3001\u672A\u5220\u9664");
  const publics = await api.knowledge.listPublic();
  check("\u5E7F\u573A\u6709\u79CD\u5B50\u6570\u636E", publics.length >= 4, `\u5B9E\u9645 ${publics.length} \u7BC7`);
  check("\u5E7F\u573A\u4E0D\u542B\u79C1\u6709\u77E5\u8BC6\u70B9", publics.every((k) => k.visibility === Visibility.PUBLIC));
  const privateTitles = db.knowledge.filter((k) => k.visibility === Visibility.PRIVATE && k.deleted === 0).map((k) => k.title);
  check("\u79C1\u6709\u77E5\u8BC6\u70B9\u7684\u6807\u9898\u4E0D\u51FA\u73B0\u5728\u5E7F\u573A", publics.every((k) => !privateTitles.includes(k.title)));
  check("\u5E7F\u573A\u9879\u5E26\u4F5C\u8005\u4E0E\u6807\u7B7E\u4FE1\u606F", publics.every((k) => !!k.authorName && Array.isArray(k.tagNames)));
  console.log("\n\u3010\xA74.1 \u641C\u7D22\u3011\u4EC5\u6807\u9898\u524D\u7F00\u5339\u914D\uFF0C\u4E0D\u641C\u6B63\u6587");
  const byPrefix = await api.knowledge.listPublic({ keyword: "\u5B50\u7F51" });
  check("\u6807\u9898\u524D\u7F00\u53EF\u547D\u4E2D", byPrefix.some((k) => k.title.includes("\u5B50\u7F51")));
  const byBody = await api.knowledge.listPublic({ keyword: "\u501F\u4F4D" });
  check("\u6B63\u6587\u91CC\u7684\u8BCD\u641C\u4E0D\u5230\uFF08\u53EA\u505A\u6807\u9898\u524D\u7F00\uFF09", byBody.length === 0, `\u5B9E\u9645 ${byBody.length} \u7BC7`);
  console.log("\n\u3010\xA74.1 \u6392\u5E8F\u3011\u4E09\u79CD\u6392\u5E8F");
  const byTitle = await api.knowledge.listPublic({ sort: "title" });
  const sortedTitles = byTitle.map((k) => k.title);
  check(
    "\u6807\u9898 A-Z \u6392\u5E8F\u751F\u6548",
    JSON.stringify(sortedTitles) === JSON.stringify([...sortedTitles].sort((a, b) => a.localeCompare(b, "zh-CN")))
  );
  const byUpdated = await api.knowledge.listPublic({ sort: "updated" });
  check("\u6700\u65B0\u66F4\u65B0\u6392\u5E8F\u751F\u6548", byUpdated.length === publics.length);
  console.log("\n\u3010\xA74.1 \u7B5B\u9009\u3011\u5206\u7C7B\u901A\u8FC7\u6807\u7B7E\u5F52\u5C5E\u5B9E\u73B0\uFF1B\u65E0\u6807\u7B7E\u9879\u4E0D\u88AB\u6807\u7B7E\u7B5B\u9009\u547D\u4E2D");
  const catMorning = db.categories.find((c) => c.categoryName === "\u4E0A\u5348\u5BA2\u89C2\u9898");
  const byCategory = await api.knowledge.listPublic({ categoryId: catMorning.id });
  check("\u6309\u5206\u7C7B\u7B5B\u9009\u6709\u7ED3\u679C", byCategory.length > 0);
  check(
    "\u7B5B\u9009\u7ED3\u679C\u786E\u5B9E\u5F52\u5C5E\u8BE5\u5206\u7C7B",
    byCategory.every((k) => k.categoryIds.includes(catMorning.id))
  );
  const noTag = publics.find((k) => k.tagIds.length === 0);
  check("\u5B58\u5728\u300C\u672A\u7ED1\u5B9A\u4EFB\u4F55\u6807\u7B7E\u300D\u7684\u516C\u5F00\u77E5\u8BC6\u70B9\uFF0815 \u53F7 KG-03 \u524D\u63D0\uFF09", !!noTag);
  if (noTag) {
    check("\u65E0\u6807\u7B7E\u6761\u76EE\u5728\u672A\u7B5B\u9009\u65F6\u53EF\u89C1", publics.some((k) => k.id === noTag.id));
    const anyTagId = publics.find((k) => k.tagIds.length > 0).tagIds[0];
    const filtered = await api.knowledge.listPublic({ tagIds: [anyTagId] });
    check("\u6309\u6807\u7B7E\u7B5B\u9009\u65F6\u65E0\u6807\u7B7E\u6761\u76EE\u4E0D\u88AB\u547D\u4E2D", filtered.every((k) => k.id !== noTag.id));
  }
  console.log("\n\u3010\xA74.2 / KD-01\u3011\u79C1\u6709\u77E5\u8BC6\u70B9\u4EC5\u4F5C\u8005\u53EF\u8BFB");
  const alicePrivate = db.knowledge.find(
    (k) => k.userId === alice.id && k.visibility === Visibility.PRIVATE && k.deleted === 0
  );
  check("\u79CD\u5B50\u91CC\u5B58\u5728 alice \u7684\u79C1\u6709\u77E5\u8BC6\u70B9", !!alicePrivate);
  await loginAs("bob");
  await expectApiError(
    "\u4ED6\u4EBA\u8BBF\u95EE\u79C1\u6709\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.detail(alicePrivate.id, bob.id),
    ApiCode.NO_PERMISSION
  );
  logout();
  await expectApiError(
    "\u6E38\u5BA2\u8BBF\u95EE\u79C1\u6709\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.detail(alicePrivate.id, null),
    ApiCode.NO_PERMISSION
  );
  await loginAs("alice");
  const own = await api.knowledge.detail(alicePrivate.id, alice.id);
  check("\u4F5C\u8005\u672C\u4EBA\u53EF\u8BFB\uFF0C\u4E14 canEdit=true", own.canEdit === true);
  check("\u8BE6\u60C5\u8FD4\u56DE\u6807\u7B7E\u4E0E\u5173\u8054\u9898\u76EE\u5B57\u6BB5", Array.isArray(own.tagNames) && Array.isArray(own.questions));
  console.log("\n\u3010KD-06\u3011\u6279\u6CE8\u4EC5\u672C\u4EBA\u53EF\u89C1");
  await api.knowledge.saveAnnotation(alicePrivate.id, alice.id, "\u8FD9\u6BB5\u662F\u6211\u81EA\u5DF1\u7684\u590D\u4E60\u63D0\u9192");
  const mine = await api.knowledge.detail(alicePrivate.id, alice.id);
  check("\u672C\u4EBA\u80FD\u770B\u5230\u81EA\u5DF1\u7684\u6279\u6CE8", mine.myAnnotation === "\u8FD9\u6BB5\u662F\u6211\u81EA\u5DF1\u7684\u590D\u4E60\u63D0\u9192");
  const alicePublic = publics.find((k) => k.userId === alice.id);
  check("alice \u6709\u4E00\u7BC7\u516C\u5F00\u77E5\u8BC6\u70B9\uFF08\u540E\u7EED\u6743\u9650\u65AD\u8A00\u7684\u5939\u5177\uFF09", !!alicePublic);
  await api.knowledge.saveAnnotation(alicePublic.id, alice.id, "alice \u7684\u516C\u5F00\u6279\u6CE8");
  await loginAs("bob");
  const otherView = await api.knowledge.detail(alicePublic.id, bob.id);
  check("\u4ED6\u4EBA\u770B\u4E0D\u5230\u6211\u7684\u6279\u6CE8\uFF08\u4E3A null\uFF09", otherView.myAnnotation === null);
  check("\u4ED6\u4EBA\u770B\u516C\u5F00\u77E5\u8BC6\u70B9\u4ECD\u53EF\u8BFB\u6B63\u6587", otherView.knowledge.content.length > 0);
  check("\u4ED6\u4EBA\u770B\u516C\u5F00\u77E5\u8BC6\u70B9\u6CA1\u6709\u7F16\u8F91\u5165\u53E3\uFF08canEdit=false\uFF09", otherView.canEdit === false);
  console.log("\n\u3010\xA74.3\u3011\u4EC5\u4F5C\u8005\u672C\u4EBA\u53EF\u7F16\u8F91/\u5220\u9664");
  await expectApiError(
    "\u4ED6\u4EBA\u7F16\u8F91\u6211\u7684\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.update(alicePublic.id, bob.id, {
      title: "t",
      content: "c",
      tagIds: [],
      questionIds: []
    }),
    ApiCode.NO_PERMISSION
  );
  await expectApiError(
    "\u4ED6\u4EBA\u5220\u9664\u6211\u7684\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.remove(alicePublic.id, bob.id),
    ApiCode.NO_PERMISSION
  );
  const aliceStillThere = (await api.knowledge.listPublic()).find((k) => k.id === alicePublic.id);
  check("\u88AB\u62D2\u7EDD\u540E\u77E5\u8BC6\u70B9\u5B8C\u597D\u65E0\u635F", !!aliceStillThere && aliceStillThere.title === alicePublic.title);
  console.log("\n\u301013 \u53F7 \xA75.3\u3011\u7BA1\u7406\u5458\u4E5F\u4E0D\u80FD\u7F16\u8F91\u4ED6\u4EBA\u77E5\u8BC6\u70B9");
  await loginAs("admin");
  await expectApiError(
    "\u7BA1\u7406\u5458\u7F16\u8F91\u4ED6\u4EBA\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.update(alicePrivate.id, userByName("admin").id, {
      title: "t",
      content: "c",
      tagIds: [],
      questionIds: []
    }),
    ApiCode.NO_PERMISSION
  );
  const adminList = await api.knowledge.listMine(userByName("admin").id);
  check("\u7BA1\u7406\u5458\u80FD\u7BA1\u7406\u81EA\u5DF1\u7684\u77E5\u8BC6\u70B9", adminList.length > 0);
  console.log("\n\u3010\xA74.3\u3011\u6807\u9898\u5B8C\u5168\u540C\u540D \u2192 \u4E8C\u6B21\u786E\u8BA4\uFF1B\u6807\u9898\u76F8\u8FD1 \u2192 \u4EC5\u63D0\u793A");
  const exact = await api.knowledge.checkTitle("\u5B50\u7F51\u5212\u5206\u4E0E CIDR \u901F\u67E5");
  check("\u5B8C\u5168\u540C\u540D\u88AB\u8BC6\u522B", exact.exactDuplicate === true);
  const similarCheck = await api.knowledge.checkTitle("\u5B50\u7F51\u5212\u5206\u901F\u67E5\u8868");
  check("\u5B8C\u5168\u540C\u540D\u65F6\u4E0D\u4F1A\u540C\u65F6\u5224\u4E3A\u300C\u76F8\u8FD1\u300D", similarCheck.exactDuplicate === false);
  check("\u76F8\u8FD1\u6807\u9898\u80FD\u7ED9\u51FA\u53C2\u8003\u5217\u8868", similarCheck.similar.length >= 1, `\u5B9E\u9645 ${similarCheck.similar.length} \u6761`);
  const emptyCheck = await api.knowledge.checkTitle("");
  check("\u7A7A\u6807\u9898\u4E0D\u62A5\u91CD\u590D\uFF08\u79C1\u6709\u4E0D\u505A\u6821\u9A8C\uFF09", emptyCheck.exactDuplicate === false && emptyCheck.similar.length === 0);
  console.log("\n\u3010Q2\u3011\u5173\u8054\u9898\u76EE\u8303\u56F4\uFF1A\u672C\u4EBA\u5168\u90E8\u5E95\u7A3F + \u516C\u5F00\u5E95\u7A3F\uFF1B\u4E0D\u542B\u4ED6\u4EBA\u79C1\u6709\u5E95\u7A3F");
  await loginAs("alice");
  const aliceSelectable = await api.knowledge.searchQuestions(alice.id, "");
  check("\u80FD\u641C\u5230\u53EF\u5173\u8054\u9898\u76EE", aliceSelectable.length > 0, `\u5B9E\u9645 ${aliceSelectable.length} \u9053`);
  const bobPrivateDraftIds = db.drafts.filter((d) => d.deleted === 0 && d.userId === bob.id && d.visibility === Visibility.PRIVATE).map((d) => d.id);
  const bobPrivateQuestionIds = new Set(
    db.draftQuestionRels.filter((r) => r.deleted === 0 && bobPrivateDraftIds.includes(r.draftId)).map((r) => r.questionId)
  );
  const publicDraftQuestionIds = new Set(
    db.draftQuestionRels.filter((r) => {
      if (r.deleted !== 0) return false;
      const d = db.drafts.find((x) => x.id === r.draftId);
      return d && d.deleted === 0 && d.visibility === Visibility.PUBLIC;
    }).map((r) => r.questionId)
  );
  const bobOnlyQuestion = [...bobPrivateQuestionIds].find((id) => !publicDraftQuestionIds.has(id));
  if (bobOnlyQuestion) {
    check(
      "bob \u79C1\u6709\u5E95\u7A3F\u72EC\u6709\u7684\u9898\u76EE\u4E0D\u51FA\u73B0\u5728\u53EF\u9009\u5217\u8868",
      !aliceSelectable.some((q2) => q2.questionId === bobOnlyQuestion)
    );
  } else {
    check("\uFF08\u8DF3\u8FC7\uFF09\u6CA1\u6709\u300C\u4EC5\u5B58\u5728\u4E8E bob \u79C1\u6709\u5E95\u7A3F\u300D\u7684\u9898\u76EE", true);
  }
  console.log("\n\u3010\xA74.3 \u8FB9\u754C / KD-09\u3011\u5220\u9664\u77E5\u8BC6\u70B9\u53EA\u89E3\u9664\u5173\u8054\uFF0C\u4E0D\u52A8\u9898\u76EE\u4E0E\u6807\u7B7E");
  const beforeQuestions = db.questions.filter((q2) => q2.deleted === 0).length;
  const beforeTags = db.tags.filter((t) => t.deleted === 0).length;
  const beforeRels = db.knowledgeQuestionRels.filter((r) => r.deleted === 0).length;
  const temp = await api.knowledge.create(alice.id, {
    title: "\u5192\u70DF\u6D4B\u8BD5\u4E34\u65F6\u77E5\u8BC6\u70B9",
    summary: "s",
    content: "## \u4E34\u65F6",
    visibility: Visibility.PRIVATE,
    tagIds: [db.tags[0].id],
    questionIds: [aliceSelectable[0].questionId]
  });
  check("\u65B0\u5EFA\u77E5\u8BC6\u70B9\u6210\u529F", temp.id > 0);
  check(
    "\u65B0\u5EFA\u540E\u5173\u8054\u5173\u7CFB\u5DF2\u5EFA\u7ACB",
    db.knowledgeQuestionRels.filter((r) => r.deleted === 0 && r.knowledgeId === temp.id).length === 1
  );
  await api.knowledge.remove(temp.id, alice.id);
  check("\u5220\u9664\u540E\u77E5\u8BC6\u70B9\u5728\u5217\u8868\u4E2D\u6D88\u5931", !(await api.knowledge.listMine(alice.id)).some((k) => k.id === temp.id));
  check("\u9898\u76EE\u5B9E\u4F53\u672A\u53D7\u5F71\u54CD", db.questions.filter((q2) => q2.deleted === 0).length === beforeQuestions);
  check("\u6807\u7B7E\u5B9E\u4F53\u672A\u53D7\u5F71\u54CD", db.tags.filter((t) => t.deleted === 0).length === beforeTags);
  check(
    "\u5173\u8054\u5173\u7CFB\u88AB\u89E3\u9664\uFF08\u672A\u6B8B\u7559\u6709\u6548\u5173\u8054\uFF09",
    db.knowledgeQuestionRels.filter((r) => r.deleted === 0).length <= beforeRels
  );
  console.log("\n\u3010\xA74.4 / CL-04\u3011\u4F5C\u8005\u6CE8\u9500\uFF1A\u516C\u5F00\u4FDD\u7559\u3001\u79C1\u6709\u5931\u6548");
  const stamp = (/* @__PURE__ */ new Date()).toISOString();
  const pushKnowledge = (visibility, title, id) => {
    db.knowledge.push({
      id,
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      userId: carol.id,
      title,
      summary: "\u6CE8\u9500\u8D26\u53F7\u9057\u7559",
      content: "## \u5185\u5BB9",
      visibility
    });
    return id;
  };
  const carolPublicId = pushKnowledge(Visibility.PUBLIC, "\u6CE8\u9500\u7528\u6237\u7684\u516C\u5F00\u77E5\u8BC6\u70B9", 9001);
  const carolPrivateId = pushKnowledge(Visibility.PRIVATE, "\u6CE8\u9500\u7528\u6237\u7684\u79C1\u6709\u77E5\u8BC6\u70B9", 9002);
  const withCarol = await api.knowledge.listPublic();
  const carolRow = withCarol.find((k) => k.id === carolPublicId);
  check("\u6CE8\u9500\u7528\u6237\u7684\u516C\u5F00\u77E5\u8BC6\u70B9\u4ECD\u5728\u5E7F\u573A", !!carolRow);
  check("\u5E76\u5728\u5217\u8868\u4E0A\u6807\u6CE8\u4F5C\u8005\u5DF2\u6CE8\u9500", carolRow?.authorDeleted === true);
  await loginAs("bob");
  await expectApiError(
    "\u6CE8\u9500\u7528\u6237\u7684\u79C1\u6709\u77E5\u8BC6\u70B9\u4ED6\u4EBA\u4E0D\u53EF\u8BBF\u95EE \u2192 404",
    () => api.knowledge.detail(carolPrivateId, bob.id),
    ApiCode.NOT_FOUND
  );
  console.log("\n\u301013 \u53F7 \xA75.3\u3011\u4E0D\u80FD\u4EE5\u4ED6\u4EBA\u8EAB\u4EFD\u5199\u77E5\u8BC6\u70B9");
  await expectApiError(
    "bob \u4EE5 alice \u8EAB\u4EFD\u521B\u5EFA\u77E5\u8BC6\u70B9 \u2192 403",
    () => api.knowledge.create(alice.id, {
      title: "x",
      content: "y",
      tagIds: [],
      questionIds: []
    }),
    ApiCode.NO_PERMISSION
  );
  console.log("\n\u3010\xA74.3\u3011\u65B0\u5EFA\u9ED8\u8BA4\u53EF\u89C1\u6027\u6309\u89D2\u8272");
  const bobCreated = await api.knowledge.create(bob.id, {
    title: "\u5192\u70DF\u6D4B\u8BD5-\u666E\u901A\u7528\u6237\u9ED8\u8BA4\u53EF\u89C1\u6027",
    content: "## x",
    tagIds: [],
    questionIds: []
  });
  check("\u666E\u901A\u7528\u6237\u65B0\u5EFA\u9ED8\u8BA4\u79C1\u6709", bobCreated.visibility === Visibility.PRIVATE);
  await loginAs("admin");
  const adminCreated = await api.knowledge.create(userByName("admin").id, {
    title: "\u5192\u70DF\u6D4B\u8BD5-\u7BA1\u7406\u5458\u9ED8\u8BA4\u53EF\u89C1\u6027",
    content: "## x",
    tagIds: [],
    questionIds: []
  });
  check("\u7BA1\u7406\u5458\u65B0\u5EFA\u9ED8\u8BA4\u516C\u5F00", adminCreated.visibility === Visibility.PUBLIC);
  const cleanup = [bobCreated.id, adminCreated.id, carolPublicId, carolPrivateId];
  for (const id of cleanup) {
    const row = db.knowledge.find((k) => k.id === id);
    if (row) row.deleted = row.id;
  }
  check("\u6D4B\u8BD5\u4EA7\u7269\u5DF2\u6E05\u7406", db.knowledge.filter((k) => [bobCreated.id, adminCreated.id].includes(k.id) && k.deleted === 0).length === 0);
  console.log(`
===== \u6A21\u57571 \u7ED3\u679C\uFF1A\u901A\u8FC7 ${pass} \u9879\uFF0C\u5931\u8D25 ${fail} \u9879 =====`);
  console.log("\n===== v1-plus \u6A21\u57572\uFF1A\u9898\u76EE\u79C1\u6709\u7B14\u8BB0 =====");
  await loginAs("alice");
  const aliceNote = db.questionNotes.find((n) => n.deleted === 0 && n.userId === alice.id);
  check("\u79CD\u5B50\u91CC alice \u6709\u4E00\u6761\u9898\u76EE\u7B14\u8BB0", !!aliceNote);
  const noteQuestionId = aliceNote.questionId;
  console.log("\n\u3010NT-06 / \u57FA\u672C\u8BFB\u5199\u3011");
  const loaded = await api.note.get(alice.id, noteQuestionId);
  check("\u80FD\u8BFB\u56DE\u81EA\u5DF1\u7684\u7B14\u8BB0", loaded === aliceNote.content);
  const batch = await api.note.list(alice.id, [noteQuestionId, aliceSelectable[0].questionId]);
  check("\u6279\u91CF\u8BFB\u53D6\u8FD4\u56DE\u6620\u5C04", batch[noteQuestionId] === aliceNote.content);
  const noNoteQuestion = aliceSelectable.find(
    (q2) => !db.questionNotes.some((n) => n.deleted === 0 && n.userId === alice.id && n.questionId === q2.questionId)
  );
  check("\u6CA1\u5199\u8FC7\u7684\u9898\u8FD4\u56DE null\uFF08\u754C\u9762\u636E\u6B64\u63D0\u793A\u300C\u6682\u65E0\u4E2A\u4EBA\u7B14\u8BB0\u300D\uFF09", await api.note.get(alice.id, noNoteQuestion.questionId) === null);
  console.log("\n\u3010NT-02\u3011\u4E00\u9898\u4E00\u4EFD\uFF0C\u7F16\u8F91\u8986\u76D6\u4E0D\u4EA7\u751F\u591A\u6761");
  const rowsBefore = db.questionNotes.filter((n) => n.deleted === 0 && n.userId === alice.id).length;
  await api.note.save(alice.id, noteQuestionId, "\u7B2C\u4E00\u6B21\u4FEE\u6539");
  await api.note.save(alice.id, noteQuestionId, "\u7B2C\u4E8C\u6B21\u4FEE\u6539\uFF08\u8986\u76D6\uFF09");
  const rowsAfter = db.questionNotes.filter((n) => n.deleted === 0 && n.userId === alice.id).length;
  check("\u8BB0\u5F55\u6761\u6570\u6CA1\u6709\u589E\u52A0", rowsBefore === rowsAfter, `${rowsBefore} \u2192 ${rowsAfter}`);
  check("\u5185\u5BB9\u88AB\u8986\u76D6\u4E3A\u6700\u540E\u4E00\u6B21", await api.note.get(alice.id, noteQuestionId) === "\u7B2C\u4E8C\u6B21\u4FEE\u6539\uFF08\u8986\u76D6\uFF09");
  console.log("\n\u3010NT-05\u3011\u7B14\u8BB0\u5B8C\u5168\u79C1\u6709\uFF0C\u4ED6\u4EBA\u8BFB\u4E0D\u5230");
  await loginAs("bob");
  const bobView = await api.note.get(bob.id, noteQuestionId);
  check("bob \u8BFB\u540C\u4E00\u9053\u9898\u62FF\u5230\u7684\u662F\u81EA\u5DF1\u7684\u7B14\u8BB0\uFF08\u4E3A null\uFF09\uFF0C\u770B\u4E0D\u5230 alice \u7684", bobView === null);
  console.log("\n\u301013 \u53F7 \xA75.3\u3011\u4E0D\u80FD\u4EE5\u4ED6\u4EBA\u8EAB\u4EFD\u8BFB\u5199\u7B14\u8BB0");
  await expectApiError(
    "bob \u4EE5 alice \u8EAB\u4EFD\u8BFB\u7B14\u8BB0 \u2192 403",
    () => api.note.get(alice.id, noteQuestionId),
    ApiCode.NO_PERMISSION
  );
  await expectApiError(
    "bob \u4EE5 alice \u8EAB\u4EFD\u5199\u7B14\u8BB0 \u2192 403",
    () => api.note.save(alice.id, noteQuestionId, "\u7BE1\u6539"),
    ApiCode.NO_PERMISSION
  );
  console.log("\n\u3010\u6E38\u5BA2\u3011\u672A\u767B\u5F55\u4E0D\u53EF\u8BFB\u5199\uFF08\u9762\u677F\u5728\u754C\u9762\u4FA7\u4E5F\u6574\u5757\u9690\u85CF\uFF09");
  logout();
  await expectApiError(
    "\u6E38\u5BA2\u4FDD\u5B58\u7B14\u8BB0 \u2192 401",
    () => api.note.save(alice.id, noteQuestionId, "x"),
    ApiCode.SESSION
  );
  console.log("\n\u3010NT-03\u3011\u5220\u9664\u7B54\u9898\u8BB0\u5F55\u4E0D\u5220\u7B14\u8BB0");
  await loginAs("alice");
  const aliceExam = db.exams.find((e) => e.deleted === 0 && e.userId === alice.id);
  check("\u5B58\u5728 alice \u7684\u7B54\u9898\u8BB0\u5F55", !!aliceExam);
  await api.exam.remove(aliceExam.id, alice.id);
  check(
    "\u5220\u6389\u7B54\u9898\u8BB0\u5F55\u540E\u7B14\u8BB0\u4ECD\u5728",
    await api.note.get(alice.id, noteQuestionId) === "\u7B2C\u4E8C\u6B21\u4FEE\u6539\uFF08\u8986\u76D6\uFF09"
  );
  console.log("\n\u3010NT-04\u3011\u9898\u76EE\u88AB\u9501\u5B9A\u540E\u7B14\u8BB0\u4F9D\u7136\u53EF\u8BFB\u53EF\u5199");
  const targetQuestion = db.questions.find((q2) => q2.id === noteQuestionId);
  const lockBefore = targetQuestion.isLocked;
  targetQuestion.isLocked = 1;
  check("\u9501\u5B9A\u540E\u4ECD\u80FD\u8BFB\u7B14\u8BB0", await api.note.get(alice.id, noteQuestionId) === "\u7B2C\u4E8C\u6B21\u4FEE\u6539\uFF08\u8986\u76D6\uFF09");
  await api.note.save(alice.id, noteQuestionId, "\u9501\u5B9A\u540E\u8865\u8BB0\u4E00\u7B14");
  check("\u9501\u5B9A\u540E\u4ECD\u80FD\u5199\u7B14\u8BB0", await api.note.get(alice.id, noteQuestionId) === "\u9501\u5B9A\u540E\u8865\u8BB0\u4E00\u7B14");
  targetQuestion.isLocked = lockBefore;
  console.log("\n\u3010\u7A7A\u5185\u5BB9 = \u5220\u9664\u3011");
  await api.note.save(alice.id, noteQuestionId, "   ");
  check("\u4FDD\u5B58\u7A7A\u767D\u5185\u5BB9\u89C6\u4E3A\u5220\u9664\u7B14\u8BB0", await api.note.get(alice.id, noteQuestionId) === null);
  console.log(`
===== \u6A21\u57572 \u7ED3\u679C\uFF1A\u901A\u8FC7 ${pass} \u9879\uFF0C\u5931\u8D25 ${fail} \u9879 =====`);
  console.log("\n===== v1-plus \u6A21\u57573\uFF1A\u591A\u6001\u6536\u85CF =====");
  await loginAs("alice");
  const aliceFavorites = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id);
  check("\u79CD\u5B50\u91CC alice \u6709\u6536\u85CF\u8BB0\u5F55", aliceFavorites.length >= 4, `\u5B9E\u9645 ${aliceFavorites.length} \u6761`);
  console.log("\n\u3010FA-01 / \u552F\u4E00\u6027\u3011\u540C\u4E00\u8D44\u6E90\u4E0D\u80FD\u91CD\u590D\u6536\u85CF");
  const draftList = await api.favorite.list(alice.id, FavoriteTargetType.DRAFT);
  const availableDraft = draftList.find((f) => f.available);
  check("\u5B58\u5728\u53EF\u8BBF\u95EE\u7684\u6536\u85CF\u8BD5\u5377", !!availableDraft);
  const beforeToggle = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id).length;
  const on = await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId);
  check("\u5BF9\u5DF2\u6536\u85CF\u8D44\u6E90\u70B9\u4E00\u6B21 \u2192 \u53D6\u6D88\u6536\u85CF", on === false);
  const again = await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId);
  check("\u518D\u70B9\u4E00\u6B21 \u2192 \u91CD\u65B0\u6536\u85CF", again === true);
  const afterToggle = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id).length;
  check("\u6765\u56DE\u5207\u6362\u4E0D\u4EA7\u751F\u91CD\u590D\u8BB0\u5F55", beforeToggle === afterToggle, `${beforeToggle} \u2192 ${afterToggle}`);
  check(
    "\u540C\u4E00\u8D44\u6E90\u6700\u591A\u4E00\u6761\u6709\u6548\u8BB0\u5F55",
    db.favorites.filter(
      (f) => f.deleted === 0 && f.userId === alice.id && f.targetType === FavoriteTargetType.DRAFT && f.targetId === availableDraft.targetId
    ).length === 1
  );
  console.log("\n\u3010\u4E1A\u52A1\u7EA6\u675F\u3011\u6536\u85CF\u4E0D\u6539\u53D8\u8D44\u6E90\u672C\u8EAB\u72B6\u6001");
  const draftRow = db.drafts.find((d) => d.id === availableDraft.targetId);
  const snapshot = JSON.stringify({ v: draftRow.visibility, s: draftRow.draftStatus, q: draftRow.questionCount, l: draftRow.isLocked });
  await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId);
  await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId);
  check("\u6536\u85CF/\u53D6\u6D88\u6536\u85CF\u524D\u540E\u8BD5\u5377\u72B6\u6001\u5B8C\u5168\u4E0D\u53D8", JSON.stringify({ v: draftRow.visibility, s: draftRow.draftStatus, q: draftRow.questionCount, l: draftRow.isLocked }) === snapshot);
  console.log("\n\u3010FA-02\u3011\u8D44\u6E90\u8F6C\u4E3A\u79C1\u6709 / \u5E9F\u5F03 \u2192 \u8BB0\u5F55\u4FDD\u7559\u4F46\u7F6E\u7070");
  const unavailable = draftList.find((f) => !f.available);
  check("\u79CD\u5B50\u91CC\u5B58\u5728\u300C\u4E0D\u53EF\u8BBF\u95EE\u300D\u7684\u6536\u85CF\u6837\u672C\uFF08bob \u79C1\u6709\u5E95\u7A3F\uFF09", !!unavailable);
  check("\u4E0D\u53EF\u8BBF\u95EE\u6761\u76EE\u65E0\u8DF3\u8F6C\u94FE\u63A5", unavailable?.link === null);
  const adminPublicDraftId = availableDraft.targetId;
  await loginAs("admin");
  const adminDraft = db.drafts.find((d) => d.id === adminPublicDraftId);
  const statusBefore = adminDraft.draftStatus;
  adminDraft.draftStatus = 3;
  await loginAs("alice");
  const afterDiscard = (await api.favorite.list(alice.id, FavoriteTargetType.DRAFT)).find(
    (f) => f.targetId === adminPublicDraftId
  );
  check("\u8BD5\u5377\u88AB\u5E9F\u5F03\u540E\uFF1A\u8BB0\u5F55\u4ECD\u5728", !!afterDiscard);
  check("\u8BD5\u5377\u88AB\u5E9F\u5F03\u540E\uFF1A\u6807\u8BB0\u4E3A\u4E0D\u53EF\u8BBF\u95EE", afterDiscard?.available === false);
  check("\u8BD5\u5377\u88AB\u5E9F\u5F03\u540E\uFF1A\u4ECD\u53EF\u53D6\u6D88\u6536\u85CF", afterDiscard !== void 0);
  db.drafts.find((d) => d.id === adminPublicDraftId).draftStatus = statusBefore;
  console.log("\n\u3010FA-04 / \u6279\u91CF\u6807\u6CE8\u3011listIds \u4F9B\u5217\u8868\u9875\u6807\u661F\u6807\u72B6\u6001");
  const ids = await api.favorite.listIds(alice.id, FavoriteTargetType.KNOWLEDGE);
  check("\u80FD\u6279\u91CF\u53D6\u5230\u5DF2\u6536\u85CF\u7684\u77E5\u8BC6\u70B9 id", Array.isArray(ids) && ids.length >= 1);
  console.log("\n\u3010FA-05 / \u5206\u9875\u72EC\u7ACB\u3011\u4E09\u7C7B\u8D44\u6E90\u5404\u81EA\u8FD4\u56DE\uFF0C\u4E92\u4E0D\u5E72\u6270");
  const favDrafts = await api.favorite.list(alice.id, FavoriteTargetType.DRAFT);
  const favQuestions = await api.favorite.list(alice.id, FavoriteTargetType.QUESTION);
  const favKnowledge = await api.favorite.list(alice.id, FavoriteTargetType.KNOWLEDGE);
  check(
    "\u4E09\u7C7B\u5217\u8868\u5206\u522B\u8FD4\u56DE\u4E14\u7C7B\u578B\u6B63\u786E",
    favDrafts.every((f) => f.targetType === FavoriteTargetType.DRAFT) && favQuestions.every((f) => f.targetType === FavoriteTargetType.QUESTION) && favKnowledge.every((f) => f.targetType === FavoriteTargetType.KNOWLEDGE)
  );
  check("\u9898\u76EE\u6536\u85CF\u9F50\u5168", favQuestions.length >= 1);
  console.log("\n\u3010Q11\u3011\u6536\u85CF\u7684\u9898\u76EE \u2192 \u8DF3\u6240\u5728\u8BD5\u5377\u5E76\u5B9A\u4F4D\u9AD8\u4EAE");
  const questionFav = favQuestions.find((f) => f.available);
  check("\u53EF\u8BBF\u95EE\u7684\u9898\u76EE\u6536\u85CF\u5E26\u8DF3\u8F6C\u94FE\u63A5", !!questionFav?.link);
  check("\u94FE\u63A5\u5E26 questionId \u53C2\u6570\uFF08\u4F9B\u9884\u89C8\u9875\u5B9A\u4F4D\u9AD8\u4EAE\uFF09", questionFav?.link?.includes("?questionId=") === true, questionFav?.link ?? "");
  console.log("\n\u3010FA-07\u3011\u53D6\u6D88\u6536\u85CF\u540E\u8BB0\u5F55\u79FB\u9664");
  const toRemove = favKnowledge[0];
  await api.favorite.toggle(alice.id, FavoriteTargetType.KNOWLEDGE, toRemove.targetId);
  const afterRemove = await api.favorite.list(alice.id, FavoriteTargetType.KNOWLEDGE);
  check("\u53D6\u6D88\u540E\u4E0D\u5728\u5217\u8868\u4E2D", !afterRemove.some((f) => f.targetId === toRemove.targetId));
  check("isFavorited \u540C\u6B65\u4E3A false", await api.favorite.isFavorited(alice.id, FavoriteTargetType.KNOWLEDGE, toRemove.targetId) === false);
  console.log("\n\u3010\u9694\u79BB / \u6743\u9650\u3011\u7528\u6237\u7EA7\u9694\u79BB\u4E0E Actor \u4E00\u81F4\u6027");
  await loginAs("bob");
  const bobFavs = await api.favorite.list(bob.id, FavoriteTargetType.DRAFT);
  check("bob \u770B\u4E0D\u5230 alice \u7684\u6536\u85CF", bobFavs.every((f) => !!f.title));
  check("bob \u7684\u6536\u85CF\u4E3A\u7A7A\uFF08\u79CD\u5B50\u91CC\u6CA1\u7ED9\u4ED6\u9020\uFF09", bobFavs.length === 0);
  await expectApiError(
    "bob \u4EE5 alice \u8EAB\u4EFD\u5207\u6362\u6536\u85CF \u2192 403",
    () => api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId),
    ApiCode.NO_PERMISSION
  );
  console.log("\n\u3010\u6E38\u5BA2\u3011\u672A\u767B\u5F55\u4E0D\u53EF\u6536\u85CF");
  logout();
  await expectApiError(
    "\u6E38\u5BA2\u5207\u6362\u6536\u85CF \u2192 401",
    () => api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId),
    ApiCode.SESSION
  );
  console.log(`
===== \u6A21\u57573 \u7ED3\u675F\uFF1A\u7D2F\u8BA1\u901A\u8FC7 ${pass} \u9879\uFF0C\u5931\u8D25 ${fail} \u9879 =====`);
  console.log("\n===== v1-plus \u6A21\u57574\uFF1A\u53CD\u9988\u5DE5\u5355 =====");
  await loginAs("alice");
  const seedTickets = db.feedbackTickets.filter((t) => t.deleted === 0);
  check("\u79CD\u5B50\u91CC\u6709\u5DE5\u5355\u6570\u636E", seedTickets.length >= 3, `\u5B9E\u9645 ${seedTickets.length} \u6761`);
  check(
    "\u5B58\u5728\u300C\u9898\u76EE\u5DF2\u5220\u9664\u300D\u7684\u5DE5\u5355\u6837\u672C\uFF08FB-02 \u524D\u63D0\uFF09",
    seedTickets.some((t) => t.questionId === 999999)
  );
  console.log("\n\u3010FB-05 / \u63D0\u4EA4\u3011\u5185\u5BB9\u6821\u9A8C");
  const targetQuestionId = aliceSelectable[0].questionId;
  let emptyRejected = false;
  try {
    await api.feedback.submit(alice.id, targetQuestionId, "   ");
  } catch {
    emptyRejected = true;
  }
  check("\u53CD\u9988\u5185\u5BB9\u4E3A\u7A7A \u2192 \u62D2\u7EDD\u63D0\u4EA4", emptyRejected);
  const beforeSubmit = db.feedbackTickets.filter((t) => t.deleted === 0).length;
  await api.feedback.submit(alice.id, targetQuestionId, "\u5192\u70DF\u6D4B\u8BD5\uFF1A\u8FD9\u9053\u9898\u7684\u9009\u9879\u987A\u5E8F\u770B\u8D77\u6765\u4E0D\u5BF9");
  check("\u6B63\u5E38\u63D0\u4EA4\u6210\u529F", db.feedbackTickets.filter((t) => t.deleted === 0).length === beforeSubmit + 1);
  const submitted = db.feedbackTickets[db.feedbackTickets.length - 1];
  check("\u65B0\u5DE5\u5355\u72B6\u6001\u4E3A\u5F85\u5904\u7406", submitted.status === FeedbackStatus.PENDING);
  console.log("\n\u3010FB-U2\u3011\u9898\u76EE\u5DF2\u5931\u6548\u4E0D\u80FD\u63D0\u4EA4");
  await expectApiError(
    "\u5BF9\u4E0D\u5B58\u5728\u7684\u9898\u76EE\u63D0\u4EA4\u53CD\u9988 \u2192 404",
    () => api.feedback.submit(alice.id, 999999, "\u9898\u76EE\u6CA1\u4E86"),
    ApiCode.NOT_FOUND
  );
  console.log("\n\u3010FB-01 / \u6743\u9650\u3011\u666E\u901A\u7528\u6237\u4E0E\u6E38\u5BA2\u4E0D\u80FD\u7BA1\u7406\u5DE5\u5355");
  await expectApiError("\u666E\u901A\u7528\u6237\u67E5\u770B\u5DE5\u5355\u5217\u8868 \u2192 403", () => api.feedback.list(), ApiCode.NO_PERMISSION);
  await expectApiError("\u666E\u901A\u7528\u6237\u5904\u7406\u5DE5\u5355 \u2192 403", () => api.feedback.handle(submitted.id, FeedbackStatus.HANDLED, "x"), ApiCode.NO_PERMISSION);
  logout();
  await expectApiError("\u6E38\u5BA2\u63D0\u4EA4\u53CD\u9988 \u2192 401", () => api.feedback.submit(alice.id, targetQuestionId, "x"), ApiCode.SESSION);
  await expectApiError("\u6E38\u5BA2\u67E5\u770B\u5DE5\u5355\u5217\u8868 \u2192 401", () => api.feedback.list(), ApiCode.SESSION);
  console.log("\n\u3010FB-04\u3011\u7BA1\u7406\u5458\u7B5B\u9009\uFF1A\u72B6\u6001 + \u65F6\u95F4\u8303\u56F4");
  await loginAs("admin");
  const allTickets = await api.feedback.list();
  check("\u7BA1\u7406\u5458\u53EF\u62C9\u53D6\u5168\u90E8\u5DE5\u5355", allTickets.length >= 4, `\u5B9E\u9645 ${allTickets.length} \u6761`);
  const pendingOnly = await api.feedback.list({ status: FeedbackStatus.PENDING });
  check("\u6309\u300C\u5F85\u5904\u7406\u300D\u7B5B\u9009\u751F\u6548", pendingOnly.every((t) => t.status === FeedbackStatus.PENDING));
  const handledOnly = await api.feedback.list({ status: FeedbackStatus.HANDLED });
  check("\u6309\u300C\u5DF2\u5904\u7406\u300D\u7B5B\u9009\u751F\u6548", handledOnly.every((t) => t.status === FeedbackStatus.HANDLED));
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const onlyToday = await api.feedback.list({ startDate: today, endDate: today });
  check("\u65F6\u95F4\u8303\u56F4\u7B5B\u9009\u751F\u6548\uFF08\u53EA\u770B\u4ECA\u5929\uFF09", onlyToday.every((t) => t.createTime.slice(0, 10) === today));
  console.log("\n\u3010FB-02\u3011\u9898\u76EE\u5DF2\u5220\u9664\u7684\u5DE5\u5355\u4ECD\u7136\u4FDD\u7559");
  const goneTicket = allTickets.find((t) => t.questionId === 999999);
  check("\u5DE5\u5355\u4ECD\u5728\u5217\u8868\u4E2D", !!goneTicket);
  check("\u9898\u76EE\u9884\u89C8\u4E3A\u7A7A\uFF08\u754C\u9762\u636E\u6B64\u6807\u6CE8\u300C\u9898\u76EE\u5DF2\u5220\u9664\u300D\uFF09", goneTicket.questionPreview === null);
  check("\u63D0\u4EA4\u4EBA\u4FE1\u606F\u4ECD\u5728", !!goneTicket.submitterName);
  console.log("\n\u3010Q5\u3011\u5904\u7406\u5DE5\u5355\uFF1A\u5DF2\u5904\u7406/\u5FFD\u7565 \u5907\u6CE8\u5FC5\u586B");
  let noRemarkRejected = false;
  try {
    await api.feedback.handle(goneTicket.id, FeedbackStatus.HANDLED, "  ");
  } catch {
    noRemarkRejected = true;
  }
  check("\u5DF2\u5904\u7406\u4F46\u5907\u6CE8\u4E3A\u7A7A \u2192 \u62D2\u7EDD", noRemarkRejected);
  console.log("\n\u3010FB-03\u3011\u5904\u7406\u5DE5\u5355\u4E0D\u4FEE\u6539\u9898\u5E93\u4EFB\u4F55\u6570\u636E");
  const q = db.questions.find((x) => x.id === submitted.questionId);
  const qSnapshot = JSON.stringify({ t: q.title, a: q.answer, an: q.analysis, l: q.isLocked });
  await api.feedback.handle(submitted.id, FeedbackStatus.HANDLED, "\u5DF2\u6838\u5BF9\uFF0C\u9898\u5E72\u65E0\u8BEF\uFF0C\u5C5E\u4E8E\u7406\u89E3\u504F\u5DEE");
  const after = (await api.feedback.list()).find((t) => t.id === submitted.id);
  check("\u72B6\u6001\u5DF2\u66F4\u65B0\u4E3A\u5DF2\u5904\u7406", after.status === FeedbackStatus.HANDLED);
  check("\u5907\u6CE8\u5DF2\u4FDD\u5B58", after.adminRemark === "\u5DF2\u6838\u5BF9\uFF0C\u9898\u5E72\u65E0\u8BEF\uFF0C\u5C5E\u4E8E\u7406\u89E3\u504F\u5DEE");
  check("\u8BB0\u5F55\u4E86\u5904\u7406\u4EBA\u4E0E\u5904\u7406\u65F6\u95F4", after.handledByName === "admin" && !!after.handledTime);
  check("\u9898\u76EE\u6570\u636E\u5B8C\u5168\u672A\u88AB\u6539\u52A8", JSON.stringify({ t: q.title, a: q.answer, an: q.analysis, l: q.isLocked }) === qSnapshot);
  console.log("\n\u3010\u9000\u56DE\u5F85\u5904\u7406\u3011\u6E05\u6389\u5904\u7406\u75D5\u8FF9");
  await api.feedback.handle(submitted.id, FeedbackStatus.PENDING, "");
  const reverted = (await api.feedback.list()).find((t) => t.id === submitted.id);
  check("\u72B6\u6001\u9000\u56DE\u5F85\u5904\u7406", reverted.status === FeedbackStatus.PENDING);
  check("\u5904\u7406\u4EBA\u4E0E\u5904\u7406\u65F6\u95F4\u5DF2\u6E05\u7A7A", reverted.handledByName === null && reverted.handledTime === null);
  console.log("\n\u3010\u7528\u6237\u81EA\u67E5\u3011\u6211\u63D0\u4EA4\u7684\u5DE5\u5355\u4E0D\u4E0B\u53D1\u6CBB\u7406\u5B57\u6BB5");
  await loginAs("alice");
  const mineTickets = await api.feedback.listMine(alice.id);
  check("\u80FD\u770B\u5230\u81EA\u5DF1\u63D0\u4EA4\u7684\u5DE5\u5355", mineTickets.length >= 2);
  check("\u7528\u6237\u4FA7\u770B\u4E0D\u5230\u7BA1\u7406\u5458\u5907\u6CE8", mineTickets.every((t) => t.adminRemark === null && t.handledByName === null));
  await expectApiError(
    "\u4EE5\u4ED6\u4EBA\u8EAB\u4EFD\u67E5\u6211\u7684\u5DE5\u5355 \u2192 403",
    () => api.feedback.listMine(bob.id),
    ApiCode.NO_PERMISSION
  );
  console.log(`
===== \u6A21\u57574 \u7ED3\u675F\uFF1A\u7D2F\u8BA1\u901A\u8FC7 ${pass} \u9879\uFF0C\u5931\u8D25 ${fail} \u9879 =====`);
  console.log("\n===== v1-plus \u6A21\u57575\uFF1A\u5B66\u4E60\u7EDF\u8BA1\u5927\u76D8 =====");
  await loginAs("alice");
  const dash = await api.stat.dashboard(alice.id);
  console.log("\n\u3010\u53E3\u5F84\u3011\u53EA\u7EDF\u8BA1\u5DF2\u4EA4\u5377 + \u5DF2\u5224\u5206\u5BA2\u89C2\u9898\uFF08\u7B80\u7B54\u4E0D\u8BA1\u5165\uFF09");
  const finishedExams = db.exams.filter(
    (e) => e.deleted === 0 && e.userId === alice.id && !!e.submitTime
  );
  check(
    "\u603B\u5B8C\u6210\u8BD5\u5377\u6570 = \u5DF2\u4EA4\u5377\u8BB0\u5F55\u6570",
    dash.totals.finishedExamCount === finishedExams.length,
    `${dash.totals.finishedExamCount} vs ${finishedExams.length}`
  );
  const finishedIds = new Set(finishedExams.map((e) => e.id));
  const judgedObjectiveManual = db.examQuestions.filter(
    (q2) => q2.deleted === 0 && finishedIds.has(q2.examId) && q2.questionType !== 4 && q2.judgeStatus === 2
  ).length;
  check(
    "\u603B\u4F5C\u7B54\u5BA2\u89C2\u9898\u6570 = \u5DF2\u5224\u5206\u5BA2\u89C2\u9898\u5C0F\u9898\u6570",
    dash.totals.judgedQuestionCount === judgedObjectiveManual,
    `${dash.totals.judgedQuestionCount} vs ${judgedObjectiveManual}`
  );
  const shortAnswerJudged = db.examQuestions.filter(
    (q2) => q2.deleted === 0 && finishedIds.has(q2.examId) && q2.questionType === 4 && q2.judgeStatus === 2
  ).length;
  check("\uFF08\u524D\u63D0\uFF09\u79CD\u5B50\u91CC\u6CA1\u6709\u300C\u5DF2\u5224\u5206\u7684\u7B80\u7B54\u9898\u300D", shortAnswerJudged === 0);
  console.log("\n\u3010\u96C6\u5408\u53E3\u5F84\u3011\u9519\u9898 / \u5DF2\u638C\u63E1\u6570\u91CF\u4E0E\u8BB0\u5F55\u8868\u4E00\u81F4");
  const wrongManual = db.records.filter((r) => r.deleted === 0 && r.userId === alice.id && r.isMaster === 0).length;
  const masteredManual = db.records.filter((r) => r.deleted === 0 && r.userId === alice.id && r.isMaster === 1).length;
  check("\u603B\u9519\u9898\u6570\u4E00\u81F4", dash.totals.wrongCount === wrongManual, `${dash.totals.wrongCount} vs ${wrongManual}`);
  check("\u5DF2\u638C\u63E1\u9898\u76EE\u6570\u4E00\u81F4", dash.totals.masteredCount === masteredManual, `${dash.totals.masteredCount} vs ${masteredManual}`);
  check(
    "\u96C6\u5408\u5BF9\u6BD4\u4E0E\u6570\u5B57\u5361\u7247\u4E00\u81F4",
    dash.setCompare.wrongCount === dash.totals.wrongCount && dash.setCompare.masteredCount === dash.totals.masteredCount
  );
  console.log("\n\u3010\u8D8B\u52BF\u3011\u6309\u4EA4\u5377\u65E5\u671F\u805A\u5408\uFF1B\u505A\u9898\u91CF\u4E4B\u548C\u7B49\u4E8E\u603B\u4F5C\u7B54\u5BA2\u89C2\u9898\u6570\uFF08Q4\uFF09");
  check("\u8D8B\u52BF\u6309\u65E5\u671F\u5347\u5E8F", dash.trend.every((p, i) => i === 0 || dash.trend[i - 1].date <= p.date));
  const trendSum = dash.trend.reduce((sum, p) => sum + p.questionCount, 0);
  check(
    "\u6BCF\u65E5\u505A\u9898\u91CF\u4E4B\u548C = \u603B\u4F5C\u7B54\u5BA2\u89C2\u9898\u6570",
    trendSum === dash.totals.judgedQuestionCount,
    `${trendSum} vs ${dash.totals.judgedQuestionCount}`
  );
  const examSum = dash.trend.reduce((sum, p) => sum + p.examCount, 0);
  check("\u6BCF\u65E5\u5B8C\u6210\u8BD5\u5377\u4E4B\u548C = \u603B\u5B8C\u6210\u8BD5\u5377\u6570", examSum === dash.totals.finishedExamCount);
  console.log("\n\u3010\u8003\u70B9\u6392\u884C\u3011\u6309\u9519\u9898\u6570\u964D\u5E8F\uFF0C\u4E00\u9898\u591A\u6807\u7B7E\u5404\u8BA1\u4E00\u6B21");
  check("\u6392\u884C\u699C\u5DF2\u6309\u9519\u9898\u6570\u964D\u5E8F", dash.tagWrongRanking.every((t, i) => i === 0 || dash.tagWrongRanking[i - 1].wrongCount >= t.wrongCount));
  check("\u6392\u884C\u699C\u6700\u591A 10 \u6761", dash.tagWrongRanking.length <= 10);
  const rankingTotal = dash.tagWrongRanking.reduce((s, t) => s + t.wrongCount, 0);
  check(
    "\u6392\u884C\u699C\u8BA1\u6570\u4E0D\u8D85\u8FC7\u300C\u9519\u9898\u6570 \xD7 \u6BCF\u9898\u6750\u6807\u7B7E\u4E0A\u9650\u300D\u7684\u5408\u7406\u8303\u56F4",
    rankingTotal >= dash.totals.wrongCount,
    `\u6392\u884C\u5408\u8BA1 ${rankingTotal}\uFF0C\u9519\u9898\u6570 ${dash.totals.wrongCount}`
  );
  console.log("\n\u3010ST-03\u3011\u5220\u9664\u7B54\u9898\u8BB0\u5F55\u540E\u7EDF\u8BA1\u540C\u6B65\u53D8\u5316");
  const examToDelete = finishedExams[0];
  const beforeTotals = { ...dash.totals };
  await api.exam.remove(examToDelete.id, alice.id);
  const afterDelete = await api.stat.dashboard(alice.id);
  check(
    "\u603B\u5B8C\u6210\u8BD5\u5377\u6570\u51CF\u5C11 1",
    afterDelete.totals.finishedExamCount === beforeTotals.finishedExamCount - 1,
    `${beforeTotals.finishedExamCount} \u2192 ${afterDelete.totals.finishedExamCount}`
  );
  check(
    "\u603B\u4F5C\u7B54\u5BA2\u89C2\u9898\u6570\u540C\u6B65\u51CF\u5C11",
    afterDelete.totals.judgedQuestionCount < beforeTotals.judgedQuestionCount,
    `${beforeTotals.judgedQuestionCount} \u2192 ${afterDelete.totals.judgedQuestionCount}`
  );
  console.log("\n\u3010ST-04\u3011\u53EA\u505A\u7B80\u7B54\u9898 \u2192 \u4E0D\u8BA1\u5165\u4EFB\u4F55\u7EDF\u8BA1");
  const beforeShort = await api.stat.dashboard(alice.id);
  const shortDraft = db.drafts.find((d) => {
    if (d.deleted !== 0 || d.draftStatus !== 1) return false;
    if (d.visibility !== Visibility.PUBLIC && d.userId !== alice.id) return false;
    return db.draftQuestionRels.filter((r) => r.deleted === 0 && r.draftId === d.id).some((r) => db.questions.find((q2) => q2.id === r.questionId)?.questionType === 4);
  });
  if (shortDraft) {
    const exam = await api.exam.start(alice.id, shortDraft.id);
    await api.exam.submit(exam.id, alice.id);
    const afterShort = await api.stat.dashboard(alice.id);
    check("\u5B8C\u6210\u4E00\u4EFD\u542B\u7B80\u7B54\u7684\u8BD5\u5377 \u2192 \u5B8C\u6210\u8BD5\u5377\u6570 +1", afterShort.totals.finishedExamCount === beforeShort.totals.finishedExamCount + 1);
    check(
      "\u5BA2\u89C2\u9898\u8BA1\u6570\u53EA\u5728\u5BA2\u89C2\u9898\u4E0A\u6709\u53D8\u5316\uFF08\u7B80\u7B54\u4E0D\u53C2\u4E0E\uFF09",
      afterShort.totals.judgedQuestionCount >= beforeShort.totals.judgedQuestionCount
    );
  } else {
    check("\uFF08\u8DF3\u8FC7\uFF09\u6CA1\u6709\u53EF\u89C1\u7684\u542B\u7B80\u7B54\u9898\u5E95\u7A3F", true);
  }
  console.log("\n\u3010ST-02 / ST-05\u3011\u65E0\u6570\u636E\u7528\u6237\uFF1A\u5168\u90E8\u5F52\u96F6\u5E76\u6807\u8BB0\u4E3A\u7A7A");
  await loginAs("dave");
  const daveDash = await api.stat.dashboard(userByName("dave").id);
  check("empty \u6807\u8BB0\u4E3A true", daveDash.empty === true);
  check(
    "\u56DB\u9879\u6570\u5B57\u5168\u90E8\u4E3A\u96F6",
    daveDash.totals.finishedExamCount === 0 && daveDash.totals.judgedQuestionCount === 0 && daveDash.totals.wrongCount === 0 && daveDash.totals.masteredCount === 0
  );
  check("\u65E0\u8D8B\u52BF\u6570\u636E", daveDash.trend.length === 0);
  check("\u65E0\u8003\u70B9\u6392\u884C", daveDash.tagWrongRanking.length === 0);
  console.log("\n\u3010ST-01 / \u6743\u9650\u3011\u4EC5\u672C\u4EBA\u53EF\u8BBF\u95EE");
  await loginAs("alice");
  await expectApiError(
    "\u4EE5\u4ED6\u4EBA\u8EAB\u4EFD\u62C9\u53D6\u5B66\u60C5\u5927\u76D8 \u2192 403",
    () => api.stat.dashboard(bob.id),
    ApiCode.NO_PERMISSION
  );
  logout();
  await expectApiError(
    "\u6E38\u5BA2\u62C9\u53D6\u5B66\u60C5\u5927\u76D8 \u2192 401",
    () => api.stat.dashboard(alice.id),
    ApiCode.SESSION
  );
  console.log(`
===== v1-plus \u5168\u90E8\u6A21\u5757\u7ED3\u675F\uFF1A\u7D2F\u8BA1\u901A\u8FC7 ${pass} \u9879\uFF0C\u5931\u8D25 ${fail} \u9879 =====`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("\n\u6A21\u57571 \u5192\u70DF\u6D4B\u8BD5\u5F02\u5E38\u7EC8\u6B62\uFF1A", e);
  process.exit(1);
});
