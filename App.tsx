
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { TestDetails, Question, Answer } from './types';
import { QuestionEditor } from './components/QuestionEditor';
import { TestPreview } from './components/TestPreview';
import { FontSelector } from './components/FontSelector';
import { Modal } from './components/Modal';
import { PlusIcon, TrashIcon, EditIcon, SpinnerIcon, DownloadIcon, UploadIcon } from './components/icons';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from 'docx';
import  saveAs  from 'file-saver';

// Helper to strip HTML for plain text previews
const stripHtml = (html: string): string => {
    if (!html) return '';
    // HTML entity'leri decode et
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    const decodedHtml = textarea.value;
    
    // HTML etiketlerini temizle
    const doc = new DOMParser().parseFromString(decodedHtml, 'text/html');
    const text = doc.body.textContent || "";
    
    // Fazla boşlukları temizle
    return text.replace(/\s+/g, ' ').trim();
};

// Helper to convert HTML to text with preserved line breaks
const htmlToTextWithBreaks = (html: string): string => {
    // Replace common block elements with line breaks
    let text = html
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<li>/gi, '\n• ')
        .replace(/<\/li>/gi, '');
    
    // Remove all remaining HTML tags
    const doc = new DOMParser().parseFromString(text, 'text/html');
    text = doc.body.textContent || "";
    
    // Clean up excessive line breaks
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    return text;
};

// Helper to shuffle array non-destructively
const shuffleArray = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

// A utility component for measuring content height during pagination
const PaginateMeasure: React.FC<{
    details: TestDetails;
    questions: Question[];
    startIndex: number;
    onMeasure: (height: number) => void;
}> = ({ details, questions, startIndex, onMeasure }) => {
    const measureRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (measureRef.current) {
            onMeasure(measureRef.current.scrollHeight);
        }
    }, [questions, onMeasure]);

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
            <TestPreview innerRef={measureRef} details={details} questions={questions} startIndex={startIndex} isMeasureOnly />
        </div>
    );
};


