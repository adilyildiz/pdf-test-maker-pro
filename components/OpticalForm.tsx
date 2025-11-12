
import React from 'react';

interface OpticalFormProps {
  questionCount: number;
  booklet: string;
  innerRef: React.Ref<HTMLDivElement>;
}

export const OpticalForm: React.FC<OpticalFormProps> = ({ questionCount, booklet, innerRef }) => {
  const totalQuestions = Math.max(15, questionCount); // Ensure at least 15 rows

  return (
    <div ref={innerRef} className="p-8 bg-white text-black" style={{ width: '210mm', height: '297mm', fontFamily: 'Arial, sans-serif' }}>
        <div className="border-4 border-black p-4 h-full relative">

            {/* Corner markers */}
            <div className="absolute top-[-10px] left-[-10px] w-6 h-6 bg-black"></div>
            <div className="absolute top-[-10px] right-[-10px] w-6 h-6 bg-black"></div>
            <div className="absolute bottom-[-10px] left-[-10px] w-6 h-6 bg-black"></div>
            <div className="absolute bottom-[-10px] right-[-10px] w-6 h-6 bg-black"></div>

            <div className="flex justify-between items-start">
                <div className="w-1/3">
                    <p className="font-bold">Ad - Soyad</p>
                    <div className="border border-black h-8 mt-1"></div>
                </div>

                <div className="flex-grow mx-8">
                  <p className="font-bold text-center">Numara</p>
                  <div className="grid grid-cols-10 border-collapse mt-1">
                    {Array.from({length: 10}).map((_, colIndex) => (
                      <div key={colIndex} className="text-center text-sm border-t border-b border-l border-black h-6">{colIndex}</div>
                    ))}
                    {Array.from({length: 10 * 10}).map((_, cellIndex) => (
                       <div key={cellIndex} className="flex items-center justify-center border-l border-b border-black h-6">
                           <div className="w-4 h-4 rounded-full border border-black"></div>
                       </div>
                    ))}
                  </div>
                </div>

                <div className="w-1/6">
                    <p className="font-bold text-center">Grup</p>
                    <div className="mt-1 space-y-1">
                       {['A', 'B', 'C', 'D'].map(g => (
                          <div key={g} className="flex items-center">
                              <div className={`w-5 h-5 rounded-full border border-black flex items-center justify-center ${booklet.toUpperCase() === g ? 'bg-black' : ''}`}></div>
                              <span className="ml-2 font-bold">{g}</span>
                          </div>
                       ))}
                    </div>
                </div>
            </div>

            <div className="flex mt-8">
                <div className="flex">
                    <div className="flex flex-col items-end mr-1 text-sm">
                        {Array.from({ length: totalQuestions }).map((_, index) => (
                            <div key={index} className="h-6 flex items-center font-bold">{index + 1}</div>
                        ))}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex h-6">
                            {['A', 'B', 'C', 'D', 'E'].map(label => (
                                <div key={label} className="w-7 text-center font-bold">{label}</div>
                            ))}
                        </div>
                        {Array.from({ length: totalQuestions }).map((_, qIndex) => (
                            <div key={qIndex} className="flex h-6">
                                {Array.from({ length: 5 }).map((_, aIndex) => (
                                    <div key={aIndex} className="w-7 flex justify-center items-center">
                                        <div className="w-5 h-5 rounded-full border border-black"></div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 right-4 text-xs font-mono transform -rotate-90 origin-bottom-right">
              Form ID: {new Date().getTime()}
            </div>
        </div>
    </div>
  );
};
