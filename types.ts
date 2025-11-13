export interface Answer {
  text: string;
}

export interface Question {
  id: string;
  text: string;
  image?: string | null;
  answers: Answer[];
  correctAnswerIndex: number;
  originalIndex?: number;
}

export interface TestDetails {
  schoolYear: string;
  faculty: string;
  department: string;
  course: string;
  examType: string;
  booklet: string;
  studentNumberLength?: number;
}