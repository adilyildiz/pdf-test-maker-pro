
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { TestDetails, Question, Answer } from './types';
import { QuestionEditor } from './components/QuestionEditor';
import { TestPreview } from './components/TestPreview';
import { AnswerKeyPreview } from './components/AnswerKeyPreview';
import { OpticalForm } from './components/OpticalForm';
import { PlusIcon, TrashIcon, EditIcon, SpinnerIcon, DownloadIcon, UploadIcon } from './components/icons';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from 'docx';
import  saveAs  from 'file-saver';

// Declare globals from included scripts to satisfy TypeScript
declare var jspdf: any;
declare var html2canvas: any;

// Helper to strip HTML for plain text previews
const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
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
  const [testDetails, setTestDetails] = useState<TestDetails>({
    schoolYear: '2025 - 2026',
    faculty: 'BİLGİSAYAR VE BİLİŞİM BİLİMLERİ FAKÜLTESİ',
    department: 'DİJİTAL OYUN TASARIMI BÖLÜMÜ',
    course: 'TEMEL BİLGİ TEKNOLOJİLERİ',
    examType: 'ÇOKTAN SEÇMELİ TEST SINAVI',
    booklet: 'A', // Default, will be overridden during generation
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [numberOfBooklets, setNumberOfBooklets] = useState(2);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [currentlyRenderingPage, setCurrentlyRenderingPage] = useState<{ bookletType: string; questions: Question[]; startIndex: number } | null>(null);
  const [currentlyRenderingOpticalForm, setCurrentlyRenderingOpticalForm] = useState<string | null>(null);
  const [answerKeyData, setAnswerKeyData] = useState<Array<{ bookletType: string; questions: Question[] }> | null>(null);
  const [pdfGenerationMessage, setPdfGenerationMessage] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);
  const answerKeyRef = useRef<HTMLDivElement>(null);
  const opticalFormRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pageQueueRef = useRef<Array<{ bookletType: string; questions: Question[]; startIndex: number }>>([]);
  const opticalFormQueueRef = useRef<string[]>([]);
  const isGeneratingRef = useRef<boolean>(false);

  // Load all data from localStorage on initial render
  useEffect(() => {
    try {
        const savedData = localStorage.getItem('pdfTestData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (parsedData.testDetails) setTestDetails(parsedData.testDetails);
            if (parsedData.questions) setQuestions(parsedData.questions);
        }
    } catch (error) {
        console.error("Veri localStorage'dan yüklenemedi", error);
    }
  }, []);

  // Save all data to localStorage whenever it changes
  useEffect(() => {
    try {
        const dataToSave = { testDetails, questions };
        localStorage.setItem('pdfTestData', JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Veri localStorage'a kaydedilemedi", error);
    }
  }, [testDetails, questions]);

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
      setQuestions([...questions, question]);
    }
  };

  const deleteQuestion = (id: string) => {
    if (window.confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
        setQuestions(questions.filter(q => q.id !== id));
    }
  };
  
  const shuffleQuestionsAndAnswers = (originalQuestions: Question[]): Question[] => {
      // Soruları karıştır (originalIndex artık gerekli değil)
      const shuffledQuestions = shuffleArray(originalQuestions);
      
      // Her soru için cevapları karıştır
      return shuffledQuestions.map(q => {
          const validAnswers = q.answers.filter(a => a.text.trim() !== '');
          
          // Eğer geçerli cevap yoksa veya doğru cevap index'i geçersizse, sadece soruyu döndür
          if (validAnswers.length === 0 || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= validAnswers.length) {
             return { 
                 ...q, 
                 answers: q.answers
             };
          }
          
          // Doğru cevabın metnini bul
          const correctAnswerText = validAnswers[q.correctAnswerIndex]?.text;
          
          if (!correctAnswerText) {
             return { 
                 ...q, 
                 answers: shuffleArray(q.answers) 
             };
          }
          
          // Geçerli cevapları karıştır
          const shuffledValidAnswers = shuffleArray(validAnswers);
          
          // Yeni doğru cevap index'ini bul
          const newCorrectIndex = shuffledValidAnswers.findIndex(a => a.text === correctAnswerText);

          // Boş cevapları ekle (eğer 5'ten az cevap varsa)
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
  
  const resetPdfGenerationState = () => {
    isGeneratingRef.current = false;
    setIsGeneratingPdf(false);
    setCurrentlyRenderingPage(null);
    setCurrentlyRenderingOpticalForm(null);
    setAnswerKeyData(null);
    setPdfGenerationMessage('');
    pdfDocRef.current = null;
    pageQueueRef.current = [];
    opticalFormQueueRef.current = [];
  };

  const paginate = useCallback((allQuestions: Question[], bookletDetails: TestDetails): Promise<Question[][]> => {
    return new Promise((resolve, reject) => {
        const A4_CONTENT_HEIGHT_PX = 900; // Use a safe height to avoid overflow
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
                
                // Calculate the start index for this potential page
                const startIndexForMeasure = allQuestions.length - remainingQuestions.length - potentialPageQuestions.length;

                const handleMeasure = (height: number) => {
                    if (height > A4_CONTENT_HEIGHT_PX && currentPageQuestions.length > 0) {
                        pages.push([...currentPageQuestions]);
                        currentPageQuestions = [nextQuestion];
                    } else {
                        currentPageQuestions = potentialPageQuestions;
                    }
                    // Process the next question in the next tick
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

  const handleGeneratePdf = async () => {
    console.log('handleGeneratePdf çağrıldı, isGeneratingRef:', isGeneratingRef.current, 'isGeneratingPdf:', isGeneratingPdf);
    
    if (isGeneratingRef.current) {
        console.warn('PDF zaten oluşturuluyor (ref kontrolü), ikinci çağrı engellendi');
        return;
    }
    
    if (questions.length === 0) {
        alert("PDF oluşturmadan önce lütfen en az bir soru ekleyin.");
        return;
    }

    try {
        isGeneratingRef.current = true;
        setIsGeneratingPdf(true);
        setPdfGenerationMessage('Kitapçıklar hazırlanıyor...');
        
        const { jsPDF } = jspdf;
        pdfDocRef.current = new jsPDF('p', 'mm', 'a4');
        
        const booklets = [];
        for (let i = 0; i < numberOfBooklets; i++) {
            const bookletType = String.fromCharCode(65 + i);
            booklets.push({
                bookletType,
                questions: shuffleQuestionsAndAnswers(JSON.parse(JSON.stringify(questions)))
            });
        }

        setAnswerKeyData([...booklets]);
        
        pageQueueRef.current = [];

        for (const [index, booklet] of booklets.entries()) {
            setPdfGenerationMessage(`Kitapçık ${booklet.bookletType} sayfalara ayrılıyor... (${index + 1}/${booklets.length})`);
            const bookletDetails = { ...testDetails, booklet: booklet.bookletType };
            const paginated = await paginate(booklet.questions, bookletDetails);
            
            console.log(`Kitapçık ${booklet.bookletType}: ${paginated.length} sayfa, ${booklet.questions.length} soru`);
            
            let questionIndex = 0;
            for (const pageQuestions of paginated) {
                pageQueueRef.current.push({
                    bookletType: booklet.bookletType,
                    questions: pageQuestions,
                    startIndex: questionIndex,
                });
                questionIndex += pageQuestions.length;
            }
        }
        
        console.log(`Toplam ${pageQueueRef.current.length} sayfa kuyruğa eklendi`);

        const firstPage = pageQueueRef.current.shift();
        if (firstPage) {
            console.log(`İlk sayfa render için ayarlanıyor: ${firstPage.bookletType}, ${firstPage.questions.length} soru, startIndex: ${firstPage.startIndex}`);
            setCurrentlyRenderingPage(firstPage);
        } else {
            console.warn('Hiç sayfa oluşturulmadı!');
            // No pages to render, move directly to answer key
            setCurrentlyRenderingPage(null); 
        }
    } catch (error) {
        console.error("PDF oluşturma başlatma hatası:", error);
        alert("PDF oluşturma başlatılırken bir hata oluştu. Lütfen konsolu kontrol edin.");
        resetPdfGenerationState();
    }
  };

  const handleExport = () => {
    const dataToExport = { testDetails, questions };
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
    if (questions.length === 0) {
        alert("Dışa aktarılacak soru bulunmuyor.");
        return;
    }

    const escapeGiftText = (text: string): string => {
        return text.replace(/([~=#{}])/g, '\\$1');
    };

    const giftContent = questions.map((q, index) => {
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
           throw new Error("Geçersiz sınav verisi formatı. 'testDetails' ve 'questions' alanları bulunmalıdır.");
        }
  
        if (questions.length > 0 && !window.confirm("Mevcut sınav bilgileri ve soruların üzerine yazılsın mı? Bu işlem geri alınamaz.")) {
           return;
        }
        setTestDetails(importedData.testDetails);
        setQuestions(importedData.questions);
        alert(`Sınav detayları ve ${importedData.questions.length} soru başarıyla yüklendi.`);
  
      } catch (error) {
        console.error("Veri içe aktarma hatası:", error);
        alert("Sınav verisi yüklenirken bir hata oluştu. Lütfen dosyanın doğru formatta olduğundan emin olun.");
      } finally {
          event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const parseGiftFormat = (giftText: string): Question[] => {
    const parsedQuestions: Question[] = [];
    const blocks = giftText.replace(/\r\n/g, '\n').split(/(?:\s*\n){2,}/);

    blocks.forEach((block, blockIndex) => {
        block = block.trim();
        if (!block || block.startsWith('//')) {
            return; // Skip comments and empty blocks
        }

        const questionRegex = /(?:::(.*?)::)?(.*?)\{(.*?)\}/s;
        const match = block.match(questionRegex);

        if (!match) {
            console.warn(`GIFT formatında soru ayrıştırılamadı: Blok ${blockIndex + 1}`);
            return;
        }

        const [, , textContent, answersContent] = match;

        let questionText = textContent.trim();
        if (questionText.startsWith('[html]')) {
            questionText = questionText.substring(6).trim();
        }

        const answerLines = answersContent.trim().split('\n').filter(line => line.trim().match(/^[=~]/));
        
        const answers: Answer[] = [];
        let correctAnswerIndex = -1;

        answerLines.forEach(line => {
            const trimmedLine = line.trim();
            const isCorrect = trimmedLine.startsWith('=');
            
            const text = trimmedLine
                .replace(/^[=~]/, '')
                .replace(/#.*$/, '')
                .replace(/~?%-?\d+(\.\d+)?%/, '')
                .trim();

            if (text) {
                answers.push({ text });
                if (isCorrect) {
                    correctAnswerIndex = answers.length - 1;
                }
            }
        });

        if (questionText && answers.length >= 2 && correctAnswerIndex !== -1) {
            while (answers.length < 5) {
                answers.push({ text: '' });
            }

            parsedQuestions.push({
                id: new Date().toISOString() + `-${blockIndex}-${Math.random()}`,
                text: questionText,
                image: null,
                answers: answers,
                correctAnswerIndex: correctAnswerIndex,
            });
        } else {
            console.warn(`GIFT bloğu geçerli bir soruya dönüştürülemedi: Blok ${blockIndex + 1}`);
        }
    });

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
            alert("Dosya içinde geçerli GIFT formatında soru bulunamadı.");
            return;
        }
  
        if (questions.length > 0 && !window.confirm(`GIFT dosyasından ${importedQuestions.length} soru bulundu. Mevcut sorular silinip yenileri eklensin mi? Bu işlem geri alınamaz.`)) {
           return;
        }
        
        setQuestions(importedQuestions);
        alert(`${importedQuestions.length} soru başarıyla yüklendi.`);
  
      } catch (error) {
        console.error("GIFT verisi içe aktarma hatası:", error);
        alert("GIFT verisi yüklenirken bir hata oluştu. Lütfen dosyanın doğru formatta olduğundan emin olun ve konsolu kontrol edin.");
      } finally {
          event.target.value = ''; // Reset file input
      }
    };
    reader.readAsText(file);
};

  const handleGenerateWord = async () => {
    if (questions.length === 0) {
        alert("Word dosyası oluşturmadan önce lütfen en az bir soru ekleyin.");
        return;
    }

    try {
        const booklets = [];
        for (let i = 0; i < numberOfBooklets; i++) {
            const bookletType = String.fromCharCode(65 + i);
            booklets.push({
                bookletType,
                questions: shuffleQuestionsAndAnswers(JSON.parse(JSON.stringify(questions)))
            });
        }

        const sections = [];

        // Her kitapçık için section oluştur
        for (const booklet of booklets) {
            const children: any[] = [];

            // Başlık bilgileri
            children.push(
                new Paragraph({
                    text: `${testDetails.schoolYear} EĞİTİM - ÖĞRETİM YILI`,
                    heading: HeadingLevel.HEADING_2,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.faculty.toUpperCase()}`,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.department.toUpperCase()}`,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.course.toUpperCase()} DERSİ ${testDetails.examType.toUpperCase()} SORULARI`,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                })
            );

            // Öğrenci bilgileri ve kitapçık
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "AD-SOYAD: ", bold: true }),
                        new TextRun("_____________________________"),
                        new TextRun({ text: "     PUAN: ", bold: true }),
                        new TextRun("_________"),
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "NUMARA: ", bold: true }),
                        new TextRun("_____________________________"),
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    text: `${booklet.bookletType} KİTAPÇIĞI`,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                })
            );

            // Sorular - İki sütunlu tablo ile
            const tableRows: TableRow[] = [];
            
            for (let i = 0; i < booklet.questions.length; i += 2) {
                const leftQuestion = booklet.questions[i];
                const rightQuestion = booklet.questions[i + 1];

                const leftCell = new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${i + 1}. `, bold: true }),
                                new TextRun(stripHtml(leftQuestion.text))
                            ],
                            spacing: { after: 100 }
                        }),
                        ...leftQuestion.answers.filter(a => a.text.trim() !== '').map((ans, idx) => 
                            new Paragraph({
                                text: `${String.fromCharCode(97 + idx)}) ${ans.text}`,
                                spacing: { after: 50 }
                            })
                        )
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                });

                const rightCell = rightQuestion ? new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${i + 2}. `, bold: true }),
                                new TextRun(stripHtml(rightQuestion.text))
                            ],
                            spacing: { after: 100 }
                        }),
                        ...rightQuestion.answers.filter(a => a.text.trim() !== '').map((ans, idx) => 
                            new Paragraph({
                                text: `${String.fromCharCode(97 + idx)}) ${ans.text}`,
                                spacing: { after: 50 }
                            })
                        )
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }) : new TableCell({
                    children: [new Paragraph("")],
                    width: { size: 50, type: WidthType.PERCENTAGE }
                });

                tableRows.push(new TableRow({
                    children: [leftCell, rightCell]
                }));
            }

            const table = new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" }
                }
            });

            children.push(table);

            sections.push({
                properties: {
                    page: {
                        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
                    }
                },
                children
            });
        }

        // Cevap Anahtarı Sayfası
        const answerKeyChildren: any[] = [
            new Paragraph({
                text: `${testDetails.course.toUpperCase()} DERSİ CEVAP ANAHTARI`,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            })
        ];

        // Her kitapçık için cevap anahtarı tablosu oluştur
        for (const booklet of booklets) {
            answerKeyChildren.push(
                new Paragraph({
                    text: `${booklet.bookletType} KİTAPÇIĞI`,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                })
            );

            // Cevapları 4 sütunlu tablo olarak düzenle
            const answerRows: TableRow[] = [];
            const questionsPerRow = 4;
            
            for (let i = 0; i < booklet.questions.length; i += questionsPerRow) {
                const cells: TableCell[] = [];
                
                for (let j = 0; j < questionsPerRow; j++) {
                    const qIndex = i + j;
                    if (qIndex < booklet.questions.length) {
                        const q = booklet.questions[qIndex];
                        cells.push(new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: `${qIndex + 1}. `, bold: true }),
                                        new TextRun({ text: String.fromCharCode(65 + q.correctAnswerIndex), bold: true, size: 24 })
                                    ]
                                })
                            ],
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            margins: { top: 100, bottom: 100, left: 200, right: 200 }
                        }));
                    } else {
                        cells.push(new TableCell({
                            children: [new Paragraph("")],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        }));
                    }
                }
                
                answerRows.push(new TableRow({ children: cells }));
            }

            const answerTable = new Table({
                rows: answerRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    bottom: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    left: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    right: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" }
                }
            });

            answerKeyChildren.push(answerTable);
        }

        sections.push({
            properties: {
                page: {
                    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
                }
            },
            children: answerKeyChildren
        });

        const doc = new Document({
            sections
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `test_${testDetails.course.replace(/\s/g, '_')}.docx`);
        alert('Word dosyası başarıyla oluşturuldu!');

    } catch (error) {
        console.error("Word dosyası oluşturma hatası:", error);
        alert("Word dosyası oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
    }
};

  const handleGenerateWordColumns = async () => {
    if (questions.length === 0) {
        alert("Word dosyası oluşturmadan önce lütfen en az bir soru ekleyin.");
        return;
    }

    try {
        const booklets = [];
        for (let i = 0; i < numberOfBooklets; i++) {
            const bookletType = String.fromCharCode(65 + i);
            booklets.push({
                bookletType,
                questions: shuffleQuestionsAndAnswers(JSON.parse(JSON.stringify(questions)))
            });
        }

        const sections = [];

        // Her kitapçık için section oluştur
        for (const booklet of booklets) {
            const children: any[] = [];

            // Başlık bilgileri
            children.push(
                new Paragraph({
                    text: `${testDetails.schoolYear} EĞİTİM - ÖĞRETİM YILI`,
                    heading: HeadingLevel.HEADING_2,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.faculty.toUpperCase()}`,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.department.toUpperCase()}`,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: `${testDetails.course.toUpperCase()} DERSİ ${testDetails.examType.toUpperCase()} SORULARI`,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                })
            );

            // Öğrenci bilgileri ve kitapçık
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "AD-SOYAD: ", bold: true }),
                        new TextRun("_____________________________"),
                        new TextRun({ text: "     PUAN: ", bold: true }),
                        new TextRun("_________"),
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "NUMARA: ", bold: true }),
                        new TextRun("_____________________________"),
                    ],
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    text: `${booklet.bookletType} KİTAPÇIĞI`,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                })
            );

            // Sorular - Native iki sütun kullanarak
            booklet.questions.forEach((q, index) => {
                // Soru metni - paragraf yapısını koru
                const questionText = htmlToTextWithBreaks(q.text);
                const questionLines = questionText.split('\n').filter(line => line.trim() !== '');
                
                questionLines.forEach((line, lineIndex) => {
                    if (lineIndex === 0) {
                        // İlk satırda soru numarasını ekle
                        children.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: `${index + 1}. `, bold: true }),
                                    new TextRun({ text: line.trim() })
                                ],
                                spacing: { after: 100 }
                            })
                        );
                    } else {
                        // Diğer satırları girintili olarak ekle
                        children.push(
                            new Paragraph({
                                text: line.trim(),
                                spacing: { after: 100 },
                                indent: { left: 200 }
                            })
                        );
                    }
                });

                // Cevap şıkları
                q.answers.filter(a => a.text.trim() !== '').forEach((ans, idx) => {
                    children.push(
                        new Paragraph({
                            text: `${String.fromCharCode(97 + idx)}) ${ans.text}`,
                            spacing: { after: 50 },
                            indent: { left: 360 }
                        })
                    );
                });

                // Sorular arasında boşluk
                children.push(
                    new Paragraph({
                        text: "",
                        spacing: { after: 200 }
                    })
                );
            });

            sections.push({
                properties: {
                    page: {
                        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
                    },
                    column: {
                        space: 708, // 708 twips = yaklaşık 1.25 cm
                        count: 2,
                        separate: true
                    }
                },
                children
            });
        }

        // Cevap Anahtarı Sayfası
        const answerKeyChildren: any[] = [
            new Paragraph({
                text: `${testDetails.course.toUpperCase()} DERSİ CEVAP ANAHTARI`,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            })
        ];

        // Her kitapçık için cevap anahtarı tablosu oluştur
        for (const booklet of booklets) {
            answerKeyChildren.push(
                new Paragraph({
                    text: `${booklet.bookletType} KİTAPÇIĞI`,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                })
            );

            // Cevapları 4 sütunlu tablo olarak düzenle
            const answerRows: TableRow[] = [];
            const questionsPerRow = 4;
            
            for (let i = 0; i < booklet.questions.length; i += questionsPerRow) {
                const cells: TableCell[] = [];
                
                for (let j = 0; j < questionsPerRow; j++) {
                    const qIndex = i + j;
                    if (qIndex < booklet.questions.length) {
                        const q = booklet.questions[qIndex];
                        cells.push(new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: `${qIndex + 1}. `, bold: true }),
                                        new TextRun({ text: String.fromCharCode(65 + q.correctAnswerIndex), bold: true, size: 24 })
                                    ]
                                })
                            ],
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            margins: { top: 100, bottom: 100, left: 200, right: 200 }
                        }));
                    } else {
                        cells.push(new TableCell({
                            children: [new Paragraph("")],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        }));
                    }
                }
                
                answerRows.push(new TableRow({ children: cells }));
            }

            const answerTable = new Table({
                rows: answerRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    bottom: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    left: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    right: { style: BorderStyle.SINGLE, size: 10, color: "CCCCCC" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 5, color: "EEEEEE" }
                }
            });

            answerKeyChildren.push(answerTable);
        }

        sections.push({
            properties: {
                page: {
                    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
                }
            },
            children: answerKeyChildren
        });

        const doc = new Document({
            sections
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `test_${testDetails.course.replace(/\s/g, '_')}_2sutun.docx`);
        alert('Word dosyası (2 Sütun) başarıyla oluşturuldu!');

    } catch (error) {
        console.error("Word dosyası oluşturma hatası:", error);
        alert("Word dosyası oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
    }
};
  
  // Effect to handle rendering of test pages
  useEffect(() => {
    if (!isGeneratingPdf) return;

    if (currentlyRenderingPage) {
        const generatePage = async () => {
          if (!previewRef.current) {
              console.error('Preview ref not ready, retrying...');
              // Retry after a short delay
              setTimeout(() => {
                  if (currentlyRenderingPage) {
                      setCurrentlyRenderingPage({...currentlyRenderingPage});
                  }
              }, 100);
              return;
          }
          
          const currentPageNum = pdfDocRef.current.internal.getNumberOfPages();
          setPdfGenerationMessage(`Sayfa ${currentPageNum} render ediliyor (${currentlyRenderingPage.questions.length} soru)...`);
          
          console.log('PreviewRef içeriği:', {
            hasRef: !!previewRef.current,
            scrollHeight: previewRef.current?.scrollHeight,
            childrenCount: previewRef.current?.children.length
          });
          
          try {
            // Render'ın tamamlanması için kısa bir bekleme
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const canvas = await html2canvas(previewRef.current, { 
                scale: 2,
                logging: true,
                useCORS: true,
                allowTaint: true
            });
            
            console.log('Canvas oluşturuldu:', {
                width: canvas.width,
                height: canvas.height,
                isEmpty: canvas.width === 0 || canvas.height === 0
            });
            
            if (canvas.width === 0 || canvas.height === 0) {
                console.error('Canvas boş! Render edilemiyor.');
                alert('Sayfa render hatası: Canvas boş. Lütfen konsolda hata detaylarını kontrol edin.');
                resetPdfGenerationState();
                return;
            }
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            const pdf = pdfDocRef.current;
            
            // İlk sayfayı kontrol et - eğer boşsa yeni sayfa ekleme
            const isFirstPage = pdf.internal.getNumberOfPages() === 1;
            if (!isFirstPage) {
                pdf.addPage();
            }

            const a4Width_mm = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * a4Width_mm) / imgProps.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, a4Width_mm, pdfHeight);

            console.log(`Sayfa eklendi. Kuyruktaki sayfa sayısı: ${pageQueueRef.current.length}`);
            
            const nextPage = pageQueueRef.current.shift();
            if (nextPage) {
                console.log(`Sonraki sayfa: ${nextPage.bookletType}, ${nextPage.questions.length} soru, startIndex: ${nextPage.startIndex}`);
                setCurrentlyRenderingPage(nextPage);
            } else {
                console.log('Tüm sayfalar tamamlandı, cevap anahtarına geçiliyor');
                // Tüm sayfalar tamamlandı, cevap anahtarına geç
                setCurrentlyRenderingPage(null);
            }
          } catch (error) {
            console.error("PDF sayfası oluşturma hatası:", error);
            alert("PDF oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
            resetPdfGenerationState();
          }
        };
        const timer = setTimeout(generatePage, 200);
        return () => clearTimeout(timer);
    } else if (answerKeyData && !currentlyRenderingPage && pageQueueRef.current.length === 0) {
        // All pages are rendered, move to Answer Key and Optical Forms
        const generatePostPages = async () => {
            try {
                // 1. Generate Answer Key
                if (answerKeyRef.current) {
                    setPdfGenerationMessage('Cevap anahtarı oluşturuluyor...');
                    const answerCanvas = await html2canvas(answerKeyRef.current, { scale: 2 });
                    const answerImgData = answerCanvas.toDataURL('image/jpeg', 0.95);
                    const pdf = pdfDocRef.current;
                    pdf.addPage();
                    const a4Width_mm = pdf.internal.pageSize.getWidth();
                    const answerImgProps = pdf.getImageProperties(answerImgData);
                    const answerPdfHeight = (answerImgProps.height * a4Width_mm) / answerImgProps.width;
                    pdf.addImage(answerImgData, 'JPEG', 0, 0, a4Width_mm, answerPdfHeight);
                }
                
                // 2. Start optical form queue
                const opticalFormBooklets = answerKeyData?.map(b => b.bookletType) ?? [];
                opticalFormQueueRef.current = opticalFormBooklets;

                const nextFormBooklet = opticalFormQueueRef.current.shift();
                if (nextFormBooklet) {
                    setCurrentlyRenderingOpticalForm(nextFormBooklet);
                } else {
                    pdfDocRef.current.save(`test_${testDetails.course.replace(/\s/g, '_')}_cevapli.pdf`);
                    resetPdfGenerationState();
                }

            } catch (error) {
                console.error("Cevap anahtarı oluştururken hata:", error);
                alert("Cevap anahtarı oluşturulurken bir hata oluştu. PDF kaydedilemiyor.");
                resetPdfGenerationState();
            }
        };
        const timer = setTimeout(generatePostPages, 100);
        return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf, currentlyRenderingPage, answerKeyData]);

  // Effect to handle rendering of optical forms
  useEffect(() => {
    if (!isGeneratingPdf || !currentlyRenderingOpticalForm) return;

    const generateFormPage = async () => {
        if (!opticalFormRef.current) return;
        
        const totalForms = answerKeyData?.length ?? 0;
        const currentFormIndex = totalForms - opticalFormQueueRef.current.length;
        
        setPdfGenerationMessage(`Optik form oluşturuluyor: ${currentlyRenderingOpticalForm} (${currentFormIndex}/${totalForms})`);

        try {
            const pdf = pdfDocRef.current;
            const canvas = await html2canvas(opticalFormRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            pdf.addPage();
            const a4Width_mm = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * a4Width_mm) / imgProps.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, a4Width_mm, pdfHeight);

            const nextFormBooklet = opticalFormQueueRef.current.shift();
            if (nextFormBooklet) {
                setCurrentlyRenderingOpticalForm(nextFormBooklet);
            } else {
                setPdfGenerationMessage('PDF kaydediliyor...');
                pdf.save(`test_${testDetails.course.replace(/\s/g, '_')}_cevapli_optik.pdf`);
                resetPdfGenerationState();
            }
        } catch (error) {
            console.error("Optik form sayfası oluşturma hatası:", error);
            alert("Optik form oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
            resetPdfGenerationState();
        }
    };
    
    const timer = setTimeout(generateFormPage, 100);
    return () => clearTimeout(timer);
  }, [isGeneratingPdf, currentlyRenderingOpticalForm, testDetails.course, answerKeyData]);

  // Debug için
  useEffect(() => {
    if (isGeneratingPdf && currentlyRenderingPage) {
      console.log('Render ediliyor:', {
        booklet: currentlyRenderingPage.bookletType,
        questionCount: currentlyRenderingPage.questions.length,
        startIndex: currentlyRenderingPage.startIndex,
        firstQuestionText: currentlyRenderingPage.questions[0]?.text?.substring(0, 50)
      });
    }
  }, [currentlyRenderingPage, isGeneratingPdf]);

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
              </div>
            </section>

            <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-wrap gap-4 justify-between items-center border-b border-slate-700 pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-cyan-400">Sorular ({questions.length})</h2>
                    <div className="flex items-center flex-wrap gap-3">
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
                        <button onClick={openEditorForNew} className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 font-semibold transition">
                            <PlusIcon className="w-5 h-5"/> Soru Ekle
                        </button>
                    </div>
                </div>
                <div className="space-y-3">
                    {questions.length === 0 && <p className="text-slate-400 text-center py-4">Henüz soru eklenmedi. Başlamak için 'Soru Ekle' düğmesine tıklayın.</p>}
                    {questions.map((q, index) => (
                        <div key={q.id} className="bg-slate-700 p-4 rounded-md flex justify-between items-start">
                           <div className="flex-1 overflow-hidden">
                                <p className="font-semibold truncate">{index + 1}. {stripHtml(q.text)}</p>
                                <p className="text-sm text-green-400 mt-1">Doğru Cevap: {String.fromCharCode(65 + q.correctAnswerIndex)}</p>
                           </div>
                           <div className="flex items-center space-x-2 ml-4">
                               <button onClick={() => openEditorForEdit(q)} className="p-2 text-slate-300 hover:text-cyan-400 transition"><EditIcon /></button>
                               <button onClick={() => deleteQuestion(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition"><TrashIcon /></button>
                           </div>
                        </div>
                    ))}
                </div>
            </section>
            
            <section className="text-center py-4">
                <button 
                    onClick={handleGenerateWordColumns} 
                    disabled={questions.length === 0}
                    className="w-full max-w-sm px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-xl transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto"
                >
                    <DownloadIcon className="w-6 h-6" /> Word Oluştur
                </button>
                {questions.length === 0 && <p className="text-sm text-yellow-400 mt-2">Word dosyası oluşturmak için en az bir soru ekleyin.</p>}
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
      
      <div className="absolute -left-[9999px] top-0">
        {isGeneratingPdf && currentlyRenderingPage && (
            <TestPreview 
              innerRef={previewRef} 
              details={{...testDetails, booklet: currentlyRenderingPage.bookletType}} 
              questions={currentlyRenderingPage.questions} 
              startIndex={currentlyRenderingPage.startIndex} 
            />
        )}
        {isGeneratingPdf && !currentlyRenderingPage && answerKeyData && pageQueueRef.current.length === 0 && (
          <AnswerKeyPreview
            innerRef={answerKeyRef}
            booklets={answerKeyData}
            courseName={testDetails.course}
          />
        )}
        {isGeneratingPdf && currentlyRenderingOpticalForm && (
          <OpticalForm
              innerRef={opticalFormRef}
              booklet={currentlyRenderingOpticalForm}
              questionCount={questions.length}
          />
        )}
      </div>
    </>
  );
};

export default App;