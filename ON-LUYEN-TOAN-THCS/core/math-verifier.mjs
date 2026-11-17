/**
 * Bo kiem tra dap an, cham diem 10 dang cau hoi va de xuat lo trinh hoc tap dua tren du lieu thuc te.
 */

export function normalizeAnswerString(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim().toLowerCase();
  // Chuan hoa dau phay thap phan tieng Viet (vd: "7,5" -> "7.5")
  if (/^-?\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  }
  s = s.replace(/\s+/g, '');
  s = s.replace(/°/g, '');
  return s;
}

export function gradeQuestion(question, userAnswer) {
  const maxScore = Number(question.points) || 10;
  const type = question.type;

  // 1. Trac nghiem 4 lua chon, Hinh ve/Do thi, Van dung cao, Tim loi sai, Bai toan thuc te dang MCQ
  if (
    type === 'mcq' ||
    type === 'geometry_graph' ||
    type === 'high_application' ||
    type === 'find_error' ||
    (type === 'real_world' && question.inputType !== 'fill')
  ) {
    if (Array.isArray(question.options)) {
      const chosen = Number(userAnswer);
      const expected = Number(question.answer);
      const isCorrect = Number.isInteger(chosen) && chosen === expected;
      return {
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        needsManualGrading: false,
        expectedDisplay: question.options[expected] ?? String(expected)
      };
    }
    if (type === 'find_error' && Array.isArray(question.workSteps)) {
      const chosen = Number(userAnswer);
      const expected = Number(question.answer);
      const isCorrect = Number.isInteger(chosen) && chosen === expected;
      return {
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        needsManualGrading: false,
        expectedDisplay: question.workSteps[expected] ?? `Bước ${expected + 1}`
      };
    }
  }

  // 2. Trac nghiem Dung / Sai 4 y (cham theo thang diem GDPT 2018: 1 y = 10%, 2 y = 25%, 3 y = 50%, 4 y = 100%)
  if (type === 'true_false' && Array.isArray(question.statements)) {
    const expected = question.statements.map((st) => Boolean(st.isTrue));
    const given = Array.isArray(userAnswer) ? userAnswer : [];
    let matched = 0;
    for (let i = 0; i < expected.length; i++) {
      if (given[i] === expected[i]) matched++;
    }
    const ratios = [0, 0.1, 0.25, 0.5, 1];
    const ratio = ratios[matched] ?? 0;
    const score = Math.round(maxScore * ratio * 10) / 10;
    return {
      isCorrect: matched === expected.length,
      score,
      maxScore,
      needsManualGrading: false,
      expectedDisplay: expected.map((v, i) => `${question.statements[i]?.label || i + 1}) ${v ? 'Đúng' : 'Sai'}`).join(' · ')
    };
  }

  // 3. Dien dap an / Bai toan thuc te dang dien so / Geometry fill
  if (
    type === 'fill_blank' ||
    (type === 'real_world' && question.inputType === 'fill') ||
    (type === 'geometry_graph' && !Array.isArray(question.options))
  ) {
    const normUser = normalizeAnswerString(userAnswer);
    const accepted = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0
      ? question.acceptedAnswers
      : [question.answer];
    const isCorrect = normUser !== '' && accepted.some((a) => normalizeAnswerString(a) === normUser);
    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      needsManualGrading: false,
      expectedDisplay: String(question.answer)
    };
  }

  // 4. Ghep cap kien thuc: userAnswer la mang chi so rightIdx tuong ung voi tung leftIdx [0..n-1]
  if (type === 'matching' && Array.isArray(question.pairs)) {
    const total = question.pairs.length;
    const given = Array.isArray(userAnswer) ? userAnswer : [];
    let matched = 0;
    for (let i = 0; i < total; i++) {
      if (Number(given[i]) === i) matched++;
    }
    const score = total > 0 ? Math.round((maxScore * (matched / total)) * 10) / 10 : 0;
    return {
      isCorrect: matched === total && total > 0,
      score,
      maxScore,
      needsManualGrading: false,
      expectedDisplay: question.pairs.map((p) => `${p.left} → ${p.right}`).join(' ; ')
    };
  }

  // 5. Sap xep cac buoc giai: userAnswer la mang thu tu cac chi so goc [0, 1, 2, ...]
  if (type === 'ordering' && Array.isArray(question.steps)) {
    const total = question.steps.length;
    const given = Array.isArray(userAnswer) ? userAnswer : [];
    const isExact = given.length === total && given.every((val, idx) => Number(val) === idx);
    return {
      isCorrect: isExact,
      score: isExact ? maxScore : 0,
      maxScore,
      needsManualGrading: false,
      expectedDisplay: question.steps.map((s, i) => `${i + 1}. ${s}`).join(' → ')
    };
  }

  // 6. Tu luan ngan: Cham tu dong so bo theo tu khoa rubrics de hoc sinh tham khao va danh dau cho giao vien cham
  if (type === 'short_essay') {
    const text = String(userAnswer || '').trim().toLowerCase();
    const compactText = text.replace(/\s+/g, '');
    const keywords = Array.isArray(question.rubricKeywords) ? question.rubricKeywords : [];
    let hit = 0;
    for (const kw of keywords) {
      const k = String(kw).toLowerCase().replace(/\s+/g, '');
      if (compactText.includes(k)) hit++;
    }
    const autoRatio = keywords.length > 0 ? hit / keywords.length : 0;
    const provisionalScore = text.length > 2 ? Math.round(maxScore * autoRatio * 10) / 10 : 0;
    return {
      isCorrect: autoRatio >= 0.75,
      score: provisionalScore,
      maxScore,
      needsManualGrading: true,
      expectedDisplay: String(question.answer)
    };
  }

  return {
    isCorrect: false,
    score: 0,
    maxScore,
    needsManualGrading: false,
    expectedDisplay: String(question.answer ?? '')
  };
}

