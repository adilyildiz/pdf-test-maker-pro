import React from 'react';
import { TestDetails, Question } from '../types';

interface TestPreviewProps {
  details: TestDetails;
  questions: Question[];
  innerRef: React.Ref<HTMLDivElement>;
  isMeasureOnly?: boolean;
}

export const TestPreview: React.FC<TestPreviewProps> = ({ details, questions, innerRef, isMeasureOnly = false }) => {
  const baseStyles: React.CSSProperties = {
    width: '210mm',
    fontFamily: 'Times New Roman, serif',
  };

  const containerStyles: React.CSSProperties = isMeasureOnly
    ? baseStyles
    : { ...baseStyles, minHeight: '297mm' };

  return (
    <div ref={innerRef} className="p-16 bg-white text-black" style={containerStyles}>
      <div className="text-center space-y-0.5" style={{ fontSize: '10pt' }}>
        <p className="font-bold">{details.schoolYear} EĞİTİM - ÖĞRETİM YILI {details.faculty.toUpperCase()} {details.department.toUpperCase()}</p>
        <p className="font-bold">{details.course.toUpperCase()} DERSİ {details.examType.toUpperCase()} SORULARI</p>
      </div>

      <div className="flex justify-between items-start mt-4" style={{ fontSize: '10pt' }}>
        <div>
          <p><span className="font-bold">AD-SOYAD:</span></p>
          <p className="mt-1"><span className="font-bold">NUMARA:</span></p>
        </div>
        <div className="text-right">
          <p><span className="font-bold">PUAN:</span></p>
        </div>
        <div className="text-center">
            <div className="text-5xl font-extrabold">{details.booklet.toUpperCase()}</div>
            <div className="font-bold tracking-widest" style={{ fontSize: '12pt' }}>KİTAPÇIĞI</div>
        </div>
      </div>
      
      <div className="mt-6" style={{ columnCount: 2, columnGap: '2rem', fontSize: '10pt', lineHeight: '1.4' }}>
        {questions.map((q, index) => (
          <div key={q.id} className="question-item" style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: '1rem' }}>
            <div className="flex items-start">
              <span className="font-bold mr-2">{q.originalIndex! + 1}.</span>
              <div className="flex-1">
                {q.image && <img src={q.image} alt={`Question ${q.originalIndex! + 1} image`} className="mb-2 max-w-full h-auto" />}
                <div dangerouslySetInnerHTML={{ __html: q.text }} />
                <div className="mt-1 flex flex-col">
                  {q.answers.map((ans, ansIndex) => (
                    ans.text && <span key={ansIndex}>{String.fromCharCode(97 + ansIndex)}) {ans.text}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};