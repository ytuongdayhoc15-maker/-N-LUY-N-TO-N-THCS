export type Role = 'admin' | 'teacher' | 'student';
export type TextbookId = 'kntt' | 'ctst' | 'cd';
export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'ordering'
  | 'short_essay'
  | 'real_world'
  | 'geometry_graph'
  | 'find_error'
  | 'high_application';

export type PracticeMode =
  | 'lesson'
  | 'chapter'
  | 'midterm'
  | 'final'
  | 'test_15m'
  | 'test_45m'
  | 'mock_exam'
  | 'wrong_only';

export interface User {
  id: string;
  username: string;
  studentCode: string;
  fullName: string;
  role: Role;
  classId: string | null;
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: number;
  textbook: TextbookId;
  teacherId: string | null;
  schoolYear: string;
}

export interface TextbookInfo {
  id: TextbookId;
  name: string;
  shortName: string;
  publisher: string;
}

export interface LessonInfo {
  id: string;
  code: string;
  title: string;
}

export interface ChapterInfo {
  id: string;
  semester: number;
  code: string;
  title: string;
  topicKey: string;
  lessons: LessonInfo[];
}

export interface TopicMeta {
  key: string;
  grade: number;
  name: string;
}

export interface CurriculumData {
  textbooks: TextbookInfo[];
  grades: Record<string, { label: string; overview: string; books: Record<TextbookId, ChapterInfo[]> }>;
  topics: TopicMeta[];
}

export interface SvgSpec {
  kind: 'trapezoid' | 'bar_chart' | 'parallel_lines' | 'thales_triangle' | 'linear_graph' | 'right_triangle' | 'parabola';
  [key: string]: unknown;
}

export interface Question {
  id: string;
  code: string;
  grade: number;
  textbooks: TextbookId[];
  semester: number;
  topic: string;
  lessonTitle: string;
  level: 1 | 2 | 3;
  type: QuestionType;
  inputType?: 'mcq' | 'fill';
  prompt: string;
  svgSpec?: SvgSpec | null;
  options?: string[];
  statements?: { label: string; text: string; isTrue?: boolean }[];
  pairs?: { left: string; right: string }[];
  steps?: string[];
  workSteps?: string[];
  rubricKeywords?: string[];
  acceptedAnswers?: string[];
  answer?: unknown;
  maxScore?: number;
  solutionSteps?: string[];
  commonMistake?: string;
  points: number;
  estimatedSeconds: number;
}

export interface Assignment {
  id: string;
  title: string;
  teacherId: string;
  classId: string | null;
  mode: PracticeMode;
  grade: number;
  textbook: TextbookId;
  topic: string;
  level: number;
  questionIds: string[];
  durationMinutes: number;
  revealSolutionMode: 'after_submit' | 'immediate' | 'hidden';
  dueDate: string | null;
  createdAt: string;
}

export interface GradedAnswer {
  questionId: string;
  code: string;
  topic: string;
  type: QuestionType;
  prompt: string;
  userAnswer: unknown;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  needsManualGrading: boolean;
  expectedDisplay: string;
  solutionSteps: string[];
  commonMistake: string;
  teacherComment?: string;
}

export interface Attempt {
  id: string;
  userId: string;
  assignmentId: string | null;
  mode: string;
  grade: number;
  textbook: string;
  topic: string;
  level: number;
  adaptiveEnabled: boolean;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalCount: number;
  status: 'graded' | 'needs_grading' | 'submitted';
  answers: GradedAnswer[];
}

export interface Badge {
  id: string;
  userId: string;
  badgeCode: string;
  title: string;
  description: string;
  awardedAt: string;
}

export interface TopicRecommendation {
  topicKey: string;
  topicName: string;
  grade: number | null;
  answered: number;
  correct: number;
  accuracy: number;
  recommendedLevel?: number;
  reason: string;
}

export interface PersonalizedRecommendations {
  minimumThreshold: number;
  weakTopics: TopicRecommendation[];
  strongTopics: TopicRecommendation[];
  insufficientDataTopics: TopicRecommendation[];
  weeklyPlan: { day: string; focus: string; action: string; reason: string }[];
}