export function nextAdaptiveLevel(currentLevel, recentIsCorrectList) {
  let lvl = Number(currentLevel) || 1;
  if (!Array.isArray(recentIsCorrectList) || recentIsCorrectList.length < 2) return lvl;
  const last2 = recentIsCorrectList.slice(-2);
  const last3 = recentIsCorrectList.slice(-3);
  if (last3.length === 3 && last3.every(Boolean)) {
    lvl = Math.min(3, lvl + 1);
  } else if (last2.every((v) => v === false)) {
    lvl = Math.max(1, lvl - 1);
  }
  return lvl;
}

/**
 * Phan tich lich su thuc te de de xuat lo trinh hoc tap.
 * Chi ket luan diem yeu/manh khi chu de co >= 5 cau da lam de tranh ket luan voi vang.
 */
export function buildPersonalizedRecommendations(attempts, curriculumTopics) {
  const topicMap = new Map();
  for (const t of curriculumTopics || []) {
    topicMap.set(t.key, t);
  }

  const statsByTopic = new Map();
  for (const attempt of attempts || []) {
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    for (const ans of answers) {
      const topicKey = ans.topic || attempt.topic;
      if (!topicKey) continue;
      if (!statsByTopic.has(topicKey)) {
        statsByTopic.set(topicKey, { topicKey, total: 0, correct: 0, wrongQuestionIds: [] });
      }
      const entry = statsByTopic.get(topicKey);
      entry.total += 1;
      if (ans.isCorrect) {
        entry.correct += 1;
      } else if (ans.questionId) {
        entry.wrongQuestionIds.push(ans.questionId);
      }
    }
  }

  const weakTopics = [];
  const strongTopics = [];
  const insufficientDataTopics = [];

  for (const [topicKey, st] of statsByTopic.entries()) {
    const meta = topicMap.get(topicKey) || { name: topicKey, grade: null };
    const accuracy = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;

    if (st.total < 5) {
      insufficientDataTopics.push({
        topicKey,
        topicName: meta.name,
        grade: meta.grade,
        answered: st.total,
        correct: st.correct,
        accuracy,
        reason: `Mới làm ${st.total} câu (cần tối thiểu 5 câu để đánh giá tin cậy).`
      });
      continue;
    }

    if (accuracy < 65) {
      weakTopics.push({
        topicKey,
        topicName: meta.name,
        grade: meta.grade,
        answered: st.total,
        correct: st.correct,
        accuracy,
        recommendedLevel: accuracy < 45 ? 1 : 2,
        reason: `Tỉ lệ đúng đạt ${accuracy}% (${st.correct}/${st.total} câu), dưới ngưỡng vững 65%.`
      });
    } else {
      strongTopics.push({
        topicKey,
        topicName: meta.name,
        grade: meta.grade,
        answered: st.total,
        correct: st.correct,
        accuracy,
        recommendedLevel: accuracy >= 85 ? 3 : 2,
        reason: `Đạt ${accuracy}% (${st.correct}/${st.total} câu) — nền tảng tốt, có thể tăng mức độ.`
      });
    }
  }

  weakTopics.sort((a, b) => a.accuracy - b.accuracy);
  strongTopics.sort((a, b) => b.accuracy - a.accuracy);

  const weeklyPlan = [];
  if (weakTopics.length > 0) {
    const topWeak = weakTopics[0];
    weeklyPlan.push({
      day: 'Thứ 2 – Thứ 3',
      focus: `Củng cố ${topWeak.topicName}`,
      action: `Ôn lại bước giải mẫu và luyện 10 câu Mức ${topWeak.recommendedLevel}.`,
      reason: topWeak.reason
    });
  }
  if (weakTopics.length > 1) {
    const secondWeak = weakTopics[1];
    weeklyPlan.push({
      day: 'Thứ 4 – Thứ 5',
      focus: `Luyện tập ${secondWeak.topicName}`,
      action: `Làm lại các câu từng sai và 10 câu Mức ${secondWeak.recommendedLevel}.`,
      reason: secondWeak.reason
    });
  }
  if (strongTopics.length > 0) {
    const topStrong = strongTopics[0];
    weeklyPlan.push({
      day: 'Thứ 6 – Thứ 7',
      focus: `Nâng cao ${topStrong.topicName}`,
      action: `Thử sức với 5–10 câu Mức ${topStrong.recommendedLevel} và bài toán thực tế.`,
      reason: topStrong.reason
    });
  }
  if (weeklyPlan.length === 0) {
    weeklyPlan.push({
      day: 'Trong tuần này',
      focus: 'Khởi động và thu thập dữ liệu năng lực',
      action: 'Hoàn thành ít nhất 1 bài luyện tập (10 câu) theo lớp đang học để hệ thống có đủ căn cứ đánh giá.',
      reason: 'Hiện chưa có chủ đề nào đủ 5 câu trả lời để kết luận năng lực.'
    });
  }

  return {
    minimumThreshold: 5,
    weakTopics,
    strongTopics,
    insufficientDataTopics,
    weeklyPlan
  };
}
