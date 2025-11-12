import React from 'react';
import { Question } from '../types';

interface AnswerKeyPreviewProps {
  booklets: Array<{ bookletType: string; questions: Question[] }> | null;
  courseName: string;
  innerRef: React.Ref<HTMLDivElement>;
}

export const AnswerKeyPreview: React.FC<AnswerKeyPreviewProps> = ({ booklets, courseName, innerRef }) => {
  if (!booklets) return null;

  return (
    <div ref={innerRef} className="p-16 bg-white text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Times New Roman, serif' }}>
      <div className="text-center mb-8">
        <h1 className="font-bold" style={{ fontSize: '16pt' }}>{courseName.toUpperCase()} DERSİ CEVAP ANAHTARI</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4" style={{ fontSize: '10pt' }}>
        {booklets.map(({ bookletType, questions }) => (
          <div key={bookletType} className="p-4 border border-black rounded-lg" style={{ breakInside: 'avoid' }}>
            <h2 className="font-bold text-center mb-4 border-b border-black pb-2" style={{ fontSize: '12pt' }}>{bookletType} KİTAPÇIĞI</h2>
            <ol className="list-none list-inside space-y-1" style={{ columnCount: questions.length > 20 ? 2 : 1, columnGap: '1rem' }}>
              {questions.map((q, index) => (
                <li key={q.id} className="font-mono">
                  <span className="font-sans font-bold w-8 inline-block">{index + 1}.</span>
                  {String.fromCharCode(65 + q.correctAnswerIndex)}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
};