const DetailInput: React.FC<{label: string, name: keyof TestDetails, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({label, name, value, onChange}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-300">{label}</label>
        <input type="text" id={name} name={name} value={value} onChange={onChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"/>
    </div>
);

const App: React.FC = () => {
  const [testDetails, setTestDetails] = useState<TestDetails & { studentNumberLength?: number }>({
    schoolYear: '2025 - 2026',
    faculty: 'BİLGİSAYAR VE BİLİŞİM BİLİMLERİ FAKÜLTESİ',
    department: 'DİJİTAL OYUN TASARIMI BÖLÜMÜ',
    course: 'TEMEL BİLGİ TEKNOLOJİLERİ',
    examType: 'ÇOKTAN SEÇMELİ TEST SINAVI',
    booklet: 'A', 
    studentNumberLength: 10, 
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [numberOfBooklets, setNumberOfBooklets] = useState(2);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionSpacing, setQuestionSpacing] = useState<number>(100); 
  const [removeQuestionSpacing, setRemoveQuestionSpacing] = useState<boolean>(false);
  const [questionFontFamily, setQuestionFontFamily] = useState<string>('Times New Roman');
  const [questionFontSize, setQuestionFontSize] = useState<number>(10);
  const [headingFontFamily, setHeadingFontFamily] = useState<string>('Times New Roman');
  const [headingFontSize, setHeadingFontSize] = useState<number>(12);
  const [randomCount, setRandomCount] = useState<string>('');
  
  // Modal States
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'warning';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Filter selected questions for generation
  const activeQuestions = useMemo(() => 
    questions.filter(q => selectedIds.has(q.id)), 
  [questions, selectedIds]);

  // Load all data from localStorage on initial render
  useEffect(() => {
    try {
        const savedData = localStorage.getItem('pdfTestData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (parsedData.testDetails) setTestDetails(parsedData.testDetails);
            if (parsedData.questions) {
                setQuestions(parsedData.questions);
                // By default select all loaded questions if no selection was saved
                if (parsedData.selectedIds) {
                    setSelectedIds(new Set(parsedData.selectedIds));
                } else {
                    setSelectedIds(new Set(parsedData.questions.map((q: Question) => q.id)));
                }
            }
            if (parsedData.numberOfBooklets !== undefined) setNumberOfBooklets(Number(parsedData.numberOfBooklets));
            if (parsedData.questionSpacing !== undefined) setQuestionSpacing(parsedData.questionSpacing);
            if (parsedData.removeQuestionSpacing !== undefined) setRemoveQuestionSpacing(parsedData.removeQuestionSpacing);
            if (parsedData.questionFontFamily) setQuestionFontFamily(parsedData.questionFontFamily);
            if (parsedData.questionFontSize !== undefined) setQuestionFontSize(parsedData.questionFontSize);
            if (parsedData.headingFontFamily) setHeadingFontFamily(parsedData.headingFontFamily);
            if (parsedData.headingFontSize !== undefined) setHeadingFontSize(parsedData.headingFontSize);
        }
    } catch (error) {
        console.error("Veri localStorage'dan yüklenemedi", error);
    }
  }, []);

  // Save all data to localStorage whenever it changes
  useEffect(() => {
    try {
      const dataToSave = {
        testDetails,
        questions,
        selectedIds: Array.from(selectedIds),
        numberOfBooklets,
        questionSpacing,
        removeQuestionSpacing,
        questionFontFamily,
        questionFontSize,
        headingFontFamily,
        headingFontSize,
      };
      localStorage.setItem('pdfTestData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Veri localStorage'a kaydedilemedi", error);
    }
  }, [testDetails, questions, selectedIds, numberOfBooklets, questionSpacing, removeQuestionSpacing, questionFontFamily, questionFontSize, headingFontFamily, headingFontSize]);

  const showModal = (title: string, message: string, type: 'info' | 'danger' | 'warning' = 'info', onConfirm?: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm
    });
  };

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestDetails({ ...testDetails, [e.target.name]: e.target.value });
  };
  
  const handleBookletCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setNumberOfBooklets(parseInt(e.target.value));
  };

  const openEditorForNew = () => {
    setEditingQuestion(null);
    setIsEditorOpen(true);
  };
  
  const openEditorForEdit = (question: Question) => {
    setEditingQuestion(question);
    setIsEditorOpen(true);
  };

  const handleSaveQuestion = (question: Question) => {
    if (editingQuestion) {
      setQuestions(questions.map(q => q.id === question.id ? question : q));
    } else {
      const newId = question.id || `q-${Date.now()}`;
      const newQuestion = { ...question, id: newId };
      setQuestions([...questions, newQuestion]);
      // Auto select new question
      setSelectedIds(prev => new Set(prev).add(newId));
    }
  };

  const deleteQuestion = (id: string) => {
    showModal(
        'Soruyu Sil',
        'Bu soruyu silmek istediğinizden emin misiniz?',
        'danger',
        () => {
            setQuestions(questions.filter(q => q.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    );
  };

  const deleteAllQuestions = () => {
    if (questions.length === 0) {
      showModal('Bilgi', 'Silinecek soru bulunmuyor.', 'info');
      return;
    }
    showModal(
        'Tüm Soruları Sil',
        'Tüm soruları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        'danger',
        () => {
            setQuestions([]);
            setSelectedIds(new Set());
        }
    );
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(questions.map(q => q.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleRandomSelect = () => {
    const count = parseInt(randomCount);
    if (isNaN(count) || count <= 0) {
        showModal('Uyarı', 'Lütfen geçerli bir sayı girin.', 'warning');
        return;
    }
    if (questions.length === 0) {
        showModal('Uyarı', 'Soru havuzu boş.', 'warning');
        return;
    }
    
    const safeCount = Math.min(count, questions.length);
    const shuffledIds = shuffleArray(questions.map(q => q.id));
    const selection = shuffledIds.slice(0, safeCount);
    setSelectedIds(new Set(selection));
    showModal('Bilgi', `${safeCount} adet soru rasgele seçildi.`, 'info');
  };
  
  const shuffleQuestionsAndAnswers = (originalQuestions: Question[]): Question[] => {
      const shuffledQuestions = shuffleArray(originalQuestions);
      return shuffledQuestions.map(q => {
          const validAnswers = q.answers.filter(a => a.text.trim() !== '');
          if (validAnswers.length === 0 || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= validAnswers.length) {
             return { ...q, answers: q.answers };
          }
          const correctAnswerText = validAnswers[q.correctAnswerIndex]?.text;
          if (!correctAnswerText) {
             return { ...q, answers: shuffleArray(q.answers) };
          }
          const shuffledValidAnswers = shuffleArray(validAnswers);
          const newCorrectIndex = shuffledValidAnswers.findIndex(a => a.text === correctAnswerText);
          const newAnswers = [...shuffledValidAnswers];
          while (newAnswers.length < q.answers.length) {
              newAnswers.push({ text: '' });
          }
          return {
              ...q,
              answers: newAnswers,
              correctAnswerIndex: newCorrectIndex >= 0 ? newCorrectIndex : q.correctAnswerIndex,
          };
      });
  };
  
  // PDF fonksiyonları kaldırıldı - sadece Word export kullanılıyor

  const paginate = useCallback((allQuestions: Question[], bookletDetails: TestDetails): Promise<Question[][]> => {
    return new Promise((resolve, reject) => {
        const A4_CONTENT_HEIGHT_PX = 900; 
        const measureRootEl = document.createElement('div');
        document.body.appendChild(measureRootEl);
        const measureRoot = ReactDOM.createRoot(measureRootEl);

        const pages: Question[][] = [];
        let currentPageQuestions: Question[] = [];
        let remainingQuestions = [...allQuestions];

        const cleanup = () => {
            try {
                measureRoot.unmount();
            } catch (e) {
                console.error('Unmount error:', e);
            }
            if (document.body.contains(measureRootEl)) {
                document.body.removeChild(measureRootEl);
            }
        };

        const processQuestion = () => {
            try {
                if (remainingQuestions.length === 0) {
                    if (currentPageQuestions.length > 0) {
                        pages.push([...currentPageQuestions]);
                    }
                    cleanup();
                    resolve(pages);
                    return;
                }

                const nextQuestion = remainingQuestions.shift()!;
                const potentialPageQuestions = [...currentPageQuestions, nextQuestion];
                const startIndexForMeasure = allQuestions.length - remainingQuestions.length - potentialPageQuestions.length;

                const handleMeasure = (height: number) => {
                    if (height > A4_CONTENT_HEIGHT_PX && currentPageQuestions.length > 0) {
                        pages.push([...currentPageQuestions]);
                        currentPageQuestions = [nextQuestion];
                    } else {
                        currentPageQuestions = potentialPageQuestions;
                    }
                    setTimeout(processQuestion, 0);
                };

                measureRoot.render(
                    <PaginateMeasure
                        details={bookletDetails}
                        questions={potentialPageQuestions}
                        startIndex={startIndexForMeasure}
                        onMeasure={handleMeasure}
                    />
                );
            } catch (error) {
                console.error('Pagination error:', error);
                cleanup();
                reject(error);
            }
        };
        processQuestion();
    });
}, []);

  // State for direct PDF generation
  const [directPdfPages, setDirectPdfPages] = useState<Array<{
    type: 'booklet' | 'answer-key' | 'optical-form';
    bookletType: string;
    questions: Question[];
    startIndex: number;
    isFirstPage: boolean;
    allBooklets?: Array<{ bookletType: string; questions: Question[] }>;
  }> | null>(null);
  const [directPdfCurrentPage, setDirectPdfCurrentPage] = useState<number>(0);
  const directPdfRef = useRef<HTMLDivElement>(null);
  const directPdfDocRef = useRef<any>(null);

  // Soruları sayfalara böl
  const paginateQuestionsForPdf = (questions: Question[], questionsPerPage: number = 12): Question[][] => {
    const pages: Question[][] = [];
    for (let i = 0; i < questions.length; i += questionsPerPage) {
      pages.push(questions.slice(i, i + questionsPerPage));
    }
    return pages;
  };


  const handleExport = () => {
    const dataToExport = {
      testDetails,
      questions,
      selectedIds: Array.from(selectedIds),
      numberOfBooklets,
      questionSpacing,
      removeQuestionSpacing,
      questionFontFamily,
      questionFontSize,
      headingFontFamily,
      headingFontSize,
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sinav-verileri.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportGift = () => {
    const questionsToExport = activeQuestions.length > 0 ? activeQuestions : questions;
    if (questionsToExport.length === 0) {
        showModal('Uyarı', "Dışa aktarılacak soru bulunmuyor.", 'warning');
        return;
    }

    const escapeGiftText = (text: string): string => {
        return text.replace(/([~=#{}])/g, '\\$1');
    };

    const giftContent = questionsToExport.map((q, index) => {
        const title = `Soru ${index + 1}`;
        const text = `[html]${q.text}`;

        const answers = q.answers
            .map((ans, ansIndex) => {
                if (ans.text.trim() === '') return null;
                const prefix = ansIndex === q.correctAnswerIndex ? '=' : '~';
                return `${prefix}${escapeGiftText(ans.text.trim())}`;
            })
            .filter(Boolean)
            .join('\n');

        return `::${title}::${text}{\n${answers}\n}`;
    }).join('\n\n');

    const blob = new Blob([giftContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sinav-sorulari.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Dosya metin olarak okunamadı.");
        const importedData = JSON.parse(text);
  
        if (!importedData.testDetails || !Array.isArray(importedData.questions)) {
           throw new Error("Geçersiz sınav verisi formatı.");
        }
  
        const loadData = () => {
            setTestDetails(importedData.testDetails);
            setQuestions(importedData.questions);
            if (importedData.selectedIds) {
                setSelectedIds(new Set(importedData.selectedIds));
            } else {
                setSelectedIds(new Set(importedData.questions.map((q: Question) => q.id)));
            }
            if (importedData.numberOfBooklets !== undefined) setNumberOfBooklets(Number(importedData.numberOfBooklets));
            if (importedData.questionSpacing !== undefined) setQuestionSpacing(importedData.questionSpacing);
            if (importedData.removeQuestionSpacing !== undefined) setRemoveQuestionSpacing(importedData.removeQuestionSpacing);
            if (importedData.questionFontFamily) setQuestionFontFamily(importedData.questionFontFamily);
            if (importedData.questionFontSize !== undefined) setQuestionFontSize(importedData.questionFontSize);
            if (importedData.headingFontFamily) setHeadingFontFamily(importedData.headingFontFamily);
            if (importedData.headingFontSize !== undefined) setHeadingFontSize(importedData.headingFontSize);
            showModal('Başarılı', `Sınav detayları ve ${importedData.questions.length} soru başarıyla yüklendi.`, 'info');
        };

        if (questions.length > 0) {
            showModal(
                'Üzerine Yazılsın mı?',
                "Mevcut sınav bilgileri ve soruların üzerine yazılsın mı? Bu işlem geri alınamaz.",
                'warning',
                loadData
            );
        } else {
            loadData();
        }
      } catch (error) {
        console.error("Veri içe aktarma hatası:", error);
        showModal('Hata', "Sınav verisi yüklenirken bir hata oluştu. Dosya formatını kontrol edin.", 'danger');
      } finally {
          event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const parseGiftFormat = (giftText: string): Question[] => {
    const parsedQuestions: Question[] = [];
    const cleanText = giftText.replace(/\/\/.*$/gm, '');
    const blocks = cleanText.split(/\n\s*\n/);
    
    let count = 0;
    for (let rawBlock of blocks) {
        let block = rawBlock.trim();
        if (!block || !block.includes('{')) continue;

        const titleMatch = block.match(/^::(.*?)::/);
        if (titleMatch) {
            block = block.replace(/^::(.*?)::/, '').trim();
        }

        const braceIndex = block.indexOf('{');
        if (braceIndex === -1) continue;

        let questionText = block.substring(0, braceIndex).trim();
        const answersContent = block.substring(braceIndex + 1, block.lastIndexOf('}')).trim();

        questionText = questionText.replace(/^\[(html|markdown|plain|moodle)\]/i, '').trim();

        const answers: Answer[] = [];
        let correctAnswerIndex = -1;
        
        const parts = answersContent.split(/([=~])/);
        for (let i = 1; i < parts.length; i += 2) {
            const prefix = parts[i];
            const content = parts[i + 1];
            if (!content) continue;

            let ansText = content.split(/[#~=}]/)[0].trim();
            ansText = ansText.replace(/^%-?\d+(\.\d+)?%/, '').trim();

            if (ansText) {
                answers.push({ text: ansText });
                if (prefix === '=') {
                    correctAnswerIndex = answers.length - 1;
                }
            }
        }

        if (questionText && answers.length >= 2) {
            const finalAnswers = [...answers];
            while (finalAnswers.length < 5) finalAnswers.push({ text: '' });
            
            parsedQuestions.push({
                id: `gift-${Date.now()}-${count++}-${Math.random().toString(36).substring(2, 5)}`,
                text: questionText,
                image: null,
                answers: finalAnswers,
                correctAnswerIndex: correctAnswerIndex !== -1 ? correctAnswerIndex : 0,
            });
        }
    }
    
    return parsedQuestions;
  };

const handleImportGift = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Dosya metin olarak okunamadı.");
        const importedQuestions = parseGiftFormat(text);
        if (importedQuestions.length === 0) {
            showModal('Hata', "Dosya içinde geçerli GIFT formatında soru bulunamadı. Lütfen formatı kontrol edin.", 'warning');
            return;
        }
        const applyImport = () => {
            setQuestions(importedQuestions);
            setSelectedIds(new Set(importedQuestions.map(q => q.id)));
            showModal('Başarılı', `${importedQuestions.length} soru başarıyla yüklendi.`, 'info');
        };
        if (questions.length > 0) {
            showModal(
                'Sorular Değiştirilsin mi?',
                `GIFT dosyasından ${importedQuestions.length} soru bulundu. Mevcut sorular silinip yenileri eklensin mi?`,
                'warning',
                applyImport
            );
        } else {
            applyImport();
        }
      } catch (error) {
        console.error("GIFT verisi içe aktarma hatası:", error);
        showModal('Hata', "GIFT verisi yüklenirken bir hata oluştu.", 'danger');
      } finally {
          event.target.value = '';
      }
    };
    reader.readAsText(file);
};

const generateOpticalFormContent = (
  bookletType: string, 
  questionCount: number, 
  studentNumberLength: number
): any[] => {
  const children: any[] = [];
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "AD-SOYAD: ", bold: true, size: questionFontSize*2, font: questionFontFamily  }),
        new TextRun({ text: "_____________________________", size: questionFontSize*2, font: questionFontFamily })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "NUMARA:  ", bold: true, size: questionFontSize*2, font: questionFontFamily }),
        new TextRun({ text: "_____________________________", size: questionFontSize*2, font: questionFontFamily })
      ],
      spacing: { after: 100 }
    }),
  );

  const answersPerColumn = Math.ceil(questionCount / 2);
  const tableRows: TableRow[] = [];
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })],
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
        }
      }),
      ...['A', 'B', 'C', 'D', 'E'].map(letter => 
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: letter, bold: true , size: questionFontSize*2, font: questionFontFamily})],
            alignment: AlignmentType.CENTER
          })],
          width: { size: 8.5, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
          }
        })
      ),
      new TableCell({
        children: [new Paragraph({ text: "" })],
        width: { size: 1, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
        }
      }),
      new TableCell({
        children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })],
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
        }
      }),
      ...['A', 'B', 'C', 'D', 'E'].map(letter => 
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: letter, bold: true, size: questionFontSize*2, font: questionFontFamily })],
            alignment: AlignmentType.CENTER
          })],
          width: { size: 8.5, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
          }
        })
      )
    ]
  });
  tableRows.push(headerRow);

  for (let row = 0; row < answersPerColumn; row++) {
    const leftQuestionNum = row + 1;
    const rightQuestionNum = row + answersPerColumn + 1;
    const cells: TableCell[] = [];
    cells.push(
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: `${leftQuestionNum}`, bold: true, size: questionFontSize*2, font: questionFontFamily })], alignment: AlignmentType.CENTER })],
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
        }
      })
    );
    for (let opt = 0; opt < 5; opt++) {
      cells.push(
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "O", size: questionFontSize*2, font: questionFontFamily })], alignment: AlignmentType.CENTER })],
          width: { size: 8.5, type: WidthType.PERCENTAGE },
          margins: { top: 30, bottom: 30 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
          }
        })
      );
    }
    cells.push(
      new TableCell({
        children: [new Paragraph({ text: "" })],
        width: { size: 1, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
        }
      })
    );
    if (rightQuestionNum <= questionCount) {
      cells.push(
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${rightQuestionNum}`, bold: true, size: questionFontSize*2, font: questionFontFamily })], alignment: AlignmentType.CENTER })],
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 15, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
          }
        })
      );
      for (let opt = 0; opt < 5; opt++) {
        cells.push(
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "O", size: questionFontSize*2, font: questionFontFamily })], alignment: AlignmentType.CENTER })],
            width: { size: 8.5, type: WidthType.PERCENTAGE },
            margins: { top: 30, bottom: 30 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 10, color: "000000" }
            }
          })
        );
      }
    } else {
      cells.push(new TableCell({ children: [new Paragraph({ text: "" })], width: { size: 5, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 10, color: "000000" }, left: { style: BorderStyle.SINGLE, size: 15, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 10, color: "000000" } } }));
      for (let opt = 0; opt < 5; opt++) {
        cells.push(new TableCell({ children: [new Paragraph({ text: "" })], width: { size: 8.5, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 10, color: "000000" }, left: { style: BorderStyle.SINGLE, size: 10, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 10, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 10, color: "000000" } } }));
      }
    }
    tableRows.push(new TableRow({ children: cells }));
  }
  const mainAnswerTable = new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
  children.push(mainAnswerTable);
  return children;
};

  const handleGenerateWordColumns = async () => {
    if (activeQuestions.length === 0) {
        showModal('Uyarı', "Word dosyası oluşturmadan önce lütfen en az bir soru seçin.", 'warning');
        return;
    }
    try {
        const booklets = [];
        for (let i = 0; i < numberOfBooklets; i++) {
            const bookletType = String.fromCharCode(65 + i);
            booklets.push({
                bookletType,
                questions: shuffleQuestionsAndAnswers(JSON.parse(JSON.stringify(activeQuestions)))
            });
        }
        const sections = [];
        for (const booklet of booklets) {
            const children: any[] = [];
            children.push(
                new Paragraph({ children: [new TextRun({ text: `${testDetails.schoolYear} EĞİTİM - ÖĞRETİM YILI`, size: headingFontSize*2, font: headingFontFamily })], heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: `${testDetails.faculty.toUpperCase()}`, size: headingFontSize*2, font: headingFontFamily })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: `${testDetails.department.toUpperCase()}`, size: headingFontSize*2, font: headingFontFamily })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: `${testDetails.course.toUpperCase()} DERSİ ${testDetails.examType.toUpperCase()} SORULARI`, size: headingFontSize*2, font: headingFontFamily })], alignment: AlignmentType.CENTER, spacing: { after: 200 } })
            );
            children.push(
                new Paragraph({ children: [new TextRun({ text: "AD-SOYAD:\t", bold: true, size: questionFontSize*2, font: questionFontFamily }), new TextRun({ text: "_____________________________", size: questionFontSize*2, font: questionFontFamily })], spacing: { after: 100 } }),
                new Paragraph({ children: [new TextRun({ text: "NUMARA:\t", bold: true, size: questionFontSize*2, font: questionFontFamily }), new TextRun({ text: "_____________________________", size: questionFontSize*2, font: questionFontFamily })], spacing: { after: 100 } }),
                new Paragraph({ children: [new TextRun({ text: `${booklet.bookletType} KİTAPÇIĞI`, size: headingFontSize*2, font: headingFontFamily })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
            );
            booklet.questions.forEach((q, index) => {
                const questionText = htmlToTextWithBreaks(q.text);
                const questionLines = questionText.split('\n').filter(line => line.trim() !== '');
                questionLines.forEach((line, lineIndex) => {
                    if (lineIndex === 0) {
                        children.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. `, bold: true, size: questionFontSize*2, font: questionFontFamily }), new TextRun({ text: line.trim(), size: questionFontSize*2, font: questionFontFamily })], spacing: { after: 0 }, keepNext: true, keepLines: true }));
                    } else {
                        children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: questionFontSize*2, font: questionFontFamily })], spacing: { after: 0 }, indent: { left: 200 }, keepNext: true, keepLines: true }));
                    }
                });
                q.answers.filter(a => a.text.trim() !== '').forEach((ans, idx) => {
                    children.push(new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(97 + idx)}) `, size: questionFontSize*2, font: questionFontFamily }), new TextRun({ text: ans.text, size: questionFontSize*2, font: questionFontFamily })], spacing: { after: 0 }, indent: { left: 200 }, keepNext: true, keepLines: true }));
                });
                children.push(new Paragraph({ style: "soruarasi", text: "", spacing: { after: questionSpacing } }));
            });
            const opticalFormContent = generateOpticalFormContent(booklet.bookletType, activeQuestions.length, testDetails.studentNumberLength ?? 10);
            children.push(...opticalFormContent);
            sections.push({
                properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } }, column: { space: 708, count: 2, separate: true } },
                children
            });
        }
        const answerKeyChildren: any[] = [new Paragraph({ text: `${testDetails.course.toUpperCase()} DERSİ CEVAP ANAHTARI`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } })];
        if (booklets.length > 0) {
          const headerCells: TableCell[] = [];
          const firstColSize = 10;
          const otherColSize = Math.floor((100 - firstColSize) / booklets.length);
          headerCells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true })], alignment: AlignmentType.CENTER })], width: { size: firstColSize, type: WidthType.PERCENTAGE } }));
          for (const b of booklets) headerCells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${b.bookletType} Grubu`, bold: true })], alignment: AlignmentType.CENTER })], width: { size: otherColSize, type: WidthType.PERCENTAGE } }));
          const rows: TableRow[] = [];
          rows.push(new TableRow({ children: headerCells }));
          const totalQuestions = Math.max(...booklets.map(b => b.questions.length));
          for (let qi = 0; qi < totalQuestions; qi++) {
            const cells: TableCell[] = [];
            cells.push(new TableCell({ children: [new Paragraph({ text: String(qi + 1), alignment: AlignmentType.CENTER })], width: { size: firstColSize, type: WidthType.PERCENTAGE } }));
            for (const b of booklets) {
              let letter = '';
              const q = b.questions[qi];
              if (q && typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0) letter = String.fromCharCode(65 + q.correctAnswerIndex);
              cells.push(new TableCell({ children: [new Paragraph({ text: letter, alignment: AlignmentType.CENTER })], width: { size: otherColSize, type: WidthType.PERCENTAGE } }));
            }
            rows.push(new TableRow({ children: cells }));
          }
          const answerTable = new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" }, bottom: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" }, left: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" }, right: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" }, insideVertical: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" } } });
          answerKeyChildren.push(answerTable);
        }
        sections.push({ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: answerKeyChildren });
        const doc = new Document({ styles:{paragraphStyles:[{ id: "soruarasi", name: "Soru Arası Boşluk", basedOn: "Normal", next: "Normal", run: { size: 2 }, }]}, sections });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `test_${testDetails.course.replace(/\s/g, '_')}_2sutun.docx`);
    } catch (error) {
        console.error("Word dosyası oluşturma hatası:", error);
        showModal('Hata', "Word dosyası oluşturulurken bir hata oluştu.", 'danger');
    }
};
  

  return (
    <>
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">Test Oluşturucu <span className="text-cyan-400">Pro</span></h1>
            <p className="mt-4 text-xl text-slate-400">Zahmetsizce profesyonel, iki sütunlu testler oluşturun.</p>
          </header>

          <main className="space-y-8">
            <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold border-b border-slate-700 pb-3 mb-4 text-cyan-400">Test Başlık Detayları</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailInput label="Eğitim Yılı" name="schoolYear" value={testDetails.schoolYear} onChange={handleDetailsChange} />
                  <DetailInput label="Fakülte" name="faculty" value={testDetails.faculty} onChange={handleDetailsChange} />
                  <DetailInput label="Bölüm" name="department" value={testDetails.department} onChange={handleDetailsChange} />
                  <DetailInput label="Ders" name="course" value={testDetails.course} onChange={handleDetailsChange} />
                  <DetailInput label="Sınav Türü" name="examType" value={testDetails.examType} onChange={handleDetailsChange} />
                  <div>
                    <label htmlFor="numberOfBooklets" className="block text-sm font-medium text-slate-300">Kitapçık Türü Sayısı</label>
                    <select id="numberOfBooklets" name="numberOfBooklets" value={numberOfBooklets} onChange={handleBookletCountChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition">
                        <option value={1}>1 (A)</option>
                        <option value={2}>2 (A, B)</option>
                        <option value={3}>3 (A, B, C)</option>
                        <option value={4}>4 (A, B, C, D)</option>
                    </select>
                  </div>
                                    <div>
                                        <label htmlFor="questionSpacing" className="block text-sm font-medium text-slate-300">Sorular Arası Boşluk</label>
                                        <div className="mt-1 flex items-center gap-2">
                                            <input
                                                id="questionSpacing"
                                                type="range"
                                                min={0}
                                                max={800}
                                                step={10}
                                                value={questionSpacing}
                                                onChange={(e) => setQuestionSpacing(parseInt(e.target.value || '0'))}
                                                className="w-full"
                                            />
                                            <input
                                                type="number"
                                                value={questionSpacing}
                                                onChange={(e) => setQuestionSpacing(parseInt(e.target.value || '0'))}
                                                className="w-20 bg-slate-700 border border-slate-600 rounded-md p-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-3 lg:col-span-3">
                                        <label className="block text-sm font-medium text-slate-300">Yazı Tipi ve Boyutu</label>
                                        <div className="mt-2 grid grid-cols-2 gap-3">
                                                                                        <div>
                                                                                                <div className="text-sm text-slate-300">Soru Yazı Tipi</div>
                                                                                                <FontSelector
                                                                                                    value={questionFontFamily}
                                                                                                    onChange={(v) => setQuestionFontFamily(v)}
                                                                                                    options={[
                                                                                                        'Arial','Arial Black','Bahnschrift','Calibri','Cambria','Candara','Comic Sans MS','Consolas','Constantia','Corbel','Courier New','Didot','Fira Sans','Franklin Gothic Medium','Garamond','Georgia','Helvetica','Impact','Liberation Sans','Leelawadee UI','Lucida Console','Lucida Sans Unicode','Microsoft Sans Serif','Monaco','MS Gothic','MS Mincho','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana','Century Gothic','Droid Sans','Open Sans','Roboto','Montserrat','Noto Sans','PT Sans','Raleway','Lato','Oswald','Source Sans Pro','Ubuntu','Victor Mono','Work Sans','Gill Sans','Brush Script MT','Optima','Cambria Math'
                                                                                                    ]}
                                                                                                    placeholder="Font adı yazın veya seçin"
                                                                                                />
                                                                                        </div>
                                            <div>
                                                <div className="text-sm text-slate-300">Soru Boyutu</div>
                                                <input type="number" value={questionFontSize} onChange={(e) => setQuestionFontSize(parseInt(e.target.value||'0'))} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" />
                                            </div>
                                                                                        <div>
                                                                                                <div className="text-sm text-slate-300">Başlık Yazı Tipi</div>
                                                                                                <FontSelector
                                                                                                    value={headingFontFamily}
                                                                                                    onChange={(v) => setHeadingFontFamily(v)}
                                                                                                    options={[
                                                                                                        'Arial','Arial Black','Bahnschrift','Calibri','Cambria','Candara','Comic Sans MS','Consolas','Constantia','Corbel','Courier New','Didot','Fira Sans','Franklin Gothic Medium','Garamond','Georgia','Helvetica','Impact','Liberation Sans','Leelawadee UI','Lucida Console','Lucida Sans Unicode','Microsoft Sans Serif','Monaco','MS Gothic','MS Mincho','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana','Century Gothic','Droid Sans','Open Sans','Roboto','Montserrat','Noto Sans','PT Sans','Raleway','Lato','Oswald','Source Sans Pro','Ubuntu','Victor Mono','Work Sans','Gill Sans','Brush Script MT','Optima','Cambria Math'
                                                                                                    ]}
                                                                                                    placeholder="Font adı yazın veya seçin"
                                                                                                />
                                                                                        </div>
                                            <div>
                                                <div className="text-sm text-slate-300">Başlık Boyutu</div>
                                                <input type="number" value={headingFontSize} onChange={(e) => setHeadingFontSize(parseInt(e.target.value||'0'))} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" />
                                            </div>
                                        </div>
                                    </div>
              </div>
              
                
            <div className="text-center py-4">
                <button 
                    onClick={handleGenerateWordColumns} 
                    disabled={activeQuestions.length === 0}
                    className="w-full max-w-sm px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-xl transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto"
                >
                    <DownloadIcon className="w-6 h-6" /> Word Oluştur ({activeQuestions.length} Soru)
                </button>
            </div>
            </section>

            <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-wrap gap-4 justify-between items-center border-b border-slate-700 pb-3 mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-bold text-cyan-400">Soru Havuzu ({questions.length})</h2>
                        <span className="text-sm text-slate-400">{activeQuestions.length} soru seçildi</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="flex items-center gap-2 bg-slate-700 p-1.5 rounded-md border border-slate-600">
                             <input 
                                type="number" 
                                placeholder="Adet" 
                                value={randomCount} 
                                onChange={(e) => setRandomCount(e.target.value)}
                                className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-500"
                             />
                             <button onClick={handleRandomSelect} className="text-xs px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 transition text-white font-bold">Rasgele Seç</button>
                        </div>
                        <button onClick={selectAll} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition">Hepsini Seç</button>
                        <button onClick={deselectAll} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition">Seçimleri Kaldır</button>
                        <button onClick={handleExport} title="Sınav Verilerini İndir (JSON)" className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <DownloadIcon className="w-4 h-4"/> İndir (JSON)
                        </button>
                        <button onClick={handleExportGift} title="Soruları GIFT Formatında İndir" className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <DownloadIcon className="w-4 h-4"/> İndir (GIFT)
                        </button>
                        <label title="Sınav Verilerini Yükle (JSON)" className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <UploadIcon className="w-4 h-4"/> Yükle (JSON)
                            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                        </label>
                         <label title="GIFT Dosyasından Soru Yükle" className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <UploadIcon className="w-4 h-4"/> Yükle (GIFT)
                            <input type="file" accept=".txt" onChange={handleImportGift} className="hidden" />
                        </label>

                        <button
                          onClick={deleteAllQuestions}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Tüm Soruları Sil
                        </button>

                        <button onClick={openEditorForNew} className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 font-semibold transition">
                            <PlusIcon className="w-5 h-5"/> Soru Ekle
                        </button>
                    </div>
                </div>
                <div className="space-y-3">
                    {questions.length === 0 && <p className="text-slate-400 text-center py-4">Henüz soru eklenmedi. Başlamak için 'Soru Ekle' düğmesine tıklayın.</p>}
                    {questions.map((q, index) => (
                        <div 
                            key={q.id} 
                            className={`bg-slate-700 p-4 rounded-md flex justify-between items-start border-l-4 transition-colors ${selectedIds.has(q.id) ? 'border-cyan-500' : 'border-transparent'}`}
                        >
                           <div className="flex items-start gap-4 flex-1 overflow-hidden">
                               <input 
                                   type="checkbox" 
                                   checked={selectedIds.has(q.id)} 
                                   onChange={() => toggleSelection(q.id)}
                                   className="mt-1.5 h-5 w-5 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500 transition cursor-pointer"
                               />
                               <div className="flex-1 overflow-hidden cursor-pointer" onClick={() => toggleSelection(q.id)}>
                                    <p className="font-semibold truncate">{index + 1}. {stripHtml(q.text)}</p>
                                    <p className="text-sm text-green-400 mt-1">Doğru Cevap: {q.correctAnswerIndex >= 0 ? String.fromCharCode(65 + q.correctAnswerIndex) : '-'}</p>
                               </div>
                           </div>
                           <div className="flex items-center space-x-2 ml-4">
                               <button onClick={(e) => { e.stopPropagation(); openEditorForEdit(q); }} className="p-2 text-slate-300 hover:text-cyan-400 transition"><EditIcon /></button>
                               <button onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }} className="p-2 text-slate-300 hover:text-red-500 transition"><TrashIcon /></button>
                           </div>
                        </div>
                    ))}
                </div>
            </section>
            
            <section className="text-center py-4 space-y-3">
                <div className="flex flex-wrap gap-4 justify-center">

                    <button 
                        onClick={handleGenerateWordColumns} 
                        disabled={activeQuestions.length === 0}
                        className="w-full max-w-md px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-xl transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        <DownloadIcon className="w-6 h-6" /> Word Oluştur ({activeQuestions.length} Soru)
                    </button>
                </div>
            </section>
          </main>
        </div>
      </div>

      <QuestionEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveQuestion}
        questionToEdit={editingQuestion}
      />
      

      {/* Modern Modal System */}
      <Modal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </>
  );
};

export default App;
